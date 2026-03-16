import express from 'express'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { ServerAssetVersioner } from './ServerAssetVersioner.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')
const staticRoot = path.join(projectRoot, 'src')
const noStoreCacheControl = 'no-store, no-cache, must-revalidate, max-age=0'

const app = express()

app.use(express.json({ limit: '1mb' }))

app.get(['/', '/index.html'], async (_req, res, next) => {
    try {
        await ServerRuntime.sendVersionedIndexHtml(res, projectRoot, staticRoot)
    } catch (error) {
        next(error)
    }
})

app.get(/\.mjs$/i, async (req, res, next) => {
    try {
        const filePath = ServerRuntime.resolveStaticAssetPath(
            staticRoot,
            req.path
        )

        if (!filePath) {
            res.status(404).send('Not Found')
            return
        }

        const source = await readFile(filePath, 'utf8')
        const versionKey = await ServerRuntime.resolveRequestedAssetVersion(
            req.originalUrl,
            projectRoot
        )

        res.type('text/javascript')
        res.setHeader('Cache-Control', noStoreCacheControl)
        res.send(
            ServerAssetVersioner.rewriteJavaScriptModule(source, versionKey)
        )
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            res.status(404).send('Not Found')
            return
        }
        next(error)
    }
})

app.use(
    express.static(staticRoot, {
        extensions: ['html'],
        setHeaders: (res) => {
            res.setHeader('Cache-Control', noStoreCacheControl)
        }
    })
)

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
})

app.get(['/api/app-meta', '/api/app-meta.php'], async (_req, res) => {
    const version = await ServerRuntime.readAppVersion(projectRoot)
    res.setHeader('Cache-Control', noStoreCacheControl)
    res.json({ version })
})

app.use((req, res) => {
    const hasFileExtension = /.[a-z0-9]+$/i.test(req.path)
    if (hasFileExtension) {
        res.status(404).send('Not Found')
        return
    }
    ServerRuntime.sendVersionedIndexHtml(res, projectRoot, staticRoot).catch(
        () => {
            res.status(500).send('Server Error')
        }
    )
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

    /**
     * Resolves one request URL to the app version or an explicit `v` query.
     * @param {string} requestUrl
     * @param {string} root
     * @returns {Promise<string>}
     */
    static async resolveRequestedAssetVersion(requestUrl, root) {
        const parsedUrl = new URL(String(requestUrl || '/'), 'http://localhost')
        const requestedVersion = String(
            parsedUrl.searchParams.get('v') || ''
        ).trim()

        if (requestedVersion) {
            return requestedVersion
        }

        return ServerRuntime.readAppVersion(root)
    }

    /**
     * Resolves a static request path to one file under the frontend root.
     * @param {string} root
     * @param {string} requestPath
     * @returns {string | null}
     */
    static resolveStaticAssetPath(root, requestPath) {
        const normalizedRequestPath = String(requestPath || '').replace(
            /^\/+/,
            ''
        )
        const resolvedPath = path.resolve(root, normalizedRequestPath)

        if (
            resolvedPath === root ||
            resolvedPath.startsWith(root + path.sep)
        ) {
            return resolvedPath
        }

        return null
    }

    /**
     * Sends the SPA shell with versioned asset URLs.
     * @param {import('express').Response} res
     * @param {string} root
     * @param {string} frontendRoot
     * @returns {Promise<void>}
     */
    static async sendVersionedIndexHtml(res, root, frontendRoot) {
        const [htmlSource, appVersion] = await Promise.all([
            readFile(path.join(frontendRoot, 'index.html'), 'utf8'),
            ServerRuntime.readAppVersion(root)
        ])

        res.setHeader('Cache-Control', noStoreCacheControl)
        res.type('html')
        res.send(
            ServerAssetVersioner.rewriteHtmlDocument(htmlSource, appVersion)
        )
    }
}

const port = ServerRuntime.parsePort(process.env.PORT)

app.listen(port, () => {
    console.log('Server listening on http://localhost:' + port)
})
