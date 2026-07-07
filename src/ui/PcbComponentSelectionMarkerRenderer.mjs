import { PcbComponentSelectionModel } from '../core/PcbComponentSelectionModel.mjs'
import { PcbRenderedFootprintBoundsResolver } from './PcbRenderedFootprintBoundsResolver.mjs'
import { SvgTransformBoundsMapper } from './SvgTransformBoundsMapper.mjs'

/**
 * Renders visible PCB component selection markers from component geometry.
 */
export class PcbComponentSelectionMarkerRenderer {
    /**
     * Injects a visible selected-component marker above PCB artwork.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {object} documentModel Document model.
     * @param {string} selectedComponentKey Selected component key.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {string}
     */
    static render(markup, documentModel, selectedComponentKey, side = 'top') {
        const key = String(selectedComponentKey || '').trim()
        if (!key) return markup

        const componentRecord =
            PcbComponentSelectionMarkerRenderer.#resolveComponentRecordByKey(
                documentModel,
                key
            )
        const viewBox = PcbRenderedFootprintBoundsResolver.resolveSvgViewBox(
            markup
        )
        const primitiveBounds = componentRecord
            ? PcbComponentSelectionMarkerRenderer.#resolveComponentPrimitiveMarkerBounds(
                  documentModel,
                  componentRecord,
                  side
              )
            : null
        const visualPrimitiveBounds =
            PcbComponentSelectionMarkerRenderer.#resolveVisualPrimitiveMarkerBounds(
                markup,
                documentModel,
                primitiveBounds,
                side
            )
        if (
            visualPrimitiveBounds &&
            PcbRenderedFootprintBoundsResolver.boundsOverlapViewBox(
                visualPrimitiveBounds,
                viewBox
            )
        ) {
            return String(markup).replace(
                /<\/svg>/,
                PcbComponentSelectionMarkerRenderer.#renderBoundsMarker(
                    key,
                    visualPrimitiveBounds
                ) + '</svg>'
            )
        }

        const renderedBounds =
            PcbRenderedFootprintBoundsResolver.resolveMarkerBounds(
                markup,
                key,
                viewBox
            )
        if (renderedBounds) {
            const visualRenderedBounds =
                PcbComponentSelectionMarkerRenderer.#resolveVisualRenderedMarkerBounds(
                    markup,
                    renderedBounds
                )
            return String(markup).replace(
                /<\/svg>/,
                PcbComponentSelectionMarkerRenderer.#renderBoundsMarker(
                    key,
                    visualRenderedBounds
                ) + '</svg>'
            )
        }

        if (primitiveBounds) {
            return String(markup).replace(
                /<\/svg>/,
                PcbComponentSelectionMarkerRenderer.#renderBoundsMarker(
                    key,
                    visualPrimitiveBounds || primitiveBounds
                ) + '</svg>'
            )
        }

        const transform =
            PcbComponentSelectionMarkerRenderer.#resolveSelectedComponentTransform(
                markup,
                key
            )
        if (!transform) return markup

        const marker =
            PcbComponentSelectionMarkerRenderer.#renderTransformMarker(
                key,
                transform,
                PcbComponentSelectionMarkerRenderer.#resolveFallbackMarkerBox(
                    componentRecord?.component || null
                )
            )

        return String(markup).replace(/<\/svg>/, marker + '</svg>')
    }

    /**
     * Renders a board-space PCB component selection marker.
     * @param {string} key Selected component key.
     * @param {{ x: number, y: number, width: number, height: number, rx: number }} bounds Marker bounds.
     * @returns {string}
     */
    static #renderBoundsMarker(key, bounds) {
        return (
            '<g class="pcb-component-selection-marker" data-pcb-selected-component-key="' +
            PcbComponentSelectionMarkerRenderer.#escapeHtml(key) +
            '" aria-hidden="true">' +
            PcbComponentSelectionMarkerRenderer.#renderMarkerRects(bounds) +
            '</g>'
        )
    }

    /**
     * Renders a transform-local PCB component selection marker.
     * @param {string} key Selected component key.
     * @param {string} transform SVG transform for the component anchor.
     * @param {{ width: number, height: number, rx: number }} box Marker box.
     * @returns {string}
     */
    static #renderTransformMarker(key, transform, box) {
        const bounds = {
            x: -box.width / 2,
            y: -box.height / 2,
            width: box.width,
            height: box.height,
            rx: box.rx
        }

        return (
            '<g class="pcb-component-selection-marker" data-pcb-selected-component-key="' +
            PcbComponentSelectionMarkerRenderer.#escapeHtml(key) +
            '" transform="' +
            PcbComponentSelectionMarkerRenderer.#escapeHtml(transform) +
            '" aria-hidden="true">' +
            PcbComponentSelectionMarkerRenderer.#renderMarkerRects(bounds) +
            '</g>'
        )
    }

    /**
     * Renders the shared selection marker rectangles.
     * @param {{ x: number, y: number, width: number, height: number, rx: number }} bounds Marker bounds.
     * @returns {string}
     */
    static #renderMarkerRects(bounds) {
        return (
            '<rect class="pcb-component-selection-marker__outline" x="' +
            PcbComponentSelectionMarkerRenderer.#formatSvgNumber(bounds.x) +
            '" y="' +
            PcbComponentSelectionMarkerRenderer.#formatSvgNumber(bounds.y) +
            '" width="' +
            PcbComponentSelectionMarkerRenderer.#formatSvgNumber(
                bounds.width
            ) +
            '" height="' +
            PcbComponentSelectionMarkerRenderer.#formatSvgNumber(
                bounds.height
            ) +
            '" rx="' +
            PcbComponentSelectionMarkerRenderer.#formatSvgNumber(bounds.rx) +
            '"></rect>' +
            '<rect class="pcb-component-selection-marker__fill" x="' +
            PcbComponentSelectionMarkerRenderer.#formatSvgNumber(bounds.x) +
            '" y="' +
            PcbComponentSelectionMarkerRenderer.#formatSvgNumber(bounds.y) +
            '" width="' +
            PcbComponentSelectionMarkerRenderer.#formatSvgNumber(
                bounds.width
            ) +
            '" height="' +
            PcbComponentSelectionMarkerRenderer.#formatSvgNumber(
                bounds.height
            ) +
            '" rx="' +
            PcbComponentSelectionMarkerRenderer.#formatSvgNumber(bounds.rx) +
            '"></rect>'
        )
    }

    /**
     * Resolves the SVG transform for the selected component group.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {string}
     */
    static #resolveSelectedComponentTransform(markup, selectedComponentKey) {
        const key = PcbComponentSelectionMarkerRenderer.#escapeRegExp(
            PcbComponentSelectionMarkerRenderer.#escapeHtml(
                selectedComponentKey
            )
        )
        const match = String(markup).match(
            new RegExp(
                '<g\\b(?=[^>]*\\bdata-component-key="' +
                    key +
                    '")[^>]*\\btransform="([^"]+)"[^>]*>'
            )
        )
        const transform = String(match?.[1] || '').trim()

        return /\bNaN\b/.test(transform) ? '' : transform
    }

    /**
     * Resolves a component metadata record and source index by selection key.
     * @param {object} documentModel Document model.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {{ component: object, index: number, key: string } | null}
     */
    static #resolveComponentRecordByKey(documentModel, selectedComponentKey) {
        const components = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []

        for (let index = 0; index < components.length; index += 1) {
            const component = components[index]
            const key = PcbComponentSelectionModel.resolveComponentKey(
                component,
                index
            )
            if (key === selectedComponentKey) {
                return { component, index, key }
            }
        }

        return null
    }

    /**
     * Resolves selected marker bounds from primitives owned by a component.
     * @param {object} documentModel Document model.
     * @param {{ component: object, index: number, key: string }} componentRecord Component record.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {{ x: number, y: number, width: number, height: number, rx: number } | null}
     */
    static #resolveComponentPrimitiveMarkerBounds(
        documentModel,
        componentRecord,
        side
    ) {
        let bounds = null
        const pcb = documentModel?.pcb || {}
        const include = (candidate) => {
            bounds = PcbComponentSelectionMarkerRenderer.#includeBounds(
                bounds,
                candidate
            )
        }

        const pads = Array.isArray(pcb.pads) ? pcb.pads : []
        pads.filter((primitive) =>
            PcbComponentSelectionMarkerRenderer.#isComponentOwnedPrimitive(
                primitive,
                componentRecord
            )
        )
            .filter((primitive) =>
                PcbComponentSelectionMarkerRenderer.#primitiveMatchesSide(
                    primitive,
                    side
                )
            )
            .forEach((pad) =>
                include(
                    PcbComponentSelectionMarkerRenderer.#resolvePadBounds(
                        pad,
                        side
                    )
                )
            )

        for (const key of ['tracks', 'arcs', 'regions', 'fills']) {
            const primitives = Array.isArray(pcb[key]) ? pcb[key] : []
            primitives
                .filter((primitive) =>
                    PcbComponentSelectionMarkerRenderer.#isComponentOwnedPrimitive(
                        primitive,
                        componentRecord
                    )
                )
                .filter((primitive) =>
                    PcbComponentSelectionMarkerRenderer.#primitiveMatchesSide(
                        primitive,
                        side
                    )
                )
                .forEach((primitive) =>
                    include(
                        PcbComponentSelectionMarkerRenderer.#resolvePrimitiveBounds(
                            primitive
                        )
                    )
                )
        }

        if (!bounds) return null

        return PcbComponentSelectionMarkerRenderer.#expandMarkerBounds(
            bounds,
            18
        )
    }

    /**
     * Maps primitive-derived marker bounds into the rendered SVG frame.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {object} documentModel Document model.
     * @param {{ x: number, y: number, width: number, height: number, rx: number } | null} bounds Primitive marker bounds.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {{ x: number, y: number, width: number, height: number, rx: number } | null}
     */
    static #resolveVisualPrimitiveMarkerBounds(
        markup,
        documentModel,
        bounds,
        side
    ) {
        if (!bounds) return null
        if (
            side !== 'bottom' ||
            !/\bpcb-svg--altium\b/.test(String(markup))
        ) {
            return bounds
        }

        return PcbComponentSelectionMarkerRenderer.#mirrorBoundsX(
            documentModel,
            bounds
        )
    }

    /**
     * Maps rendered SVG marker bounds into the root SVG coordinate frame.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {{ x: number, y: number, width: number, height: number, rx: number }} bounds Rendered marker bounds.
     * @returns {{ x: number, y: number, width: number, height: number, rx: number }}
     */
    static #resolveVisualRenderedMarkerBounds(markup, bounds) {
        return SvgTransformBoundsMapper.map(
            bounds,
            PcbComponentSelectionMarkerRenderer.#resolvePcbSceneTransform(
                markup
            )
        )
    }

    /**
     * Resolves the PCB scene transform attribute when the renderer uses one.
     * @param {string} markup Renderer-owned SVG markup.
     * @returns {string}
     */
    static #resolvePcbSceneTransform(markup) {
        const match = String(markup).match(
            /<g\b(?=[^>]*\bclass="[^"]*\bpcb-scene\b[^"]*")[^>]*\btransform="([^"]+)"[^>]*>/u
        )

        return String(match?.[1] || '')
    }

    /**
     * Mirrors marker bounds around the Altium bottom-view board X span.
     * @param {object} documentModel Document model.
     * @param {{ x: number, y: number, width: number, height: number, rx: number }} bounds Marker bounds.
     * @returns {{ x: number, y: number, width: number, height: number, rx: number }}
     */
    static #mirrorBoundsX(documentModel, bounds) {
        const mirrorAxis =
            PcbComponentSelectionMarkerRenderer.#resolveBoardMirrorAxis(
                documentModel
            )
        if (mirrorAxis === null) return bounds

        return {
            ...bounds,
            x: mirrorAxis - bounds.x - bounds.width
        }
    }

    /**
     * Resolves the X-axis sum used by the bottom-side Altium renderer mirror.
     * @param {object} documentModel Document model.
     * @returns {number | null}
     */
    static #resolveBoardMirrorAxis(documentModel) {
        const outline = documentModel?.pcb?.boardOutline
        const minX = PcbComponentSelectionMarkerRenderer.#finiteNumber(
            outline?.minX
        )
        if (minX === null) return null

        const width = PcbComponentSelectionMarkerRenderer.#firstFiniteNumber([
            outline?.widthMil,
            outline?.width
        ])
        const maxX =
            width === null
                ? PcbComponentSelectionMarkerRenderer.#finiteNumber(
                      outline?.maxX
                  )
                : minX + width
        if (maxX === null) return null

        return minX + maxX
    }

    /**
     * Returns true when a primitive is owned by the selected component.
     * @param {object} primitive PCB primitive.
     * @param {{ component: object, index: number, key: string }} componentRecord Component record.
     * @returns {boolean}
     */
    static #isComponentOwnedPrimitive(primitive, componentRecord) {
        const explicitOwnerIds =
            PcbComponentSelectionMarkerRenderer.#componentExplicitOwnerIds(
                componentRecord
            )
        const fallbackOwnerIds =
            PcbComponentSelectionMarkerRenderer.#componentFallbackOwnerIds(
                componentRecord
            )
        const componentIndex =
            PcbComponentSelectionMarkerRenderer.#finiteNumber(
                primitive?.componentIndex
            )
        if (
            componentIndex !== null &&
            (explicitOwnerIds.has(componentIndex) ||
                (!explicitOwnerIds.size &&
                    fallbackOwnerIds.has(componentIndex)))
        ) {
            return true
        }

        for (const field of ['ownerIndex', 'ownerComponentIndex']) {
            const value =
                PcbComponentSelectionMarkerRenderer.#finiteNumber(
                    primitive?.[field]
                )
            if (
                value !== null &&
                (explicitOwnerIds.has(value) || fallbackOwnerIds.has(value))
            ) {
                return true
            }
        }

        const componentId = PcbComponentSelectionMarkerRenderer.#finiteNumber(
            primitive?.componentId
        )
        if (
            componentId !== null &&
            (explicitOwnerIds.has(componentId) ||
                (!explicitOwnerIds.size && fallbackOwnerIds.has(componentId)))
        ) {
            return true
        }

        const key = String(componentRecord?.key || '')
        const ownerId = String(primitive?.ownerId || '')

        return Boolean(
            key && (ownerId === key || ownerId.startsWith('footprint:' + key))
        )
    }

    /**
     * Resolves explicit numeric owner ids for one component record.
     * @param {{ component: object }} componentRecord Component record.
     * @returns {Set<number>}
     */
    static #componentExplicitOwnerIds(componentRecord) {
        return new Set(
            [
                componentRecord?.component?.componentIndex,
                componentRecord?.component?.componentId,
                componentRecord?.component?.index
            ]
                .map((value) =>
                    PcbComponentSelectionMarkerRenderer.#finiteNumber(value)
                )
                .filter((value) => value !== null)
        )
    }

    /**
     * Resolves fallback row-based owner ids for legacy primitive records.
     * @param {{ index: number }} componentRecord Component record.
     * @returns {Set<number>}
     */
    static #componentFallbackOwnerIds(componentRecord) {
        return new Set(
            [componentRecord?.index]
                .map((value) =>
                    PcbComponentSelectionMarkerRenderer.#finiteNumber(value)
                )
                .filter((value) => value !== null)
        )
    }

    /**
     * Returns true when a primitive belongs to the active board side.
     * @param {object} primitive PCB primitive.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {boolean}
     */
    static #primitiveMatchesSide(primitive, side) {
        const primitiveSide =
            PcbComponentSelectionMarkerRenderer.#primitiveSide(primitive)

        return !primitiveSide || primitiveSide === side
    }

    /**
     * Resolves the board side for a primitive when layer metadata is available.
     * @param {object} primitive PCB primitive.
     * @returns {'top' | 'bottom' | ''}
     */
    static #primitiveSide(primitive) {
        const layerId = Number(
            primitive?.layerId ?? primitive?.layerCode ?? primitive?.sideCode
        )
        if ([1, 33].includes(layerId)) return 'top'
        if ([32, 34].includes(layerId)) return 'bottom'

        const text = [
            primitive?.layer,
            primitive?.layerName,
            primitive?.side,
            primitive?.material
        ]
            .filter((value) => value !== undefined && value !== null)
            .join(' ')
            .toLowerCase()
        if (/\b(bottom|back)\b|\bb[._-]/.test(text)) return 'bottom'
        if (/\b(top|front)\b|\bf[._-]/.test(text)) return 'top'

        return ''
    }

    /**
     * Resolves the board-space bounds of one pad.
     * @param {object} pad Pad primitive.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolvePadBounds(pad, side) {
        const x = PcbComponentSelectionMarkerRenderer.#finiteNumber(pad?.x)
        const y = PcbComponentSelectionMarkerRenderer.#finiteNumber(pad?.y)
        const width =
            PcbComponentSelectionMarkerRenderer.#firstFiniteNumber(
                side === 'bottom'
                    ? [pad?.sizeBottomX, pad?.sizeX, pad?.width, pad?.diameter]
                    : [pad?.sizeTopX, pad?.sizeX, pad?.width, pad?.diameter]
            )
        const height =
            PcbComponentSelectionMarkerRenderer.#firstFiniteNumber(
                side === 'bottom'
                    ? [
                          pad?.sizeBottomY,
                          pad?.sizeY,
                          pad?.height,
                          pad?.diameter
                      ]
                    : [pad?.sizeTopY, pad?.sizeY, pad?.height, pad?.diameter]
            )
        if (x === null || y === null || width === null || height === null) {
            return null
        }

        return PcbComponentSelectionMarkerRenderer.#resolveRotatedRectBounds(
            x,
            y,
            width,
            height,
            Number(pad?.rotation || 0)
        )
    }

    /**
     * Resolves generic PCB primitive board-space bounds.
     * @param {object} primitive PCB primitive.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolvePrimitiveBounds(primitive) {
        const trackBounds =
            PcbComponentSelectionMarkerRenderer.#resolveTrackBounds(primitive)
        if (trackBounds) return trackBounds

        const arcBounds =
            PcbComponentSelectionMarkerRenderer.#resolveArcBounds(primitive)
        if (arcBounds) return arcBounds

        return PcbComponentSelectionMarkerRenderer.#resolvePointListBounds(
            primitive
        )
    }

    /**
     * Resolves track-like primitive bounds.
     * @param {object} primitive PCB primitive.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveTrackBounds(primitive) {
        const x1 = PcbComponentSelectionMarkerRenderer.#finiteNumber(
            primitive?.x1
        )
        const y1 = PcbComponentSelectionMarkerRenderer.#finiteNumber(
            primitive?.y1
        )
        const x2 = PcbComponentSelectionMarkerRenderer.#finiteNumber(
            primitive?.x2
        )
        const y2 = PcbComponentSelectionMarkerRenderer.#finiteNumber(
            primitive?.y2
        )
        if (x1 === null || y1 === null || x2 === null || y2 === null) {
            return null
        }

        const halfWidth =
            (PcbComponentSelectionMarkerRenderer.#firstFiniteNumber([
                primitive?.width,
                primitive?.strokeWidth
            ]) || 0) / 2

        return {
            minX: Math.min(x1, x2) - halfWidth,
            minY: Math.min(y1, y2) - halfWidth,
            maxX: Math.max(x1, x2) + halfWidth,
            maxY: Math.max(y1, y2) + halfWidth
        }
    }

    /**
     * Resolves circular arc primitive bounds.
     * @param {object} primitive PCB primitive.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveArcBounds(primitive) {
        const x = PcbComponentSelectionMarkerRenderer.#finiteNumber(
            primitive?.x
        )
        const y = PcbComponentSelectionMarkerRenderer.#finiteNumber(
            primitive?.y
        )
        const radius = PcbComponentSelectionMarkerRenderer.#finiteNumber(
            primitive?.radius
        )
        if (x === null || y === null || radius === null) {
            return null
        }

        const halfWidth =
            (PcbComponentSelectionMarkerRenderer.#firstFiniteNumber([
                primitive?.width,
                primitive?.strokeWidth
            ]) || 0) / 2
        const extent = radius + halfWidth

        return {
            minX: x - extent,
            minY: y - extent,
            maxX: x + extent,
            maxY: y + extent
        }
    }

    /**
     * Resolves point-list primitive bounds.
     * @param {object} primitive PCB primitive.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolvePointListBounds(primitive) {
        const points = Array.isArray(primitive?.points)
            ? primitive.points
            : Array.isArray(primitive?.vertices)
              ? primitive.vertices
              : []
        let bounds = null
        for (const point of points) {
            const x = PcbComponentSelectionMarkerRenderer.#finiteNumber(
                point?.x
            )
            const y = PcbComponentSelectionMarkerRenderer.#finiteNumber(
                point?.y
            )
            if (x !== null && y !== null) {
                bounds = PcbComponentSelectionMarkerRenderer.#includePoint(
                    bounds,
                    x,
                    y
                )
            }
        }

        return bounds
    }

    /**
     * Resolves rotated rectangle board-space bounds.
     * @param {number} x Center x.
     * @param {number} y Center y.
     * @param {number} width Rectangle width.
     * @param {number} height Rectangle height.
     * @param {number} rotation Rotation in degrees.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #resolveRotatedRectBounds(x, y, width, height, rotation) {
        const radians = (rotation * Math.PI) / 180
        const cosine = Math.cos(radians)
        const sine = Math.sin(radians)
        let bounds = null

        for (const [dx, dy] of [
            [-width / 2, -height / 2],
            [width / 2, -height / 2],
            [width / 2, height / 2],
            [-width / 2, height / 2]
        ]) {
            bounds = PcbComponentSelectionMarkerRenderer.#includePoint(
                bounds,
                x + dx * cosine - dy * sine,
                y + dx * sine + dy * cosine
            )
        }

        return bounds
    }

    /**
     * Includes one point in a bounds object.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Current bounds.
     * @param {number} x Point x.
     * @param {number} y Point y.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #includePoint(bounds, x, y) {
        if (!bounds) return { minX: x, minY: y, maxX: x, maxY: y }

        return {
            minX: Math.min(bounds.minX, x),
            minY: Math.min(bounds.minY, y),
            maxX: Math.max(bounds.maxX, x),
            maxY: Math.max(bounds.maxY, y)
        }
    }

    /**
     * Merges two primitive bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Current bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} candidate Candidate bounds.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #includeBounds(bounds, candidate) {
        if (!candidate) return bounds
        const withMin = PcbComponentSelectionMarkerRenderer.#includePoint(
            bounds,
            candidate.minX,
            candidate.minY
        )

        return PcbComponentSelectionMarkerRenderer.#includePoint(
            withMin,
            candidate.maxX,
            candidate.maxY
        )
    }

    /**
     * Expands primitive bounds into renderable marker bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Primitive bounds.
     * @param {number} margin Marker margin.
     * @returns {{ x: number, y: number, width: number, height: number, rx: number }}
     */
    static #expandMarkerBounds(bounds, margin) {
        const width = Math.max(0, bounds.maxX - bounds.minX + margin * 2)
        const height = Math.max(0, bounds.maxY - bounds.minY + margin * 2)

        return {
            x: bounds.minX - margin,
            y: bounds.minY - margin,
            width,
            height,
            rx: Math.min(16, width / 8, height / 8)
        }
    }

    /**
     * Resolves a fallback marker size from generic footprint metadata.
     * @param {object | null} component Component metadata.
     * @returns {{ width: number, height: number, rx: number }}
     */
    static #resolveFallbackMarkerBox(component) {
        const text =
            PcbComponentSelectionMarkerRenderer.#componentSearchText(component)

        if (/\b(esp[_\s-]?12|module)\b/.test(text)) {
            return { width: 760, height: 480, rx: 28 }
        }
        if (/\b(1x15|pinhd|pin[-_\s]?header|tht)\b/.test(text)) {
            return { width: 1160, height: 180, rx: 14 }
        }
        if (/\b(sop|soic|ssop|tssop|qfn|lqfp)\b/.test(text)) {
            return { width: 270, height: 170, rx: 12 }
        }
        if (/\busb\b/.test(text)) {
            return { width: 240, height: 160, rx: 12 }
        }
        if (/\b(sw|switch|button|pts)\b/.test(text)) {
            return { width: 170, height: 130, rx: 14 }
        }
        if (/\b(sot|triode|transistor)\b/.test(text)) {
            return { width: 120, height: 90, rx: 10 }
        }
        if (/\b(xtal|crystal)\b/.test(text)) {
            return { width: 130, height: 90, rx: 10 }
        }
        if (/\b(diode|do[-_\s]?214)\b/.test(text)) {
            return { width: 150, height: 95, rx: 12 }
        }
        if (/\b(led|0603|0805)\b/.test(text)) {
            return { width: 110, height: 70, rx: 10 }
        }
        if (/\b(0402|smt_[cr])\b/.test(text)) {
            return { width: 90, height: 58, rx: 8 }
        }

        return { width: 160, height: 110, rx: 10 }
    }

    /**
     * Builds normalized text for component classification.
     * @param {object | null} component Component metadata.
     * @returns {string}
     */
    static #componentSearchText(component) {
        return [
            component?.pattern,
            component?.source,
            component?.description,
            component?.libraryReference,
            component?.footprint,
            component?.layer,
            component?.side,
            component?.layerName
        ]
            .filter((value) => value !== undefined && value !== null)
            .join(' ')
            .toLowerCase()
    }

    /**
     * Escapes text for use inside a regular expression.
     * @param {string} value Raw text.
     * @returns {string}
     */
    static #escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    /**
     * Formats an SVG numeric attribute without unnecessary decimals.
     * @param {number} value Numeric SVG value.
     * @returns {string}
     */
    static #formatSvgNumber(value) {
        if (!Number.isFinite(value)) return '0'

        return String(Number(value.toFixed(3)))
    }

    /**
     * Returns the first finite number from a candidate list.
     * @param {unknown[]} values Candidate values.
     * @returns {number | null}
     */
    static #firstFiniteNumber(values) {
        for (const value of values) {
            const number =
                PcbComponentSelectionMarkerRenderer.#finiteNumber(value)
            if (number !== null) return number
        }

        return null
    }

    /**
     * Resolves a finite number or null.
     * @param {unknown} value Raw value.
     * @returns {number | null}
     */
    static #finiteNumber(value) {
        const number = Number(value)

        return Number.isFinite(number) ? number : null
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
