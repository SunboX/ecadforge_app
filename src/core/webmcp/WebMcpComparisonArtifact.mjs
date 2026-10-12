import { ComponentGrouping } from 'altium-toolkit/extensions'
import { EcadDocumentComponents } from '../ecad/EcadDocumentComponents.mjs'
import { WebMcpDesignAnalyzer } from './WebMcpDesignAnalyzer.mjs'

/** Serializes a read-only comparison into a deterministic local JSON artifact. */
export class WebMcpComparisonArtifact {
    /**
     * Builds an artifact without downloading, uploading or submitting feedback.
     * @param {object} schematic Loaded schematic entry.
     * @param {object} pcb Loaded PCB entry.
     * @param {object} comparison Connectivity comparison.
     * @returns {{ file_name: string, mime_type: string, content: string }}
     */
    static create(schematic, pcb, comparison) {
        const schematicRefs = this.#references(schematic)
        const pcbRefs = this.#references(pcb)
        const references = [...new Set([...schematicRefs, ...pcbRefs])].sort(
            ComponentGrouping.naturalSort
        )
        const report = {
            schema_version: 1,
            kind: 'schematic_pcb_comparison',
            identifier_scope: 'loaded_session',
            designs: {
                schematic: this.#design(schematic),
                pcb: this.#design(pcb)
            },
            components: references.map((refdes) => ({
                id: JSON.stringify([schematic.id, pcb.id, refdes]),
                refdes,
                schematic_component_id: schematicRefs.has(refdes)
                    ? JSON.stringify([schematic.id, refdes])
                    : null,
                pcb_component_id: pcbRefs.has(refdes)
                    ? JSON.stringify([pcb.id, refdes])
                    : null
            })),
            comparison
        }
        return {
            file_name: 'schematic-pcb-comparison.json',
            mime_type: 'application/json',
            content: JSON.stringify(report, null, 2)
        }
    }

    /** @param {object} entry Loaded entry. @returns {object} Explicit session identity. */
    static #design(entry) {
        return {
            id: entry.id,
            name: WebMcpDesignAnalyzer.entryName(entry),
            file_name: entry.fileName,
            source_format: entry.sourceFormat
        }
    }

    /** @param {object} entry Loaded entry. @returns {Set<string>} Logical component references. */
    static #references(entry) {
        return new Set(
            EcadDocumentComponents.resolve(entry.documentModel)
                .map((component) =>
                    String(
                        component.designator ||
                            component.refdes ||
                            component.reference ||
                            ''
                    ).trim()
                )
                .filter(Boolean)
        )
    }
}
