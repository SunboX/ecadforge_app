import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'

/**
 * Renders PCB measurement toolbar controls and SVG overlays.
 */
export class PcbMeasurementRenderer {
    /**
     * Renders measurement tool buttons.
     * @param {string} activeTool Active measurement mode.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {{ hidden?: boolean }} [options] Render options.
     * @returns {string}
     */
    static renderToolbarButtons(activeTool, translate, options = {}) {
        const hidden = options.hidden === true
        return [
            PcbMeasurementRenderer.#renderButton(
                'distance',
                activeTool,
                translate('pcbView.measureDistance'),
                hidden
            ),
            PcbMeasurementRenderer.#renderButton(
                'bounds',
                activeTool,
                translate('pcbView.measureBounds'),
                hidden
            ),
            PcbMeasurementRenderer.#renderButton(
                'clear',
                activeTool,
                translate('pcbView.measureClear'),
                hidden
            )
        ].join('')
    }

    /**
     * Injects measurement overlay markup into a rendered SVG.
     * @param {string} markup PCB SVG markup.
     * @param {{ tool: string, mode: string, start: object | null, end: object | null }} measurement Measurement state.
     * @param {object | object[] | null} [documentModel] Active document model.
     * @param {((key: string) => string) | null} [translate] Translation lookup.
     * @returns {string}
     */
    static injectOverlay(
        markup,
        measurement,
        documentModel = null,
        translate = null
    ) {
        const overlay =
            PcbMeasurementRenderer.#snapTargetsOverlay(
                measurement,
                documentModel
            ) + PcbMeasurementRenderer.#renderOverlay(measurement, translate)
        return overlay
            ? String(markup).replace(/<\/svg>/, overlay + '</svg>')
            : markup
    }

    /**
     * Normalizes measurement state for rendering.
     * @param {object | null | undefined} measurement Measurement candidate.
     * @returns {{ tool: string, mode: string, start: object | null, end: object | null }}
     */
    static normalize(measurement) {
        return {
            tool: ['distance', 'bounds'].includes(measurement?.tool)
                ? String(measurement.tool)
                : '',
            mode: ['distance', 'bounds'].includes(measurement?.mode)
                ? String(measurement.mode)
                : '',
            start: PcbMeasurementRenderer.#point(measurement?.start),
            end: PcbMeasurementRenderer.#point(measurement?.end)
        }
    }

    /**
     * Renders one measurement button.
     * @param {'distance' | 'bounds' | 'clear'} tool Tool id.
     * @param {string} activeTool Active tool id.
     * @param {string} label Accessible label.
     * @param {boolean} hidden Whether the button is hidden.
     * @returns {string}
     */
    static #renderButton(tool, activeTool, label, hidden) {
        const isActive = tool === activeTool && tool !== 'clear'
        return (
            '<button class="scene-3d__preset pcb-view__measure-tool' +
            (isActive ? ' is-active' : '') +
            '" type="button"' +
            (hidden ? ' hidden' : '') +
            ' data-pcb-measure-tool="' +
            tool +
            '" aria-label="' +
            PcbMeasurementRenderer.#escapeHtml(label) +
            '" title="' +
            PcbMeasurementRenderer.#escapeHtml(label) +
            '" aria-pressed="' +
            (isActive ? 'true' : 'false') +
            '">' +
            PcbMeasurementRenderer.#icon(tool) +
            '</button>'
        )
    }

    /**
     * Renders an icon for one measurement tool.
     * @param {string} tool Tool id.
     * @returns {string}
     */
    static #icon(tool) {
        if (tool === 'bounds') {
            return '<svg aria-hidden="true" viewBox="0 0 18 18" width="16" height="16"><rect x="4" y="5" width="10" height="8" rx="1.2"></rect><path d="M4 3v12M14 3v12"></path></svg>'
        }
        if (tool === 'clear') {
            return '<svg aria-hidden="true" viewBox="0 0 18 18" width="16" height="16"><path d="M5 5l8 8M13 5l-8 8"></path></svg>'
        }
        return '<svg aria-hidden="true" viewBox="0 0 18 18" width="16" height="16"><path d="M4 13L14 5"></path><circle cx="4" cy="13" r="1.6"></circle><circle cx="14" cy="5" r="1.6"></circle></svg>'
    }

    /**
     * Renders measurement overlay markup.
     * @param {{ tool: string, start: object | null, end: object | null }} measurement Measurement state.
     * @param {((key: string) => string) | null} translate Translation lookup.
     * @returns {string}
     */
    static #renderOverlay(measurement, translate) {
        const tool = String(measurement?.tool || '').trim()
        const start = PcbMeasurementRenderer.#point(measurement?.start)
        const end = PcbMeasurementRenderer.#point(measurement?.end)
        if (!tool || !start) return ''
        if (!end) return PcbMeasurementRenderer.#pointOverlay(start)
        if (tool === 'bounds') {
            return PcbMeasurementRenderer.#boundsOverlay(start, end, translate)
        }
        return PcbMeasurementRenderer.#distanceOverlay(start, end)
    }

    /**
     * Renders visible snap targets while a measurement mode is active.
     * @param {{ mode: string }} measurement Measurement state.
     * @param {object | object[] | null} documentModel Active document model.
     * @returns {string}
     */
    static #snapTargetsOverlay(measurement, documentModel) {
        if (!String(measurement?.mode || '').trim() || !documentModel) return ''

        const anchors = PcbMeasurementRenderer.#uniqueAnchors(
            PcbInteractionPrimitiveModel.build(documentModel).anchors
        ).slice(0, 160)
        if (!anchors.length) return ''

        return (
            '<g class="pcb-measurement-snap-targets" aria-hidden="true">' +
            anchors
                .map(
                    (anchor) =>
                        '<circle class="pcb-measurement-snap-target" cx="' +
                        PcbMeasurementRenderer.#svgNumber(anchor.point.x) +
                        '" cy="' +
                        PcbMeasurementRenderer.#svgNumber(anchor.point.y) +
                        '" r="0.055"></circle>'
                )
                .join('') +
            '</g>'
        )
    }

    /**
     * Deduplicates snap anchors by rounded board coordinate.
     * @param {object[]} anchors Snap anchors.
     * @returns {object[]}
     */
    static #uniqueAnchors(anchors) {
        const seen = new Set()
        const unique = []
        for (const anchor of Array.isArray(anchors) ? anchors : []) {
            const point = PcbMeasurementRenderer.#point(anchor?.point)
            if (!point) continue
            const key =
                PcbMeasurementRenderer.#svgNumber(point.x) +
                ',' +
                PcbMeasurementRenderer.#svgNumber(point.y)
            if (seen.has(key)) continue
            seen.add(key)
            unique.push({ ...anchor, point })
        }
        return unique
    }

    /**
     * Renders a pending measurement point.
     * @param {{ x: number, y: number }} point Start point.
     * @returns {string}
     */
    static #pointOverlay(point) {
        return (
            '<g class="pcb-measurement-overlay" aria-hidden="true">' +
            PcbMeasurementRenderer.#handle(point) +
            '</g>'
        )
    }

    /**
     * Renders a distance measurement overlay.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @returns {string}
     */
    static #distanceOverlay(start, end) {
        const distance = Math.hypot(end.x - start.x, end.y - start.y)
        const midX = (start.x + end.x) / 2
        const midY = (start.y + end.y) / 2
        return (
            '<g class="pcb-measurement-overlay" data-pcb-measurement-distance="' +
            PcbMeasurementRenderer.#dataNumber(distance) +
            '" aria-hidden="true"><line class="pcb-measurement-overlay__line" x1="' +
            PcbMeasurementRenderer.#svgNumber(start.x) +
            '" y1="' +
            PcbMeasurementRenderer.#svgNumber(start.y) +
            '" x2="' +
            PcbMeasurementRenderer.#svgNumber(end.x) +
            '" y2="' +
            PcbMeasurementRenderer.#svgNumber(end.y) +
            '"></line>' +
            PcbMeasurementRenderer.#handle(start) +
            PcbMeasurementRenderer.#handle(end) +
            PcbMeasurementRenderer.#text(midX, midY, distance) +
            '</g>'
        )
    }

    /**
     * Renders a bounds measurement overlay.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @param {((key: string) => string) | null} translate Translation lookup.
     * @returns {string}
     */
    static #boundsOverlay(start, end, translate) {
        const x = Math.min(start.x, end.x)
        const y = Math.min(start.y, end.y)
        const width = Math.abs(end.x - start.x)
        const height = Math.abs(end.y - start.y)
        return (
            '<g class="pcb-measurement-overlay" data-pcb-measurement-width="' +
            PcbMeasurementRenderer.#dataNumber(width) +
            '" data-pcb-measurement-height="' +
            PcbMeasurementRenderer.#dataNumber(height) +
            '"><rect class="pcb-measurement-overlay__bounds" x="' +
            PcbMeasurementRenderer.#svgNumber(x) +
            '" y="' +
            PcbMeasurementRenderer.#svgNumber(y) +
            '" width="' +
            PcbMeasurementRenderer.#svgNumber(width) +
            '" height="' +
            PcbMeasurementRenderer.#svgNumber(height) +
            '"></rect>' +
            PcbMeasurementRenderer.#handle(start) +
            PcbMeasurementRenderer.#handle(end) +
            PcbMeasurementRenderer.#text(
                x + width / 2,
                y + height / 2,
                width,
                height
            ) +
            PcbMeasurementRenderer.#copyButton(
                x,
                y,
                x + width,
                y + height,
                PcbMeasurementRenderer.#translated(
                    translate,
                    'pcbView.copyMeasurementBounds',
                    'Copy measurement bounds'
                )
            ) +
            PcbMeasurementRenderer.#actionButtons(
                x,
                y,
                x + width,
                y + height,
                translate
            ) +
            '</g>'
        )
    }

    /**
     * Renders one endpoint handle.
     * @param {{ x: number, y: number }} point Endpoint.
     * @returns {string}
     */
    static #handle(point) {
        return (
            '<circle class="pcb-measurement-overlay__handle" cx="' +
            PcbMeasurementRenderer.#svgNumber(point.x) +
            '" cy="' +
            PcbMeasurementRenderer.#svgNumber(point.y) +
            '" r="0.12"></circle>'
        )
    }

    /**
     * Renders measurement label text.
     * @param {number} x Text x.
     * @param {number} y Text y.
     * @param {number} primary Primary value.
     * @param {number | null} [secondary] Optional secondary value.
     * @returns {string}
     */
    static #text(x, y, primary, secondary = null) {
        const label =
            secondary === null
                ? PcbMeasurementRenderer.#labelNumber(primary)
                : PcbMeasurementRenderer.#labelNumber(primary) +
                  ' x ' +
                  PcbMeasurementRenderer.#labelNumber(secondary)
        return (
            '<text class="pcb-measurement-overlay__label" x="' +
            PcbMeasurementRenderer.#svgNumber(x) +
            '" y="' +
            PcbMeasurementRenderer.#svgNumber(y) +
            '" text-anchor="middle" dominant-baseline="central">' +
            PcbMeasurementRenderer.#escapeHtml(label) +
            '</text>'
        )
    }

    /**
     * Renders a copy button for completed bounds measurements.
     * @param {number} minX Minimum x.
     * @param {number} minY Minimum y.
     * @param {number} maxX Maximum x.
     * @param {number} maxY Maximum y.
     * @param {string} label Accessible label.
     * @returns {string}
     */
    static #copyButton(minX, minY, maxX, maxY, label) {
        const value =
            'minX: ' +
            PcbMeasurementRenderer.#labelNumber(minX) +
            ', minY: ' +
            PcbMeasurementRenderer.#labelNumber(minY) +
            ', maxX: ' +
            PcbMeasurementRenderer.#labelNumber(maxX) +
            ', maxY: ' +
            PcbMeasurementRenderer.#labelNumber(maxY)
        return (
            '<foreignObject class="pcb-measurement-copy-host" x="' +
            PcbMeasurementRenderer.#svgNumber((minX + maxX) / 2 - 0.28) +
            '" y="' +
            PcbMeasurementRenderer.#svgNumber((minY + maxY) / 2 + 0.22) +
            '" width="0.56" height="0.56"><button class="pcb-measurement-copy" type="button" data-pcb-measure-copy="' +
            PcbMeasurementRenderer.#escapeHtml(value) +
            '" aria-label="' +
            PcbMeasurementRenderer.#escapeHtml(label) +
            '" title="' +
            PcbMeasurementRenderer.#escapeHtml(label) +
            '"><svg aria-hidden="true" viewBox="0 0 18 18" width="14" height="14"><rect x="6" y="5" width="8" height="10" rx="1"></rect><path d="M4 12V3h8"></path></svg></button></foreignObject>'
        )
    }

    /**
     * Renders workflow actions for completed bounds measurements.
     * @param {number} minX Minimum x.
     * @param {number} minY Minimum y.
     * @param {number} maxX Maximum x.
     * @param {number} maxY Maximum y.
     * @param {((key: string) => string) | null} translate Translation lookup.
     * @returns {string}
     */
    static #actionButtons(minX, minY, maxX, maxY, translate) {
        const actions = [
            ['zoom', 'pcbView.zoomMeasurementBounds'],
            ['select', 'pcbView.selectMeasurementBounds'],
            ['export-svg', 'pcbView.exportMeasurementBoundsSvg'],
            ['export-png', 'pcbView.exportMeasurementBoundsPng']
        ]
        return (
            '<foreignObject class="pcb-measurement-actions-host" x="' +
            PcbMeasurementRenderer.#svgNumber((minX + maxX) / 2 - 0.82) +
            '" y="' +
            PcbMeasurementRenderer.#svgNumber((minY + maxY) / 2 + 0.82) +
            '" width="1.64" height="0.56"><span class="pcb-measurement-actions">' +
            actions
                .map(([action, labelKey]) =>
                    PcbMeasurementRenderer.#actionButton(
                        action,
                        minX,
                        minY,
                        maxX,
                        maxY,
                        PcbMeasurementRenderer.#translated(
                            translate,
                            labelKey,
                            labelKey
                        )
                    )
                )
                .join('') +
            '</span></foreignObject>'
        )
    }

    /**
     * Renders one bounds action button.
     * @param {string} action Action id.
     * @param {number} minX Minimum x.
     * @param {number} minY Minimum y.
     * @param {number} maxX Maximum x.
     * @param {number} maxY Maximum y.
     * @param {string} label Accessible label.
     * @returns {string}
     */
    static #actionButton(action, minX, minY, maxX, maxY, label) {
        return (
            '<button class="pcb-measurement-action" type="button" data-pcb-measure-action="' +
            PcbMeasurementRenderer.#escapeHtml(action) +
            '" data-pcb-bounds-min-x="' +
            PcbMeasurementRenderer.#dataNumber(minX) +
            '" data-pcb-bounds-min-y="' +
            PcbMeasurementRenderer.#dataNumber(minY) +
            '" data-pcb-bounds-max-x="' +
            PcbMeasurementRenderer.#dataNumber(maxX) +
            '" data-pcb-bounds-max-y="' +
            PcbMeasurementRenderer.#dataNumber(maxY) +
            '" aria-label="' +
            PcbMeasurementRenderer.#escapeHtml(label) +
            '" title="' +
            PcbMeasurementRenderer.#escapeHtml(label) +
            '">' +
            PcbMeasurementRenderer.#actionIcon(action) +
            '</button>'
        )
    }

    /**
     * Renders an icon for a bounds action.
     * @param {string} action Action id.
     * @returns {string}
     */
    static #actionIcon(action) {
        if (action === 'select') {
            return '<svg aria-hidden="true" viewBox="0 0 18 18" width="14" height="14"><path d="M5 4h8v8H5z"></path><path d="m7 14 2-2 2 2"></path></svg>'
        }
        if (action === 'export-svg') {
            return '<svg aria-hidden="true" viewBox="0 0 18 18" width="14" height="14"><path d="M9 3v8"></path><path d="m6 8 3 3 3-3"></path><path d="M4 14h10"></path></svg>'
        }
        if (action === 'export-png') {
            return '<svg aria-hidden="true" viewBox="0 0 18 18" width="14" height="14"><rect x="4" y="4" width="10" height="10" rx="1"></rect><circle cx="7" cy="7" r="1"></circle><path d="m5 13 3-3 2 2 1-1 2 2"></path></svg>'
        }
        return '<svg aria-hidden="true" viewBox="0 0 18 18" width="14" height="14"><path d="M6 4h8v8"></path><path d="M14 4 5 13"></path><path d="M5 8v5h5"></path></svg>'
    }

    /**
     * Resolves translated text with a fallback.
     * @param {((key: string) => string) | null} translate Translation lookup.
     * @param {string} key Message key.
     * @param {string} fallback Fallback text.
     * @returns {string}
     */
    static #translated(translate, key, fallback) {
        const value = typeof translate === 'function' ? translate(key) : ''
        return value && value !== key ? value : fallback
    }

    /**
     * Normalizes one point.
     * @param {object | null | undefined} point Point candidate.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(point) {
        const x = Number(point?.x)
        const y = Number(point?.y)
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }

    /**
     * Formats one SVG numeric attribute.
     * @param {number} value Raw number.
     * @returns {string}
     */
    static #svgNumber(value) {
        const number = Number(value)
        return Number.isFinite(number)
            ? Number(number.toFixed(6)).toString()
            : '0'
    }

    /**
     * Formats one data attribute number.
     * @param {number} value Raw number.
     * @returns {string}
     */
    static #dataNumber(value) {
        return Number(Number(value).toFixed(6)).toString()
    }

    /**
     * Formats one visible measurement number.
     * @param {number} value Raw number.
     * @returns {string}
     */
    static #labelNumber(value) {
        const number = Number(value)
        return Number.isFinite(number) ? number.toFixed(2) : '0.00'
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
