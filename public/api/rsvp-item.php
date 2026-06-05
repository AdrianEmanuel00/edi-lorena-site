<?php

require __DIR__ . '/bootstrap.php';

handle_api(function (): void {
    require_method(['PUT', 'DELETE']);
    require_auth();

    $id = sanitize_text($_GET['id'] ?? '', 80);
    if (!$id) {
        throw new InvalidArgumentException('Răspunsul nu a fost găsit.');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        if (!delete_rsvp($id)) {
            throw new InvalidArgumentException('Răspunsul nu a fost găsit.');
        }

        json_response(200, ['ok' => true]);
    }

    $existing = find_rsvp($id);
    if (!$existing) {
        throw new InvalidArgumentException('Răspunsul nu a fost găsit.');
    }

    $updatedRsvp = normalize_rsvp(read_json_body(), $existing);
    update_rsvp($id, $updatedRsvp);

    json_response(200, ['ok' => true, 'rsvp' => $updatedRsvp]);
});
