import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

/** Allocates an ephemeral loopback port for the real app server. */
async function allocatePort() {
    const server = createServer()
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = server.address().port
    await new Promise((resolve) => server.close(resolve))
    return port
}

test(
    'installed KiCad parser falls back when module worker options are unavailable',
    { skip: !process.env.WORKER_BROWSER_MODULE, timeout: 30_000 },
    async () => {
        const { chromium } = await import(process.env.WORKER_BROWSER_MODULE)
        const port = await allocatePort()
        const server = spawn(
            process.execPath,
            [fileURLToPath(new URL('../src/server.mjs', import.meta.url))],
            {
                env: { ...process.env, PORT: String(port) },
                stdio: ['ignore', 'pipe', 'pipe']
            }
        )
        let browser
        try {
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(
                    () => reject(new Error('App server did not start.')),
                    5_000
                )
                server.once('error', reject)
                server.once('exit', (code) =>
                    reject(new Error(`App server exited: ${code}`))
                )
                server.stdout.on('data', (chunk) => {
                    if (
                        String(chunk).includes(
                            `Server listening on http://localhost:${port}`
                        )
                    ) {
                        clearTimeout(timeout)
                        resolve()
                    }
                })
            })
            browser = await chromium.launch({
                headless: true,
                executablePath: process.env.WORKER_BROWSER_EXECUTABLE
            })
            const page = await browser.newPage()
            const errors = []
            page.on('pageerror', (error) => errors.push(error.message))
            await page.addInitScript(() => {
                const NativeWorker = globalThis.Worker
                globalThis.Worker = class extends NativeWorker {
                    /** Models a host that ignores WorkerOptions.type. */
                    constructor(url) {
                        super(url)
                    }
                }
            })
            await page.goto(`http://127.0.0.1:${port}/`)
            const result = await page.evaluate(async () => {
                const { Parser } =
                    await import('/node_modules/kicad-toolkit/src/parser.mjs')
                const input = {
                    fileName: 'fake.kicad_sch',
                    data: '(kicad_sch (version 20230121) (generator "fake") (uuid "00000000-0000-0000-0000-000000000001") (paper "A4") (lib_symbols))'
                }
                const document = await Parser.parseAsync(input, {
                    worker: 'auto'
                })
                let explicitFailure = null
                try {
                    await Parser.parseAsync(input, { worker: true })
                } catch (error) {
                    explicitFailure = error.code
                }
                return {
                    schema: document.schema,
                    format: document.source.format,
                    fileName: document.source.fileName,
                    explicitFailure
                }
            })
            assert.deepEqual(result, {
                schema: 'ecad-toolkit.document.v1',
                format: 'kicad',
                fileName: 'fake.kicad_sch',
                explicitFailure: 'ERR_WORKER_REQUEST'
            })
            assert.deepEqual(errors, [])
        } finally {
            await browser?.close()
            server.kill()
        }
    }
)
