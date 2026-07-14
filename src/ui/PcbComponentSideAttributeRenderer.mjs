import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'
import { PcbComponentSelectionModel } from '../core/PcbComponentSelectionModel.mjs'
import { EcadDocumentComponents } from '../core/ecad/EcadDocumentComponents.mjs'

/**
 * Adds component-side attributes to rendered PCB SVG elements.
 */
export class PcbComponentSideAttributeRenderer {
    /**
     * Tags component-keyed markup with component-side attributes.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {object} documentModel Parsed document model.
     * @param {object[] | null} [components] Reused component rows.
     * @param {object | null} [interactionModel] Reused primitive model.
     * @returns {string}
     */
    static render(
        markup,
        documentModel,
        components = null,
        interactionModel = null
    ) {
        const sideByKey = PcbComponentSideAttributeRenderer.#componentSideByKey(
            documentModel,
            components
        )
        const unresolvedKeys = new Set()
        const renderedMarkup = PcbComponentSideAttributeRenderer.#renderSides(
            markup,
            sideByKey,
            unresolvedKeys
        )
        if (!unresolvedKeys.size) return renderedMarkup

        PcbComponentSideAttributeRenderer.#appendInteractionSides(
            sideByKey,
            interactionModel ??
                PcbInteractionPrimitiveModel.build(documentModel)
        )
        return PcbComponentSideAttributeRenderer.#renderSides(
            renderedMarkup,
            sideByKey
        )
    }

    /**
     * Tags known component sides and records unresolved renderer keys.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {Map<string, string>} sideByKey Component sides by key.
     * @param {Set<string> | null} [unresolvedKeys] Unresolved key collector.
     * @returns {string}
     */
    static #renderSides(markup, sideByKey, unresolvedKeys = null) {
        return String(markup).replace(
            /<([a-zA-Z][a-zA-Z0-9:-]*)\b(?=[^>]*\bdata-component-key="([^"]+)")[^>]*>/g,
            (match, _tagName, componentKey) => {
                if (match.includes('data-pcb-component-side=')) return match

                const key = String(componentKey || '')
                const side = sideByKey.get(key)
                if (!side) {
                    unresolvedKeys?.add(key)
                    return match
                }

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
     * @param {object[] | null} components Reused component rows.
     * @returns {Map<string, string>}
     */
    static #componentSideByKey(documentModel, components) {
        const sides = new Map()
        const componentRows = Array.isArray(components)
            ? components
            : EcadDocumentComponents.resolve(documentModel)
        for (let index = 0; index < componentRows.length; index += 1) {
            const component = componentRows[index]
            const side =
                PcbComponentSelectionModel.resolveComponentSide(component)
            for (const key of [
                PcbComponentSelectionModel.resolveComponentKey(
                    component,
                    index
                ),
                component.designator,
                component.reference,
                component.refdes,
                component.name,
                component.componentKey,
                component.key,
                component.pcbComponentId,
                component.sourceComponentId
            ]) {
                PcbComponentSideAttributeRenderer.#appendSideEntry(
                    sides,
                    key,
                    side
                )
            }
        }
        return sides
    }

    /**
     * Supplements component sides from the generic interaction model.
     * @param {Map<string, string>} sides Mutable component-side map.
     * @param {object} model Prepared interaction model.
     * @returns {void}
     */
    static #appendInteractionSides(sides, model) {
        for (const component of model.components || []) {
            for (const key of [
                component.designator,
                component.componentKey,
                component.name,
                component.key
            ]) {
                PcbComponentSideAttributeRenderer.#appendSideEntry(
                    sides,
                    key,
                    component.side
                )
            }
        }
        for (const primitive of model.primitives || []) {
            PcbComponentSideAttributeRenderer.#appendSideEntry(
                sides,
                primitive.componentKey,
                primitive.side
            )
        }
    }

    /**
     * Appends a component key and side pair when both are usable.
     * @param {Map<string, string>} sides Mutable component-side map.
     * @param {unknown} key Component key candidate.
     * @param {unknown} side Component side candidate.
     * @returns {void}
     */
    static #appendSideEntry(sides, key, side) {
        const normalizedKey = String(key || '').trim()
        const normalizedSide = String(side || '').trim()
        if (normalizedKey && normalizedSide) {
            sides.set(normalizedKey, normalizedSide)
        }
    }
}
