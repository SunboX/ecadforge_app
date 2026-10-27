<?php

declare(strict_types=1);

require_once __DIR__ . '/ServerRequestMetrics.php';

/** Keeps independent daily histograms locally and sends only batched, thresholded reports. */
final class ServerStatistics
{
    /** Expose only operational readiness, never counters or visitor attributes, for deployment checks. */
    public static function readiness(array $server, ?string $directory = null): string
    {
        if (($server['REQUEST_METHOD'] ?? '') !== 'GET' || ($server['SERVER_NAME'] ?? '') !== 'ecadforge.app'
            || ($server['HTTP_DNT'] ?? '') === '1' || ($server['HTTP_SEC_GPC'] ?? '') === '1') {
            return 'disabled';
        }
        $directory ??= dirname(__DIR__) . '/.usage-data';
        return function_exists('curl_init') && self::prepareDirectory($directory) && is_writable($directory)
            ? 'ready' : 'unavailable';
    }

    /** Count a delivery without retaining a request record, IP, raw headers or a feature tuple. */
    public static function record(array $server, array $delivery = [], ?string $directory = null, ?callable $transport = null, ?int $now = null): void
    {
        if (($server['REQUEST_METHOD'] ?? '') !== 'GET' || ($server['SERVER_NAME'] ?? '') !== 'ecadforge.app') {
            return;
        }
        $metrics = ServerRequestMetrics::fromRequest($server, $delivery);
        if ($metrics === []) {
            return;
        }
        $directory ??= dirname(__DIR__) . '/.usage-data';
        $now ??= time();
        try {
            if (!self::prepareDirectory($directory)) {
                return;
            }
            $due = self::increment($directory, gmdate('Y-m-d', $now), $metrics, $now);
            if ($due) {
                $reports = self::reports($directory, $now);
                if ($reports !== []) {
                    ($transport ?? self::send(...))(['site_key' => 'ecadforge_app', 'reports' => $reports]);
                }
            }
        } catch (Throwable) {
            // A failed ledger or report must never break the viewer or log visitor data.
        }
    }

    /** Protect the ledger before creating any JSON; the generated root policy also denies this path. */
    private static function prepareDirectory(string $directory): bool
    {
        if (!is_dir($directory) && !@mkdir($directory, 0750, true) && !is_dir($directory)) {
            return false;
        }
        $policy = $directory . '/.htaccess';
        return is_file($policy) || @file_put_contents($policy, "Require all denied\n", LOCK_EX) !== false;
    }

    /** Serialize increments and reserve at most one reporting attempt per UTC hour. */
    private static function increment(string $directory, string $day, array $metrics, int $now): bool
    {
        $handle = @fopen($directory . '/' . $day . '.json', 'c+');
        if ($handle === false) {
            return false;
        }
        try {
            if (!flock($handle, LOCK_EX)) {
                return false;
            }
            $data = json_decode(stream_get_contents($handle, 1048576) ?: '{}', true);
            $data = is_array($data) ? $data : [];
            $data['samples'] = (int) ($data['samples'] ?? 0) + 1;
            foreach ($metrics as $dimension => $bucket) {
                $data['metrics'][$dimension][$bucket] = (int) ($data['metrics'][$dimension][$bucket] ?? 0) + 1;
            }
            $hour = intdiv($now, 3600);
            $hasPreviousDays = count(glob($directory . '/*.json') ?: []) > 1;
            $due = $hour > (int) ($data['report_hour'] ?? -1) && ($data['samples'] >= 5 || $hasPreviousDays);
            if ($due) {
                $data['report_hour'] = $hour;
            }
            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, json_encode($data, JSON_THROW_ON_ERROR));
            fflush($handle);
            return $due;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /** Export separate marginals with at least five observations per bucket; expire local files at seven days. */
    private static function reports(string $directory, int $now): array
    {
        $reports = [];
        $cutoff = gmdate('Y-m-d', $now - 6 * 86400);
        foreach (glob($directory . '/*.json') ?: [] as $file) {
            $day = basename($file, '.json');
            if (preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D', $day) !== 1) {
                continue;
            }
            if ($day < $cutoff) {
                @unlink($file);
                continue;
            }
            if ($day > gmdate('Y-m-d', $now)) {
                continue;
            }
            $handle = @fopen($file, 'r');
            if ($handle === false) {
                continue;
            }
            flock($handle, LOCK_SH);
            $data = json_decode(stream_get_contents($handle, 1048576) ?: '{}', true);
            flock($handle, LOCK_UN);
            fclose($handle);
            if (!is_array($data) || (int) ($data['samples'] ?? 0) < 5) {
                continue;
            }
            $metrics = [];
            foreach ($data['metrics'] ?? [] as $dimension => $buckets) {
                foreach ($buckets as $bucket => $count) {
                    if ((int) $count >= 5) {
                        $metrics[$dimension][$bucket] = (int) $count;
                    }
                }
            }
            $reports[] = ['day' => $day, 'samples' => (int) $data['samples'], 'metrics' => $metrics];
        }
        return $reports;
    }

    /** Forward no visitor data; one bounded server-to-server request carries cumulative daily histograms. */
    private static function send(array $payload): void
    {
        if (!function_exists('curl_init')) {
            return;
        }
        $handle = curl_init('https://analytics.andrefiedler.de/v1/aggregate/report');
        if ($handle === false) {
            return;
        }
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_USERAGENT => 'ECADForge-Server-Statistics/1',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT_MS => 200,
            CURLOPT_TIMEOUT_MS => 500,
            CURLOPT_NOSIGNAL => true
        ]);
        curl_exec($handle);
        curl_close($handle);
    }
}
