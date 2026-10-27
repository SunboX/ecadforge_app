<?php

declare(strict_types=1);

/** Counts document deliveries without reading or forwarding visitor attributes. */
final class MinimalUsage
{
    /** Return a constant payload only for production GET document deliveries. */
    public static function payload(array $server): ?array
    {
        if (($server['REQUEST_METHOD'] ?? '') !== 'GET'
            || ($server['SERVER_NAME'] ?? '') !== 'ecadforge.app') {
            return null;
        }
        return ['site_key' => 'ecadforge_app'];
    }

    /** Best-effort server-to-server delivery; analytics failure must not break viewing. */
    public static function record(array $server, ?callable $transport = null): void
    {
        $payload = self::payload($server);
        if ($payload === null) {
            return;
        }
        try {
            ($transport ?? self::send(...))($payload);
        } catch (Throwable) {
            // No visitor details or per-request logs are retained on failure.
        }
    }

    /** Send only the app key, using fixed headers and a short, verified TLS connection. */
    private static function send(array $payload): void
    {
        if (!function_exists('curl_init')) {
            return;
        }
        $handle = curl_init('https://analytics.andrefiedler.de/v1/aggregate');
        if ($handle === false) {
            return;
        }
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_USERAGENT => 'ECADForge-Server-Aggregate/1',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT_MS => 200,
            CURLOPT_TIMEOUT_MS => 500,
            CURLOPT_NOSIGNAL => true
        ]);
        curl_exec($handle);
        curl_close($handle);
    }
}
