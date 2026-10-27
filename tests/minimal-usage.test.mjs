import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { StaticDeployBuilder } from '../src/StaticDeployBuilder.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const phpAvailable = spawnSync('php', ['--version']).status === 0

/** Run a PHP behavior probe without allowing production network traffic. */
function probe(source) {
    const result = spawnSync('php', ['-r', source], {
        cwd: root,
        encoding: 'utf8'
    })
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout)
}

test(
    'server baseline sends identical constant data for pending, denied and accepted visitors',
    { skip: !phpAvailable },
    () => {
        const result = probe(`
        require 'src/server/MinimalUsage.php';
        $sent = [];
        foreach (['', 'denied', 'granted'] as $choice) {
            MinimalUsage::record([
                'REQUEST_METHOD' => 'GET', 'SERVER_NAME' => 'ecadforge.app',
                'HTTP_COOKIE' => 'choice=' . $choice, 'REMOTE_ADDR' => '192.0.2.1',
                'REQUEST_URI' => '/?private=secret', 'HTTP_USER_AGENT' => 'private-agent',
                'HTTP_REFERER' => 'https://private.example.test/secret'
            ], function ($payload) use (&$sent) { $sent[] = $payload; });
        }
        echo json_encode($sent);
    `)
        assert.deepEqual(
            result,
            Array.from({ length: 3 }, () => ({ site_key: 'ecadforge_app' }))
        )
    }
)

test(
    'server baseline skips local and HEAD requests and tolerates transport failure',
    { skip: !phpAvailable },
    () => {
        const result = probe(`
        require 'src/server/MinimalUsage.php';
        $sent = 0;
        foreach ([['GET', 'localhost'], ['HEAD', 'ecadforge.app'], ['POST', 'ecadforge.app']] as [$method, $host]) {
            MinimalUsage::record(['REQUEST_METHOD' => $method, 'SERVER_NAME' => $host], function () use (&$sent) { $sent++; });
        }
        MinimalUsage::record(['REQUEST_METHOD' => 'GET', 'SERVER_NAME' => 'ecadforge.app'], function () { throw new Exception('offline'); });
        echo json_encode($sent);
    `)
        assert.equal(result, 0)
    }
)

test(
    'PHP entry serves the unchanged viewer document without accepting arbitrary file paths',
    { skip: !phpAvailable },
    async () => {
        const html = await readFile(
            new URL('../src/index.html', import.meta.url),
            'utf8'
        )
        const result = probe(`
        $_SERVER = ['REQUEST_METHOD' => 'GET', 'SERVER_NAME' => 'localhost', 'REQUEST_URI' => '/?file=/etc/passwd'];
        ob_start(); require 'src/index.php'; $html = ob_get_clean();
        echo json_encode($html);
    `)
        assert.equal(result, html)
    }
)

test('Apache routes viewer document and SPA requests through the server counter', () => {
    const config = StaticDeployBuilder.buildApacheCachePolicy()
    assert.match(
        config,
        /RewriteRule \^\(\?:index\\\.html\)\?\$ index\.php \[END\]/
    )
    assert.match(config, /RewriteRule \^ index\.php \[L\]/)
    assert.ok(
        config.indexOf('index.php [END]') < config.indexOf('REQUEST_FILENAME')
    )
})
