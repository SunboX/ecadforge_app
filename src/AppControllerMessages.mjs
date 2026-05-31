/**
 * Resolves AppController fallback messages and coarse parser error buckets.
 */
export class AppControllerMessages {
    /**
     * Returns a fallback status text when i18n is disabled.
     * @param {string} key Message key.
     * @returns {string}
     */
    static fallback(key) {
        const fallbackMap = {
            'status.ready':
                'Drop .PcbDoc, .SchDoc, .kicad_pcb or KiCad project files here. Files are processed locally in your browser.',
            'status.loading': 'Parsing native ECAD files in the browser...',
            'status.loaded':
                'Design loaded locally. Use the tabs to inspect PCB, schematic, 3D view, BOM and diagnostics.',
            'status.invalidFile':
                'This file type is not supported yet. ECAD Forge currently supports selected Altium and KiCad design files. Try a sample project or open a supported board/schematic file.',
            'status.assetsAdded':
                'Companion 3D assets added to the current session.',
            'status.localeChanged': 'Language updated.',
            'status.unknownSample': 'Unknown sample project.',
            'status.loadingSample':
                'Loading sample project locally in your browser...',
            'status.loadedSample':
                'This sample project is parsed locally in your browser. Try switching between schematic, PCB, 3D, BOM and diagnostics.',
            'status.loadingGithub':
                'Loading the GitHub source. Parsing still happens locally in your browser...',
            'status.loadedGithub':
                'Design loaded locally. The external file was fetched from GitHub, then parsed in your browser.',
            'status.browserFetchUnavailable': 'Browser fetch is unavailable.',
            'status.sampleLoadHttp': 'Could not load sample file. HTTP',
            'status.noDocuments': 'Parser did not return any documents.',
            'status.refreshing':
                'Refreshing viewer to load the latest renderer...'
        }
        return fallbackMap[key] || key
    }

    /**
     * Normalizes an error message.
     * @param {unknown} error Error value.
     * @returns {string}
     */
    static getErrorMessage(error) {
        if (error instanceof Error && error.message) {
            return error.message
        }
        return 'Unknown parser error.'
    }

    /**
     * Resolves a coarse analytics error bucket.
     * @param {unknown} error Error value.
     * @returns {string}
     */
    static resolveErrorBucket(error) {
        const message =
            AppControllerMessages.getErrorMessage(error).toLowerCase()
        if (message.includes('not supported')) return 'unsupported_file'
        if (message.includes('http')) return 'http'
        if (message.includes('cors') || message.includes('network')) {
            return 'network_or_cors'
        }
        return 'parse'
    }
}
