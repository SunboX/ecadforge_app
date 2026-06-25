import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/renderers'

/**
 * Adds component-side attributes to rendered PCB SVG elements.
 */
export class PcbComponentSideAttributeRenderer {
    /**
     * Tags component-keyed markup with component-side attributes.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {object} documentModel Parsed document model.
     * @returns {string}
     */
    static render(markup, documentModel) {
        const sideByKey =
            PcbComponentSideAttributeRenderer.#componentSideByKey(documentModel)
        if (!sideByKey.size) return String(markup)

        return String(markup).replace(
            /<([a-zA-Z][a-zA-Z0-9:-]*)\b(?=[^>]*\bdata-component-key="([^"]+)")[^>]*>/g,
            (match, _tagName, componentKey) => {
                if (match.includes('data-pcb-component-side=')) return match

                const side = sideByKey.get(String(componentKey || ''))
                if (!side) return match

                return match.replace(
                    /^<([a-zA-Z][a-zA-Z0-9:-]*)\b/,
                    '<$1 data-pcb-component-side="' + side + '"'
                )
            }
        )
    }

    /**
     * Resolves component side by displayed component key.
     * @param {object} documentModel Parsed document model.
     * @returns {Map<string, string>}
     */
    static #componentSideByKey(documentModel) {
        const model = PcbInteractionPrimitiveModel.build(documentModel)
        const entries = []
        for (const component of model.components || []) {
            for (const key of [
                component.designator,
                component.componentKey,
                component.name,
                component.key
            ]) {
                PcbComponentSideAttributeRenderer.#appendSideEntry(
                    entries,
                    key,
                    component.side
                )
            }
        }
        for (const primitive of model.primitives || []) {
            PcbComponentSideAttributeRenderer.#appendSideEntry(
                entries,
                primitive.componentKey,
                primitive.side
            )
        }
        return new Map(entries)
    }

    /**
     * Appends a component key and side pair when both are usable.
     * @param {Array<[string, string]>} entries Mutable entry list.
     * @param {unknown} key Component key candidate.
     * @param {unknown} side Component side candidate.
     * @returns {void}
     */
    static #appendSideEntry(entries, key, side) {
        const normalizedKey = String(key || '').trim()
        const normalizedSide = String(side || '').trim()
        if (normalizedKey && normalizedSide) {
            entries.push([normalizedKey, normalizedSide])
        }
    }
}
