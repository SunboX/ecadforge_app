import { AppControllerParserData } from './AppControllerParserData.mjs'

/**
 * Handles whole-PCB 3D assembly exports from sidebar actions.
 */
export class AppControllerPcbAssemblyExport {
    /**
     * Exports the active PCB assembly as STEP or WRL.
     * @param {{ change?: { documentId?: string, format?: string }, state: { getSnapshot: () => object, setValue?: (key: string, value: any) => object }, view: { showExportProgress?: (progress: { title?: string, value?: number, message?: string }) => void, updateExportProgress?: (progress: { value?: number, message?: string }) => void, hideExportProgress?: () => void, downloadBytes?: (fileName: string, bytes: Uint8Array, contentType: string) => void, setStatus?: (message: string) => void }, pcbAssemblyExportService: { export: (options: { format?: string, documentId?: string, documentModel?: object | null, documents?: object[], sessionAssets?: object[], onProgress?: (progress: { value: number, message: string }) => void }) => Promise<{ fileName: string, bytes: Uint8Array, contentType: string, diagnostics?: object[] }> }, modelSearchService?: { resolveSessionAssets?: (documentModel: object, options: { enabled?: boolean, sessionAssets?: object[] }) => Promise<object[]> } | null }} options Export handling options.
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
                format: String(change?.format || 'step'),
                documentId,
                documentModel,
                documents: snapshot.documents,
                sessionAssets,
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
     * Resolves model-search assets for export when enabled.
     * @param {{ state: { setValue?: (key: string, value: any) => object }, modelSearchService?: { resolveSessionAssets?: (documentModel: object, options: { enabled?: boolean, sessionAssets?: object[] }) => Promise<object[]> } | null }} options Export handling options.
     * @param {{ autoSearchMissingModels?: boolean, sessionAssets?: object[] }} snapshot Current snapshot.
     * @param {object | null} documentModel Active document model.
     * @returns {Promise<object[]>}
     */
    static async #resolveSessionAssets(options, snapshot, documentModel) {
        const sessionAssets = Array.isArray(snapshot.sessionAssets)
            ? snapshot.sessionAssets
            : []
        const resolver = options.modelSearchService?.resolveSessionAssets
        if (
            snapshot.autoSearchMissingModels !== true ||
            !documentModel ||
            typeof resolver !== 'function'
        ) {
            return sessionAssets
        }

        const resolvedAssets = await resolver.call(
            options.modelSearchService,
            documentModel,
            {
                enabled: true,
                sessionAssets
            }
        )
        const mergedAssets = AppControllerParserData.mergeSessionAssets(
            sessionAssets,
            Array.isArray(resolvedAssets) ? resolvedAssets : []
        )

        if (
            AppControllerPcbAssemblyExport.#sessionAssetsChanged(
                sessionAssets,
                mergedAssets
            )
        ) {
            options.state.setValue?.('sessionAssets', mergedAssets)
        }

        return mergedAssets
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
                current.file !== asset.file
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
