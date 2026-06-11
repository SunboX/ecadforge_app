import express from 'express'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { ServerAssetVersioner } from './ServerAssetVersioner.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')
const staticRoot = path.join(projectRoot, 'src')
const vendorRoot = path.join(projectRoot, 'node_modules')
const occtVendorRoot = path.join(staticRoot, 'vendor', 'occt-import-js', 'dist')
const noStoreCacheControl = 'no-store, no-cache, must-revalidate, max-age=0'
const originAgentClusterHeaderValue = '?1'
const permissionsPolicyHeaderValue = 'tools=(self)'

const app = express()

app.use((_req, res, next) => {
    ServerRuntime.setWebMcpPolicyHeaders(res)
    next()
})

app.use(express.json({ limit: '1mb' }))

app.get(['/', '/index.html'], async (_req, res, next) => {
    try {
        await ServerRuntime.sendVersionedIndexHtml(res, projectRoot, staticRoot)
    } catch (error) {
        next(error)
    }
})

app.get(/\.mjs$/i, async (req, res, next) => {
    if (/^\/(?:node_modules|vendor)\//i.test(req.path)) {
        next()
        return
    }

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

app.get(
    /^\/vendor\/three\/(?:examples\/jsm|build)\/.+\.js$/i,
    async (req, res, next) => {
        try {
            const filePath = ServerRuntime.resolveStaticAssetPath(
                vendorRoot,
                req.path.replace(/^\/vendor\/+/i, '/')
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
                ServerRuntime.rewriteVendorJavaScriptModule(source, versionKey)
            )
        } catch (error) {
            if (error && error.code === 'ENOENT') {
                res.status(404).send('Not Found')
                return
            }
            next(error)
        }
    }
)

app.use(
    '/vendor/occt-import-js/dist',
    express.static(occtVendorRoot, {
        setHeaders: (res) => {
            res.setHeader('Cache-Control', noStoreCacheControl)
        }
    })
)

app.use(
    '/node_modules/occt-import-js/dist',
    express.static(occtVendorRoot, {
        setHeaders: (res) => {
            res.setHeader('Cache-Control', noStoreCacheControl)
        }
    })
)

app.get(
    /^\/node_modules\/(?:altium-toolkit|kicad-toolkit|circuitjson-toolkit|pcb-scene3d-viewer)\/.+\.mjs$/i,
    async (req, res, next) => {
        try {
            const filePath = ServerRuntime.resolveStaticAssetPath(
                vendorRoot,
                req.path.replace(/^\/node_modules\/+/i, '/')
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
    }
)

app.use(
    '/node_modules',
    express.static(vendorRoot, {
        setHeaders: (res) => {
            res.setHeader('Cache-Control', noStoreCacheControl)
        }
    })
)

app.use(
    '/vendor',
    express.static(vendorRoot, {
        setHeaders: (res) => {
            res.setHeader('Cache-Control', noStoreCacheControl)
        }
    })
)

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
    const hasFileExtension = /\.[a-z0-9]+$/i.test(req.path)
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
     * Applies headers required for document-scoped WebMCP registration.
     * @param {import('express').Response} res
     * @returns {void}
     */
    static setWebMcpPolicyHeaders(res) {
        res.setHeader('Origin-Agent-Cluster', originAgentClusterHeaderValue)
        res.setHeader('Permissions-Policy', permissionsPolicyHeaderValue)
    }

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
     * Reads app version from package.json.
     * @param {string} root
     * @returns {Promise<string>}
     */
    static async readAppVersion(root) {
        try {
            const raw = await readFile(path.join(root, 'package.json'), 'utf8')
            const parsed = JSON.parse(raw)
            return String(parsed?.version || '').trim()
        } catch (_error) {
            return ''
        }
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

        if (resolvedPath === root || resolvedPath.startsWith(root + path.sep)) {
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

    /**
     * Rewrites vendored browser ESM so addon modules can resolve Three.js
     * directly from the local static server.
     * @param {string} source
     * @param {string} versionKey
     * @returns {string}
     */
    static rewriteVendorJavaScriptModule(source, versionKey) {
        const suffix = versionKey ? '?v=' + encodeURIComponent(versionKey) : ''

        return ServerAssetVersioner.rewriteRelativeJavaScriptSpecifiers(
            String(source || '')
                .replace(
                    /from\s+(['"])three\/addons\/([^'"]+)\1/g,
                    (_match, quote, specifier) =>
                        'from ' +
                        quote +
                        '/vendor/three/examples/jsm/' +
                        specifier +
                        suffix +
                        quote
                )
                .replace(
                    /from\s+(['"])three\/webgpu\1/g,
                    (_match, quote) =>
                        'from ' +
                        quote +
                        '/vendor/three/build/three.webgpu.js' +
                        suffix +
                        quote
                )
                .replace(
                    /from\s+(['"])three\/tsl\1/g,
                    (_match, quote) =>
                        'from ' +
                        quote +
                        '/vendor/three/build/three.tsl.js' +
                        suffix +
                        quote
                )
                .replace(
                    /from\s+(['"])three\1/g,
                    (_match, quote) =>
                        'from ' +
                        quote +
                        '/vendor/three/build/three.module.js' +
                        suffix +
                        quote
                ),
            versionKey
        )
    }
}

const port = ServerRuntime.parsePort(process.env.PORT)

app.listen(port, () => {
    console.log('Server listening on http://localhost:' + port)
})
