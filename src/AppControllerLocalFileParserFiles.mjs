import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'

/**
 * Resolves local files that should be submitted to the ECAD parser.
 */
export class AppControllerLocalFileParserFiles {
    /**
     * Resolves selected files that should be sent to the parser.
     * @param {File[]} nativeFiles Files that create viewer documents.
     * @param {File[]} companionFiles Supported local companion assets.
     * @returns {File[]}
     */
    static resolve(nativeFiles, companionFiles) {
        const hasKiCadNative = nativeFiles.some((file) => {
            return (
                EcadFormatRegistry.resolveNativeRole(file?.name)
                    ?.sourceFormat === 'kicad'
            )
        })

        if (!hasKiCadNative) {
            return nativeFiles
        }

        const kicadLibraryFiles = companionFiles.filter((file) => {
            return (
                EcadFormatRegistry.resolveCompanionFormat(file?.name) ===
                'kicad-library'
            )
        })

        return AppControllerLocalFileParserFiles.#dedupeByRelativePath([
            ...nativeFiles,
            ...kicadLibraryFiles
        ])
    }

    /**
     * Deduplicates browser File objects by their project-relative path.
     * @param {File[]} files Selected files.
     * @returns {File[]}
     */
    static #dedupeByRelativePath(files) {
        const deduped = new Map()

        for (const file of files || []) {
            const key = String(
                file?.webkitRelativePath || file?.name || ''
            ).toLowerCase()
            if (key) {
                deduped.set(key, file)
            }
        }

        return [...deduped.values()]
    }
}
