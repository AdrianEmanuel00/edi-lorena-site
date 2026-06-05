<?php

declare(strict_types=1);

const SESSION_MAX_AGE_SECONDS = 28800;

function app_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $configFile = __DIR__ . '/config.php';
    $localConfig = file_exists($configFile) ? require $configFile : [];
    if (!is_array($localConfig)) {
        $localConfig = [];
    }

    $config = array_merge([
        'db_host' => getenv('DB_HOST') ?: 'localhost',
        'db_name' => getenv('DB_NAME') ?: '',
        'db_user' => getenv('DB_USER') ?: '',
        'db_password' => getenv('DB_PASSWORD') ?: '',
        'admin_user' => getenv('ADMIN_USER') ?: 'admin',
        'admin_password' => getenv('ADMIN_PASSWORD') ?: 'lagoo2026',
        'admin_password_hash' => getenv('ADMIN_PASSWORD_HASH') ?: '',
        'session_name' => getenv('SESSION_NAME') ?: 'edi_lorena_admin',
    ], $localConfig);

    return $config;
}

function json_response(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function require_method(array $methods): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', $methods, true)) {
        json_response(405, ['ok' => false, 'message' => 'Metodă neacceptată.']);
    }
}

function handle_api(callable $handler): void
{
    try {
        $handler();
    } catch (InvalidArgumentException $error) {
        json_response(400, ['ok' => false, 'message' => $error->getMessage()]);
    } catch (Throwable $error) {
        json_response(500, ['ok' => false, 'message' => $error->getMessage()]);
    }
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if (trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new InvalidArgumentException('Datele trimise nu sunt valide.');
    }

    return $data;
}

function sanitize_text(mixed $value, int $maxLength = 240): string
{
    $text = trim((string) ($value ?? ''));
    $text = preg_replace('/\s+/u', ' ', $text) ?? '';

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $maxLength, 'UTF-8');
    }

    return substr($text, 0, $maxLength);
}

function now_iso(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = app_config();
    if (!$config['db_name'] || !$config['db_user']) {
        throw new RuntimeException('Configurația MySQL lipsește. Creează public/api/config.php după modelul config.example.php.');
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=utf8mb4',
        $config['db_host'],
        $config['db_name']
    );

    $pdo = new PDO($dsn, $config['db_user'], $config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    ensure_schema($pdo);
    return $pdo;
}

function ensure_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS rsvps (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            response_type VARCHAR(24) NOT NULL,
            message TEXT NULL,
            submitted_at VARCHAR(40) NOT NULL,
            updated_at VARCHAR(40) NULL,
            guest_count INT NOT NULL DEFAULT 0,
            primary_name VARCHAR(180) NOT NULL,
            guests_json LONGTEXT NOT NULL,
            INDEX idx_response_type (response_type),
            INDEX idx_submitted_at (submitted_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function start_admin_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $config = app_config();
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    session_name($config['session_name'] ?: 'edi_lorena_admin');
    session_set_cookie_params([
        'lifetime' => SESSION_MAX_AGE_SECONDS,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function password_matches(string $password): bool
{
    $config = app_config();
    if (!empty($config['admin_password_hash'])) {
        return password_verify($password, $config['admin_password_hash']);
    }

    return hash_equals((string) $config['admin_password'], $password);
}

function is_authenticated(): bool
{
    start_admin_session();
    $config = app_config();

    return isset($_SESSION['admin_user'], $_SESSION['admin_expires'])
        && $_SESSION['admin_user'] === $config['admin_user']
        && (int) $_SESSION['admin_expires'] > time();
}

function require_auth(): void
{
    if (!is_authenticated()) {
        json_response(401, ['ok' => false, 'message' => 'Autentificare necesară.']);
    }

    $_SESSION['admin_expires'] = time() + SESSION_MAX_AGE_SECONDS;
}

function normalize_rsvp(array $input, ?array $existing = null): array
{
    $responseType = sanitize_text($input['responseType'] ?? '', 24);
    if (!in_array($responseType, ['attend', 'decline'], true)) {
        throw new InvalidArgumentException('Alegeți o opțiune validă de confirmare.');
    }

    $base = [
        'id' => $existing['id'] ?? uuid_v4(),
        'responseType' => $responseType,
        'message' => sanitize_text($input['message'] ?? '', 1000),
        'submittedAt' => $existing['submittedAt'] ?? now_iso(),
    ];

    if ($existing) {
        $base['updatedAt'] = now_iso();
    }

    if ($responseType === 'decline') {
        $firstName = sanitize_text($input['firstName'] ?? '', 80);
        $lastName = sanitize_text($input['lastName'] ?? '', 80);
        if (!$firstName || !$lastName) {
            throw new InvalidArgumentException('Completați prenumele și numele.');
        }

        return array_merge($base, [
            'guestCount' => 0,
            'primaryName' => trim($firstName . ' ' . $lastName),
            'guests' => [[
                'firstName' => $firstName,
                'lastName' => $lastName,
                'menu' => '',
            ]],
        ]);
    }

    $guests = $input['guests'] ?? [];
    if (!is_array($guests) || count($guests) < 1 || count($guests) > 8) {
        throw new InvalidArgumentException('Selectați între 1 și 8 persoane.');
    }

    $normalizedGuests = [];
    foreach ($guests as $index => $guest) {
        $guest = is_array($guest) ? $guest : [];
        $firstName = sanitize_text($guest['firstName'] ?? '', 80);
        $lastName = sanitize_text($guest['lastName'] ?? '', 80);
        $menu = sanitize_text($guest['menu'] ?? '', 80);

        if (!$firstName || !$lastName || !$menu) {
            throw new InvalidArgumentException('Completați toate câmpurile pentru persoana ' . ($index + 1) . '.');
        }

        $normalizedGuests[] = [
            'firstName' => $firstName,
            'lastName' => $lastName,
            'menu' => $menu,
        ];
    }

    return array_merge($base, [
        'guestCount' => count($normalizedGuests),
        'primaryName' => trim($normalizedGuests[0]['firstName'] . ' ' . $normalizedGuests[0]['lastName']),
        'guests' => $normalizedGuests,
    ]);
}

function row_to_rsvp(array $row): array
{
    $guests = json_decode($row['guests_json'] ?? '[]', true);
    if (!is_array($guests)) {
        $guests = [];
    }

    $rsvp = [
        'id' => $row['id'],
        'responseType' => $row['response_type'],
        'message' => $row['message'] ?? '',
        'submittedAt' => $row['submitted_at'],
        'guestCount' => (int) $row['guest_count'],
        'primaryName' => $row['primary_name'],
        'guests' => $guests,
    ];

    if (!empty($row['updated_at'])) {
        $rsvp['updatedAt'] = $row['updated_at'];
    }

    return $rsvp;
}

function save_rsvp(array $rsvp): void
{
    $stmt = db()->prepare(
        "INSERT INTO rsvps
            (id, response_type, message, submitted_at, updated_at, guest_count, primary_name, guests_json)
         VALUES
            (:id, :response_type, :message, :submitted_at, :updated_at, :guest_count, :primary_name, :guests_json)"
    );
    $stmt->execute([
        ':id' => $rsvp['id'],
        ':response_type' => $rsvp['responseType'],
        ':message' => $rsvp['message'],
        ':submitted_at' => $rsvp['submittedAt'],
        ':updated_at' => $rsvp['updatedAt'] ?? null,
        ':guest_count' => $rsvp['guestCount'],
        ':primary_name' => $rsvp['primaryName'],
        ':guests_json' => json_encode($rsvp['guests'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

function list_rsvps(): array
{
    $stmt = db()->query('SELECT * FROM rsvps ORDER BY submitted_at DESC, id DESC');
    return array_map('row_to_rsvp', $stmt->fetchAll());
}

function find_rsvp(string $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM rsvps WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch();

    return $row ? row_to_rsvp($row) : null;
}

function update_rsvp(string $id, array $rsvp): void
{
    $stmt = db()->prepare(
        "UPDATE rsvps
         SET response_type = :response_type,
             message = :message,
             updated_at = :updated_at,
             guest_count = :guest_count,
             primary_name = :primary_name,
             guests_json = :guests_json
         WHERE id = :id"
    );
    $stmt->execute([
        ':id' => $id,
        ':response_type' => $rsvp['responseType'],
        ':message' => $rsvp['message'],
        ':updated_at' => $rsvp['updatedAt'] ?? now_iso(),
        ':guest_count' => $rsvp['guestCount'],
        ':primary_name' => $rsvp['primaryName'],
        ':guests_json' => json_encode($rsvp['guests'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
}

function delete_rsvp(string $id): bool
{
    $stmt = db()->prepare('DELETE FROM rsvps WHERE id = :id');
    $stmt->execute([':id' => $id]);

    return $stmt->rowCount() > 0;
}
