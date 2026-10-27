<?php

declare(strict_types=1);

$startedAt = hrtime(true);
require_once __DIR__ . '/server/MinimalUsage.php';
require_once __DIR__ . '/server/ServerStatistics.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'HEAD'], true)) {
    http_response_code(405);
    header('Allow: GET, HEAD');
    exit;
}
if (!is_readable(__DIR__ . '/index.html')) {
    http_response_code(503);
    exit;
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
if (MinimalUsage::payload($_SERVER) !== null) {
    header('X-Usage-Mode: daily-server-count');
    header('X-Server-Statistics: ' . ServerStatistics::readiness($_SERVER));
}
if ($method === 'GET') {
    $bytes = readfile(__DIR__ . '/index.html');
    $delivered = $bytes !== false;
    $durationMs = (hrtime(true) - $startedAt) / 1000000;
    // Where supported, finish serving the viewer before sending the anonymous count.
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
    if ($delivered) {
        MinimalUsage::record($_SERVER);
        ServerStatistics::record($_SERVER, ['bytes' => $bytes, 'duration_ms' => $durationMs]);
    }
}
