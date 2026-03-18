<?php
declare(strict_types=1);

$publicRoot = __DIR__ . '/public_html';
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$target = realpath($publicRoot . $requestPath);

if ($target !== false && str_starts_with($target, realpath($publicRoot) ?: $publicRoot) && is_file($target)) {
    return false;
}

if (str_starts_with($requestPath, '/api/')) {
    require $publicRoot . '/api/index.php';
    return true;
}

$indexFile = $publicRoot . '/index.html';
if (is_file($indexFile)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($indexFile);
    return true;
}

http_response_code(404);
echo 'Frontend build not found.';
