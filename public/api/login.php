<?php

require __DIR__ . '/bootstrap.php';

handle_api(function (): void {
    require_method(['POST']);

    $body = read_json_body();
    $config = app_config();
    $username = sanitize_text($body['username'] ?? '', 120);
    $password = (string) ($body['password'] ?? '');

    if ($username !== $config['admin_user'] || !password_matches($password)) {
        json_response(401, ['ok' => false, 'message' => 'Date de autentificare incorecte.']);
    }

    start_admin_session();
    session_regenerate_id(true);
    $_SESSION['admin_user'] = $config['admin_user'];
    $_SESSION['admin_expires'] = time() + SESSION_MAX_AGE_SECONDS;

    json_response(200, ['ok' => true]);
});
