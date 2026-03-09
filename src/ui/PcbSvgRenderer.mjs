import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

/**
 * Renders normalized PCB models into HTML and SVG markup.
 */
export class PcbSvgRenderer {
    /**
     * Renders a normalized PCB model into HTML and SVG markup.
     * @param {{ summary: { title?: string }, pcb?: { boardOutline: { segments: Array<Record<string, number | string>>, minX: number, minY: number, widthMil: number, heightMil: number }, layers: { name: string }[], components: { designator: string, x: number, y: number, rotation: number, layer: string, pattern: string }[] } }} documentModel
     * @returns {string}
     */
    static render(documentModel) {
        const pcb = documentModel?.pcb
        if (!pcb) {
            return '<section class="viewer-empty">No PCB entities were recovered from this file.</section>'
        }

        const outline = pcb.boardOutline
        const components = pcb.components.slice(0, 260)
        const path = PcbSvgRenderer.#buildBoardPath(outline.segments)
        const viewBox = PcbSvgRenderer.#buildViewBox(outline, components)
        const layerMarkup = pcb.layers
            .slice(0, 10)
            .map(
                (layer) =>
                    '<li>' + SchematicSvgUtils.escapeHtml(layer.name) + '</li>'
            )
            .join('')

        const componentMarkup = components
            .map((component) => {
                const footprint = PcbSvgRenderer.#footprintSize(
                    component.pattern
                )
                return (
                    '<g class="pcb-component pcb-component--' +
                    SchematicSvgUtils.escapeHtml(component.layer.toLowerCase()) +
                    '" transform="translate(' +
                    SchematicSvgUtils.formatNumber(component.x) +
                    ' ' +
                    SchematicSvgUtils.formatNumber(component.y) +
                    ') rotate(' +
                    SchematicSvgUtils.formatNumber(component.rotation) +
                    ')">' +
                    '<rect x="' +
                    SchematicSvgUtils.formatNumber(-footprint.width / 2) +
                    '" y="' +
                    SchematicSvgUtils.formatNumber(-footprint.height / 2) +
                    '" width="' +
                    SchematicSvgUtils.formatNumber(footprint.width) +
                    '" height="' +
                    SchematicSvgUtils.formatNumber(footprint.height) +
                    '" rx="' +
                    SchematicSvgUtils.formatNumber(
                        Math.max(footprint.height / 5, 4)
                    ) +
                    '" />' +
                    '<text x="0" y="' +
                    SchematicSvgUtils.formatNumber(
                        footprint.height * -0.75
                    ) +
                    '">' +
                    SchematicSvgUtils.escapeHtml(component.designator) +
                    '</text></g>'
                )
            })
            .join('')

        return (
            '<section class="svg-panel">' +
            '<header class="svg-panel__header"><h3>' +
            SchematicSvgUtils.escapeHtml(
                documentModel?.summary?.title || 'PCB'
            ) +
            '</h3><p>' +
            components.length +
            ' placements, ' +
            pcb.layers.length +
            ' layers</p></header>' +
            '<div class="pcb-layout">' +
            '<aside class="pcb-legend"><h4>Visible layers</h4><ul>' +
            layerMarkup +
            '</ul></aside>' +
            '<svg class="pcb-svg" viewBox="' +
            SchematicSvgUtils.escapeHtml(viewBox) +
            '" preserveAspectRatio="xMidYMid meet" aria-label="PCB view">' +
            '<path class="board-outline" d="' +
            SchematicSvgUtils.escapeHtml(path) +
            '" />' +
            '<g class="pcb-components">' +
            componentMarkup +
            '</g>' +
            '</svg></div></section>'
        )
    }

    /**
     * Builds a best-effort board path from outline segments.
     * @param {Array<Record<string, number | string>>} segments
     * @returns {string}
     */
    static #buildBoardPath(segments) {
        if (!segments.length) {
            return 'M 0 0 L 1000 0 L 1000 600 L 0 600 Z'
        }

        const [first] = segments
        let path =
            'M ' +
            SchematicSvgUtils.formatNumber(first.x1) +
            ' ' +
            SchematicSvgUtils.formatNumber(first.y1)

        for (const segment of segments) {
            if (segment.type === 'arc') {
                const radius = Math.max(Number(segment.radius) || 0, 1)
                const delta = Math.abs(
                    (Number(segment.endAngle) || 0) -
                        (Number(segment.startAngle) || 0)
                )
                const largeArc = delta > 180 ? 1 : 0
                const sweep =
                    (Number(segment.endAngle) || 0) >=
                    (Number(segment.startAngle) || 0)
                        ? 1
                        : 0
                path +=
                    ' A ' +
                    SchematicSvgUtils.formatNumber(radius) +
                    ' ' +
                    SchematicSvgUtils.formatNumber(radius) +
                    ' 0 ' +
                    largeArc +
                    ' ' +
                    sweep +
                    ' ' +
                    SchematicSvgUtils.formatNumber(segment.x2) +
                    ' ' +
                    SchematicSvgUtils.formatNumber(segment.y2)
                continue
            }

            path +=
                ' L ' +
                SchematicSvgUtils.formatNumber(segment.x2) +
                ' ' +
                SchematicSvgUtils.formatNumber(segment.y2)
        }

        return path + ' Z'
    }

    /**
     * Computes a reasonable viewBox.
     * @param {{ minX: number, minY: number, widthMil: number, heightMil: number }} outline
     * @param {{ x: number, y: number }[]} components
     * @returns {string}
     */
    static #buildViewBox(outline, components) {
        const xs = [
            outline.minX,
            outline.minX + outline.widthMil,
            ...components.map((component) => component.x)
        ]
        const ys = [
            outline.minY,
            outline.minY + outline.heightMil,
            ...components.map((component) => component.y)
        ]
        const minX = Math.min(...xs)
        const minY = Math.min(...ys)
        const maxX = Math.max(...xs)
        const maxY = Math.max(...ys)
        const padding = 240

        return [
            minX - padding,
            minY - padding,
            maxX - minX + padding * 2,
            maxY - minY + padding * 2
        ]
            .map((value) => SchematicSvgUtils.formatNumber(value))
            .join(' ')
    }

    /**
     * Returns a small footprint size heuristic.
     * @param {string} pattern
     * @returns {{ width: number, height: number }}
     */
    static #footprintSize(pattern) {
        const normalized = String(pattern || '').toUpperCase()
        if (normalized.includes('0402')) return { width: 52, height: 28 }
        if (normalized.includes('0603')) return { width: 72, height: 36 }
        if (normalized.includes('0805')) return { width: 92, height: 48 }
        if (normalized.includes('SOT')) return { width: 140, height: 90 }
        if (normalized.includes('QFN') || normalized.includes('QFP')) {
            return { width: 180, height: 180 }
        }
        if (normalized.includes('SC70')) return { width: 110, height: 70 }
        return { width: 96, height: 60 }
    }
}
