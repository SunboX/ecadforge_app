<?php
declare(strict_types=1);

const EASYEDA_SEARCH_API = 'https://pro.lceda.cn/api/szlcsc/eda/product/list';
const EASYEDA_COMPONENT_API = 'https://pro.lceda.cn/api/components/';
const EASYEDA_STEP_API = 'https://modules.lceda.cn/qAxj6KHrDKw4blvCG8QJPs7Y/';

/**
 * Sends a JSON response.
 *
 * @param array<string, mixed> $payload
 * @param int $status
 * @return void
 */
function sendJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Returns a configured source URL.
 *
 * @param string $key
 * @param string $fallback
 * @return string
 */
function sourceUrl(string $key, string $fallback): string
{
    $value = getenv($key);
    return is_string($value) && trim($value) !== '' ? trim($value) : $fallback;
}

/**
 * Returns the configured upstream request timeout.
 *
 * @return int
 */
function sourceTimeoutSeconds(): int
{
    $value = getenv('ECAD_FORGE_COMPONENT_SOURCE_TIMEOUT_SECONDS');
    $parsed = filter_var($value, FILTER_VALIDATE_INT);
    return is_int($parsed) && $parsed > 0 ? min(30, $parsed) : 5;
}

/**
 * Builds one URL with query parameters.
 *
 * @param string $baseUrl
 * @param array<string, string> $query
 * @return string
 */
function buildUrl(string $baseUrl, array $query = []): string
{
    if (!$query) {
        return $baseUrl;
    }

    return $baseUrl . (str_contains($baseUrl, '?') ? '&' : '?') . http_build_query($query);
}

/**
 * Performs an upstream GET request.
 *
 * @param string $url
 * @return string
 */
function fetchUpstream(string $url): string
{
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => sourceTimeoutSeconds(),
            'header' => "User-Agent: ECAD-Forge/1\r\nAccept: */*\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    if (!is_string($body)) {
        throw new RuntimeException('Upstream request failed.');
    }

    return $body;
}

/**
 * Decodes upstream JSON.
 *
 * @param string $url
 * @return array<string, mixed>
 */
function fetchJson(string $url): array
{
    $decoded = json_decode(fetchUpstream($url), true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Upstream JSON was invalid.');
    }

    return $decoded;
}

/**
 * Sanitizes a search term.
 *
 * @param mixed $value
 * @return string
 */
function sanitizeSearchTerm(mixed $value): string
{
    return substr(trim((string) $value), 0, 120);
}

/**
 * Sanitizes a result limit.
 *
 * @param mixed $value
 * @return int
 */
function sanitizeLimit(mixed $value): int
{
    $parsed = filter_var($value, FILTER_VALIDATE_INT);
    if (!is_int($parsed)) {
        return 5;
    }

    return max(1, min(20, $parsed));
}

/**
 * Sanitizes a source id.
 *
 * @param mixed $value
 * @return string
 */
function sanitizeSourceId(mixed $value): string
{
    $normalized = trim((string) $value);
    return preg_match('/^[A-Za-z0-9_-]{1,128}$/', $normalized) === 1 ? $normalized : '';
}

/**
 * Reads a nested string field.
 *
 * @param mixed $value
 * @param array<int, string> $path
 * @return string
 */
function nestedString(mixed $value, array $path): string
{
    $cursor = $value;
    foreach ($path as $key) {
        if (!is_array($cursor) || !array_key_exists($key, $cursor)) {
            return '';
        }
        $cursor = $cursor[$key];
    }

    return is_string($cursor) ? trim($cursor) : '';
}

/**
 * Normalizes one source search row.
 *
 * @param mixed $row
 * @param int $index
 * @return array<string, mixed>
 */
function normalizeSearchRow(mixed $row, int $index): array
{
    if (!is_array($row)) {
        return [];
    }

    $attributes = isset($row['attributes']) && is_array($row['attributes'])
        ? $row['attributes']
        : [];
    $modelSeedId = trim((string) ($attributes['3D Model'] ?? ''));
    $productCode = trim((string) ($row['product_code'] ?? ($attributes['Supplier Part'] ?? '')));
    $fallbackId = trim((string) ($row['uuid'] ?? $productCode));
    $displayName = trim((string) ($row['display_title'] ?? ($row['title'] ?? ($productCode ?: $fallbackId))));

    return [
        'id' => $modelSeedId ?: $fallbackId,
        'name' => $displayName ?: 'component-' . (string) ($index + 1),
        'manufacturer' => trim((string) ($attributes['Manufacturer'] ?? '')),
        'productCode' => $productCode,
        'modelSeedId' => $modelSeedId,
    ];
}

/**
 * Sorts exact supplier-code matches first.
 *
 * @param string $query
 * @param array<int, array<string, mixed>> $rows
 * @return array<int, array<string, mixed>>
 */
function preferExactSupplierPart(string $query, array $rows): array
{
    $normalized = strtolower(trim($query));
    if (preg_match('/^c\d+$/', $normalized) !== 1) {
        return $rows;
    }

    usort($rows, static function (array $left, array $right) use ($normalized): int {
        $leftMatch = strtolower((string) ($left['productCode'] ?? '')) === $normalized;
        $rightMatch = strtolower((string) ($right['productCode'] ?? '')) === $normalized;
        return (int) $rightMatch <=> (int) $leftMatch;
    });

    return $rows;
}

/**
 * Handles component search.
 *
 * @return void
 */
function handleSearch(): void
{
    $query = sanitizeSearchTerm($_GET['q'] ?? '');
    if ($query === '') {
        sendJson(['error' => 'Search query is required.'], 400);
    }

    $payload = fetchJson(buildUrl(sourceUrl('ECAD_FORGE_EASYEDA_SEARCH_API', EASYEDA_SEARCH_API), [
        'wd' => $query,
    ]));
    $rawRows = isset($payload['result']) && is_array($payload['result'])
        ? $payload['result']
        : [];
    $rows = [];
    foreach ($rawRows as $index => $row) {
        $normalized = normalizeSearchRow($row, (int) $index);
        if (($normalized['id'] ?? '') !== '') {
            $rows[] = $normalized;
        }
    }

    $rows = preferExactSupplierPart($query, $rows);
    sendJson(['results' => array_slice($rows, 0, sanitizeLimit($_GET['limit'] ?? null))]);
}

/**
 * Handles component detail.
 *
 * @param string $id
 * @return void
 */
function handleComponent(string $id): void
{
    $sourceId = sanitizeSourceId($id);
    if ($sourceId === '') {
        sendJson(['error' => 'Invalid component id.'], 400);
    }

    $baseUrl = rtrim(sourceUrl('ECAD_FORGE_EASYEDA_COMPONENT_API', EASYEDA_COMPONENT_API), '/') . '/';
    $detail = fetchJson(buildUrl($baseUrl . rawurlencode($sourceId), [
        'uuid' => $sourceId,
    ]));
    $modelId = nestedString($detail, ['result', '3d_model_uuid']) ?: $sourceId;
    sendJson([
        'id' => $sourceId,
        'models' => [[
            'name' => $modelId . '.step',
            'format' => 'step',
            'sourceUrl' => 'models/' . $modelId . '.step',
        ]],
    ]);
}

/**
 * Handles STEP model download.
 *
 * @param string $id
 * @return void
 */
function handleModel(string $id): void
{
    $modelId = sanitizeSourceId($id);
    if ($modelId === '') {
        sendJson(['error' => 'Invalid model id.'], 400);
    }

    $baseUrl = rtrim(sourceUrl('ECAD_FORGE_EASYEDA_STEP_API', EASYEDA_STEP_API), '/') . '/';
    $bytes = fetchUpstream($baseUrl . rawurlencode($modelId));
    http_response_code(200);
    header('Content-Type: model/step');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo $bytes;
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    sendJson(['error' => 'Method not allowed'], 405);
}

$path = trim((string) ($_GET['path'] ?? ''), '/');

try {
    if ($path === 'search') {
        handleSearch();
    }

    if (preg_match('/^components\/([^\/]+)$/', $path, $matches) === 1) {
        handleComponent($matches[1]);
    }

    if (preg_match('/^models\/([^\/]+)\.step$/', $path, $matches) === 1) {
        handleModel($matches[1]);
    }

    sendJson(['error' => 'Not found'], 404);
} catch (Throwable $error) {
    sendJson(['error' => 'Component source request failed.'], 502);
}
