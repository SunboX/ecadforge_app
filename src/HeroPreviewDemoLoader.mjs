import { EcadParserService } from './core/ecad/EcadParserService.mjs'
import { DemoProjectRegistry } from './DemoProjectRegistry.mjs'

/**
 * Loads the bundled demo documents that power the landing-page preview.
 */
export class HeroPreviewDemoLoader {
    /**
     * Parses the local KiCad demo and forwards the documents to the view.
     * @param {{ setHeroPreviewDocuments?: (documentModels: any[]) => void }} view App view.
     * @param {{ fetcher?: (url: string) => Promise<Response>, parser?: { parseEntries?: (entries: { name: string, buffer: ArrayBuffer }[]) => Promise<object> | object } }} [options] Loader options.
     * @returns {Promise<boolean>}
     */
    static async load(view, options = {}) {
        if (typeof view?.setHeroPreviewDocuments !== 'function') {
            return false
        }

        const fetcher =
            options.fetcher ||
            (typeof globalThis.fetch === 'function'
                ? globalThis.fetch.bind(globalThis)
                : null)
        if (!fetcher) {
            return false
        }

        try {
            const demo = DemoProjectRegistry.get('kicad')
            if (!demo) {
                return false
            }

            const entries = await Promise.all(
                demo.files.map((file) =>
                    HeroPreviewDemoLoader.#fetchParserEntry(fetcher, file)
                )
            )
            const parser = options.parser || EcadParserService
            const parseResult = await parser.parseEntries(entries)
            const documents = Array.isArray(parseResult?.documents)
                ? parseResult.documents
                : []

            view.setHeroPreviewDocuments(documents)
            return true
        } catch (_error) {
            return false
        }
    }

    /**
     * Fetches one bundled demo file as a parser entry.
     * @param {(url: string) => Promise<Response>} fetcher Browser fetch function.
     * @param {{ path: string, name: string }} file Demo file descriptor.
     * @returns {Promise<{ name: string, buffer: ArrayBuffer }>}
     */
    static async #fetchParserEntry(fetcher, file) {
        const response = await fetcher(file.path)
        if (!response?.ok) {
            throw new Error(
                'Could not load preview demo file. HTTP ' +
                    String(response?.status || 0)
            )
        }

        return {
            name: file.name,
            buffer: await response.arrayBuffer()
        }
    }
}
