<?php

declare(strict_types=1);

/** Reduces ordinary request metadata to independent, bounded statistical categories. */
final class ServerRequestMetrics
{
    /** Read no cookies, client hints, addresses or query strings; honour browser objections. */
    public static function fromRequest(array $server, array $delivery): array
    {
        if (($server['HTTP_DNT'] ?? '') === '1' || ($server['HTTP_SEC_GPC'] ?? '') === '1') {
            return [];
        }
        $agent = substr((string) ($server['HTTP_USER_AGENT'] ?? ''), 0, 512);
        [$browser, $major] = self::browser($agent);
        $language = strtolower(substr((string) ($server['HTTP_ACCEPT_LANGUAGE'] ?? ''), 0, 2));
        $country = strtoupper((string) ($server['GEOIP_COUNTRY_CODE'] ?? ''));
        return [
            'browser' => $browser,
            'browser_major' => $major,
            'os' => self::operatingSystem($agent),
            'device' => self::device($agent),
            'language' => preg_match('/^[a-z]{2}$/D', $language) === 1 ? $language : 'unknown',
            'country' => preg_match('/^[A-Z]{2}$/D', $country) === 1 ? $country : 'unknown',
            'referrer' => self::referrer($server),
            'transport' => (($server['HTTPS'] ?? '') === 'on' || ($server['SERVER_PORT'] ?? '') === '443') ? 'https' : 'http',
            'http_version' => match (strtoupper((string) ($server['SERVER_PROTOCOL'] ?? ''))) {
                'HTTP/1.0' => '1.0', 'HTTP/1.1' => '1.1', 'HTTP/2', 'HTTP/2.0' => '2',
                'HTTP/3', 'HTTP/3.0' => '3', default => 'unknown'
            },
            'automation' => preg_match('/bot|crawler|spider|slurp|headless/i', $agent) === 1 ? 'declared_bot' : 'not_declared',
            'response_size' => self::bucket((float) ($delivery['bytes'] ?? 0), [65536, 262144, 1048576], ['under_64k', '64k_256k', '256k_1m', 'over_1m']),
            'server_time' => self::bucket((float) ($delivery['duration_ms'] ?? 0), [10, 50, 200, 1000], ['under_10ms', '10_50ms', '50_200ms', '200_1000ms', 'over_1000ms'])
        ];
    }

    /** Infer a declared browser family and coarse major generation, without a raw UA string. */
    private static function browser(string $agent): array
    {
        foreach (['edge' => 'Edg(?:e|A|iOS)?', 'opera' => 'OPR', 'firefox' => '(?:Firefox|FxiOS)', 'chrome' => '(?:Chrome|CriOS)', 'safari' => 'Version'] as $family => $token) {
            if (preg_match('~' . $token . '/([0-9]{1,3})(?:[. /]|$)~i', $agent, $match) === 1) {
                // Major versions are grouped in decades to avoid rare exact-version categories.
                $generation = (int) floor((int) $match[1] / 10) * 10;
                return [$family, $generation . 's'];
            }
        }
        return ['other', 'unknown'];
    }

    /** Infer only an OS family; frozen user agents are declarations, not device identification. */
    private static function operatingSystem(string $agent): string
    {
        foreach (['android' => 'Android', 'ios' => 'iPhone|iPad|iPod', 'windows' => 'Windows', 'chromeos' => 'CrOS', 'macos' => 'Macintosh|Mac OS', 'linux' => 'Linux'] as $family => $pattern) {
            if (preg_match('/' . $pattern . '/i', $agent) === 1) {
                return $family;
            }
        }
        return 'other';
    }

    /** Infer a coarse form factor without screen, model, architecture or hardware probes. */
    private static function device(string $agent): string
    {
        if (preg_match('/iPad|Tablet|Android(?!.*Mobile)/i', $agent) === 1) {
            return 'tablet';
        }
        if (preg_match('/Mobile|iPhone|iPod/i', $agent) === 1) {
            return 'mobile';
        }
        return $agent === '' ? 'unknown' : 'desktop_or_other';
    }

    /** Discard every referrer hostname/path after same-origin versus external classification. */
    private static function referrer(array $server): string
    {
        $raw = substr((string) ($server['HTTP_REFERER'] ?? ''), 0, 2048);
        if ($raw === '') {
            return 'none';
        }
        $host = parse_url($raw, PHP_URL_HOST);
        if (!is_string($host) || !in_array(strtolower((string) parse_url($raw, PHP_URL_SCHEME)), ['http', 'https'], true)) {
            return 'unknown';
        }
        return strtolower($host) === strtolower((string) ($server['SERVER_NAME'] ?? '')) ? 'same_site' : 'external';
    }

    /** Map a server measurement into a bounded histogram rather than an exact per-request value. */
    private static function bucket(float $value, array $limits, array $labels): string
    {
        foreach ($limits as $index => $limit) {
            if ($value < $limit) {
                return $labels[$index];
            }
        }
        return $labels[count($labels) - 1];
    }
}
