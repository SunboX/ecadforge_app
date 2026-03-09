import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const serverEntryPath = fileURLToPath(new URL('../src/server.mjs', import.meta.url))

/**
 * Allocates an available TCP port for the spawned server process.
 * @returns {Promise<number>}
 */
async function allocatePort() {
    return await new Promise((resolve, reject) => {
        const probeServer = createServer()

        probeServer.once('error', reject)
        probeServer.listen(0, '127.0.0.1', () => {
            const address = probeServer.address()
            if (!address || typeof address === 'string') {
                probeServer.close()
                reject(new Error('Unable to resolve an available TCP port'))
                return
            }

            probeServer.close((error) => {
                if (error) {
                    reject(error)
                    return
                }
                resolve(address.port)
            })
        })
    })
}

/**
 * Waits until the server process logs that it is listening on the requested
 * port, or rejects with captured process output if the process exits first.
 * @param {import('node:child_process').ChildProcessWithoutNullStreams} childProcess
 * @param {number} port
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
async function waitForServerListening(childProcess, port) {
    return await new Promise((resolve, reject) => {
        const listeningMessage =
            'Server listening on http://localhost:' + String(port)
        let stdout = ''
        let stderr = ''
        let settled = false

        const cleanup = () => {
            clearTimeout(timeoutId)
            childProcess.stdout.off('data', handleStdout)
            childProcess.stderr.off('data', handleStderr)
            childProcess.off('error', handleError)
            childProcess.off('exit', handleExit)
        }

        const settle = (callback) => {
            if (settled) return
            settled = true
            cleanup()
            callback()
        }

        const handleStdout = (chunk) => {
            stdout += String(chunk)
            if (stdout.includes(listeningMessage)) {
                settle(() => resolve({ stdout, stderr }))
            }
        }

        const handleStderr = (chunk) => {
            stderr += String(chunk)
        }

        const handleError = (error) => {
            settle(() => reject(error))
        }

        const handleExit = (code, signal) => {
            const output = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n')
            const details = output ? '\n' + output : ''
            settle(() => {
                reject(
                    new Error(
                        'Server exited before listening (code=' +
                            String(code) +
                            ', signal=' +
                            String(signal) +
                            ')' +
                            details
                    )
                )
            })
        }

        const timeoutId = setTimeout(() => {
            const output = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n')
            const details = output ? '\n' + output : ''
            settle(() => {
                reject(
                    new Error(
                        'Timed out waiting for server startup on port ' +
                            String(port) +
                            details
                    )
                )
            })
        }, 5000)

        childProcess.stdout.on('data', handleStdout)
        childProcess.stderr.on('data', handleStderr)
        childProcess.once('error', handleError)
        childProcess.once('exit', handleExit)
    })
}

/**
 * Stops the spawned server process if it is still running.
 * @param {import('node:child_process').ChildProcessWithoutNullStreams} childProcess
 * @returns {Promise<void>}
 */
async function stopChildProcess(childProcess) {
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
        return
    }

    childProcess.kill('SIGTERM')
    await once(childProcess, 'exit')
}

/**
 * Verifies the browser server entrypoint boots and starts listening.
 */
test('server entrypoint starts listening on the configured port', async (t) => {
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    const output = await waitForServerListening(childProcess, port)
    assert.match(output.stdout, new RegExp('localhost:' + String(port)))
})
