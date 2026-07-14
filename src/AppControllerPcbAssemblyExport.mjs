import { AppControllerParserData } from './AppControllerParserData.mjs'
import { ManufacturingService } from 'circuitjson-toolkit/manufacturing'

const MANUFACTURING_FORMATS = new Set(
    ManufacturingService.listExports([]).map((entry) => entry.id)
)

/**
 * Handles whole-PCB 3D assembly exports from sidebar actions.
 */
export class AppControllerPcbAssemblyExport {
    /**
     * Exports the active PCB assembly or manufacturing metadata.
     * @param {{ change?: { documentId?: string, format?: string }, state: { getSnapshot: () => object, setValue?: (key: string, value: any) => object }, view: { showExportProgress?: (progress: { title?: string, value?: number, message?: string }) => void, updateExportProgress?: (progress: { value?: number, message?: string }) => void, hideExportProgress?: () => void, downloadBytes?: (fileName: string, bytes: Uint8Array, contentType: string) => void, setStatus?: (message: string) => void }, pcbAssemblyExportService: { export: (options: { format?: string, documentId?: string, documentModel?: object | null, documents?: object[], sessionAssets?: object[], boardTextureFormat?: string, onProgress?: (progress: { value: number, message: string }) => void }) => Promise<{ fileName: string, bytes: Uint8Array, contentType: string, diagnostics?: object[] }> }, modelSearchService?: { resolveSessionAssets?: (documentModel: object, options: { enabled?: boolean, sessionAssets?: object[] }) => Promise<object[]> } | null }} options Export handling options.
     * @returns {Promise<void>}
     */
    static async handle(options) {
        const snapshot = options.state.getSnapshot()
        const change = options.change || {}
        const documentId = String(
            change?.documentId || snapshot.activeDocumentId || ''
        )
        const documentModel =
            snapshot.documents?.find((entry) => entry.id === documentId)
                ?.documentModel || snapshot.documentModel
        const format = String(change?.format || 'step')

        if (MANUFACTURING_FORMATS.has(format)) {
            AppControllerPcbAssemblyExport.#handleManufacturingDownload(
                options,
                documentModel,
                format
            )
            return
        }

        try {
            options.view.showExportProgress?.({
                title: 'Exporting PCB assembly',
                value: 0,
                message: 'Preparing PCB assembly export'
            })
            const sessionAssets =
                await AppControllerPcbAssemblyExport.#resolveSessionAssets(
                    options,
                    snapshot,
                    documentModel
                )
            const exportResult = await options.pcbAssemblyExportService.export({
                format,
                documentId,
                documentModel,
                documents: snapshot.documents,
                sessionAssets,
                ...AppControllerPcbAssemblyExport.#boardTextureExportOptions(
                    format
                ),
                onProgress: (progress) =>
                    options.view.updateExportProgress?.(progress)
            })

            options.view.downloadBytes?.(
                exportResult.fileName,
                exportResult.bytes,
                exportResult.contentType
            )
            options.view.setStatus?.(
                AppControllerPcbAssemblyExport.#statusMessage(exportResult)
            )
        } catch (error) {
            options.view.setStatus?.(
                'PCB assembly export failed: ' + String(error?.message || error)
            )
        } finally {
            options.view.hideExportProgress?.()
        }
    }

    /**
     * Builds board texture export defaults for texture-heavy payload formats.
     * @param {string} format Export format.
     * @returns {{ boardTextureFormat?: string }}
     */
    static #boardTextureExportOptions(format) {
        return String(format).toLowerCase() === 'glb'
            ? { boardTextureFormat: 'png' }
            : {}
    }

    /**
     * Downloads manufacturing metadata from the active document.
     * @param {{ view: { downloadBytes?: (fileName: string, bytes: Uint8Array, contentType: string) => void, setStatus?: (message: string) => void } }} options Export handling options.
     * @param {object | null} documentModel Active document model.
     * @param {string} format Export format.
     * @returns {void}
     */
    static #handleManufacturingDownload(options, documentModel, format) {
        try {
            const download = ManufacturingService.export(documentModel, {
                id: format
            })
            options.view.downloadBytes?.(
                download.fileName,
                download.data,
                download.mediaType
            )
            options.view.setStatus?.('Exported ' + download.fileName)
        } catch (error) {
            options.view.setStatus?.(
                'Manufacturing export failed: ' +
                    String(error?.message || error)
            )
        }
    }

    /**
     * Resolves model assets and filters scoped search assets for export.
     * @param {{ state: { getSnapshot?: () => object, setValue?: (key: string, value: any) => object }, modelSearchService?: { resolveSessionAssets?: (documentModel: object, options: { enabled?: boolean, sessionAssets?: object[] }) => Promise<object[]> } | null }} options Export handling options.
     * @param {{ autoSearchMissingModels?: boolean, sessionAssets?: object[] }} snapshot Current snapshot.
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
            AppControllerPcbAssemblyExport.#sessionAssetsChanged(
                currentAssets,
                nextSessionAssets
            )
        ) {
            options.state.setValue?.('sessionAssets', nextSessionAssets)
        }

        return resolvedSessionAssets
    }

    /**
     * Returns true when resolved assets change the session list.
     * @param {object[]} currentAssets Current assets.
     * @param {object[]} resolvedAssets Resolved assets.
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

    /**
     * Builds the user-facing export status message.
     * @param {{ fileName?: string, diagnostics?: object[] }} exportResult Export result.
     * @returns {string}
     */
    static #statusMessage(exportResult) {
        const diagnostics = Array.isArray(exportResult?.diagnostics)
            ? exportResult.diagnostics
            : []
        const warnings = diagnostics.filter(
            (diagnostic) => diagnostic?.severity === 'warning'
        ).length

        return (
            'Exported ' +
            String(exportResult?.fileName || 'PCB assembly') +
            (warnings ? ' with ' + warnings + ' warning(s)' : '')
        )
    }
}
