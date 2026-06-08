import path from 'node:path'
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { ServerAssetVersioner } from './ServerAssetVersioner.mjs'

const noStoreCacheControl = 'no-store, no-cache, must-revalidate, max-age=0'
const browserDependencyAssets = [
    {
        sourceParts: ['node_modules', 'altium-toolkit', 'src'],
        outputParts: ['node_modules', 'altium-toolkit', 'src']
    },
    {
        sourceParts: ['node_modules', 'kicad-toolkit', 'src'],
        outputParts: ['node_modules', 'kicad-toolkit', 'src']
    },
    {
        sourceParts: ['node_modules', 'circuitjson-toolkit', 'src'],
        outputParts: ['node_modules', 'circuitjson-toolkit', 'src']
    },
    {
        sourceParts: ['node_modules', 'pcb-scene3d-viewer', 'src'],
        outputParts: ['node_modules', 'pcb-scene3d-viewer', 'src']
    },
    {
        sourceParts: ['node_modules', 'fflate', 'esm', 'browser.js'],
        outputParts: ['node_modules', 'fflate', 'esm', 'browser.js']
    },
    {
        sourceParts: ['node_modules', 'three', 'build', 'three.module.js'],
        outputParts: ['node_modules', 'three', 'build', 'three.module.js']
    },
    {
        sourceParts: ['node_modules', 'three', 'build', 'three.core.js'],
        outputParts: ['node_modules', 'three', 'build', 'three.core.js']
    },
    {
        sourceParts: [
            'node_modules',
            'three',
            'examples',
            'jsm',
            'controls',
            'OrbitControls.js'
        ],
        outputParts: [
            'node_modules',
            'three',
            'examples',
            'jsm',
            'controls',
            'OrbitControls.js'
        ]
    },
    {
        sourceParts: [
            'node_modules',
            'three',
            'examples',
            'jsm',
            'loaders',
            'VRMLLoader.js'
        ],
        outputParts: [
            'node_modules',
            'three',
            'examples',
            'jsm',
            'loaders',
            'VRMLLoader.js'
        ]
    },
    {
        sourceParts: [
            'node_modules',
            'three',
            'examples',
            'jsm',
            'libs',
            'chevrotain.module.min.js'
        ],
        outputParts: [
            'node_modules',
            'three',
            'examples',
            'jsm',
            'libs',
            'chevrotain.module.min.js'
        ]
    }
]

/**
 * Builds an Apache/shared-hosting frontend artifact from the browser source
 * tree by applying the same version rewrites as the local Node server.
 */
export class StaticDeployBuilder {
    /**
     * Copies and rewrites the browser source tree into one deploy directory.
     * @param {{ projectRoot: string, sourceRoot: string, outputRoot: string }} options
     * @returns {Promise<{ version: string, outputRoot: string }>}
     */
    static async build(options) {
        const projectRoot = path.resolve(String(options?.projectRoot || ''))
        const sourceRoot = path.resolve(String(options?.sourceRoot || ''))
        const outputRoot = path.resolve(String(options?.outputRoot || ''))
        const version = await StaticDeployBuilder.readAppVersion(projectRoot)

        StaticDeployBuilder.#assertSafeOutputPath(sourceRoot, outputRoot)

        await StaticDeployBuilder.copySourceTree(sourceRoot, outputRoot)
        await StaticDeployBuilder.copyBrowserDependencyAssets(
            projectRoot,
            outputRoot
        )
        await StaticDeployBuilder.rewriteStaticAssets(outputRoot, version)
        await StaticDeployBuilder.writeApacheCachePolicy(outputRoot)

        return { version, outputRoot }
    }

    /**
     * Reads the package version used as the static asset cache key.
     * @param {string} projectRoot
     * @returns {Promise<string>}
     */
    static async readAppVersion(projectRoot) {
        const packageRaw = await readFile(
            path.join(projectRoot, 'package.json'),
            'utf8'
        )
        const pkg = JSON.parse(packageRaw)
        return String(pkg?.version || '').trim()
    }

    /**
     * Copies the browser source tree to a clean output directory.
     * @param {string} sourceRoot
     * @param {string} outputRoot
     * @returns {Promise<void>}
     */
    static async copySourceTree(sourceRoot, outputRoot) {
        await rm(outputRoot, { force: true, recursive: true })
        await mkdir(path.dirname(outputRoot), { recursive: true })
        await cp(sourceRoot, outputRoot, {
            recursive: true,
            filter: (sourcePath) =>
                !StaticDeployBuilder.#isIgnoredDeploySource(sourcePath)
        })
    }

    /**
     * Copies browser dependency modules that static hosting must serve from
     * the same `/node_modules/` paths used by the import map.
     * @param {string} projectRoot
     * @param {string} outputRoot
     * @returns {Promise<void>}
     */
    static async copyBrowserDependencyAssets(projectRoot, outputRoot) {
        await Promise.all(
            browserDependencyAssets.map((asset) =>
                StaticDeployBuilder.#copyBrowserDependencyAsset(
                    projectRoot,
                    outputRoot,
                    asset
                )
            )
        )
    }

    /**
     * Rewrites index.html and local module imports with the app version key.
     * @param {string} outputRoot
     * @param {string} version
     * @returns {Promise<void>}
     */
    static async rewriteStaticAssets(outputRoot, version) {
        const indexPath = path.join(outputRoot, 'index.html')
        const indexHtml = await readFile(indexPath, 'utf8')
        const modulePaths = await StaticDeployBuilder.#collectMatchingFiles(
            outputRoot,
            (filePath) => filePath.endsWith('.mjs')
        )

        await writeFile(
            indexPath,
            ServerAssetVersioner.rewriteHtmlDocument(indexHtml, version)
        )
        await Promise.all(
            modulePaths.map((modulePath) =>
                StaticDeployBuilder.#rewriteJavaScriptModule(
                    modulePath,
                    version
                )
            )
        )
    }

    /**
     * Writes root Apache cache headers for hosts that serve the artifact
     * without the local Node server's no-store response headers.
     * @param {string} outputRoot
     * @returns {Promise<void>}
     */
    static async writeApacheCachePolicy(outputRoot) {
        await writeFile(
            path.join(outputRoot, '.htaccess'),
            StaticDeployBuilder.buildApacheCachePolicy()
        )
    }

    /**
     * Builds the Apache cache policy text for static deploys.
     * @returns {string}
     */
    static buildApacheCachePolicy() {
        return (
            '# Generated by npm run build:static.\n' +
            '<IfModule mod_rewrite.c>\n' +
            '    RewriteEngine On\n' +
            '    RewriteCond %{REQUEST_FILENAME} !-f\n' +
            '    RewriteCond %{REQUEST_FILENAME} !-d\n' +
            '    RewriteCond %{REQUEST_FILENAME}.html -f\n' +
            '    RewriteRule ^(.+)$ $1.html [L]\n' +
            '    RewriteCond %{REQUEST_FILENAME} !-f\n' +
            '    RewriteCond %{REQUEST_FILENAME} !-d\n' +
            '    RewriteCond %{REQUEST_URI} !\\.[^/]+$\n' +
            '    RewriteRule ^ index.html [L]\n' +
            '</IfModule>\n' +
            '<IfModule mod_headers.c>\n' +
            '    <FilesMatch "\\.(?:html|css|mjs|js|json|wasm|svg|txt|xml)$">\n' +
            '        Header set Cache-Control "' +
            noStoreCacheControl +
            '"\n' +
            '    </FilesMatch>\n' +
            '</IfModule>\n'
        )
    }

    /**
     * Copies one browser dependency file or directory into the deploy tree.
     * @param {string} projectRoot
     * @param {string} outputRoot
     * @param {{ sourceParts: string[], outputParts: string[] }} asset
     * @returns {Promise<void>}
     */
    static async #copyBrowserDependencyAsset(projectRoot, outputRoot, asset) {
        const sourcePath = path.join(projectRoot, ...asset.sourceParts)
        const outputPath = path.join(outputRoot, ...asset.outputParts)

        await mkdir(path.dirname(outputPath), { recursive: true })
        await cp(sourcePath, outputPath, { recursive: true })
    }

    /**
     * Rewrites one JavaScript module file in place.
     * @param {string} modulePath
     * @param {string} version
     * @returns {Promise<void>}
     */
    static async #rewriteJavaScriptModule(modulePath, version) {
        const source = await readFile(modulePath, 'utf8')
        await writeFile(
            modulePath,
            ServerAssetVersioner.rewriteJavaScriptModule(source, version)
        )
    }

    /**
     * Recursively collects files matching a predicate.
     * @param {string} directory
     * @param {(filePath: string) => boolean} predicate
     * @returns {Promise<string[]>}
     */
    static async #collectMatchingFiles(directory, predicate) {
        const entries = await readdir(directory, { withFileTypes: true })
        const nestedFiles = await Promise.all(
            entries.map(async (entry) => {
                const entryPath = path.join(directory, entry.name)
                if (entry.isDirectory()) {
                    return StaticDeployBuilder.#collectMatchingFiles(
                        entryPath,
                        predicate
                    )
                }

                if (entry.isFile() && predicate(entryPath)) {
                    return [entryPath]
                }

                return []
            })
        )

        return nestedFiles.flat()
    }

    /**
     * Returns true for files that should not be uploaded to shared hosting.
     * @param {string} sourcePath
     * @returns {boolean}
     */
    static #isIgnoredDeploySource(sourcePath) {
        const baseName = path.basename(sourcePath)
        return (
            baseName === '.DS_Store' ||
            baseName === '.env' ||
            baseName.startsWith('.env.')
        )
    }

    /**
     * Guards against deleting the source tree or filesystem root.
     * @param {string} sourceRoot
     * @param {string} outputRoot
     * @returns {void}
     */
    static #assertSafeOutputPath(sourceRoot, outputRoot) {
        const filesystemRoot = path.parse(outputRoot).root

        if (!outputRoot || outputRoot === filesystemRoot) {
            throw new Error('Refusing to write static deploy output at root.')
        }

        if (outputRoot === sourceRoot) {
            throw new Error('Refusing to overwrite the source directory.')
        }

        if (sourceRoot.startsWith(outputRoot + path.sep)) {
            throw new Error('Refusing to write output above the source tree.')
        }
    }
}
