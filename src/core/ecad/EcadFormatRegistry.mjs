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

        if (EcadFormatRegistry.#isGerberFileName(normalized)) {
            return { sourceFormat: 'gerber', fileType: 'gerber' }
        }

        if (EcadFormatRegistry.#isDrillFileName(normalized)) {
            return { sourceFormat: 'gerber', fileType: 'drill' }
        }

        if (normalized.endsWith('.zip')) {
            return { sourceFormat: 'kicad', fileType: 'zip' }
        }

        if (normalized.endsWith('.json')) {
            return { sourceFormat: 'circuitjson', fileType: 'circuitjson' }
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

    /**
     * Returns true for common Gerber layer file names.
     * @param {string} normalized Lowercase file name.
     * @returns {boolean}
     */
    static #isGerberFileName(normalized) {
        return /\.(?:gbr|gtl|gbl|gto|gbo|gts|gbs|gtp|gbp|gko|gm1)$/u.test(
            normalized
        )
    }

    /**
     * Returns true for common Excellon drill file names.
     * @param {string} normalized Lowercase file name.
     * @returns {boolean}
     */
    static #isDrillFileName(normalized) {
        return /\.(?:drl|xln)$/u.test(normalized)
    }
}
