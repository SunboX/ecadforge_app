import express from 'express'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')
const staticRoot = path.join(projectRoot, 'src')

const app = express()

app.use(express.json({ limit: '1mb' }))
app.use(express.static(staticRoot, { extensions: ['html'] }))

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
})

app.get(['/api/app-meta', '/api/app-meta.php'], async (_req, res) => {
    const version = await ServerRuntime.readAppVersion(projectRoot)
    res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, max-age=0'
    )
    res.json({ version })
})

app.use((req, res) => {
    const hasFileExtension = /.[a-z0-9]+$/i.test(req.path)
    if (hasFileExtension) {
        res.status(404).send('Not Found')
        return
    }
    res.sendFile(path.join(staticRoot, 'index.html'))
})

/**
 * Server bootstrap helpers for metadata and configuration.
 */
class ServerRuntime {
    /**
     * Parses a valid TCP port.
     * @param {string | undefined} rawPort
     * @returns {number}
     */
    static parsePort(rawPort) {
        const parsed = Number.parseInt(String(rawPort || ''), 10)
        if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
            return parsed
        }
        return 3000
    }

    /**
     * Reads app version from known metadata files.
     * @param {string} root
     * @returns {Promise<string>}
     */
    static async readAppVersion(root) {
        const files = [
            path.join(root, 'package.json'),
            path.join(root, 'api', 'app-version.json')
        ]

        for (const filePath of files) {
            try {
                const raw = await readFile(filePath, 'utf8')
                const parsed = JSON.parse(raw)
                const version = String(parsed?.version || '').trim()
                if (version) return version
            } catch (_error) {
                // Ignore missing or malformed metadata files.
            }
        }

        return ''
    }
}

const port = ServerRuntime.parsePort(process.env.PORT)

app.listen(port, () => {
    console.log('Server listening on http://localhost:' + port)
})
