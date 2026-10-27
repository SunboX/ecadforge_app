import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
    mkdtemp,
    readFile,
    rm,
    mkdir,
    writeFile,
    access
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { StaticDeployBuilder } from '../src/StaticDeployBuilder.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const phpAvailable = spawnSync('php', ['--version']).status === 0

/** Run a PHP probe using isolated scratch storage and no production transport. */
function probe(source, directory = '') {
    const result = spawnSync('php', ['-r', source, directory], {
        cwd: root,
        encoding: 'utf8'
    })
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout)
}

test(
    'passive metrics reduce ordinary headers to bounded, independent categories',
    { skip: !phpAvailable },
    () => {
        const metrics = probe(`
        require 'src/server/ServerRequestMetrics.php';
        echo json_encode(ServerRequestMetrics::fromRequest([
            'HTTP_USER_AGENT' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/142.0.1234.56 Safari/537.36',
            'HTTP_ACCEPT_LANGUAGE' => 'de-DE,de;q=0.9,en;q=0.8',
            'GEOIP_COUNTRY_CODE' => 'DE', 'SERVER_NAME' => 'example.test',
            'HTTP_REFERER' => 'https://search.example.test/private?q=secret',
            'REMOTE_ADDR' => '192.0.2.20', 'HTTP_AUTHORIZATION' => 'Bearer secret',
            'HTTP_COOKIE' => 'account=private', 'REQUEST_URI' => '/secret?token=private',
            'HTTPS' => 'on', 'SERVER_PROTOCOL' => 'HTTP/2.0'
        ], ['bytes' => 55000, 'duration_ms' => 25]));
    `)
        assert.deepEqual(metrics, {
            browser: 'chrome',
            browser_major: '140s',
            os: 'windows',
            device: 'desktop_or_other',
            language: 'de',
            country: 'DE',
            referrer: 'external',
            transport: 'https',
            http_version: '2',
            automation: 'not_declared',
            response_size: 'under_64k',
            server_time: '10_50ms'
        })
        assert.doesNotMatch(
            JSON.stringify(metrics),
            /secret|private|192\.0|example\.test|1234|Win64/
        )
    }
)

test(
    'DNT and GPC objections bypass expanded statistics independently of consent',
    { skip: !phpAvailable },
    () => {
        const result = probe(`
        require 'src/server/ServerRequestMetrics.php';
        echo json_encode([
            ServerRequestMetrics::fromRequest(['HTTP_DNT' => '1'], []),
            ServerRequestMetrics::fromRequest(['HTTP_SEC_GPC' => '1'], [])
        ]);
    `)
        assert.deepEqual(result, [[], []])
    }
)

test(
    'local ledger stores marginals, suppresses rare buckets and batches cumulative snapshots hourly',
    { skip: !phpAvailable },
    async () => {
        const directory = await mkdtemp(
            path.join(tmpdir(), 'server-statistics-')
        )
        try {
            const sent = probe(
                `
            require 'src/server/ServerStatistics.php';
            $sent = [];
            $send = function ($data) use (&$sent) { $sent[] = $data; };
            $server = ['REQUEST_METHOD' => 'GET', 'SERVER_NAME' => 'ecadforge.app',
                'HTTP_USER_AGENT' => 'Firefox/143.0', 'HTTP_ACCEPT_LANGUAGE' => 'en-US',
                'HTTP_REFERER' => 'https://private.example.test/secret', 'REMOTE_ADDR' => '192.0.2.10'];
            $now = strtotime('2026-10-27 12:00:00 UTC');
            for ($i = 0; $i < 6; $i++) {
                $server['HTTP_ACCEPT_LANGUAGE'] = $i === 0 ? 'de-DE' : 'en-US';
                ServerStatistics::record($server, ['bytes' => 55000, 'duration_ms' => 3], $argv[1], $send, $now + $i);
            }
            ServerStatistics::record($server, ['bytes' => 55000, 'duration_ms' => 3], $argv[1], $send, $now + 3600);
            ServerStatistics::record($server, [], $argv[1], $send, $now + 3601);
            echo json_encode($sent);
        `,
                directory
            )
            assert.equal(sent.length, 2)
            assert.equal(sent[0].reports[0].samples, 5)
            assert.equal(sent[0].reports[0].metrics.language, undefined)
            assert.equal(sent[1].reports[0].samples, 7)
            assert.deepEqual(sent[1].reports[0].metrics.language, { en: 6 })
            assert.deepEqual(sent[1].reports[0].metrics.browser, { firefox: 7 })
            const stored = JSON.parse(
                await readFile(path.join(directory, '2026-10-27.json'), 'utf8')
            )
            assert.equal(stored.samples, 8)
            assert.deepEqual(stored.metrics.language, { de: 1, en: 7 })
            assert.deepEqual(Object.keys(stored).sort(), [
                'metrics',
                'report_hour',
                'samples'
            ])
            assert.doesNotMatch(
                JSON.stringify(stored),
                /secret|private|192\.0|Firefox\/|example\.test/
            )
            assert.equal(
                await readFile(path.join(directory, '.htaccess'), 'utf8'),
                'Require all denied\n'
            )
        } finally {
            await rm(directory, { recursive: true, force: true })
        }
    }
)

test(
    'expanded statistics honour objections, isolate development, expire old ledgers and tolerate offline reports',
    { skip: !phpAvailable },
    async () => {
        const directory = await mkdtemp(
            path.join(tmpdir(), 'server-statistics-')
        )
        try {
            const result = probe(
                `
            require 'src/server/ServerStatistics.php';
            $server = ['REQUEST_METHOD' => 'GET', 'SERVER_NAME' => 'ecadforge.app'];
            $now = strtotime('2026-10-27 12:00:00 UTC');
            $noop = function () { throw new Exception('offline'); };
            ServerStatistics::record($server + ['HTTP_DNT' => '1'], [], $argv[1], $noop, $now);
            ServerStatistics::record(['REQUEST_METHOD' => 'GET', 'SERVER_NAME' => 'localhost'], [], $argv[1], $noop, $now);
            $readiness = ServerStatistics::readiness($server + ['HTTP_SEC_GPC' => '1'], $argv[1]);
            $before = glob($argv[1] . '/*.json');
            file_put_contents($argv[1] . '/2026-10-01.json', '{}');
            ServerStatistics::record($server, [], $argv[1], $noop, $now);
            echo json_encode(['readiness' => $readiness, 'before' => count($before), 'old_exists' => file_exists($argv[1] . '/2026-10-01.json')]);
        `,
                directory
            )
            assert.deepEqual(result, {
                readiness: 'disabled',
                before: 0,
                old_exists: false
            })
        } finally {
            await rm(directory, { recursive: true, force: true })
        }
    }
)

test('static packaging excludes runtime histogram files and Apache denies direct access', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'statistics-artifact-'))
    try {
        const sourceRoot = path.join(directory, 'source')
        const outputRoot = path.join(directory, 'output')
        await mkdir(path.join(sourceRoot, '.usage-data'), { recursive: true })
        await writeFile(
            path.join(sourceRoot, '.usage-data', '2026-10-27.json'),
            '{"samples":5}'
        )
        await writeFile(path.join(sourceRoot, 'index.html'), '<html></html>')
        await StaticDeployBuilder.copySourceTree(sourceRoot, outputRoot)
        await assert.rejects(access(path.join(outputRoot, '.usage-data')))
        assert.match(
            StaticDeployBuilder.buildApacheCachePolicy(),
            /RewriteRule \^\\\.usage-data\(\?:\/\|\$\) - \[F,END\]/
        )
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})
