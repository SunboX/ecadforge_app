<?php

declare(strict_types=1);

/** Uses the manifest uploaded last as the activation boundary for the disclosed processing. */
final class ServerStatisticsConfig
{
    /** Fail closed until the deployed root manifest explicitly enables the disclosed statistics. */
    public static function enabled(?string $manifest = null): bool
    {
        $manifest ??= dirname(__DIR__) . '/package.json';
        $source = is_file($manifest) ? @file_get_contents($manifest) : false;
        $data = is_string($source) ? json_decode($source, true) : null;
        return is_array($data) && ($data['serverStatisticsEnabled'] ?? false) === true;
    }
}
