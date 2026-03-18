<?php
declare(strict_types=1);

$publicRoot = __DIR__ . '/public_html/CTF';
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($requestPath === '/') {
    $requestPath = '/CTF/';
}

if ($requestPath === '/CTF') {
    $relativePath = '/';
} elseif (str_starts_with($requestPath, '/CTF/')) {
    $relativePath = substr($requestPath, 4);
} else {
    http_response_code(404);
    echo 'Open /CTF/';
    return true;
}

$target = realpath($publicRoot . $relativePath);

if ($target !== false && str_starts_with($target, realpath($publicRoot) ?: $publicRoot) && is_file($target)) {
    return false;
}

if (str_starts_with($relativePath, '/api/') || $relativePath === '/api') {
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
