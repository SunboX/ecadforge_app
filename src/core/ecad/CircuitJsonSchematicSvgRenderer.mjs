import { CircuitJsonIndexer, CircuitJsonUnits } from 'circuitjson-toolkit'

/**
 * Renders standards-shaped schematic element arrays into app-compatible SVG.
 */
export class CircuitJsonSchematicSvgRenderer {
    /**
     * Renders one schematic document into SVG markup.
     * @param {object | object[]} documentModel Parsed document model.
     * @returns {string}
     */
    static render(documentModel) {
        const elements = CircuitJsonSchematicSvgRenderer.#elements(documentModel)
        const index = CircuitJsonIndexer.index(elements)
        const bounds = CircuitJsonSchematicSvgRenderer.#bounds(index)
        const viewBox = CircuitJsonSchematicSvgRenderer.#viewBox(bounds)

        return (
            '<svg class="schematic-svg schematic-svg--circuitjson" xmlns="http://www.w3.org/2000/svg" role="img" viewBox="' +
            CircuitJsonSchematicSvgRenderer.#formatViewBox(viewBox) +
            '">' +
            CircuitJsonSchematicSvgRenderer.#renderSheet(bounds) +
            CircuitJsonSchematicSvgRenderer.#renderComponents(index) +
            CircuitJsonSchematicSvgRenderer.#renderSymbols(index) +
            CircuitJsonSchematicSvgRenderer.#renderGroups(index) +
            CircuitJsonSchematicSvgRenderer.#renderLines(index) +
            CircuitJsonSchematicSvgRenderer.#renderShapes(index) +
            CircuitJsonSchematicSvgRenderer.#renderPorts(index) +
            CircuitJsonSchematicSvgRenderer.#renderTables(index) +
            CircuitJsonSchematicSvgRenderer.#renderTexts(index) +
            CircuitJsonSchematicSvgRenderer.#renderProbes(index) +
            CircuitJsonSchematicSvgRenderer.#renderDebugObjects(index) +
            CircuitJsonSchematicSvgRenderer.#renderDiagnostics(index) +
            '</svg>'
        )
    }

    /**
     * Returns element rows from an array or wrapper object.
     * @param {object | object[]} documentModel Parsed document model.
     * @returns {object[]}
     */
    static #elements(documentModel) {
        if (Array.isArray(documentModel)) return documentModel
        if (Array.isArray(documentModel?.elements)) return documentModel.elements
        if (Array.isArray(documentModel?.circuitJson)) {
            return documentModel.circuitJson
        }
        return []
    }

    /**
     * Renders the schematic sheet backdrop.
     * @param {object} bounds Sheet bounds.
     * @returns {string}
     */
    static #renderSheet(bounds) {
        return (
            '<rect class="sheet-backdrop schematic-sheet" x="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(bounds.minX) +
            '" y="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(bounds.minY) +
            '" width="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(bounds.width) +
            '" height="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(bounds.height) +
            '"></rect>'
        )
    }

    /**
     * Renders schematic component boxes.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {string}
     */
    static #renderComponents(index) {
        const sourceNames = CircuitJsonSchematicSvgRenderer.#sourceNames(index)
        const components = CircuitJsonSchematicSvgRenderer.#all(
            index,
            'schematic_component'
        ).map((component, componentIndex) => {
            const center =
                CircuitJsonSchematicSvgRenderer.#center(component) || {
                    x: 0,
                    y: 0
                }
            const size =
                CircuitJsonUnits.optionalSize(component.size) || {
                    width: 4,
                    height: 3
                }
            const key =
                sourceNames.get(String(component.source_component_id || '')) ||
                String(component.name || 'U' + (componentIndex + 1))
            const x = center.x - size.width / 2
            const y = center.y - size.height / 2

            return (
                '<g class="schematic-component" data-component-key="' +
                CircuitJsonSchematicSvgRenderer.#escapeHtml(key) +
                '" data-schematic-component-id="' +
                CircuitJsonSchematicSvgRenderer.#escapeHtml(
                    component.schematic_component_id || ''
                ) +
                '">' +
                '<rect class="schematic-component__body" x="' +
                CircuitJsonSchematicSvgRenderer.#formatNumber(x) +
                '" y="' +
                CircuitJsonSchematicSvgRenderer.#formatNumber(y) +
                '" width="' +
                CircuitJsonSchematicSvgRenderer.#formatNumber(size.width) +
                '" height="' +
                CircuitJsonSchematicSvgRenderer.#formatNumber(size.height) +
                '"></rect><text class="schematic-component__label" x="' +
                CircuitJsonSchematicSvgRenderer.#formatNumber(center.x) +
                '" y="' +
                CircuitJsonSchematicSvgRenderer.#formatNumber(center.y) +
                '" text-anchor="middle" dominant-baseline="central">' +
                CircuitJsonSchematicSvgRenderer.#escapeHtml(key) +
                '</text></g>'
            )
        })

        return components.length
            ? '<g class="schematic-components">' + components.join('') + '</g>'
            : ''
    }

    /**
     * Renders reusable schematic symbol rows.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {string}
     */
    static #renderSymbols(index) {
        const sourceNames = CircuitJsonSchematicSvgRenderer.#sourceNames(index)
        const symbols = CircuitJsonSchematicSvgRenderer.#all(
            index,
            'schematic_symbol'
        )
            .map((symbol, symbolIndex) =>
                CircuitJsonSchematicSvgRenderer.#symbolElement(
                    symbol,
                    symbolIndex,
                    sourceNames
                )
            )
            .filter(Boolean)
        return symbols.length
            ? '<g class="schematic-symbols">' + symbols.join('') + '</g>'
            : ''
    }

    /**
     * Renders one schematic symbol.
     * @param {object} symbol Symbol row.
     * @param {number} symbolIndex Symbol index.
     * @param {Map<string, string>} sourceNames Source display names.
     * @returns {string}
     */
    static #symbolElement(symbol, symbolIndex, sourceNames) {
        const center = CircuitJsonSchematicSvgRenderer.#center(symbol)
        const size = CircuitJsonSchematicSvgRenderer.#size(symbol)
        if (!center || !size) return ''
        const key =
            sourceNames.get(String(symbol.source_component_id || '')) ||
            String(symbol.name || 'SYM' + (symbolIndex + 1))
        const x = center.x - size.width / 2
        const y = center.y - size.height / 2

        return (
            '<g class="schematic-symbol" data-component-key="' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(key) +
            '" data-schematic-symbol-id="' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(
                symbol.schematic_symbol_id || ''
            ) +
            '"><rect class="schematic-symbol__body" x="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(x) +
            '" y="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(y) +
            '" width="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(size.width) +
            '" height="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(size.height) +
            '"></rect><text class="schematic-symbol__label" x="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.x) +
            '" y="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.y) +
            '" text-anchor="middle" dominant-baseline="central">' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(key) +
            '</text></g>'
        )
    }

    /**
     * Renders schematic grouping bounds.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {string}
     */
    static #renderGroups(index) {
        const groups = CircuitJsonSchematicSvgRenderer.#all(
            index,
            'schematic_group'
        )
            .map((element) => CircuitJsonSchematicSvgRenderer.#groupElement(element))
            .filter(Boolean)
        return groups.length
            ? '<g class="schematic-groups">' + groups.join('') + '</g>'
            : ''
    }

    /**
     * Renders one schematic group.
     * @param {object} element Group element.
     * @returns {string}
     */
    static #groupElement(element) {
        const rect = CircuitJsonSchematicSvgRenderer.#rectAttributes(element)
        const center = CircuitJsonSchematicSvgRenderer.#center(element)
        if (!rect || !center) return ''
        const label = String(element.name || element.schematic_group_id || '')

        return (
            '<g class="schematic-group" data-schematic-group-id="' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(
                element.schematic_group_id || ''
            ) +
            '"><rect class="schematic-group__bounds" ' +
            rect +
            '></rect><text class="schematic-group__label" x="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.x) +
            '" y="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.y) +
            '" text-anchor="middle" dominant-baseline="central">' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(label) +
            '</text></g>'
        )
    }

    /**
     * Renders schematic line and trace elements.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {string}
     */
    static #renderLines(index) {
        const lines = ['schematic_line', 'schematic_trace']
            .flatMap((type) => CircuitJsonSchematicSvgRenderer.#all(index, type))
            .map((element) =>
                CircuitJsonSchematicSvgRenderer.#lineElement(element)
            )
            .filter(Boolean)
        return lines.length
            ? '<g class="schematic-wires">' + lines.join('') + '</g>'
            : ''
    }

    /**
     * Renders one schematic line.
     * @param {object} element Source element.
     * @returns {string}
     */
    static #lineElement(element) {
        const start = CircuitJsonSchematicSvgRenderer.#point({
            x: element.x1 ?? element.start?.x,
            y: element.y1 ?? element.start?.y
        })
        const end = CircuitJsonSchematicSvgRenderer.#point({
            x: element.x2 ?? element.end?.x,
            y: element.y2 ?? element.end?.y
        })
        if (!start || !end) return ''
        return (
            '<line class="schematic-wire" x1="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(start.x) +
            '" y1="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(start.y) +
            '" x2="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(end.x) +
            '" y2="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(end.y) +
            '"></line>'
        )
    }

    /**
     * Renders schematic rectangle and circle shapes.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {string}
     */
    static #renderShapes(index) {
        const rects = ['schematic_rect', 'schematic_box']
            .flatMap((type) => CircuitJsonSchematicSvgRenderer.#all(index, type))
            .map((element) => CircuitJsonSchematicSvgRenderer.#rectElement(element))
            .filter(Boolean)
        const circles = CircuitJsonSchematicSvgRenderer.#all(
            index,
            'schematic_circle'
        )
            .map((element) =>
                CircuitJsonSchematicSvgRenderer.#circleElement(element)
            )
            .filter(Boolean)
        const arcs = CircuitJsonSchematicSvgRenderer.#all(
            index,
            'schematic_arc'
        )
            .map((element) => CircuitJsonSchematicSvgRenderer.#arcElement(element))
            .filter(Boolean)
        const paths = CircuitJsonSchematicSvgRenderer.#all(
            index,
            'schematic_path'
        )
            .map((element) => CircuitJsonSchematicSvgRenderer.#pathElement(element))
            .filter(Boolean)
        const markup = [...rects, ...circles, ...arcs, ...paths]
        return markup.length
            ? '<g class="schematic-shapes">' + markup.join('') + '</g>'
            : ''
    }

    /**
     * Renders one schematic rectangle.
     * @param {object} element Rectangle element.
     * @returns {string}
     */
    static #rectElement(element) {
        const center = CircuitJsonSchematicSvgRenderer.#center(element)
        const size = CircuitJsonUnits.optionalSize(element.size || element)
        if (!center || !size) return ''
        return (
            '<rect class="schematic-shape schematic-shape--rect" x="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(
                center.x - size.width / 2
            ) +
            '" y="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(
                center.y - size.height / 2
            ) +
            '" width="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(size.width) +
            '" height="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(size.height) +
            '"></rect>'
        )
    }

    /**
     * Renders one schematic circle.
     * @param {object} element Circle element.
     * @returns {string}
     */
    static #circleElement(element) {
        const center = CircuitJsonSchematicSvgRenderer.#center(element)
        const radius = CircuitJsonUnits.optionalLength(element.radius)
        if (!center || radius === null) return ''
        return (
            '<circle class="schematic-shape schematic-shape--circle" cx="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.x) +
            '" cy="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.y) +
            '" r="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(radius) +
            '"></circle>'
        )
    }

    /**
     * Renders one schematic arc.
     * @param {object} element Arc element.
     * @returns {string}
     */
    static #arcElement(element) {
        const center = CircuitJsonSchematicSvgRenderer.#center(element)
        const radius = CircuitJsonUnits.optionalLength(element.radius)
        if (!center || radius === null) return ''
        const startAngle = CircuitJsonUnits.angle(
            element.start_angle ?? element.startAngle,
            0
        )
        const endAngle = CircuitJsonUnits.angle(
            element.end_angle ?? element.endAngle,
            360
        )
        const start = CircuitJsonSchematicSvgRenderer.#polarPoint(
            center,
            radius,
            startAngle
        )
        const end = CircuitJsonSchematicSvgRenderer.#polarPoint(
            center,
            radius,
            endAngle
        )
        const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0

        return (
            '<path class="schematic-shape schematic-shape--arc" d="M ' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(start.x) +
            ' ' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(start.y) +
            ' A ' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(radius) +
            ' ' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(radius) +
            ' 0 ' +
            largeArc +
            ' 1 ' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(end.x) +
            ' ' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(end.y) +
            '"></path>'
        )
    }

    /**
     * Renders one schematic polyline path.
     * @param {object} element Path element.
     * @returns {string}
     */
    static #pathElement(element) {
        const points = CircuitJsonSchematicSvgRenderer.#points(element)
        if (points.length < 2) return ''
        return (
            '<polyline class="schematic-shape schematic-shape--path" points="' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(
                CircuitJsonSchematicSvgRenderer.#pointsAttribute(points)
            ) +
            '"></polyline>'
        )
    }

    /**
     * Renders schematic ports.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {string}
     */
    static #renderPorts(index) {
        const ports = CircuitJsonSchematicSvgRenderer.#all(
            index,
            'schematic_port'
        )
            .map((element) => CircuitJsonSchematicSvgRenderer.#portElement(element))
            .filter(Boolean)
        return ports.length
            ? '<g class="schematic-ports">' + ports.join('') + '</g>'
            : ''
    }

    /**
     * Renders one schematic port marker.
     * @param {object} element Port element.
     * @returns {string}
     */
    static #portElement(element) {
        const center = CircuitJsonSchematicSvgRenderer.#center(element)
        if (!center) return ''
        const label = String(element.name || element.label || '').trim()
        const direction = String(
            element.facing_direction || element.direction || ''
        ).trim()

        return (
            '<g class="schematic-port" data-schematic-port-id="' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(
                element.schematic_port_id || ''
            ) +
            '" data-facing-direction="' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(direction) +
            '"><circle class="schematic-port__terminal" cx="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.x) +
            '" cy="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.y) +
            '" r="0.35"></circle><text class="schematic-port__label" x="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.x + 0.7) +
            '" y="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.y) +
            '" dominant-baseline="central">' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(label) +
            '</text></g>'
        )
    }

    /**
     * Renders schematic tables and cells.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {string}
     */
    static #renderTables(index) {
        const tables = CircuitJsonSchematicSvgRenderer.#all(
            index,
            'schematic_table'
        )
            .map((element) =>
                CircuitJsonSchematicSvgRenderer.#tableElement(element)
            )
            .filter(Boolean)
        const cells = CircuitJsonSchematicSvgRenderer.#all(
            index,
            'schematic_table_cell'
        )
            .map((element) =>
                CircuitJsonSchematicSvgRenderer.#tableCellElement(element)
            )
            .filter(Boolean)
        const markup = [...tables, ...cells]
        return markup.length
            ? '<g class="schematic-tables">' + markup.join('') + '</g>'
            : ''
    }

    /**
     * Renders one schematic table frame.
     * @param {object} element Table element.
     * @returns {string}
     */
    static #tableElement(element) {
        const rect = CircuitJsonSchematicSvgRenderer.#rectAttributes(element)
        if (!rect) return ''
        return (
            '<rect class="schematic-table" data-schematic-table-id="' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(
                element.schematic_table_id || ''
            ) +
            '" ' +
            rect +
            '></rect>'
        )
    }

    /**
     * Renders one schematic table cell.
     * @param {object} element Table cell element.
     * @returns {string}
     */
    static #tableCellElement(element) {
        const rect = CircuitJsonSchematicSvgRenderer.#rectAttributes(element)
        const center = CircuitJsonSchematicSvgRenderer.#center(element)
        if (!rect || !center) return ''
        return (
            '<g class="schematic-table-cell" data-schematic-table-id="' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(
                element.schematic_table_id || ''
            ) +
            '"><rect ' +
            rect +
            '></rect><text x="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.x) +
            '" y="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.y) +
            '" text-anchor="middle" dominant-baseline="central">' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(element.text || '') +
            '</text></g>'
        )
    }

    /**
     * Renders schematic text and net labels.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {string}
     */
    static #renderTexts(index) {
        const texts = ['schematic_text', 'schematic_net_label']
            .flatMap((type) => CircuitJsonSchematicSvgRenderer.#all(index, type))
            .map((element) => CircuitJsonSchematicSvgRenderer.#textElement(element))
            .filter(Boolean)
        return texts.length
            ? '<g class="schematic-texts">' + texts.join('') + '</g>'
            : ''
    }

    /**
     * Renders one schematic text row.
     * @param {object} element Text element.
     * @returns {string}
     */
    static #textElement(element) {
        const point =
            CircuitJsonSchematicSvgRenderer.#point(element.anchor_position) ||
            CircuitJsonSchematicSvgRenderer.#center(element)
        if (!point) return ''
        const fontSize = CircuitJsonUnits.optionalLength(element.font_size)
        const rotation = CircuitJsonUnits.angle(
            element.ccw_rotation ?? element.rotation,
            0
        )
        const attributes = [
            'class="schematic-text"',
            'x="' + CircuitJsonSchematicSvgRenderer.#formatNumber(point.x) + '"',
            'y="' + CircuitJsonSchematicSvgRenderer.#formatNumber(point.y) + '"'
        ]

        if (fontSize !== null) {
            attributes.push(
                'font-size="' +
                    CircuitJsonSchematicSvgRenderer.#formatNumber(fontSize) +
                    '"'
            )
        }
        if (rotation) {
            attributes.push(
                'transform="rotate(' +
                    CircuitJsonSchematicSvgRenderer.#formatNumber(rotation) +
                    ' ' +
                    CircuitJsonSchematicSvgRenderer.#formatNumber(point.x) +
                    ' ' +
                    CircuitJsonSchematicSvgRenderer.#formatNumber(point.y) +
                    ')"'
            )
        }

        return (
            '<text ' +
            attributes.join(' ') +
            '>' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(
                element.text || element.name || ''
            ) +
            '</text>'
        )
    }

    /**
     * Renders schematic probe markers.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {string}
     */
    static #renderProbes(index) {
        const probes = ['schematic_voltage_probe']
            .flatMap((type) => CircuitJsonSchematicSvgRenderer.#all(index, type))
            .map((element) => CircuitJsonSchematicSvgRenderer.#probeElement(element))
            .filter(Boolean)
        return probes.length
            ? '<g class="schematic-probes">' + probes.join('') + '</g>'
            : ''
    }

    /**
     * Renders one schematic probe.
     * @param {object} element Probe element.
     * @returns {string}
     */
    static #probeElement(element) {
        const center = CircuitJsonSchematicSvgRenderer.#center(element)
        if (!center) return ''
        const label = String(element.name || element.label || '').trim()
        return (
            '<g class="schematic-probe" data-schematic-probe-id="' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(
                CircuitJsonIndexer.getElementId(element)
            ) +
            '"><circle cx="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.x) +
            '" cy="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.y) +
            '" r="0.45"></circle><text x="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.x + 0.65) +
            '" y="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.y) +
            '" dominant-baseline="central">' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(label) +
            '</text></g>'
        )
    }

    /**
     * Renders schematic debug objects.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {string}
     */
    static #renderDebugObjects(index) {
        const objects = CircuitJsonSchematicSvgRenderer.#all(
            index,
            'schematic_debug_object'
        )
            .map((element) =>
                CircuitJsonSchematicSvgRenderer.#debugObjectElement(element)
            )
            .filter(Boolean)
        return objects.length
            ? '<g class="schematic-debug-objects">' +
                  objects.join('') +
                  '</g>'
            : ''
    }

    /**
     * Renders one schematic debug object.
     * @param {object} element Debug element.
     * @returns {string}
     */
    static #debugObjectElement(element) {
        const rect = CircuitJsonSchematicSvgRenderer.#rectAttributes(element)
        const center = CircuitJsonSchematicSvgRenderer.#center(element)
        if (!rect || !center) return ''
        const message = String(element.message || '').trim()

        return (
            '<g class="schematic-debug-object" data-schematic-debug-object-id="' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(
                element.schematic_debug_object_id || ''
            ) +
            '"><title>' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(message) +
            '</title><rect ' +
            rect +
            '></rect><text x="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.x) +
            '" y="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.y) +
            '" text-anchor="middle" dominant-baseline="central">' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(message) +
            '</text></g>'
        )
    }

    /**
     * Renders schematic warning and error markers.
     * @param {{ elements: object[] }} index Element index.
     * @returns {string}
     */
    static #renderDiagnostics(index) {
        const diagnostics = (index.elements || [])
            .filter((element) =>
                /(?:error|warning)/iu.test(String(element?.type || ''))
            )
            .map((element) =>
                CircuitJsonSchematicSvgRenderer.#diagnosticElement(element)
            )
            .filter(Boolean)
        return diagnostics.length
            ? '<g class="schematic-diagnostics">' +
                  diagnostics.join('') +
                  '</g>'
            : ''
    }

    /**
     * Renders one schematic diagnostic marker.
     * @param {object} element Diagnostic row.
     * @returns {string}
     */
    static #diagnosticElement(element) {
        const center = CircuitJsonSchematicSvgRenderer.#center(element) || {
            x: 0,
            y: 0
        }
        const severity = String(element.warning_type ? 'warning' : 'error')
        return (
            '<g class="schematic-diagnostic-marker schematic-diagnostic-marker--' +
            severity +
            '" data-schematic-diagnostic-id="' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(
                CircuitJsonIndexer.getElementId(element)
            ) +
            '"><title>' +
            CircuitJsonSchematicSvgRenderer.#escapeHtml(
                element.message || element.error_type || element.warning_type || ''
            ) +
            '</title><circle cx="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.x) +
            '" cy="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(center.y) +
            '" r="0.45"></circle></g>'
        )
    }

    /**
     * Builds source component display names.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {Map<string, string>}
     */
    static #sourceNames(index) {
        return new Map(
            CircuitJsonSchematicSvgRenderer.#all(index, 'source_component').map(
                (element) => [
                    String(element.source_component_id || '').trim(),
                    String(element.name || element.source_component_id || '')
                ]
            )
        )
    }

    /**
     * Resolves schematic bounds.
     * @param {{ elements: object[], elementsByType: Map<string, object[]> }} index Element index.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
     */
    static #bounds(index) {
        const sheet = CircuitJsonSchematicSvgRenderer.#all(
            index,
            'schematic_sheet'
        )[0]
        const width = CircuitJsonUnits.optionalLength(sheet?.width)
        const height = CircuitJsonUnits.optionalLength(sheet?.height)
        if (width !== null && height !== null) {
            return {
                minX: 0,
                minY: 0,
                maxX: width,
                maxY: height,
                width,
                height
            }
        }
        return {
            minX: -10,
            minY: -10,
            maxX: 10,
            maxY: 10,
            width: 20,
            height: 20
        }
    }

    /**
     * Builds a padded SVG viewBox.
     * @param {object} bounds Bounds.
     * @returns {object}
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
     * Returns indexed elements by type.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {string} type Element type.
     * @returns {object[]}
     */
    static #all(index, type) {
        return index.elementsByType.get(type) || []
    }

    /**
     * Resolves an element center.
     * @param {object} element Element row.
     * @returns {{ x: number, y: number } | null}
     */
    static #center(element) {
        return CircuitJsonSchematicSvgRenderer.#point(element?.center || element)
    }

    /**
     * Resolves an element size.
     * @param {object} element Element row.
     * @returns {{ width: number, height: number } | null}
     */
    static #size(element) {
        return CircuitJsonUnits.optionalSize(element?.size || element)
    }

    /**
     * Resolves a point.
     * @param {object | null | undefined} value Point candidate.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(value) {
        return CircuitJsonUnits.optionalPoint(value)
    }

    /**
     * Resolves path points from common element fields.
     * @param {object} element Element row.
     * @returns {{ x: number, y: number }[]}
     */
    static #points(element) {
        const points = Array.isArray(element?.points)
            ? element.points
            : Array.isArray(element?.path)
              ? element.path
              : []
        return points
            .map((point) => CircuitJsonSchematicSvgRenderer.#point(point))
            .filter(Boolean)
    }

    /**
     * Builds SVG rect attributes for a center/size element.
     * @param {object} element Element row.
     * @returns {string}
     */
    static #rectAttributes(element) {
        const center = CircuitJsonSchematicSvgRenderer.#center(element)
        const size = CircuitJsonSchematicSvgRenderer.#size(element)
        if (!center || !size) return ''
        return (
            'x="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(
                center.x - size.width / 2
            ) +
            '" y="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(
                center.y - size.height / 2
            ) +
            '" width="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(size.width) +
            '" height="' +
            CircuitJsonSchematicSvgRenderer.#formatNumber(size.height) +
            '"'
        )
    }

    /**
     * Resolves one point on a circle.
     * @param {{ x: number, y: number }} center Circle center.
     * @param {number} radius Circle radius.
     * @param {number} angle Angle in degrees.
     * @returns {{ x: number, y: number }}
     */
    static #polarPoint(center, radius, angle) {
        const radians = (angle * Math.PI) / 180
        return {
            x: center.x + Math.cos(radians) * radius,
            y: center.y + Math.sin(radians) * radius
        }
    }

    /**
     * Builds a polyline point string.
     * @param {{ x: number, y: number }[]} points Points.
     * @returns {string}
     */
    static #pointsAttribute(points) {
        return points
            .map(
                (point) =>
                    CircuitJsonSchematicSvgRenderer.#formatNumber(point.x) +
                    ',' +
                    CircuitJsonSchematicSvgRenderer.#formatNumber(point.y)
            )
            .join(' ')
    }

    /**
     * Formats a viewBox record.
     * @param {{ minX: number, minY: number, width: number, height: number }} viewBox ViewBox record.
     * @returns {string}
     */
    static #formatViewBox(viewBox) {
        return [viewBox.minX, viewBox.minY, viewBox.width, viewBox.height]
            .map((value) => CircuitJsonSchematicSvgRenderer.#formatNumber(value))
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
