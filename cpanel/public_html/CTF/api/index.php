<?php
declare(strict_types=1);

require __DIR__ . '/lib/backend.php';

try {
    handle_request();
} catch (Throwable $error) {
    error_log((string) $error);
    send_json(500, ['message' => $error->getMessage() ?: 'Internal server error']);
}
