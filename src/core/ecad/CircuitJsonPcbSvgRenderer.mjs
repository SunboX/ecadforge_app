import { PcbInteractionPrimitiveModel } from '../PcbInteractionPrimitiveModel.mjs'

/**
 * Renders standards-shaped PCB element arrays into app-compatible SVG.
 */
export class CircuitJsonPcbSvgRenderer {
    /**
     * Renders one PCB document into SVG markup.
     * @param {object | object[]} documentModel Parsed document model.
     * @param {{ side?: 'top' | 'bottom' }} [options] Render options.
     * @returns {string}
     */
    static render(documentModel, options = {}) {
        const side = options.side === 'bottom' ? 'bottom' : 'top'
        const model = PcbInteractionPrimitiveModel.build(documentModel)
        const viewBox = CircuitJsonPcbSvgRenderer.#viewBox(model.bounds)

        return (
            '<svg class="pcb-svg pcb-svg--app-palette pcb-svg--circuitjson pcb-svg--' +
            side +
            '" xmlns="http://www.w3.org/2000/svg" role="img" viewBox="' +
            CircuitJsonPcbSvgRenderer.#formatViewBox(viewBox) +
            '">' +
            CircuitJsonPcbSvgRenderer.#renderBoard(model) +
            CircuitJsonPcbSvgRenderer.#renderCopper(model, side) +
            CircuitJsonPcbSvgRenderer.#renderComponentLabels(model) +
            CircuitJsonPcbSvgRenderer.#renderOverlays(model, side) +
            '</svg>'
        )
    }

    /**
     * Renders the board substrate.
     * @param {{ primitives: object[] }} model Primitive model.
     * @returns {string}
     */
    static #renderBoard(model) {
        const board = model.primitives.find(
            (primitive) => primitive.kind === 'board'
        )
        if (!board?.bounds) return ''

        if (Array.isArray(board.points) && board.points.length >= 3) {
            return (
                '<polygon class="pcb-board" data-layer="board" points="' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(
                    CircuitJsonPcbSvgRenderer.#pointsAttribute(board.points)
                ) +
                '"></polygon>'
            )
        }

        return (
            '<rect class="pcb-board" x="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(board.bounds.minX) +
            '" y="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(board.bounds.minY) +
            '" width="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(board.bounds.width) +
            '" height="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(board.bounds.height) +
            '" rx="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(
                Math.min(board.bounds.width, board.bounds.height) * 0.018
            ) +
            '" data-layer="board"></rect>'
        )
    }

    /**
     * Renders copper and drilled primitives.
     * @param {{ primitives: object[] }} model Primitive model.
     * @param {'top' | 'bottom'} side Active side.
     * @returns {string}
     */
    static #renderCopper(model, side) {
        const surface = []
        const subsurface = []

        for (const primitive of model.primitives) {
            const markup =
                CircuitJsonPcbSvgRenderer.#renderCopperPrimitive(primitive)
            if (!markup) continue

            const target = CircuitJsonPcbSvgRenderer.#isSurfacePrimitive(
                primitive,
                side
            )
                ? surface
                : subsurface
            target.push(markup)
        }

        return (
            '<g class="pcb-copper pcb-copper--subsurface">' +
            subsurface.join('') +
            '</g>' +
            '<g class="pcb-copper pcb-copper--surface">' +
            surface.join('') +
            '</g>'
        )
    }

    /**
     * Renders one copper primitive.
     * @param {object} primitive Primitive row.
     * @returns {string}
     */
    static #renderCopperPrimitive(primitive) {
        if (primitive.kind === 'pad') {
            return CircuitJsonPcbSvgRenderer.#renderPad(primitive)
        }
        if (primitive.kind === 'track') {
            return CircuitJsonPcbSvgRenderer.#renderTrack(primitive)
        }
        if (primitive.kind === 'via') {
            return CircuitJsonPcbSvgRenderer.#renderVia(primitive)
        }
        if (primitive.kind === 'zone') {
            return CircuitJsonPcbSvgRenderer.#renderZone(primitive)
        }
        if (
            [
                'silkscreen',
                'silkscreen_text',
                'silkscreen_line',
                'fabrication',
                'courtyard',
                'keepout',
                'cutout',
                'copper-text',
                'note',
                'dimension',
                'solder-mask',
                'solder-paste',
                'thermal-spoke',
                'route-hint',
                'breakout-point',
                'panel'
            ].includes(primitive.kind)
        ) {
            return CircuitJsonPcbSvgRenderer.#renderDetailPrimitive(primitive)
        }

        return ''
    }

    /**
     * Renders one pad primitive.
     * @param {object} primitive Pad primitive.
     * @returns {string}
     */
    static #renderPad(primitive) {
        const attributes =
            CircuitJsonPcbSvgRenderer.#primitiveAttributes(primitive)
        const shape = String(primitive.shape || 'rect').toLowerCase()
        const className =
            'pcb-pad pcb-smd-pad pcb-pad--' +
            CircuitJsonPcbSvgRenderer.#escapeHtml(shape)

        if (shape === 'polygon' && Array.isArray(primitive.points)) {
            return (
                '<polygon class="' +
                className +
                '" ' +
                attributes +
                ' points="' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(
                    CircuitJsonPcbSvgRenderer.#pointsAttribute(primitive.points)
                ) +
                '"></polygon>'
            )
        }

        if (shape === 'circle') {
            return (
                '<circle class="' +
                className +
                '" ' +
                attributes +
                ' cx="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x) +
                '" cy="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y) +
                '" r="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(
                    Math.max(primitive.width, primitive.height) / 2
                ) +
                '"></circle>'
            )
        }

        return (
            '<rect class="' +
            className +
            '" ' +
            attributes +
            ' x="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.bounds.minX) +
            '" y="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.bounds.minY) +
            '" width="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.bounds.width) +
            '" height="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.bounds.height) +
            '" rx="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(
                primitive.radius ||
                    Math.min(primitive.bounds.width, primitive.bounds.height) *
                        0.18
            ) +
            '"' +
            CircuitJsonPcbSvgRenderer.#rotationAttribute(primitive) +
            '></rect>'
        )
    }

    /**
     * Renders one track primitive.
     * @param {object} primitive Track primitive.
     * @returns {string}
     */
    static #renderTrack(primitive) {
        return (
            '<line class="pcb-track pcb-segment" ' +
            CircuitJsonPcbSvgRenderer.#primitiveAttributes(primitive) +
            ' x1="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x1) +
            '" y1="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y1) +
            '" x2="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x2) +
            '" y2="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y2) +
            '" stroke-width="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.width) +
            '" stroke-linecap="round"></line>'
        )
    }

    /**
     * Renders one via primitive.
     * @param {object} primitive Via primitive.
     * @returns {string}
     */
    static #renderVia(primitive) {
        return (
            '<g class="pcb-via-group" ' +
            CircuitJsonPcbSvgRenderer.#primitiveAttributes(primitive) +
            '>' +
            '<circle class="pcb-via" cx="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x) +
            '" cy="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y) +
            '" r="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.diameter / 2) +
            '"></circle>' +
            '<circle class="pcb-via__hole" cx="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x) +
            '" cy="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y) +
            '" r="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(
                primitive.holeDiameter / 2
            ) +
            '"></circle>' +
            '</g>'
        )
    }

    /**
     * Renders one polygonal zone primitive.
     * @param {object} primitive Zone primitive.
     * @returns {string}
     */
    static #renderZone(primitive) {
        if (Array.isArray(primitive.rings) && primitive.rings.length) {
            const path = CircuitJsonPcbSvgRenderer.#ringsPathData(
                primitive.rings
            )
            if (!path) return ''
            return (
                '<path class="pcb-zone" ' +
                CircuitJsonPcbSvgRenderer.#primitiveAttributes(primitive) +
                ' d="' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(path) +
                '" fill-rule="evenodd" clip-rule="evenodd"></path>'
            )
        }

        const points = CircuitJsonPcbSvgRenderer.#pointsAttribute(
            primitive.points || []
        )
        if (!points) return ''

        return (
            '<polygon class="pcb-zone" ' +
            CircuitJsonPcbSvgRenderer.#primitiveAttributes(primitive) +
            ' points="' +
            CircuitJsonPcbSvgRenderer.#escapeHtml(points) +
            '"></polygon>'
        )
    }

    /**
     * Renders one non-copper detail primitive.
     * @param {object} primitive Detail primitive.
     * @returns {string}
     */
    static #renderDetailPrimitive(primitive) {
        if (primitive.kind === 'dimension') {
            return CircuitJsonPcbSvgRenderer.#renderDimension(primitive)
        }
        if (primitive.text !== undefined) {
            return CircuitJsonPcbSvgRenderer.#renderDetailText(primitive)
        }
        if (Number.isFinite(Number(primitive.x1))) {
            return CircuitJsonPcbSvgRenderer.#renderDetailLine(primitive)
        }
        if (Array.isArray(primitive.points) && primitive.points.length >= 3) {
            return CircuitJsonPcbSvgRenderer.#renderDetailPolygon(primitive)
        }
        if (String(primitive.shape || '').toLowerCase() === 'circle') {
            return CircuitJsonPcbSvgRenderer.#renderDetailCircle(primitive)
        }
        return CircuitJsonPcbSvgRenderer.#renderDetailRect(primitive)
    }

    /**
     * Renders a dimension line with a centered label.
     * @param {object} primitive Dimension primitive.
     * @returns {string}
     */
    static #renderDimension(primitive) {
        const midX = (Number(primitive.x1) + Number(primitive.x2)) / 2
        const midY = (Number(primitive.y1) + Number(primitive.y2)) / 2
        return (
            '<g class="' +
            CircuitJsonPcbSvgRenderer.#detailClass(primitive) +
            '" ' +
            CircuitJsonPcbSvgRenderer.#primitiveAttributes(primitive) +
            '><line x1="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x1) +
            '" y1="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y1) +
            '" x2="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x2) +
            '" y2="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y2) +
            '" stroke-width="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.width || 0.08) +
            '"></line><text x="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(midX) +
            '" y="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(midY) +
            '" font-size="0.32" text-anchor="middle" dominant-baseline="central">' +
            CircuitJsonPcbSvgRenderer.#escapeHtml(primitive.text || '') +
            '</text></g>'
        )
    }

    /**
     * Renders a detail text primitive.
     * @param {object} primitive Text primitive.
     * @returns {string}
     */
    static #renderDetailText(primitive) {
        return (
            '<text class="' +
            CircuitJsonPcbSvgRenderer.#detailClass(primitive) +
            '" ' +
            CircuitJsonPcbSvgRenderer.#primitiveAttributes(primitive) +
            ' x="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x) +
            '" y="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y) +
            '" font-size="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.fontSize || 1) +
            '" text-anchor="middle" dominant-baseline="central"' +
            CircuitJsonPcbSvgRenderer.#rotationAttribute(primitive) +
            '>' +
            CircuitJsonPcbSvgRenderer.#escapeHtml(primitive.text) +
            '</text>'
        )
    }

    /**
     * Renders a detail line primitive.
     * @param {object} primitive Line primitive.
     * @returns {string}
     */
    static #renderDetailLine(primitive) {
        return (
            '<line class="' +
            CircuitJsonPcbSvgRenderer.#detailClass(primitive) +
            '" ' +
            CircuitJsonPcbSvgRenderer.#primitiveAttributes(primitive) +
            ' x1="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x1) +
            '" y1="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y1) +
            '" x2="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x2) +
            '" y2="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y2) +
            '" stroke-width="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.width || 0.12) +
            '" stroke-linecap="round"></line>'
        )
    }

    /**
     * Renders a detail polygon primitive.
     * @param {object} primitive Polygon primitive.
     * @returns {string}
     */
    static #renderDetailPolygon(primitive) {
        return (
            '<polygon class="' +
            CircuitJsonPcbSvgRenderer.#detailClass(primitive) +
            '" ' +
            CircuitJsonPcbSvgRenderer.#primitiveAttributes(primitive) +
            ' points="' +
            CircuitJsonPcbSvgRenderer.#escapeHtml(
                CircuitJsonPcbSvgRenderer.#pointsAttribute(primitive.points)
            ) +
            '"></polygon>'
        )
    }

    /**
     * Renders a detail circle primitive.
     * @param {object} primitive Circle primitive.
     * @returns {string}
     */
    static #renderDetailCircle(primitive) {
        return (
            '<circle class="' +
            CircuitJsonPcbSvgRenderer.#detailClass(primitive) +
            '" ' +
            CircuitJsonPcbSvgRenderer.#primitiveAttributes(primitive) +
            ' cx="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x) +
            '" cy="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y) +
            '" r="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(
                primitive.radius ||
                    Math.max(primitive.width || 0, primitive.height || 0) / 2
            ) +
            '"></circle>'
        )
    }

    /**
     * Renders a detail rectangle primitive.
     * @param {object} primitive Rectangle primitive.
     * @returns {string}
     */
    static #renderDetailRect(primitive) {
        if (!primitive.bounds) return ''
        return (
            '<rect class="' +
            CircuitJsonPcbSvgRenderer.#detailClass(primitive) +
            '" ' +
            CircuitJsonPcbSvgRenderer.#primitiveAttributes(primitive) +
            ' x="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.bounds.minX) +
            '" y="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.bounds.minY) +
            '" width="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.bounds.width) +
            '" height="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.bounds.height) +
            '" rx="' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.radius || 0) +
            '"' +
            CircuitJsonPcbSvgRenderer.#rotationAttribute(primitive) +
            '></rect>'
        )
    }

    /**
     * Renders diagnostic markers, length labels, groups, and rats-nest lines.
     * @param {{ diagnostics?: object[], airwires?: object[], traceLengths?: object[], groups?: object[], anchorOffsets?: object[] }} model Primitive model.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {string}
     */
    static #renderOverlays(model, side) {
        return (
            CircuitJsonPcbSvgRenderer.#renderGroups(model.groups || []) +
            CircuitJsonPcbSvgRenderer.#renderAnchorOffsets(
                model.anchorOffsets || []
            ) +
            CircuitJsonPcbSvgRenderer.#renderAirwires(model.airwires || []) +
            CircuitJsonPcbSvgRenderer.#renderTraceLengths(
                model.traceLengths || [],
                side
            ) +
            CircuitJsonPcbSvgRenderer.#renderDiagnostics(
                model.diagnostics || []
            )
        )
    }

    /**
     * Renders PCB group outlines.
     * @param {object[]} groups Group rows.
     * @returns {string}
     */
    static #renderGroups(groups) {
        const outlines = groups
            .filter((group) => group.bounds)
            .map(
                (group) =>
                    '<rect class="pcb-group-outline" data-layer="groups" data-pcb-group-id="' +
                    CircuitJsonPcbSvgRenderer.#escapeHtml(group.id) +
                    '" data-source-group-id="' +
                    CircuitJsonPcbSvgRenderer.#escapeHtml(
                        group.sourceGroupId || ''
                    ) +
                    '" x="' +
                    CircuitJsonPcbSvgRenderer.#formatNumber(group.bounds.minX) +
                    '" y="' +
                    CircuitJsonPcbSvgRenderer.#formatNumber(group.bounds.minY) +
                    '" width="' +
                    CircuitJsonPcbSvgRenderer.#formatNumber(
                        group.bounds.width
                    ) +
                    '" height="' +
                    CircuitJsonPcbSvgRenderer.#formatNumber(
                        group.bounds.height
                    ) +
                    '"><title>' +
                    CircuitJsonPcbSvgRenderer.#escapeHtml(
                        group.name || group.id
                    ) +
                    '</title></rect>'
            )
        return outlines.length
            ? '<g class="pcb-groups" data-layer="groups">' +
                  outlines.join('') +
                  '</g>'
            : ''
    }

    /**
     * Renders group anchor offset lines.
     * @param {object[]} anchorOffsets Anchor offset rows.
     * @returns {string}
     */
    static #renderAnchorOffsets(anchorOffsets) {
        const lines = anchorOffsets.map(
            (offset) =>
                '<line class="pcb-anchor-offset" data-layer="anchor_offsets" data-pcb-group-id="' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(offset.sourceId || '') +
                '" data-target-id="' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(offset.targetId || '') +
                '" x1="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(offset.start?.x) +
                '" y1="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(offset.start?.y) +
                '" x2="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(offset.end?.x) +
                '" y2="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(offset.end?.y) +
                '"></line>'
        )
        return lines.length
            ? '<g class="pcb-anchor-offsets" data-layer="anchor_offsets">' +
                  lines.join('') +
                  '</g>'
            : ''
    }

    /**
     * Renders routed trace length labels.
     * @param {object[]} traceLengths Trace length rows.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {string}
     */
    static #renderTraceLengths(traceLengths, side) {
        const labels = traceLengths
            .filter((row) => !row.side || row.side === side)
            .map(
                (row) =>
                    '<text class="' +
                    CircuitJsonPcbSvgRenderer.#traceLengthClass(row) +
                    '" data-layer="trace_lengths" data-pcb-trace-length-id="' +
                    CircuitJsonPcbSvgRenderer.#escapeHtml(row.id) +
                    '" data-net="' +
                    CircuitJsonPcbSvgRenderer.#escapeHtml(row.netName || '') +
                    '" x="' +
                    CircuitJsonPcbSvgRenderer.#formatNumber(row.point?.x) +
                    '" y="' +
                    CircuitJsonPcbSvgRenderer.#formatNumber(row.point?.y) +
                    '" text-anchor="middle" dominant-baseline="central">' +
                    CircuitJsonPcbSvgRenderer.#escapeHtml(
                        CircuitJsonPcbSvgRenderer.#traceLengthLabel(row)
                    ) +
                    '</text>'
            )
        return labels.length
            ? '<g class="pcb-trace-lengths" data-layer="trace_lengths">' +
                  labels.join('') +
                  '</g>'
            : ''
    }

    /**
     * Builds trace length label classes.
     * @param {object} row Trace length row.
     * @returns {string}
     */
    static #traceLengthClass(row) {
        return (
            'pcb-trace-length-label' +
            (row?.overLimit ? ' pcb-trace-length-label--over-limit' : '')
        )
    }

    /**
     * Builds trace length label text.
     * @param {object} row Trace length row.
     * @returns {string}
     */
    static #traceLengthLabel(row) {
        return String(row?.label || '').trim() || row.length + ' mm'
    }

    /**
     * Renders rats-nest airwire lines.
     * @param {object[]} airwires Airwire rows.
     * @returns {string}
     */
    static #renderAirwires(airwires) {
        const lines = airwires.map(
            (airwire) =>
                '<line class="pcb-ratsnest-line" data-layer="ratsnest" data-net="' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(airwire.netName) +
                '" data-pcb-ratsnest-net="' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(airwire.netName) +
                '" x1="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(airwire.start?.x) +
                '" y1="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(airwire.start?.y) +
                '" x2="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(airwire.end?.x) +
                '" y2="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(airwire.end?.y) +
                '"></line>'
        )
        return lines.length
            ? '<g class="pcb-ratsnest" data-layer="ratsnest">' +
                  lines.join('') +
                  '</g>'
            : ''
    }

    /**
     * Renders diagnostic marker rows.
     * @param {object[]} diagnostics Diagnostic rows.
     * @returns {string}
     */
    static #renderDiagnostics(diagnostics) {
        const markers = diagnostics.map(
            (diagnostic) =>
                '<g class="pcb-diagnostic-marker pcb-diagnostic-marker--' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(diagnostic.severity) +
                '" data-layer="diagnostics" data-pcb-diagnostic-id="' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(diagnostic.id) +
                '" data-component-key="' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(
                    diagnostic.componentKey || ''
                ) +
                '" data-net="' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(
                    diagnostic.netName || ''
                ) +
                '">' +
                '<title>' +
                CircuitJsonPcbSvgRenderer.#escapeHtml(diagnostic.message) +
                '</title><circle cx="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(diagnostic.point?.x) +
                '" cy="' +
                CircuitJsonPcbSvgRenderer.#formatNumber(diagnostic.point?.y) +
                '" r="0.24"></circle></g>'
        )
        return markers.length
            ? '<g class="pcb-diagnostics" data-layer="diagnostics">' +
                  markers.join('') +
                  '</g>'
            : ''
    }

    /**
     * Renders component reference labels.
     * @param {{ components: object[] }} model Primitive model.
     * @returns {string}
     */
    static #renderComponentLabels(model) {
        const labels = model.components
            .filter((component) => component.componentKey)
            .map((component) => {
                const key = String(component.componentKey || '')
                return (
                    '<text class="pcb-label pcb-reference pcb-footprint-text" data-component-key="' +
                    CircuitJsonPcbSvgRenderer.#escapeHtml(key) +
                    '" data-footprint-id="' +
                    CircuitJsonPcbSvgRenderer.#escapeHtml(
                        'footprint:' + key + ':label'
                    ) +
                    '" x="' +
                    CircuitJsonPcbSvgRenderer.#formatNumber(component.x || 0) +
                    '" y="' +
                    CircuitJsonPcbSvgRenderer.#formatNumber(component.y || 0) +
                    '" text-anchor="middle" dominant-baseline="central">' +
                    CircuitJsonPcbSvgRenderer.#escapeHtml(
                        component.designator || key
                    ) +
                    '</text>'
                )
            })

        return labels.length
            ? '<g class="pcb-footprints pcb-texts">' + labels.join('') + '</g>'
            : ''
    }

    /**
     * Resolves CSS classes for detail primitives.
     * @param {object} primitive Detail primitive.
     * @returns {string}
     */
    static #detailClass(primitive) {
        const kind = String(primitive.kind || '')
        if (kind === 'silkscreen_text') {
            return 'pcb-silkscreen pcb-silkscreen-text pcb-footprint-text'
        }
        if (kind === 'silkscreen_line') {
            return 'pcb-silkscreen pcb-silkscreen-line'
        }
        if (kind === 'silkscreen') return 'pcb-silkscreen'
        if (kind === 'fabrication') return 'pcb-fabrication'
        if (kind === 'courtyard') return 'pcb-courtyard'
        if (kind === 'keepout') return 'pcb-keepout'
        if (kind === 'cutout') return 'pcb-cutout'
        if (kind === 'note') return 'pcb-note'
        if (kind === 'dimension') return 'pcb-dimension'
        if (kind === 'solder-mask') return 'pcb-solder-mask'
        if (kind === 'solder-paste') return 'pcb-solder-paste'
        if (kind === 'thermal-spoke') return 'pcb-thermal-spoke'
        if (kind === 'route-hint') return 'pcb-route-hint'
        if (kind === 'breakout-point') return 'pcb-breakout-point'
        if (kind === 'panel') return 'pcb-panel-outline'
        if (kind === 'copper-text') {
            return 'pcb-copper-text pcb-footprint-text'
        }
        return 'pcb-detail'
    }

    /**
     * Returns true when a primitive belongs to the active surface.
     * @param {object} primitive Primitive row.
     * @param {'top' | 'bottom'} side Active side.
     * @returns {boolean}
     */
    static #isSurfacePrimitive(primitive, side) {
        const primitiveSide = String(primitive.side || '').trim()
        if (primitiveSide) return primitiveSide === side

        const layer = String(primitive.layer || '').toLowerCase()
        if (side === 'bottom') return layer === 'bottom'

        return layer === 'top' || !layer || layer === 'board'
    }

    /**
     * Renders shared primitive data attributes.
     * @param {object} primitive Primitive row.
     * @returns {string}
     */
    static #primitiveAttributes(primitive) {
        const attributes = [
            ['data-layer', primitive.layer],
            ['data-net', primitive.netName],
            ['data-component-key', primitive.componentKey],
            ['data-footprint-id', primitive.footprintId],
            ['data-pcb-group-ids', (primitive.groupIds || []).join(' ')],
            ['data-subcircuit-ids', (primitive.subcircuitIds || []).join(' ')],
            ['data-source-net-id', primitive.sourceNetId],
            [
                'data-solder-mask-covered',
                primitive.coveredWithSolderMask === undefined ||
                primitive.coveredWithSolderMask === null
                    ? ''
                    : String(Boolean(primitive.coveredWithSolderMask))
            ],
            ['data-primitive-kind', primitive.kind]
        ]
            .filter((entry) => String(entry[1] || '').trim())
            .map(
                ([name, value]) =>
                    name +
                    '="' +
                    CircuitJsonPcbSvgRenderer.#escapeHtml(value) +
                    '"'
            )

        return attributes.join(' ')
    }

    /**
     * Builds a polygon points attribute.
     * @param {{ x: number, y: number }[]} points Points.
     * @returns {string}
     */
    static #pointsAttribute(points) {
        return (points || [])
            .map(
                (point) =>
                    CircuitJsonPcbSvgRenderer.#formatNumber(point.x) +
                    ',' +
                    CircuitJsonPcbSvgRenderer.#formatNumber(point.y)
            )
            .join(' ')
    }

    /**
     * Builds an SVG path for zone rings.
     * @param {{ points?: { x: number, y: number }[] }[]} rings Zone rings.
     * @returns {string}
     */
    static #ringsPathData(rings) {
        return (rings || [])
            .map((ring) => CircuitJsonPcbSvgRenderer.#ringPathData(ring))
            .filter(Boolean)
            .join(' ')
    }

    /**
     * Builds an SVG path segment for one closed ring.
     * @param {{ points?: { x: number, y: number }[] }} ring Zone ring.
     * @returns {string}
     */
    static #ringPathData(ring) {
        const points = Array.isArray(ring?.points) ? ring.points : []
        if (points.length < 3) return ''
        const [first, ...rest] = points
        return (
            'M ' +
            CircuitJsonPcbSvgRenderer.#formatNumber(first.x) +
            ' ' +
            CircuitJsonPcbSvgRenderer.#formatNumber(first.y) +
            rest
                .map(
                    (point) =>
                        ' L ' +
                        CircuitJsonPcbSvgRenderer.#formatNumber(point.x) +
                        ' ' +
                        CircuitJsonPcbSvgRenderer.#formatNumber(point.y)
                )
                .join('') +
            ' Z'
        )
    }

    /**
     * Builds a rotation transform attribute for centered primitives.
     * @param {object} primitive Primitive row.
     * @returns {string}
     */
    static #rotationAttribute(primitive) {
        const rotation = Number(primitive.rotation || 0)
        if (!Number.isFinite(rotation) || rotation === 0) return ''
        return (
            ' transform="rotate(' +
            CircuitJsonPcbSvgRenderer.#formatNumber(rotation) +
            ' ' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.x) +
            ' ' +
            CircuitJsonPcbSvgRenderer.#formatNumber(primitive.y) +
            ')"'
        )
    }

    /**
     * Builds a padded SVG viewBox for model bounds.
     * @param {{ minX: number, minY: number, width: number, height: number }} bounds Model bounds.
     * @returns {{ minX: number, minY: number, width: number, height: number }}
     */
    static #viewBox(bounds) {
        const padding = Math.max(bounds.width, bounds.height, 1) * 0.06

        return {
            minX: bounds.minX - padding,
            minY: bounds.minY - padding,
            width: bounds.width + padding * 2,
            height: bounds.height + padding * 2
        }
    }

    /**
     * Formats a viewBox record.
     * @param {{ minX: number, minY: number, width: number, height: number }} viewBox ViewBox record.
     * @returns {string}
     */
    static #formatViewBox(viewBox) {
        return [viewBox.minX, viewBox.minY, viewBox.width, viewBox.height]
            .map((value) => CircuitJsonPcbSvgRenderer.#formatNumber(value))
            .join(' ')
    }

    /**
     * Formats one SVG number.
     * @param {number} value Number.
     * @returns {string}
     */
    static #formatNumber(value) {
        const number = Number(value)
        if (!Number.isFinite(number)) return '0'

        return Number(number.toFixed(6)).toString()
    }

    /**
     * Formats a board length label.
     * @param {number} value Length value in millimeters.
     * @returns {string}
     */
    static #formatLength(value) {
        const number = Number(value)
        return (Number.isFinite(number) ? number : 0).toFixed(2) + ' mm'
    }

    /**
     * Escapes markup text.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }
}
