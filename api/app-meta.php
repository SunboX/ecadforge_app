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
 * Reads the first non-empty version string from known deployment metadata.
 *
 * @param list<string> $filePaths
 * @return string
 */
function readAppVersion(array $filePaths): string
{
    foreach ($filePaths as $filePath) {
        if (!is_file($filePath) || !is_readable($filePath)) {
            continue;
        }

        $raw = file_get_contents($filePath);
        if (!is_string($raw) || $raw === '') {
            continue;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded) || !array_key_exists('version', $decoded)) {
            continue;
        }

        $version = trim((string) $decoded['version']);
        if ($version !== '') {
            return $version;
        }
    }

    return '';
}

$version = readAppVersion([
    __DIR__ . DIRECTORY_SEPARATOR . 'app-version.json',
    dirname(__DIR__) . DIRECTORY_SEPARATOR . 'package.json'
]);

echo json_encode(['version' => $version], JSON_UNESCAPED_SLASHES);
