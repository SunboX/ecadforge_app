import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'
import { PcbComponentSelectionModel } from '../core/PcbComponentSelectionModel.mjs'
import { SvgPanelChromeStripper } from './SvgPanelChromeStripper.mjs'

const OWNER_ID_FIELDS = [
    'ownerIndex',
    'ownerId',
    'ownerUniqueId',
    'componentOwnerId',
    'componentUniqueId',
    'uniqueId'
]

/**
 * Renders schematic SVG content for the main viewer pane.
 */
export class SchematicViewRenderer {
    /**
     * Renders one schematic document with app-owned SVG post-processing.
     * @param {object} documentModel Document model.
     * @param {string} [selectedComponentKey] Selected component key.
     * @returns {string}
     */
    static render(documentModel, selectedComponentKey = '') {
        const markup = SvgPanelChromeStripper.stripMetadataHeader(
            EcadRendererService.renderSchematic(documentModel)
        )
        return SchematicViewRenderer.#injectComponentHighlight(
            markup,
            documentModel,
            selectedComponentKey
        )
    }

    /**
     * Adds a schematic symbol selection overlay when a component is selected.
     * @param {string} markup Rendered schematic markup.
     * @param {object} documentModel Document model.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {string}
     */
    static #injectComponentHighlight(
        markup,
        documentModel,
        selectedComponentKey
    ) {
        const key = String(selectedComponentKey || '').trim()
        const schematic = documentModel?.schematic
        const components = Array.isArray(schematic?.components)
            ? schematic.components
            : []
        if (!key || !components.length) return markup

        const selected = SchematicViewRenderer.#resolveSelectedComponent(
            components,
            key
        )
        if (!selected) return markup

        const isKicad =
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'kicad'
        const ownerId = SchematicViewRenderer.#resolveOwnerId(
            schematic,
            selected.component,
            key
        )
        const bounds = SchematicViewRenderer.#resolveHighlightBounds(
            schematic,
            selected.component,
            ownerId,
            isKicad
        )
        if (!bounds) return markup

        const highlight = SchematicViewRenderer.#renderHighlight(
            key,
            SchematicViewRenderer.#padBounds(bounds, isKicad)
        )
        const styledMarkup =
            SchematicViewRenderer.#injectHighlightStyle(markup)
        return SchematicViewRenderer.#injectHighlightMarkup(
            styledMarkup,
            highlight
        )
    }

    /**
     * Finds the selected schematic component metadata.
     * @param {any[]} components Component metadata.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {{ component: any, index: number } | null}
     */
    static #resolveSelectedComponent(components, selectedComponentKey) {
        for (let index = 0; index < components.length; index += 1) {
            const key = PcbComponentSelectionModel.resolveComponentKey(
                components[index],
                index
            )
            if (key === selectedComponentKey) {
                return { component: components[index], index }
            }
        }
        return null
    }

    /**
     * Resolves the primitive owner id for a selected component.
     * @param {object} schematic Schematic model.
     * @param {any} component Component metadata.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {string}
     */
    static #resolveOwnerId(schematic, component, selectedComponentKey) {
        const componentOwner = SchematicViewRenderer.#firstOwnerId(component)
        if (
            componentOwner &&
            SchematicViewRenderer.#hasOwnerPrimitives(schematic, componentOwner)
        ) {
            return componentOwner
        }

        const designator = String(
            component?.designator ??
                component?.reference ??
                component?.refdes ??
                selectedComponentKey
        ).trim()
        const textOwner = SchematicViewRenderer.#resolveDesignatorOwnerId(
            schematic,
            component,
            designator
        )
        return textOwner || componentOwner || ''
    }

    /**
     * Returns the first owner-like id on a primitive.
     * @param {any} item Primitive or component.
     * @returns {string}
     */
    static #firstOwnerId(item) {
        for (const field of OWNER_ID_FIELDS) {
            const value = item?.[field]
            if (value !== undefined && value !== null && value !== '') {
                return String(value)
            }
        }
        return ''
    }

    /**
     * Returns whether any schematic primitive references an owner id.
     * @param {object} schematic Schematic model.
     * @param {string} ownerId Owner id.
     * @returns {boolean}
     */
    static #hasOwnerPrimitives(schematic, ownerId) {
        return SchematicViewRenderer.#ownerPrimitiveCollections(schematic).some(
            (items) =>
                items.some((item) =>
                    SchematicViewRenderer.#matchesOwnerId(item, ownerId)
                )
        )
    }

    /**
     * Resolves an owner id by finding nearby visible designator text.
     * @param {object} schematic Schematic model.
     * @param {any} component Component metadata.
     * @param {string} designator Component designator.
     * @returns {string}
     */
    static #resolveDesignatorOwnerId(schematic, component, designator) {
        const normalizedDesignator = String(designator || '').trim()
        const texts = Array.isArray(schematic?.texts) ? schematic.texts : []
        const candidates = texts
            .map((text) => ({
                ownerId: SchematicViewRenderer.#firstOwnerId(text),
                text,
                value: String(text?.value ?? text?.text ?? '').trim()
            }))
            .filter(
                (entry) =>
                    entry.ownerId && entry.value === normalizedDesignator
            )
            .sort((left, right) => {
                return (
                    SchematicViewRenderer.#distanceFromComponent(
                        left.text,
                        component
                    ) -
                    SchematicViewRenderer.#distanceFromComponent(
                        right.text,
                        component
                    )
                )
            })

        return candidates[0]?.ownerId || ''
    }

    /**
     * Returns squared distance from text to component anchor.
     * @param {{ x?: number, y?: number }} text Text primitive.
     * @param {{ x?: number, y?: number }} component Component metadata.
     * @returns {number}
     */
    static #distanceFromComponent(text, component) {
        const dx = Number(text?.x || 0) - Number(component?.x || 0)
        const dy = Number(text?.y || 0) - Number(component?.y || 0)
        return dx * dx + dy * dy
    }

    /**
     * Resolves the selected symbol bounds in rendered group coordinates.
     * @param {object} schematic Schematic model.
     * @param {any} component Component metadata.
     * @param {string} ownerId Owner id.
     * @param {boolean} isKicad Whether the document uses direct coordinates.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveHighlightBounds(
        schematic,
        component,
        ownerId,
        isKicad
    ) {
        const contentHeight =
            SchematicViewRenderer.#resolveContentHeight(schematic, isKicad)
        const primitiveBounds = ownerId
            ? SchematicViewRenderer.#resolveOwnerBounds(
                  schematic,
                  ownerId,
                  contentHeight,
                  isKicad
              )
            : []
        const bounds = SchematicViewRenderer.#mergeBounds(primitiveBounds)
        return (
            bounds ||
            SchematicViewRenderer.#resolveComponentAnchorBounds(
                component,
                contentHeight,
                isKicad
            )
        )
    }

    /**
     * Resolves bounds for all owner-linked primitives.
     * @param {object} schematic Schematic model.
     * @param {string} ownerId Owner id.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }[]}
     */
    static #resolveOwnerBounds(schematic, ownerId, contentHeight, isKicad) {
        const bounds = SchematicViewRenderer.#ownerPrimitiveCollections(schematic)
            .flatMap((items) =>
                items.filter((item) =>
                    SchematicViewRenderer.#matchesOwnerId(item, ownerId)
                )
            )
            .map((item) => ({
                bounds: SchematicViewRenderer.#resolvePrimitiveBounds(
                    item,
                    contentHeight,
                    isKicad
                ),
                isText: SchematicViewRenderer.#isTextPrimitive(item)
            }))
            .filter((entry) => entry.bounds)
        const geometryBounds = bounds
            .filter((entry) => !entry.isText)
            .map((entry) => entry.bounds)

        return (
            geometryBounds.length
                ? geometryBounds
                : bounds.map((entry) => entry.bounds)
            )
    }

    /**
     * Returns primitive collections that can contribute to symbol bounds.
     * @param {object} schematic Schematic model.
     * @returns {any[][]}
     */
    static #ownerPrimitiveCollections(schematic) {
        return [
            schematic?.rectangles,
            schematic?.polygons,
            schematic?.ellipses,
            schematic?.arcs,
            schematic?.beziers,
            schematic?.lines,
            schematic?.pins,
            schematic?.texts
        ].filter(Array.isArray)
    }

    /**
     * Returns whether one primitive belongs to the given owner id.
     * @param {any} item Primitive metadata.
     * @param {string} ownerId Owner id.
     * @returns {boolean}
     */
    static #matchesOwnerId(item, ownerId) {
        return OWNER_ID_FIELDS.some(
            (field) => String(item?.[field] ?? '') === String(ownerId)
        )
    }

    /**
     * Returns whether one primitive is rendered as text.
     * @param {any} item Primitive metadata.
     * @returns {boolean}
     */
    static #isTextPrimitive(item) {
        return Boolean(item?.text || item?.value)
    }

    /**
     * Resolves one primitive bounds object.
     * @param {any} primitive Primitive metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolvePrimitiveBounds(primitive, contentHeight, isKicad) {
        if (Array.isArray(primitive?.points)) {
            return SchematicViewRenderer.#pointsBounds(
                primitive.points,
                contentHeight,
                isKicad
            )
        }
        if (
            Number.isFinite(Number(primitive?.x)) &&
            Number.isFinite(Number(primitive?.width)) &&
            Number.isFinite(Number(primitive?.height))
        ) {
            return SchematicViewRenderer.#rectangleBounds(
                primitive,
                contentHeight,
                isKicad
            )
        }
        if (
            Number.isFinite(Number(primitive?.x1)) &&
            Number.isFinite(Number(primitive?.x2))
        ) {
            return SchematicViewRenderer.#lineBounds(
                primitive,
                contentHeight,
                isKicad
            )
        }
        if (
            primitive?.orientation &&
            Number.isFinite(Number(primitive?.length))
        ) {
            return SchematicViewRenderer.#pinBounds(
                primitive,
                contentHeight,
                isKicad
            )
        }
        if (
            Number.isFinite(Number(primitive?.radius)) ||
            Number.isFinite(Number(primitive?.radiusX))
        ) {
            return SchematicViewRenderer.#ellipseLikeBounds(
                primitive,
                contentHeight,
                isKicad
            )
        }
        if (primitive?.text || primitive?.value) {
            return SchematicViewRenderer.#textBounds(
                primitive,
                contentHeight,
                isKicad
            )
        }
        return null
    }

    /**
     * Resolves rectangle bounds.
     * @param {{ x: number, y: number, width: number, height: number }} item Primitive metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #rectangleBounds(item, contentHeight, isKicad) {
        return SchematicViewRenderer.#pointsBounds(
            [
                { x: item.x, y: item.y },
                { x: Number(item.x) + Number(item.width), y: item.y },
                {
                    x: Number(item.x) + Number(item.width),
                    y: Number(item.y) + Number(item.height)
                },
                { x: item.x, y: Number(item.y) + Number(item.height) }
            ],
            contentHeight,
            isKicad
        )
    }

    /**
     * Resolves line bounds.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} item Primitive metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #lineBounds(item, contentHeight, isKicad) {
        return SchematicViewRenderer.#pointsBounds(
            [
                { x: item.x1, y: item.y1 },
                { x: item.x2, y: item.y2 }
            ],
            contentHeight,
            isKicad
        )
    }

    /**
     * Resolves pin endpoint bounds.
     * @param {{ x: number, y: number, length: number, orientation: string }} pin Pin metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #pinBounds(pin, contentHeight, isKicad) {
        const length = Math.max(Number(pin.length || 0), 0)
        const outer = { x: Number(pin.x || 0), y: Number(pin.y || 0) }
        const body = { ...outer }
        if (pin.orientation === 'left') outer.x -= length
        if (pin.orientation === 'right') outer.x += length
        if (pin.orientation === 'top') outer.y -= length
        if (pin.orientation === 'bottom') outer.y += length
        return SchematicViewRenderer.#pointsBounds(
            [body, outer],
            contentHeight,
            isKicad
        )
    }

    /**
     * Resolves circle, ellipse, or arc bounds.
     * @param {{ x: number, y: number, radius?: number, radiusX?: number, radiusY?: number }} item Primitive metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #ellipseLikeBounds(item, contentHeight, isKicad) {
        const radiusX = Math.max(
            Number(item.radiusX ?? item.radius ?? 0),
            0
        )
        const radiusY = Math.max(
            Number(item.radiusY ?? item.radius ?? radiusX),
            0
        )
        return SchematicViewRenderer.#pointsBounds(
            [
                { x: Number(item.x) - radiusX, y: Number(item.y) - radiusY },
                { x: Number(item.x) + radiusX, y: Number(item.y) + radiusY }
            ],
            contentHeight,
            isKicad
        )
    }

    /**
     * Resolves approximate rendered text bounds.
     * @param {{ x: number, y: number, text?: string, value?: string, fontSize?: number, font?: { size?: number, height?: number }, anchor?: string }} text Text primitive.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #textBounds(text, contentHeight, isKicad) {
        const value = String(text?.value ?? text?.text ?? '')
        const fontSize = Math.max(
            Number(text?.fontSize ?? text?.font?.height ?? text?.font?.size) ||
                (isKicad ? 1.27 : 10),
            isKicad ? 0.8 : 6
        )
        const width = Math.max(value.length * fontSize * 0.62, fontSize)
        const height = fontSize * 1.35
        const x = Number(text.x || 0)
        const y = SchematicViewRenderer.#projectY(
            Number(text.y || 0),
            contentHeight,
            isKicad
        )
        const anchor = String(text.anchor || '').toLowerCase()
        const minX =
            anchor === 'middle'
                ? x - width / 2
                : anchor === 'end'
                  ? x - width
                  : x

        return {
            minX,
            minY: y - height,
            maxX: minX + width,
            maxY: y + height * 0.25
        }
    }

    /**
     * Resolves bounds from point metadata.
     * @param {{ x: number, y: number }[]} points Source coordinate points.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #pointsBounds(points, contentHeight, isKicad) {
        const renderedPoints = points
            .map((point) => ({
                x: Number(point?.x),
                y: SchematicViewRenderer.#projectY(
                    Number(point?.y),
                    contentHeight,
                    isKicad
                )
            }))
            .filter((point) =>
                Number.isFinite(point.x) && Number.isFinite(point.y)
            )
        if (!renderedPoints.length) return null

        return {
            minX: Math.min(...renderedPoints.map((point) => point.x)),
            minY: Math.min(...renderedPoints.map((point) => point.y)),
            maxX: Math.max(...renderedPoints.map((point) => point.x)),
            maxY: Math.max(...renderedPoints.map((point) => point.y))
        }
    }

    /**
     * Resolves a fallback box around a component anchor.
     * @param {{ x?: number, y?: number }} component Component metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveComponentAnchorBounds(component, contentHeight, isKicad) {
        if (
            !Number.isFinite(Number(component?.x)) ||
            !Number.isFinite(Number(component?.y))
        ) {
            return null
        }

        const size = isKicad ? 8 : 36
        const x = Number(component.x)
        const y = SchematicViewRenderer.#projectY(
            Number(component.y),
            contentHeight,
            isKicad
        )
        return {
            minX: x - size / 2,
            minY: y - size / 2,
            maxX: x + size / 2,
            maxY: y + size / 2
        }
    }

    /**
     * Projects source Y coordinates into rendered group coordinates.
     * @param {number} y Source y-coordinate.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {number}
     */
    static #projectY(y, contentHeight, isKicad) {
        return isKicad ? y : contentHeight - y
    }

    /**
     * Resolves content height used by the active schematic renderer.
     * @param {object} schematic Schematic model.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {number}
     */
    static #resolveContentHeight(schematic, isKicad) {
        const sheet = schematic?.sheet || {}
        if (isKicad) {
            return Math.max(Number(sheet.height || 100), 1)
        }

        const width = Math.max(Number(sheet.width || 1000), 100)
        const height = Math.max(Number(sheet.height || 700), 100)
        const margin = Math.max(Number(sheet.marginWidth || 20), 10)
        const sourceWidth = Number(sheet.sourceWidth || 0)
        const sourceHeight = Number(sheet.sourceHeight || 0)
        if (
            !sheet.borderOn ||
            sheet.paperSize ||
            width !== sourceWidth ||
            height !== sourceHeight ||
            height <= margin * 2
        ) {
            return height
        }

        return height + margin
    }

    /**
     * Merges bounds into one envelope.
     * @param {({ minX: number, minY: number, maxX: number, maxY: number } | null)[]} boundsList Bounds list.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #mergeBounds(boundsList) {
        const validBounds = boundsList.filter((bounds) =>
            SchematicViewRenderer.#isValidBounds(bounds)
        )
        if (!validBounds.length) return null

        return {
            minX: Math.min(...validBounds.map((bounds) => bounds.minX)),
            minY: Math.min(...validBounds.map((bounds) => bounds.minY)),
            maxX: Math.max(...validBounds.map((bounds) => bounds.maxX)),
            maxY: Math.max(...validBounds.map((bounds) => bounds.maxY))
        }
    }

    /**
     * Returns whether bounds are finite and usable.
     * @param {any} bounds Bounds candidate.
     * @returns {boolean}
     */
    static #isValidBounds(bounds) {
        return (
            Number.isFinite(bounds?.minX) &&
            Number.isFinite(bounds?.minY) &&
            Number.isFinite(bounds?.maxX) &&
            Number.isFinite(bounds?.maxY) &&
            bounds.maxX >= bounds.minX &&
            bounds.maxY >= bounds.minY
        )
    }

    /**
     * Adds readable padding and a minimum size to highlight bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Raw bounds.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ x: number, y: number, width: number, height: number, radius: number }}
     */
    static #padBounds(bounds, isKicad) {
        const minSize = isKicad ? 4 : 14
        const minPadding = isKicad ? 1.6 : 6
        const width = Math.max(bounds.maxX - bounds.minX, minSize)
        const height = Math.max(bounds.maxY - bounds.minY, minSize)
        const centerX = (bounds.minX + bounds.maxX) / 2
        const centerY = (bounds.minY + bounds.maxY) / 2
        const paddedWidth = width + Math.max(width * 0.12, minPadding) * 2
        const paddedHeight = height + Math.max(height * 0.12, minPadding) * 2

        return {
            x: centerX - paddedWidth / 2,
            y: centerY - paddedHeight / 2,
            width: paddedWidth,
            height: paddedHeight,
            radius: isKicad ? 1.2 : 5
        }
    }

    /**
     * Renders the SVG selection marker.
     * @param {string} key Selected component key.
     * @param {{ x: number, y: number, width: number, height: number, radius: number }} box Highlight box.
     * @returns {string}
     */
    static #renderHighlight(key, box) {
        return (
            '<g class="schematic-symbol-highlight" data-schematic-component-key="' +
            SchematicViewRenderer.#escapeHtml(key) +
            '"><rect class="schematic-symbol-highlight__fill" x="' +
            SchematicViewRenderer.#formatNumber(box.x) +
            '" y="' +
            SchematicViewRenderer.#formatNumber(box.y) +
            '" width="' +
            SchematicViewRenderer.#formatNumber(box.width) +
            '" height="' +
            SchematicViewRenderer.#formatNumber(box.height) +
            '" rx="' +
            SchematicViewRenderer.#formatNumber(box.radius) +
            '"/><rect class="schematic-symbol-highlight__outline" x="' +
            SchematicViewRenderer.#formatNumber(box.x) +
            '" y="' +
            SchematicViewRenderer.#formatNumber(box.y) +
            '" width="' +
            SchematicViewRenderer.#formatNumber(box.width) +
            '" height="' +
            SchematicViewRenderer.#formatNumber(box.height) +
            '" rx="' +
            SchematicViewRenderer.#formatNumber(box.radius) +
            '"/></g>'
        )
    }

    /**
     * Injects SVG-local highlight CSS.
     * @param {string} markup Rendered markup.
     * @returns {string}
     */
    static #injectHighlightStyle(markup) {
        const rules =
            '.schematic-svg .schematic-symbol-highlight {' +
            'pointer-events: none;}' +
            '.schematic-svg .schematic-symbol-highlight__fill {' +
            'fill: rgba(227, 84, 23, 0.14);' +
            'stroke: #e35417;stroke-width: 1.8;' +
            'vector-effect: non-scaling-stroke;' +
            'filter: drop-shadow(0 0 3px rgba(227, 84, 23, 0.55));}' +
            '.schematic-svg .schematic-symbol-highlight__outline {' +
            'fill: none;stroke: rgba(255,255,255,0.9);' +
            'stroke-width: 0.8;vector-effect: non-scaling-stroke;}'

        return String(markup).replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="schematic-component-highlight-style">' +
                SchematicViewRenderer.#escapeHtml(rules) +
                '</style>'
        )
    }

    /**
     * Injects highlight markup into the main schematic coordinate group.
     * @param {string} markup Rendered markup.
     * @param {string} highlight Highlight SVG markup.
     * @returns {string}
     */
    static #injectHighlightMarkup(markup, highlight) {
        if (/<g class="[^"]*\bschematic-scene\b[^"]*"[^>]*>/.test(markup)) {
            return String(markup).replace(
                /(<g class="[^"]*\bschematic-scene\b[^"]*"[^>]*>)/,
                '$1' + highlight
            )
        }
        if (/<g class="[^"]*\bschematic-content\b[^"]*"[^>]*>/.test(markup)) {
            return String(markup).replace(
                /(<g class="[^"]*\bschematic-content\b[^"]*"[^>]*>)/,
                '$1' + highlight
            )
        }
        return String(markup).replace(/(<svg\b[^>]*>)/, '$1' + highlight)
    }

    /**
     * Formats an SVG number.
     * @param {number} value Numeric value.
     * @returns {string}
     */
    static #formatNumber(value) {
        return Number.isFinite(value)
            ? Number(value.toFixed(3)).toString()
            : '0'
    }

    /**
     * Escapes markup text.
     * @param {string} value Raw text.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }
}
