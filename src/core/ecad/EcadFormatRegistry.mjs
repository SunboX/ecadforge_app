/**
 * Central registry for supported ECAD file roles.
 */
export class EcadFormatRegistry {
    /**
     * Returns true when a file can produce one or more viewer documents.
     * @param {string} fileName Source file name.
     * @returns {boolean}
     */
    static isNativeDocument(fileName) {
        return Boolean(EcadFormatRegistry.resolveNativeRole(fileName))
    }

    /**
     * Returns true when a file is a companion project/model/library asset.
     * @param {string} fileName Source file name.
     * @returns {boolean}
     */
    static isCompanionAsset(fileName) {
        return Boolean(EcadFormatRegistry.resolveCompanionFormat(fileName))
    }

    /**
     * Resolves the parser role for one source file.
     * @param {string} fileName Source file name.
     * @returns {{ sourceFormat: string, fileType: string } | null}
     */
    static resolveNativeRole(fileName) {
        const normalized = String(fileName || '').toLowerCase()

        if (normalized.endsWith('.schdoc')) {
            return { sourceFormat: 'altium', fileType: 'schdoc' }
        }

        if (normalized.endsWith('.pcbdoc')) {
            return { sourceFormat: 'altium', fileType: 'pcbdoc' }
        }

        if (normalized.endsWith('.kicad_pro')) {
            return { sourceFormat: 'kicad', fileType: 'kicad_pro' }
        }

        if (normalized.endsWith('.kicad_sch')) {
            return { sourceFormat: 'kicad', fileType: 'kicad_sch' }
        }

        if (normalized.endsWith('.kicad_pcb')) {
            return { sourceFormat: 'kicad', fileType: 'kicad_pcb' }
        }

        if (normalized.endsWith('.zip')) {
            return { sourceFormat: 'kicad', fileType: 'zip' }
        }

        return null
    }

    /**
     * Resolves the normalized companion asset format.
     * @param {string} fileName Source file name.
     * @returns {string}
     */
    static resolveCompanionFormat(fileName) {
        const normalized = String(fileName || '').toLowerCase()

        if (normalized.endsWith('.wrl') || normalized.endsWith('.vrml')) {
            return 'wrl'
        }

        if (normalized.endsWith('.step') || normalized.endsWith('.stp')) {
            return 'step'
        }

        if (normalized.endsWith('.prjpcb')) {
            return 'altium-project'
        }

        if (
            normalized.endsWith('.kicad_sym') ||
            normalized.endsWith('.kicad_mod')
        ) {
            return 'kicad-library'
        }

        return ''
    }

    /**
     * Returns the active source format for one document model.
     * @param {object | null | undefined} documentModel Document model.
     * @returns {string}
     */
    static sourceFormatForDocument(documentModel) {
        return String(documentModel?.sourceFormat || 'altium')
    }
}
