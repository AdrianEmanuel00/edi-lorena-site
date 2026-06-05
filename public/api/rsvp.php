<?php

require __DIR__ . '/bootstrap.php';

handle_api(function (): void {
    require_method(['POST']);

    $rsvp = normalize_rsvp(read_json_body());
    save_rsvp($rsvp);

    json_response(201, ['ok' => true, 'id' => $rsvp['id']]);
});
