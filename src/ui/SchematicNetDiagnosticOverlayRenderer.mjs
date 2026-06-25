import { SchematicNetGeometryDiagnostics } from '../core/SchematicNetGeometryDiagnostics.mjs'
import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'
import { SchematicCoordinateProjector } from './SchematicCoordinateProjector.mjs'
import { SchematicMarkupTools } from './SchematicMarkupTools.mjs'

/**
 * Adds opt-in schematic net diagnostic SVG overlays.
 */
export class SchematicNetDiagnosticOverlayRenderer {
    /**
     * Injects diagnostic overlay markup when explicitly enabled.
     * @param {string} markup Rendered schematic markup.
     * @param {object} documentModel Document model.
     * @param {{ enabled?: boolean, diagnostics?: object }} [options] Overlay options.
     * @returns {string}
     */
    static inject(markup, documentModel, options = {}) {
        if (!options.enabled) return markup

        const schematic = documentModel?.schematic
        if (!schematic) return markup

        const diagnostics =
            options.diagnostics ||
            SchematicNetGeometryDiagnostics.analyze(schematic)
        const overlay = this.#renderOverlay(documentModel, diagnostics)
        if (!overlay) return markup

        return this.#injectOverlayMarkup(
            this.#injectDiagnosticStyle(markup),
            overlay
        )
    }

    /**
     * Renders all diagnostic segments.
     * @param {object} documentModel Document model.
     * @param {object} diagnostics Diagnostic result.
     * @returns {string}
     */
    static #renderOverlay(documentModel, diagnostics) {
        const schematic = documentModel?.schematic || {}
        const isKicad =
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'kicad'
        const contentHeight = SchematicCoordinateProjector.resolveContentHeight(
            schematic,
            isKicad
        )
        const fallback = this.#renderSegments(
            diagnostics?.fallbackSegments,
            'fallback-connection',
            contentHeight,
            isKicad
        )
        const overlaps = this.#renderSegments(
            diagnostics?.overlapSegments,
            'cross-net-overlap',
            contentHeight,
            isKicad
        )
        const obstacles = this.#renderSegments(
            diagnostics?.obstacleSegments,
            'fallback-obstacle-crossing',
            contentHeight,
            isKicad
        )
        const jogs = this.#renderSegments(
            diagnostics?.jogSuggestionSegments,
            'cross-net-overlap-jog-candidate',
            contentHeight,
            isKicad
        )
        const traceLabelDetours = this.#renderSegments(
            diagnostics?.traceLabelDetourSegments,
            'net-label-trace-detour-candidate',
            contentHeight,
            isKicad
        )
        const traceLabelSnipReconnects = this.#renderSegments(
            diagnostics?.traceLabelSnipReconnectSegments,
            'net-label-trace-snip-reconnect-candidate',
            contentHeight,
            isKicad
        )
        const multiLabelTraceDetours = this.#renderSegments(
            diagnostics?.multiLabelTraceDetourSegments,
            'multi-label-trace-detour-candidate',
            contentHeight,
            isKicad
        )
        const netIslandLaneShifts = this.#renderSegments(
            diagnostics?.netIslandLaneShiftSegments,
            'net-island-lane-shift-candidate',
            contentHeight,
            isKicad
        )
        const segmentOverlapShifts = this.#renderSegments(
            diagnostics?.segmentOverlapShiftSegments,
            'segment-overlap-shift-candidate',
            contentHeight,
            isKicad
        )
        const congestedLTurnReroutes = this.#renderSegments(
            diagnostics?.congestedLTurnRerouteSegments,
            'congested-l-turn-reroute-candidate',
            contentHeight,
            isKicad
        )
        const longDistanceConnections = this.#renderSegments(
            diagnostics?.longDistanceConnectionSegments,
            'long-distance-connection-candidate',
            contentHeight,
            isKicad
        )
        const sectionBoundaryConnections = this.#renderSegments(
            diagnostics?.sectionBoundaryConnectionSegments,
            'section-boundary-connection-candidate',
            contentHeight,
            isKicad
        )
        const pathCleanup = this.#renderSegments(
            diagnostics?.pathCleanupSegments,
            'net-path-cleanup-candidate',
            contentHeight,
            isKicad
        )
        const guidelines = this.#renderSegments(
            diagnostics?.guidelineSegments,
            'schematic-routing-guideline',
            contentHeight,
            isKicad
        )
        const restrictedCenterlines = this.#renderSegments(
            diagnostics?.restrictedCenterlineSegments,
            'schematic-routing-restricted-centerline-crossing',
            contentHeight,
            isKicad
        )
        const guidelineSnappedElbows = this.#renderSegments(
            diagnostics?.guidelineSnappedElbowSegments,
            'guideline-snapped-elbow-candidate',
            contentHeight,
            isKicad
        )
        const supplementalConnections = this.#renderSegments(
            diagnostics?.supplementalConnectionSegments,
            'supplemental-connection-candidate',
            contentHeight,
            isKicad
        )
        const orientationConnectors = this.#renderSegments(
            diagnostics?.orientationConnectorSegments,
            'label-orientation-connector-candidate',
            contentHeight,
            isKicad
        )
        const symbolPinSnaps = this.#renderSegments(
            diagnostics?.symbolPinSnapSegments,
            'symbol-pin-snap-candidate',
            contentHeight,
            isKicad
        )
        const anchors = this.#renderAnchors(
            diagnostics?.anchorMarkers,
            contentHeight,
            isKicad
        )
        const bounds = this.#renderBounds(
            diagnostics?.collisionBounds,
            contentHeight,
            isKicad
        )
        const labelCandidates = this.#renderBounds(
            diagnostics?.labelCandidateBounds,
            contentHeight,
            isKicad
        )
        const traceAnchoredLabelCandidates = this.#renderBounds(
            diagnostics?.traceAnchoredLabelCandidateBounds,
            contentHeight,
            isKicad
        )
        const orientationLabelCandidates = this.#renderBounds(
            diagnostics?.orientationLabelCandidateBounds,
            contentHeight,
            isKicad
        )
        const powerLabelCornerCandidates = this.#renderBounds(
            diagnostics?.powerLabelCornerCandidateBounds,
            contentHeight,
            isKicad
        )
        const labelRelocationCandidates = this.#renderBounds(
            diagnostics?.labelRelocationCandidateBounds,
            contentHeight,
            isKicad
        )
        const rejectedTraceAnchoredLabelCandidates = this.#renderBounds(
            diagnostics?.traceAnchoredLabelRejectedCandidateBounds,
            contentHeight,
            isKicad
        )
        const symbolBodyFitCandidates = this.#renderBounds(
            diagnostics?.symbolBodyFitCandidateBounds,
            contentHeight,
            isKicad
        )
        const body =
            fallback +
            overlaps +
            obstacles +
            jogs +
            traceLabelDetours +
            traceLabelSnipReconnects +
            multiLabelTraceDetours +
            netIslandLaneShifts +
            segmentOverlapShifts +
            congestedLTurnReroutes +
            longDistanceConnections +
            sectionBoundaryConnections +
            pathCleanup +
            guidelines +
            restrictedCenterlines +
            guidelineSnappedElbows +
            supplementalConnections +
            orientationConnectors +
            symbolPinSnaps +
            anchors +
            bounds +
            labelCandidates +
            traceAnchoredLabelCandidates +
            orientationLabelCandidates +
            powerLabelCornerCandidates +
            labelRelocationCandidates +
            rejectedTraceAnchoredLabelCandidates +
            symbolBodyFitCandidates
        return body
            ? '<g class="schematic-net-diagnostic-overlay">' + body + '</g>'
            : ''
    }

    /**
     * Renders diagnostic line segments.
     * @param {object[]} segments Diagnostic segments.
     * @param {string} kind Diagnostic kind.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {string}
     */
    static #renderSegments(segments, kind, contentHeight, isKicad) {
        if (!Array.isArray(segments)) return ''
        return segments
            .map((segment) =>
                this.#renderSegment(segment, kind, contentHeight, isKicad)
            )
            .join('')
    }

    /**
     * Renders one diagnostic segment path.
     * @param {object} segment Diagnostic segment.
     * @param {string} kind Diagnostic kind.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {string}
     */
    static #renderSegment(segment, kind, contentHeight, isKicad) {
        const path = this.#pathForPoints(
            segment?.points,
            contentHeight,
            isKicad
        )
        if (!path) return ''

        const netName = this.#segmentNetName(segment)
        const diagnosticKind = String(segment?.kind || kind)
        return (
            '<path class="schematic-net-diagnostic-overlay__segment ' +
            'schematic-net-diagnostic-overlay__segment--' +
            SchematicMarkupTools.escapeHtml(diagnosticKind) +
            '" data-schematic-net-diagnostic-kind="' +
            SchematicMarkupTools.escapeHtml(diagnosticKind) +
            '" data-schematic-net-name="' +
            SchematicMarkupTools.escapeHtml(netName) +
            '" d="' +
            SchematicMarkupTools.escapeHtml(path) +
            '"/>'
        )
    }

    /**
     * Renders diagnostic point markers.
     * @param {object[]} markers Marker rows.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {string}
     */
    static #renderAnchors(markers, contentHeight, isKicad) {
        if (!Array.isArray(markers)) return ''
        return markers
            .map((marker) => {
                const point = this.#renderedPoint(
                    marker?.point,
                    contentHeight,
                    isKicad
                )
                if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                    return ''
                }
                const kind = String(marker.kind || 'anchor-marker')
                return (
                    '<circle class="schematic-net-diagnostic-overlay__anchor' +
                    '" data-schematic-net-diagnostic-kind="' +
                    SchematicMarkupTools.escapeHtml(kind) +
                    '" data-schematic-net-name="' +
                    SchematicMarkupTools.escapeHtml(
                        this.#segmentNetName(marker)
                    ) +
                    '" cx="' +
                    SchematicMarkupTools.formatNumber(point.x) +
                    '" cy="' +
                    SchematicMarkupTools.formatNumber(point.y) +
                    '" r="1.4"/>'
                )
            })
            .join('')
    }

    /**
     * Renders diagnostic rectangular bounds.
     * @param {object[]} boundsRows Bounds rows.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {string}
     */
    static #renderBounds(boundsRows, contentHeight, isKicad) {
        if (!Array.isArray(boundsRows)) return ''
        return boundsRows
            .map((row) => {
                const bounds = this.#renderedBounds(
                    row?.bounds,
                    contentHeight,
                    isKicad
                )
                if (!bounds) return ''
                const kind = String(row.kind || 'diagnostic-bounds')
                return (
                    '<rect class="schematic-net-diagnostic-overlay__bounds ' +
                    'schematic-net-diagnostic-overlay__bounds--' +
                    SchematicMarkupTools.escapeHtml(kind) +
                    '" data-schematic-net-diagnostic-kind="' +
                    SchematicMarkupTools.escapeHtml(kind) +
                    '" data-schematic-net-name="' +
                    SchematicMarkupTools.escapeHtml(this.#segmentNetName(row)) +
                    '" x="' +
                    SchematicMarkupTools.formatNumber(bounds.minX) +
                    '" y="' +
                    SchematicMarkupTools.formatNumber(bounds.minY) +
                    '" width="' +
                    SchematicMarkupTools.formatNumber(bounds.width) +
                    '" height="' +
                    SchematicMarkupTools.formatNumber(bounds.height) +
                    '"/>'
                )
            })
            .join('')
    }

    /**
     * Resolves a data attribute net name for one diagnostic segment.
     * @param {object} segment Diagnostic segment.
     * @returns {string}
     */
    static #segmentNetName(segment) {
        if (segment?.netName) return String(segment.netName)
        return Array.isArray(segment?.netNames)
            ? segment.netNames.map((name) => String(name)).join(', ')
            : ''
    }

    /**
     * Converts points into SVG path data.
     * @param {object[]} points Source points.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {string}
     */
    static #pathForPoints(points, contentHeight, isKicad) {
        if (!Array.isArray(points) || points.length < 2) return ''
        const renderedPoints = points
            .map((point) => this.#renderedPoint(point, contentHeight, isKicad))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
        if (renderedPoints.length < 2) return ''

        return renderedPoints
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
     * Projects one point into rendered coordinates.
     * @param {{ x?: number, y?: number }} point Source point.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ x: number, y: number }}
     */
    static #renderedPoint(point, contentHeight, isKicad) {
        return {
            x: Number(point?.x),
            y: SchematicCoordinateProjector.projectY(
                Number(point?.y),
                contentHeight,
                isKicad
            )
        }
    }

    /**
     * Projects bounds into rendered coordinates.
     * @param {object} bounds Source bounds.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, width: number, height: number } | null}
     */
    static #renderedBounds(bounds, contentHeight, isKicad) {
        const first = this.#renderedPoint(
            { x: bounds?.minX, y: bounds?.minY },
            contentHeight,
            isKicad
        )
        const second = this.#renderedPoint(
            { x: bounds?.maxX, y: bounds?.maxY },
            contentHeight,
            isKicad
        )
        if (
            !Number.isFinite(first.x) ||
            !Number.isFinite(first.y) ||
            !Number.isFinite(second.x) ||
            !Number.isFinite(second.y)
        ) {
            return null
        }
        const minX = Math.min(first.x, second.x)
        const minY = Math.min(first.y, second.y)
        return {
            minX,
            minY,
            width: Math.abs(second.x - first.x),
            height: Math.abs(second.y - first.y)
        }
    }

    /**
     * Injects SVG-local diagnostic CSS.
     * @param {string} markup Rendered markup.
     * @returns {string}
     */
    static #injectDiagnosticStyle(markup) {
        const rules =
            '.schematic-svg .schematic-net-diagnostic-overlay {' +
            'pointer-events:none;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment {' +
            'fill:none;stroke-linecap:round;stroke-linejoin:round;' +
            'vector-effect:non-scaling-stroke;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--fallback-connection {' +
            'stroke:rgba(37,99,235,0.72);stroke-width:1.4;stroke-dasharray:4 3;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--cross-net-overlap {' +
            'stroke:rgba(220,38,38,0.84);stroke-width:2.2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--fallback-obstacle-crossing {' +
            'stroke:rgba(234,88,12,0.84);stroke-width:2;stroke-dasharray:2 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--cross-net-overlap-jog-candidate {' +
            'stroke:rgba(22,163,74,0.82);stroke-width:1.4;stroke-dasharray:5 3;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--net-label-trace-detour-candidate {' +
            'stroke:rgba(14,165,233,0.84);stroke-width:1.4;stroke-dasharray:5 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--multi-label-trace-detour-candidate {' +
            'stroke:rgba(8,145,178,0.86);stroke-width:1.5;stroke-dasharray:6 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--net-island-lane-shift-candidate {' +
            'stroke:rgba(5,150,105,0.84);stroke-width:1.5;stroke-dasharray:4 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--segment-overlap-shift-candidate {' +
            'stroke:rgba(16,185,129,0.84);stroke-width:1.5;stroke-dasharray:5 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--congested-l-turn-reroute-candidate {' +
            'stroke:rgba(13,148,136,0.86);stroke-width:1.5;stroke-dasharray:7 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--long-distance-connection-candidate {' +
            'stroke:rgba(124,58,237,0.78);stroke-width:1.4;stroke-dasharray:8 3;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--section-boundary-connection-candidate {' +
            'stroke:rgba(194,65,12,0.84);stroke-width:1.5;stroke-dasharray:2 4;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--net-path-cleanup-candidate {' +
            'stroke:rgba(99,102,241,0.82);stroke-width:1.3;stroke-dasharray:3 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--schematic-routing-guideline {' +
            'stroke:rgba(75,85,99,0.42);stroke-width:1;stroke-dasharray:2 3;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--schematic-routing-restricted-centerline-crossing {' +
            'stroke:rgba(190,18,60,0.86);stroke-width:2;stroke-dasharray:1 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--guideline-snapped-elbow-candidate {' +
            'stroke:rgba(20,184,166,0.82);stroke-width:1.4;stroke-dasharray:4 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--supplemental-connection-candidate {' +
            'stroke:rgba(168,85,247,0.78);stroke-width:1.4;stroke-dasharray:6 3;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--label-orientation-connector-candidate {' +
            'stroke:rgba(2,132,199,0.82);stroke-width:1.2;stroke-dasharray:2 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__segment--symbol-pin-snap-candidate {' +
            'stroke:rgba(217,119,6,0.84);stroke-width:1.4;stroke-dasharray:3 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__anchor {' +
            'fill:rgba(234,88,12,0.24);stroke:rgba(234,88,12,0.9);stroke-width:1.2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__bounds {' +
            'fill:rgba(220,38,38,0.08);stroke:rgba(220,38,38,0.76);stroke-width:1.2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__bounds--net-label-candidate {' +
            'fill:rgba(22,163,74,0.08);stroke:rgba(22,163,74,0.82);stroke-width:1.1;stroke-dasharray:2 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__bounds--trace-anchored-net-label-candidate {' +
            'fill:rgba(22,163,74,0.08);stroke:rgba(22,163,74,0.82);stroke-width:1.1;stroke-dasharray:2 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__bounds--label-orientation-candidate {' +
            'fill:rgba(2,132,199,0.08);stroke:rgba(2,132,199,0.82);stroke-width:1.1;stroke-dasharray:3 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__bounds--power-label-corner-candidate {' +
            'fill:rgba(250,204,21,0.1);stroke:rgba(202,138,4,0.82);stroke-width:1.1;stroke-dasharray:3 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__bounds--net-label-relocation-candidate {' +
            'fill:rgba(13,148,136,0.08);stroke:rgba(13,148,136,0.84);stroke-width:1.1;stroke-dasharray:4 2;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__bounds--trace-anchored-net-label-rejected-candidate {' +
            'fill:rgba(220,38,38,0.08);stroke:rgba(220,38,38,0.82);stroke-width:1.1;stroke-dasharray:1 3;}' +
            '.schematic-svg .schematic-net-diagnostic-overlay__bounds--symbol-body-fit-candidate {' +
            'fill:rgba(217,119,6,0.08);stroke:rgba(217,119,6,0.84);stroke-width:1.1;stroke-dasharray:4 2;}'

        return String(markup).replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="schematic-net-diagnostic-style">' +
                SchematicMarkupTools.escapeHtml(rules) +
                '</style>'
        )
    }

    /**
     * Injects overlay markup into the main schematic coordinate group.
     * @param {string} markup Rendered markup.
     * @param {string} overlay Overlay markup.
     * @returns {string}
     */
    static #injectOverlayMarkup(markup, overlay) {
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
                overlay +
                renderedMarkup.slice(groupEndIndex)
            )
        }
        return renderedMarkup.replace(/(<\/svg>)/, overlay + '$1')
    }
}
