/**
 * Builds cache-busted frontend worker module URLs.
 */
export class WorkerUrlBuilder {
    /**
     * Resolves the parser worker module path relative to one entry module URL.
     * @param {string} entryModuleUrl
     * @param {string} cacheKey
     * @returns {URL}
     */
    static buildParserWorkerUrl(entryModuleUrl, cacheKey) {
        const workerUrl = new URL(
            './workers/ecad-parser.worker.mjs',
            entryModuleUrl
        )

        workerUrl.searchParams.set('v', String(cacheKey || '0'))
        return workerUrl
    }

    /**
     * Resolves the 3D scene worker module path relative to one entry module
     * URL.
     * @param {string} entryModuleUrl
     * @param {string} cacheKey
     * @returns {URL}
     */
    static buildScene3dWorkerUrl(entryModuleUrl, cacheKey) {
        const workerUrl = new URL(
            './workers/pcb-scene3d.worker.mjs',
            entryModuleUrl
        )

        workerUrl.searchParams.set('v', String(cacheKey || '0'))
        return workerUrl
    }
}
