import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

/**
 * Renders normalized PCB models into HTML and SVG markup.
 */
export class PcbSvgRenderer {
    /**
     * Renders a normalized PCB model into HTML and SVG markup.
     * @param {{ summary: { title?: string }, pcb?: { boardOutline: { segments: Array<Record<string, number | string>>, minX: number, minY: number, widthMil: number, heightMil: number }, layers: { name: string }[], polygons?: { layer?: string, segments: Array<Record<string, number | string>> }[], fills?: { x1: number, y1: number, x2: number, y2: number, layerCode?: number }[], tracks?: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number }[], vias?: { x: number, y: number, diameter: number, holeDiameter: number }[], components: { designator: string, x: number, y: number, rotation: number, layer: string, pattern: string }[] } }} documentModel
     * @returns {string}
     */
    static render(documentModel) {
        const pcb = documentModel?.pcb
        if (!pcb) {
            return '<section class="viewer-empty">No PCB entities were recovered from this file.</section>'
        }

        const outline = pcb.boardOutline
        const polygons = pcb.polygons || []
        const fills = pcb.fills || []
        const tracks = pcb.tracks || []
        const vias = pcb.vias || []
        const components = pcb.components.slice(0, 260)
        const copperGroups = PcbSvgRenderer.#splitCopperPrimitives(
            polygons,
            fills,
            tracks
        )
        const path = PcbSvgRenderer.#buildBoardPath(outline.segments)
        const clipPathId = 'pcb-board-clip'
        const viewBox = PcbSvgRenderer.#buildViewBox(
            outline,
            components,
            polygons,
            fills,
            tracks,
            vias
        )
        const layerMarkup = pcb.layers
            .slice(0, 10)
            .map(
                (layer) =>
                    '<li>' + SchematicSvgUtils.escapeHtml(layer.name) + '</li>'
            )
            .join('')
        const polygonMarkup = (polygonList, visibilityClass) =>
            polygonList
                .map(
                    (polygon) =>
                        '<path class="pcb-polygon pcb-polygon--' +
                        visibilityClass +
                        '" d="' +
                        SchematicSvgUtils.escapeHtml(
                            PcbSvgRenderer.#buildBoardPath(polygon.segments)
                        ) +
                        '" />'
                )
                .join('')
        const fillMarkup = (fillList, visibilityClass) =>
            fillList
                .map((fill) => {
                const x = Math.min(fill.x1, fill.x2)
                const y = Math.min(fill.y1, fill.y2)
                const width = Math.abs(fill.x2 - fill.x1)
                const height = Math.abs(fill.y2 - fill.y1)

                return (
                    '<rect class="pcb-fill pcb-fill--' +
                    visibilityClass +
                    '" x="' +
                    SchematicSvgUtils.formatNumber(x) +
                    '" y="' +
                    SchematicSvgUtils.formatNumber(y) +
                    '" width="' +
                    SchematicSvgUtils.formatNumber(width) +
                    '" height="' +
                    SchematicSvgUtils.formatNumber(height) +
                    '" rx="' +
                    SchematicSvgUtils.formatNumber(Math.min(width, height) / 6) +
                    '" />'
                )
            })
            .join('')
        const trackMarkup = (trackList, visibilityClass) =>
            trackList
                .map(
                    (track) =>
                        '<line class="pcb-track pcb-track--' +
                        visibilityClass +
                        '" x1="' +
                        SchematicSvgUtils.formatNumber(track.x1) +
                        '" y1="' +
                        SchematicSvgUtils.formatNumber(track.y1) +
                        '" x2="' +
                        SchematicSvgUtils.formatNumber(track.x2) +
                        '" y2="' +
                        SchematicSvgUtils.formatNumber(track.y2) +
                        '" stroke-width="' +
                        SchematicSvgUtils.formatNumber(
                            Math.max(track.width || 0, 1)
                        ) +
                        '" />'
                )
                .join('')
        const viaMarkup = vias
            .map((via) => {
                const ringRadius = Math.max((via.diameter || 0) / 2, 1)
                const holeRadius = Math.max((via.holeDiameter || 0) / 2, 0.6)

                return (
                    '<g class="pcb-via">' +
                    '<circle class="pcb-via__pad" cx="' +
                    SchematicSvgUtils.formatNumber(via.x) +
                    '" cy="' +
                    SchematicSvgUtils.formatNumber(via.y) +
                    '" r="' +
                    SchematicSvgUtils.formatNumber(ringRadius) +
                    '" />' +
                    '<circle class="pcb-via__hole" cx="' +
                    SchematicSvgUtils.formatNumber(via.x) +
                    '" cy="' +
                    SchematicSvgUtils.formatNumber(via.y) +
                    '" r="' +
                    SchematicSvgUtils.formatNumber(holeRadius) +
                    '" />' +
                    '</g>'
                )
            })
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
            '<aside class="pcb-legend"><h4>Board stack</h4><p>Top-facing composite view</p><ul>' +
            layerMarkup +
            '</ul></aside>' +
            '<svg class="pcb-svg" viewBox="' +
            SchematicSvgUtils.escapeHtml(viewBox) +
            '" preserveAspectRatio="xMidYMid meet" aria-label="PCB view">' +
            '<defs><clipPath id="' +
            clipPathId +
            '"><path d="' +
            SchematicSvgUtils.escapeHtml(path) +
            '" /></clipPath></defs>' +
            '<path class="board-outline" d="' +
            SchematicSvgUtils.escapeHtml(path) +
            '" />' +
            '<g class="pcb-copper-layers" clip-path="url(#' +
            clipPathId +
            ')">' +
            '<g class="pcb-copper pcb-copper--subsurface">' +
            polygonMarkup(copperGroups.subsurface.polygons, 'subsurface') +
            fillMarkup(copperGroups.subsurface.fills, 'subsurface') +
            trackMarkup(copperGroups.subsurface.tracks, 'subsurface') +
            '</g>' +
            '<g class="pcb-copper pcb-copper--surface">' +
            polygonMarkup(copperGroups.surface.polygons, 'surface') +
            fillMarkup(copperGroups.surface.fills, 'surface') +
            trackMarkup(copperGroups.surface.tracks, 'surface') +
            viaMarkup +
            '</g>' +
            '</g>' +
            '<path class="board-outline board-outline--stroke" d="' +
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
     * @param {{ minX: number, minY: number, widthMil: number, heightMil: number, segments: Array<Record<string, number | string>> }} outline
     * @param {{ x: number, y: number }[]} components
     * @param {{ segments: Array<Record<string, number | string>> }[]} polygons
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} fills
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} tracks
     * @param {{ x: number, y: number, diameter: number }[]} vias
     * @returns {string}
     */
    static #buildViewBox(outline, components, polygons, fills, tracks, vias) {
        const xs = [outline.minX, outline.minX + outline.widthMil]
        const ys = [outline.minY, outline.minY + outline.heightMil]

        for (const segment of outline.segments || []) {
            xs.push(Number(segment.x1) || 0, Number(segment.x2) || 0)
            ys.push(Number(segment.y1) || 0, Number(segment.y2) || 0)
        }

        for (const polygon of polygons) {
            for (const segment of polygon.segments || []) {
                xs.push(Number(segment.x1) || 0, Number(segment.x2) || 0)
                ys.push(Number(segment.y1) || 0, Number(segment.y2) || 0)
            }
        }

        for (const fill of fills) {
            xs.push(fill.x1, fill.x2)
            ys.push(fill.y1, fill.y2)
        }

        for (const track of tracks) {
            xs.push(track.x1, track.x2)
            ys.push(track.y1, track.y2)
        }

        for (const via of vias) {
            const radius = (via.diameter || 0) / 2

            xs.push(via.x - radius, via.x + radius)
            ys.push(via.y - radius, via.y + radius)
        }

        for (const component of components) {
            const footprint = PcbSvgRenderer.#footprintSize(component.pattern)

            xs.push(component.x - footprint.width / 2, component.x + footprint.width / 2)
            ys.push(
                component.y - footprint.height / 2,
                component.y + footprint.height / 2
            )
        }

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

    /**
     * Splits recovered copper primitives into the default top-facing surface
     * view and de-emphasized buried layers.
     * @param {{ layer?: string, segments: Array<Record<string, number | string>> }[]} polygons
     * @param {{ x1: number, y1: number, x2: number, y2: number, layerCode?: number }[]} fills
     * @param {{ x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number }[]} tracks
     * @returns {{ surface: { polygons: { layer?: string, segments: Array<Record<string, number | string>> }[], fills: { x1: number, y1: number, x2: number, y2: number, layerCode?: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number }[] }, subsurface: { polygons: { layer?: string, segments: Array<Record<string, number | string>> }[], fills: { x1: number, y1: number, x2: number, y2: number, layerCode?: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode?: number }[] } }}
     */
    static #splitCopperPrimitives(polygons, fills, tracks) {
        const surfaceTrackLayerCode =
            PcbSvgRenderer.#resolveSurfaceLayerCode(tracks)
        const surfaceFillLayerCode =
            PcbSvgRenderer.#resolveSurfaceLayerCode(fills)

        return {
            surface: {
                polygons: polygons.filter((polygon) =>
                    PcbSvgRenderer.#isSurfacePolygon(polygon)
                ),
                fills: fills.filter(
                    (fill) => fill.layerCode === surfaceFillLayerCode
                ),
                tracks: tracks.filter(
                    (track) => track.layerCode === surfaceTrackLayerCode
                )
            },
            subsurface: {
                polygons: polygons.filter(
                    (polygon) => !PcbSvgRenderer.#isSurfacePolygon(polygon)
                ),
                fills: fills.filter(
                    (fill) => fill.layerCode !== surfaceFillLayerCode
                ),
                tracks: tracks.filter(
                    (track) => track.layerCode !== surfaceTrackLayerCode
                )
            }
        }
    }

    /**
     * Returns the default visible layer code from one primitive family.
     * @param {{ layerCode?: number }[]} primitives
     * @returns {number | null}
     */
    static #resolveSurfaceLayerCode(primitives) {
        const layerCodes = primitives
            .map((primitive) => primitive.layerCode)
            .filter((layerCode) => Number.isFinite(layerCode))

        return layerCodes.length ? Math.min(...layerCodes) : null
    }

    /**
     * Returns true when one polygon belongs to the top-facing copper view.
     * @param {{ layer?: string }} polygon
     * @returns {boolean}
     */
    static #isSurfacePolygon(polygon) {
        return String(polygon.layer || '').trim().toUpperCase() === 'TOP'
    }
}
