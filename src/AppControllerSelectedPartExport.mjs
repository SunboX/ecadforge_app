import { AppControllerParserData } from './AppControllerParserData.mjs'

/**
 * Handles selected-part ECAD library exports from sidebar actions.
 */
export class AppControllerSelectedPartExport {
    /**
     * Exports the selected part as a target ECAD library ZIP.
     * @param {{ change?: { documentId?: string, componentKey?: string, format?: string }, state: { getSnapshot: () => object, setValue?: (key: string, value: any) => object }, view: object, selectedPartExportService: { export: (options: object) => Promise<{ archiveName: string, archiveBytes: Uint8Array }> }, modelSearchService?: { resolveSessionAssets?: (documentModel: object, options: { enabled?: boolean, sessionAssets?: object[] }) => Promise<object[]> } | null }} options Export handling options.
     * @returns {Promise<void>}
     */
    static async handle(options) {
        const snapshot = options.state.getSnapshot()
        const change = options.change || {}
        const documentId = String(
            change?.documentId || snapshot.activeDocumentId
        )
        const documentModel =
            snapshot.documents.find((entry) => entry.id === documentId)
                ?.documentModel || snapshot.documentModel
        const selectedComponentKey = String(
            snapshot.selectedPcbComponents?.[documentId] ||
                change?.componentKey ||
                ''
        )

        try {
            const sessionAssets =
                await AppControllerSelectedPartExport.#resolveSessionAssets(
                    options,
                    snapshot,
                    documentModel
                )
            const archive = await options.selectedPartExportService.export({
                format: String(change?.format || ''),
                documentId,
                selectedComponentKey,
                documentModel,
                documents: snapshot.documents,
                sessionAssets
            })

            options.view.downloadBytes?.(
                archive.archiveName,
                archive.archiveBytes,
                'application/zip'
            )
            options.view.setStatus?.('Exported ' + archive.archiveName)
        } catch (error) {
            options.view.setStatus?.(
                'Selected part export failed: ' +
                    String(error?.message || error)
            )
        }
    }

    /**
     * Resolves model assets and filters scoped search assets for the export.
     * @param {{ state: { getSnapshot?: () => object, setValue?: (key: string, value: any) => object }, modelSearchService?: { resolveSessionAssets?: (documentModel: object, options: { enabled?: boolean, sessionAssets?: object[] }) => Promise<object[]> } | null }} options Export handling options.
     * @param {{ autoSearchMissingModels?: boolean, sessionAssets?: object[] }} snapshot Current state snapshot.
     * @param {object | null} documentModel Active document model.
     * @returns {Promise<object[]>}
     */
    static async #resolveSessionAssets(options, snapshot, documentModel) {
        const sessionAssets = Array.isArray(snapshot.sessionAssets)
            ? snapshot.sessionAssets
            : []
        const resolver = options.modelSearchService?.resolveSessionAssets
        if (!documentModel || typeof resolver !== 'function') {
            return sessionAssets
        }

        const enabled = snapshot.autoSearchMissingModels === true
        const resolvedAssets = await resolver.call(
            options.modelSearchService,
            documentModel,
            {
                enabled,
                sessionAssets
            }
        )
        const resolvedSessionAssets = Array.isArray(resolvedAssets)
            ? resolvedAssets
            : sessionAssets
        if (!enabled) {
            return resolvedSessionAssets
        }

        const nextSnapshot = options.state.getSnapshot?.() || snapshot
        const documentStillOpen = (nextSnapshot.documents || []).some(
            (entry) => entry?.documentModel === documentModel
        )
        if (
            nextSnapshot.autoSearchMissingModels !== true ||
            !documentStillOpen
        ) {
            return resolvedSessionAssets
        }

        const currentAssets = Array.isArray(nextSnapshot.sessionAssets)
            ? nextSnapshot.sessionAssets
            : []
        // Preserve concurrent and other-document state without leaking it into this export.
        const nextSessionAssets = AppControllerParserData.mergeSessionAssets(
            currentAssets,
            resolvedSessionAssets
        )

        if (
            AppControllerSelectedPartExport.#sessionAssetsChanged(
                currentAssets,
                nextSessionAssets
            )
        ) {
            options.state.setValue?.('sessionAssets', nextSessionAssets)
        }

        return resolvedSessionAssets
    }

    /**
     * Returns true when resolved assets add or replace exportable entries.
     * @param {object[]} currentAssets Existing session assets.
     * @param {object[]} resolvedAssets Resolved session assets.
     * @returns {boolean}
     */
    static #sessionAssetsChanged(currentAssets, resolvedAssets) {
        if (currentAssets.length !== resolvedAssets.length) {
            return true
        }

        return resolvedAssets.some((asset, index) => {
            const current = currentAssets[index] || {}
            return (
                current.name !== asset.name ||
                current.relativePath !== asset.relativePath ||
                current.format !== asset.format ||
                current.file !== asset.file ||
                current.source !== asset.source ||
                current.sourceUrl !== asset.sourceUrl ||
                current.componentKey !== asset.componentKey ||
                current.documentScope !== asset.documentScope ||
                JSON.stringify(current.aliases || []) !==
                    JSON.stringify(asset.aliases || [])
            )
        })
    }
}
