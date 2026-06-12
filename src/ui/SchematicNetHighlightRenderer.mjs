import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'
import { SchematicMarkupTools } from './SchematicMarkupTools.mjs'

/**
 * Adds schematic net hit targets and selected-net SVG overlays.
 */
export class SchematicNetHighlightRenderer {
    /**
     * Adds schematic net hit targets and a selected net overlay.
     * @param {string} markup Rendered schematic markup.
     * @param {object} documentModel Document model.
     * @param {string} selectedNetName Selected net name.
     * @returns {string}
     */
    static inject(markup, documentModel, selectedNetName) {
        const schematic = documentModel?.schematic
        const nets = Array.isArray(schematic?.nets) ? schematic.nets : []
        if (!nets.length) return markup

        const isKicad =
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'kicad'
        const overlays = this.#resolveNetOverlays(schematic, nets, isKicad)
        if (!overlays.length) return markup

        const selectedKey = String(selectedNetName || '').trim()
        const selectedHighlight = overlays
            .filter((overlay) => selectedKey && overlay.name === selectedKey)
            .map((overlay) => this.#renderNetHighlight(overlay, isKicad))
            .join('')
        const hitTargets = this.#renderNetHitTargets(overlays, isKicad)

        return this.#injectHighlightMarkup(
            this.#injectNetHighlightStyle(markup),
            selectedHighlight + hitTargets
        )
    }

    /**
     * Resolves click/highlight overlays for schematic nets.
     * @param {object} schematic Schematic model.
     * @param {any[]} nets Net metadata.
     * @param {boolean} isKicad Whether the document uses direct coordinates.
     * @returns {{ name: string, paths: string[] }[]}
     */
    static #resolveNetOverlays(schematic, nets, isKicad) {
        const contentHeight = this.#resolveContentHeight(schematic, isKicad)
        return nets
            .map((net) => {
                const name = String(
                    net?.name || net?.label || net?.netName || ''
                ).trim()
                const paths = this.#netSegments(net)
                    .map((segment) =>
                        this.#resolveNetSegmentPath(
                            segment,
                            contentHeight,
                            isKicad
                        )
                    )
                    .filter(Boolean)
                return name && paths.length ? { name, paths } : null
            })
            .filter(Boolean)
    }

    /**
     * Returns segment-like rows from one net.
     * @param {any} net Net metadata.
     * @returns {any[]}
     */
    static #netSegments(net) {
        return [
            ...(Array.isArray(net?.segments) ? net.segments : []),
            ...(Array.isArray(net?.wires) ? net.wires : []),
            ...(Array.isArray(net?.lines) ? net.lines : [])
        ]
    }

    /**
     * Resolves one schematic net segment to an SVG path.
     * @param {any} segment Net segment metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {string}
     */
    static #resolveNetSegmentPath(segment, contentHeight, isKicad) {
        const points = this.#resolveNetSegmentPoints(segment)
            .map((point) => this.#renderedPoint(point, contentHeight, isKicad))
            .filter((point) =>
                Number.isFinite(point.x) && Number.isFinite(point.y)
            )
        if (points.length < 2) return ''

        return points
            .map(
                (point, index) =>
                    (index === 0 ? 'M' : 'L') +
                    SchematicMarkupTools.formatNumber(point.x) +
                    ' ' +
                    SchematicMarkupTools.formatNumber(point.y)
            )
            .join(' ')
    }

    /**
     * Resolves a segment's authored points.
     * @param {any} segment Net segment metadata.
     * @returns {{ x: number, y: number }[]}
     */
    static #resolveNetSegmentPoints(segment) {
        if (Array.isArray(segment?.points)) {
            return segment.points
        }

        const start = segment?.start || segment?.from
        const end = segment?.end || segment?.to
        if (start && end) {
            return [start, end]
        }

        return [
            { x: segment?.x1, y: segment?.y1 },
            { x: segment?.x2, y: segment?.y2 }
        ]
    }

    /**
     * Projects one authored point into rendered schematic coordinates.
     * @param {{ x?: number, y?: number }} point Source point.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ x: number, y: number }}
     */
    static #renderedPoint(point, contentHeight, isKicad) {
        return {
            x: Number(point?.x),
            y: this.#projectY(Number(point?.y), contentHeight, isKicad)
        }
    }

    /**
     * Renders all invisible net click targets.
     * @param {{ name: string, paths: string[] }[]} overlays Net overlays.
     * @param {boolean} isKicad Whether the document uses direct coordinates.
     * @returns {string}
     */
    static #renderNetHitTargets(overlays, isKicad) {
        return (
            '<g class="schematic-net-hit-targets">' +
            overlays
                .map((overlay) =>
                    this.#renderNetPaths(
                        overlay,
                        'schematic-net-hit-target',
                        isKicad ? 2.8 : 10
                    )
                )
                .join('') +
            '</g>'
        )
    }

    /**
     * Renders the selected net highlight.
     * @param {{ name: string, paths: string[] }} overlay Net overlay.
     * @param {boolean} isKicad Whether the document uses direct coordinates.
     * @returns {string}
     */
    static #renderNetHighlight(overlay, isKicad) {
        return (
            '<g class="schematic-net-highlight" data-schematic-net-name="' +
            SchematicMarkupTools.escapeHtml(overlay.name) +
            '">' +
            this.#renderNetPathElements(
                overlay.paths,
                'schematic-net-highlight__glow',
                isKicad ? 2.2 : 8
            ) +
            this.#renderNetPathElements(
                overlay.paths,
                'schematic-net-highlight__trace',
                isKicad ? 1.1 : 4
            ) +
            '</g>'
        )
    }

    /**
     * Renders one net hit target group.
     * @param {{ name: string, paths: string[] }} overlay Net overlay.
     * @param {string} className Group class name.
     * @param {number} strokeWidth Hit stroke width.
     * @returns {string}
     */
    static #renderNetPaths(overlay, className, strokeWidth) {
        return (
            '<g class="' +
            className +
            '" data-schematic-net-name="' +
            SchematicMarkupTools.escapeHtml(overlay.name) +
            '">' +
            this.#renderNetPathElements(
                overlay.paths,
                className + '__path',
                strokeWidth
            ) +
            '</g>'
        )
    }

    /**
     * Renders SVG path elements for net geometry.
     * @param {string[]} paths SVG path data.
     * @param {string} className Path class name.
     * @param {number} strokeWidth Stroke width.
     * @returns {string}
     */
    static #renderNetPathElements(paths, className, strokeWidth) {
        return paths
            .map(
                (path) =>
                    '<path class="' +
                    className +
                    '" d="' +
                    SchematicMarkupTools.escapeHtml(path) +
                    '" stroke-width="' +
                    SchematicMarkupTools.formatNumber(strokeWidth) +
                    '"/>'
            )
            .join('')
    }

    /**
     * Injects SVG-local net highlight CSS.
     * @param {string} markup Rendered markup.
     * @returns {string}
     */
    static #injectNetHighlightStyle(markup) {
        const rules =
            '.schematic-svg .schematic-net-hit-target {' +
            'pointer-events: stroke;cursor: pointer;}' +
            '.schematic-svg .schematic-net-hit-target__path {' +
            'fill: none;stroke: transparent;pointer-events: stroke;' +
            'stroke-linecap: round;stroke-linejoin: round;' +
            'vector-effect: non-scaling-stroke;}' +
            '.schematic-svg .schematic-net-highlight {' +
            'pointer-events: stroke;cursor: pointer;}' +
            '.schematic-svg .schematic-net-highlight__glow {' +
            'fill: none;stroke: rgba(27, 191, 227, 0.38);' +
            'stroke-linecap: round;stroke-linejoin: round;' +
            'vector-effect: non-scaling-stroke;' +
            'filter: drop-shadow(0 0 1.4px rgba(27, 191, 227, 0.68)) drop-shadow(0 0 3px rgba(27, 191, 227, 0.32));}' +
            '.schematic-svg .schematic-net-highlight__trace {' +
            'fill: none;stroke: rgba(27, 191, 227, 0.94);' +
            'stroke-linecap: round;stroke-linejoin: round;' +
            'vector-effect: non-scaling-stroke;}'

        return String(markup).replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="schematic-net-highlight-style">' +
                SchematicMarkupTools.escapeHtml(rules) +
                '</style>'
        )
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
     * Injects highlight markup into the main schematic coordinate group.
     * @param {string} markup Rendered markup.
     * @param {string} highlight Highlight SVG markup.
     * @returns {string}
     */
    static #injectHighlightMarkup(markup, highlight) {
        const renderedMarkup = String(markup)
        const groupEndIndex =
            SchematicMarkupTools.findGroupEndIndex(
                renderedMarkup,
                'schematic-scene'
            ) ??
            SchematicMarkupTools.findGroupEndIndex(
                renderedMarkup,
                'schematic-content'
            )
        if (groupEndIndex !== null) {
            return (
                renderedMarkup.slice(0, groupEndIndex) +
                highlight +
                renderedMarkup.slice(groupEndIndex)
            )
        }
        return renderedMarkup.replace(/(<\/svg>)/, highlight + '$1')
    }
}
