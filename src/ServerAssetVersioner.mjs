/**
 * Rewrites served frontend assets so browser caches track the current app
 * version across full ESM import graphs.
 */
export class ServerAssetVersioner {
    /**
     * Appends or replaces one `v` query parameter on a local asset path.
     * @param {string} assetPath
     * @param {string} versionKey
     * @returns {string}
     */
    static appendVersionQuery(assetPath, versionKey) {
        const [pathAndQuery, hash = ''] = String(assetPath || '').split('#')
        const [pathName, query = ''] = pathAndQuery.split('?')
        const searchParams = new URLSearchParams(query)

        searchParams.set('v', String(versionKey || '0'))

        return (
            pathName + '?' + searchParams.toString() + (hash ? '#' + hash : '')
        )
    }

    /**
     * Rewrites relative JavaScript specifiers in browser ESM source so the
     * current asset version propagates through transitive local import graphs.
     * @param {string} source
     * @param {string} versionKey
     * @returns {string}
     */
    static rewriteRelativeJavaScriptSpecifiers(source, versionKey) {
        const patterns = [
            /(from\s+['"])(\.{1,2}\/[^'"]+\.(?:mjs|js)(?:\?[^'"]*)?)(['"])/g,
            /(import\s+['"])(\.{1,2}\/[^'"]+\.(?:mjs|js)(?:\?[^'"]*)?)(['"])/g,
            /(import\s*\(\s*['"])(\.{1,2}\/[^'"]+\.(?:mjs|js)(?:\?[^'"]*)?)(['"]\s*\))/g,
            /(new URL\(\s*['"])(\.{1,2}\/[^'"]+\.(?:mjs|js)(?:\?[^'"]*)?)(['"]\s*,\s*import\.meta\.url\s*\))/g
        ]

        return patterns.reduce(
            (rewrittenSource, pattern) =>
                rewrittenSource.replace(
                    pattern,
                    (_match, prefix, specifier, suffix) =>
                        prefix +
                        ServerAssetVersioner.appendVersionQuery(
                            specifier,
                            versionKey
                        ) +
                        suffix
                ),
            String(source || '')
        )
    }

    /**
     * Resolves one known bare browser dependency to its deployed asset path.
     * @param {string} specifier
     * @returns {string}
     */
    static resolveBrowserBareSpecifier(specifier) {
        const normalizedSpecifier = String(specifier || '')
        const dependencyMap = {
            'altium-toolkit': '/node_modules/altium-toolkit/src/index.mjs',
            'altium-toolkit/parser':
                '/node_modules/altium-toolkit/src/parser.mjs',
            'altium-toolkit/netlist-query':
                '/node_modules/altium-toolkit/src/netlist-query.mjs',
            'altium-toolkit/renderers':
                '/node_modules/altium-toolkit/src/renderers.mjs',
            'altium-toolkit/scene3d':
                '/node_modules/altium-toolkit/src/scene3d.mjs',
            'altium-toolkit/workers/altium-parser.worker.mjs':
                '/node_modules/altium-toolkit/src/workers/altium-parser.worker.mjs',
            'kicad-toolkit': '/node_modules/kicad-toolkit/src/index.mjs',
            'kicad-toolkit/parser':
                '/node_modules/kicad-toolkit/src/parser.mjs',
            'kicad-toolkit/netlist-query':
                '/node_modules/kicad-toolkit/src/netlist-query.mjs',
            'kicad-toolkit/renderers':
                '/node_modules/kicad-toolkit/src/renderers.mjs',
            'kicad-toolkit/scene3d':
                '/node_modules/kicad-toolkit/src/scene3d.mjs',
            'kicad-toolkit/workers/kicad-parser.worker.mjs':
                '/node_modules/kicad-toolkit/src/workers/kicad-parser.worker.mjs',
            'circuitjson-toolkit':
                '/node_modules/circuitjson-toolkit/src/index.mjs',
            'circuitjson-toolkit/renderers':
                '/node_modules/circuitjson-toolkit/src/renderers.mjs',
            'gerber-toolkit': '/node_modules/gerber-toolkit/src/index.mjs',
            'gerber-toolkit/parser':
                '/node_modules/gerber-toolkit/src/parser.mjs',
            'gerber-toolkit/renderers':
                '/node_modules/gerber-toolkit/src/renderers.mjs',
            'gerber-toolkit/scene3d':
                '/node_modules/gerber-toolkit/src/scene3d.mjs',
            'pcb-scene3d-viewer':
                '/node_modules/pcb-scene3d-viewer/src/index.mjs',
            'pcb-scene3d-viewer/scene3d':
                '/node_modules/pcb-scene3d-viewer/src/scene3d.mjs',
            earcut: '/node_modules/earcut/src/earcut.js',
            fflate: '/node_modules/fflate/esm/browser.js'
        }

        return dependencyMap[normalizedSpecifier] || ''
    }

    /**
     * Rewrites known bare dependency specifiers for browser worker contexts
     * that cannot rely on the page import map.
     * @param {string} source
     * @param {string} versionKey
     * @returns {string}
     */
    static rewriteBareJavaScriptSpecifiers(source, versionKey) {
        const specifierPattern =
            '((?:altium-toolkit(?:\\/(?:parser|netlist-query|renderers|scene3d|workers\\/altium-parser\\.worker\\.mjs))?|kicad-toolkit(?:\\/(?:parser|netlist-query|renderers|scene3d|workers\\/kicad-parser\\.worker\\.mjs))?|gerber-toolkit(?:\\/(?:parser|renderers|scene3d))?|circuitjson-toolkit(?:\\/renderers)?|pcb-scene3d-viewer(?:\\/scene3d)?)|earcut|fflate)'
        const patterns = [
            new RegExp('(from\\s+[\'"])' + specifierPattern + '([\'"])', 'g'),
            new RegExp('(import\\s+[\'"])' + specifierPattern + '([\'"])', 'g'),
            new RegExp(
                '(import\\s*\\(\\s*[\'"])' +
                    specifierPattern +
                    '([\'"]\\s*\\))',
                'g'
            )
        ]

        return patterns.reduce(
            (rewrittenSource, pattern) =>
                rewrittenSource.replace(
                    pattern,
                    (_match, prefix, specifier, suffix) => {
                        const assetPath =
                            ServerAssetVersioner.resolveBrowserBareSpecifier(
                                specifier
                            )
                        if (!assetPath) {
                            return _match
                        }

                        return (
                            prefix +
                            ServerAssetVersioner.appendVersionQuery(
                                assetPath,
                                versionKey
                            ) +
                            suffix
                        )
                    }
                ),
            String(source || '')
        )
    }

    /**
     * Rewrites the static HTML shell to request versioned CSS and JS assets.
     * @param {string} source
     * @param {string} versionKey
     * @returns {string}
     */
    static rewriteHtmlDocument(source, versionKey) {
        return String(source || '')
            .replace(
                /((?:href|src)=")(\/favicon\.svg(?:\?[^"]*)?)(")/g,
                (_match, prefix, assetPath, suffix) =>
                    prefix +
                    ServerAssetVersioner.appendVersionQuery(
                        assetPath,
                        versionKey
                    ) +
                    suffix
            )
            .replace(
                /href="\/style\.css(?:\?[^"]*)?"/g,
                'href="' +
                    ServerAssetVersioner.appendVersionQuery(
                        '/style.css',
                        versionKey
                    ) +
                    '"'
            )
            .replace(
                /src="\/main\.mjs(?:\?[^"]*)?"/g,
                'src="' +
                    ServerAssetVersioner.appendVersionQuery(
                        '/main.mjs',
                        versionKey
                    ) +
                    '"'
            )
    }

    /**
     * Rewrites local ESM import specifiers and worker URLs to the same version
     * key so transitive browser module caches cannot drift behind the entry.
     * @param {string} source
     * @param {string} versionKey
     * @returns {string}
     */
    static rewriteJavaScriptModule(source, versionKey) {
        const rewrittenSource =
            ServerAssetVersioner.rewriteRelativeJavaScriptSpecifiers(
                source,
                versionKey
            )

        return ServerAssetVersioner.rewriteBareJavaScriptSpecifiers(
            rewrittenSource,
            versionKey
        )
    }
}
