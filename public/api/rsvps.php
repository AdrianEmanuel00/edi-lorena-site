<?php

require __DIR__ . '/bootstrap.php';

handle_api(function (): void {
    require_method(['GET']);
    require_auth();

    json_response(200, ['ok' => true, 'rsvps' => list_rsvps()]);
});
