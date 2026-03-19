<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Reads the package version from one deployment metadata file.
 *
 * @param string $filePath
 * @return string
 */
function readAppVersion(string $filePath): string
{
    if (!is_file($filePath) || !is_readable($filePath)) {
        return '';
    }

    $raw = file_get_contents($filePath);
    if (!is_string($raw) || $raw === '') {
        return '';
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || !array_key_exists('version', $decoded)) {
        return '';
    }

    return trim((string) $decoded['version']);
}

$version = readAppVersion(
    dirname(__DIR__) . DIRECTORY_SEPARATOR . 'package.json'
);

echo json_encode(['version' => $version], JSON_UNESCAPED_SLASHES);
