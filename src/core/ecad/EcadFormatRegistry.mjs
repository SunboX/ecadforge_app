/**
 * Central registry for supported ECAD file roles.
 */
export class EcadFormatRegistry {
    /**
     * Returns true for the shared immutable toolkit document envelope.
     * @param {unknown} documentModel Document model candidate.
     * @returns {boolean}
     */
    static isCanonicalDocument(documentModel) {
        return Boolean(
            documentModel &&
            typeof documentModel === 'object' &&
            documentModel.schema === 'ecad-toolkit.document.v1' &&
            Array.isArray(documentModel.model)
        )
    }

    /**
     * Returns true when shared CircuitJSON services can consume a document
     * directly without a native compatibility model.
     * @param {unknown} documentModel Document model candidate.
     * @returns {boolean}
     */
    static isCircuitJsonDocument(documentModel) {
        if (EcadFormatRegistry.isCanonicalDocument(documentModel)) return true
        if (!EcadFormatRegistry.#isElementArrayDocument(documentModel)) {
            return false
        }

        const sourceFormat = String(documentModel?.sourceFormat || '').trim()
        if (sourceFormat === 'circuitjson') return true
        return !EcadFormatRegistry.#hasCompatibilityModel(documentModel)
    }

    /**
     * Returns the CircuitJSON element array carried by a supported document.
     * @param {unknown} documentModel Document model candidate.
     * @returns {object[]}
     */
    static circuitJsonElementsForDocument(documentModel) {
        if (Array.isArray(documentModel)) return documentModel
        if (Array.isArray(documentModel?.model)) return documentModel.model
        if (Array.isArray(documentModel?.elements)) {
            return documentModel.elements
        }
        if (Array.isArray(documentModel?.circuitJson)) {
            return documentModel.circuitJson
        }
        return []
    }

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

        if (normalized.endsWith('.kicad_mod')) {
            return { sourceFormat: 'kicad', fileType: 'kicad_mod' }
        }

        if (normalized.endsWith('.kicad_sym')) {
            return { sourceFormat: 'kicad', fileType: 'kicad_sym' }
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

        if (normalized.endsWith('.wrl')) {
            return 'wrl'
        }

        if (normalized.endsWith('.vrml')) {
            return 'vrml'
        }

        if (normalized.endsWith('.step') || normalized.endsWith('.stp')) {
            return 'step'
        }

        if (normalized.endsWith('.glb')) {
            return 'glb'
        }

        if (normalized.endsWith('.gltf')) {
            return 'gltf'
        }

        if (normalized.endsWith('.stl')) {
            return 'stl'
        }

        if (normalized.endsWith('.obj')) {
            return 'obj'
        }

        if (normalized.endsWith('.3mf')) {
            return '3mf'
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
        const sourceFormat = String(
            documentModel?.source?.format || documentModel?.sourceFormat || ''
        ).trim()
        if (sourceFormat) return sourceFormat
        if (EcadFormatRegistry.#hasCompatibilityModel(documentModel)) {
            return 'altium'
        }
        if (EcadFormatRegistry.#isElementArrayDocument(documentModel)) {
            return 'circuitjson'
        }
        return 'altium'
    }

    /**
     * Returns true when a parser has attached app-native schematic or PCB data.
     * @param {unknown} documentModel Document model candidate.
     * @returns {boolean}
     */
    static #hasCompatibilityModel(documentModel) {
        return Boolean(
            documentModel &&
            typeof documentModel === 'object' &&
            (documentModel.schematic || documentModel.pcb || documentModel.bom)
        )
    }

    /**
     * Returns true for serialized element-array document models.
     * @param {unknown} documentModel Document model candidate.
     * @returns {boolean}
     */
    static #isElementArrayDocument(documentModel) {
        return EcadFormatRegistry.circuitJsonElementsForDocument(
            documentModel
        ).some(
            (element) =>
                element &&
                typeof element === 'object' &&
                typeof element.type === 'string' &&
                (element.type.startsWith('pcb_') ||
                    element.type.startsWith('schematic_') ||
                    element.type.startsWith('source_') ||
                    element.type === 'cad_component')
        )
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
