import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Applies local KiCad renderer patches until kicad-toolkit publishes them.
 */
class KicadToolkitPcbRendererPatcher {
    static #outlineBuilderSource = `// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { Geometry } from '../core/kicad/Geometry.mjs'
import { KicadArcGeometry } from '../core/kicad/KicadArcGeometry.mjs'

const pointEpsilon = 0.01

/**
 * Builds closed SVG board paths from KiCad Edge.Cuts primitives.
 */
export class PcbSvgBoardOutlineBuilder {
    /**
     * Builds the primary closed board path from line and arc Edge.Cuts.
     * @param {object[]} outlines Board outline primitives.
     * @returns {{ d: string, strokeWidth: number } | null}
     */
    static build(outlines) {
        const segments = PcbSvgBoardOutlineBuilder.#outlineSegments(outlines)
        if (segments.length === 0) return null

        const chain = PcbSvgBoardOutlineBuilder.#connectSegments(segments)
        if (!chain || chain.segments.length < 2) return null
        if (!PcbSvgBoardOutlineBuilder.#samePoint(chain.start, chain.end)) {
            return null
        }

        return {
            d:
                chain.segments
                    .map((segment, index) =>
                        PcbSvgBoardOutlineBuilder.#pathCommand(segment, index)
                    )
                    .join(' ') + ' Z',
            strokeWidth: Math.max(
                0.08,
                ...chain.segments.map(
                    (segment) => Number(segment.strokeWidth) || 0.08
                )
            )
        }
    }

    /**
     * Normalizes supported outline primitives.
     * @param {object[]} outlines Board outline primitives.
     * @returns {object[]}
     */
    static #outlineSegments(outlines) {
        return (Array.isArray(outlines) ? outlines : [])
            .map((outline) =>
                PcbSvgBoardOutlineBuilder.#normalizeSegment(outline)
            )
            .filter(Boolean)
    }

    /**
     * Normalizes one outline primitive into start/end form.
     * @param {object} outline Outline primitive.
     * @returns {object | null}
     */
    static #normalizeSegment(outline) {
        if (outline?.type === 'line' && outline.start && outline.end) {
            return { ...outline }
        }

        if (
            outline?.type === 'arc' &&
            outline.start &&
            outline.mid &&
            outline.end
        ) {
            return { ...outline }
        }

        return null
    }

    /**
     * Connects unordered outline segments into one path chain.
     * @param {object[]} segments Outline segments.
     * @returns {{ start: object, end: object, segments: object[] } | null}
     */
    static #connectSegments(segments) {
        const [first, ...rest] = segments
        const chain = {
            start: first.start,
            end: first.end,
            segments: [first]
        }
        const unused = [...rest]

        while (unused.length > 0) {
            const match = PcbSvgBoardOutlineBuilder.#takeNextSegment(
                unused,
                chain.end
            )
            if (!match) return null
            chain.segments.push(match)
            chain.end = match.end
        }

        return chain
    }

    /**
     * Finds and removes the next connected segment.
     * @param {object[]} unused Remaining segments.
     * @param {object} end Current end point.
     * @returns {object | null}
     */
    static #takeNextSegment(unused, end) {
        const index = unused.findIndex((segment) => {
            return (
                PcbSvgBoardOutlineBuilder.#samePoint(segment.start, end) ||
                PcbSvgBoardOutlineBuilder.#samePoint(segment.end, end)
            )
        })
        if (index < 0) return null

        const [segment] = unused.splice(index, 1)
        if (PcbSvgBoardOutlineBuilder.#samePoint(segment.start, end)) {
            return segment
        }

        return PcbSvgBoardOutlineBuilder.#reverseSegment(segment)
    }

    /**
     * Reverses one line or arc segment.
     * @param {object} segment Outline segment.
     * @returns {object}
     */
    static #reverseSegment(segment) {
        return {
            ...segment,
            start: segment.end,
            end: segment.start
        }
    }

    /**
     * Renders one SVG path command.
     * @param {object} segment Outline segment.
     * @param {number} index Segment index.
     * @returns {string}
     */
    static #pathCommand(segment, index) {
        const prefix =
            index === 0
                ? \`M \${formatNumber(segment.start.x)} \${formatNumber(segment.start.y)} \`
                : ''

        if (segment.type === 'arc') {
            return prefix + PcbSvgBoardOutlineBuilder.#arcCommand(segment)
        }

        return (
            prefix +
            \`L \${formatNumber(segment.end.x)} \${formatNumber(segment.end.y)}\`
        )
    }

    /**
     * Renders one SVG arc command.
     * @param {object} segment Arc segment.
     * @returns {string}
     */
    static #arcCommand(segment) {
        const arc = KicadArcGeometry.fromThreePoints(
            segment.start,
            segment.mid,
            segment.end
        )
        if (!arc) {
            return \`Q \${formatNumber(segment.mid.x)} \${formatNumber(segment.mid.y)} \${formatNumber(segment.end.x)} \${formatNumber(segment.end.y)}\`
        }

        return [
            'A',
            formatNumber(arc.radius),
            formatNumber(arc.radius),
            '0',
            arc.largeArc ? '1' : '0',
            arc.sweep ? '1' : '0',
            formatNumber(segment.end.x),
            formatNumber(segment.end.y)
        ].join(' ')
    }

    /**
     * Checks whether two points are close enough to join.
     * @param {object} first First point.
     * @param {object} second Second point.
     * @returns {boolean}
     */
    static #samePoint(first, second) {
        return Geometry.distance(first, second) <= pointEpsilon
    }
}

/**
 * Formats a number for compact SVG output.
 * @param {number} value Number.
 * @returns {string}
 */
function formatNumber(value) {
    return Number(value || 0)
        .toFixed(4)
        .replace(/\\.?0+$/u, '')
}
`

    static #rendererImportOriginal =
        "import { KicadArcGeometry } from '../core/kicad/KicadArcGeometry.mjs'\n" +
        "import { KicadStrokeFont } from './KicadStrokeFont.mjs'"

    static #rendererImportPatched =
        "import { KicadArcGeometry } from '../core/kicad/KicadArcGeometry.mjs'\n" +
        "import { PcbSvgBoardOutlineBuilder } from './PcbSvgBoardOutlineBuilder.mjs'\n" +
        "import { KicadStrokeFont } from './KicadStrokeFont.mjs'"

    static #oppositeCopperOptionOriginal =
        '        const layerStyles = defaultLayerStyles()\n' +
        '        const viewBounds = Geometry.expandBounds(renderBoardModel.bounds, 4)'

    static #oppositeCopperOptionPatched =
        '        const includeOppositeCopper = options.includeOppositeCopper === true\n' +
        '        const layerStyles = defaultLayerStyles()\n' +
        '        const viewBounds = Geometry.expandBounds(renderBoardModel.bounds, 4)'

    static #visibleDrawingsOriginal =
        '        const visibleDrawings = renderBoardModel.drawings.filter((drawing) => {\n' +
        '            return (\n' +
        '                isVisibleOnSide(drawing, side) &&\n' +
        '                isRenderableBoardLayer(drawing)\n' +
        '            )\n' +
        '        })'

    static #visibleDrawingsPatched =
        '        const visibleDrawings = renderBoardModel.drawings.filter((drawing) => {\n' +
        '            return (\n' +
        '                (isVisibleOnSide(drawing, side) &&\n' +
        '                    isRenderableBoardLayer(drawing)) ||\n' +
        '                (includeOppositeCopper && isOppositeSideCopper(drawing, side))\n' +
        '            )\n' +
        '        })'

    static #edgeOutlineOriginal =
        '    const polygonOutlines = board.outlines.filter(\n' +
        "        (outline) => outline.type === 'polygon'\n" +
        '    )'

    static #edgeOutlinePatched =
        '    const edgeOutline = PcbSvgBoardOutlineBuilder.build(board.outlines)\n' +
        '    const polygonOutlines = board.outlines.filter(\n' +
        "        (outline) => outline.type === 'polygon'\n" +
        '    )'

    static #edgeOutlineRenderOriginal =
        "    const stroke = edgeStyle.visible ? edgeStyle.borderColor : 'none'\n" +
        '\n' +
        '    if (polygonOutlines.length === 0) {'

    static #edgeOutlineRenderPatched =
        "    const stroke = edgeStyle.visible ? edgeStyle.borderColor : 'none'\n" +
        '\n' +
        '    if (edgeOutline) {\n' +
        '        return `<path class="pcb-board" d="${edgeOutline.d}" fill="${fill}"${optionalAttribute(fillOpacity)} stroke="${stroke}" stroke-width="${formatNumber(resolveStrokeWidth(edgeStyle, edgeOutline.strokeWidth))}" ${roundedStrokeAttributes} vector-effect="non-scaling-stroke"/>`\n' +
        '    }\n' +
        '\n' +
        '    if (polygonOutlines.length === 0) {'

    static #oppositeCopperHelperOriginal =
        '/**\n' + ' * Checks side visibility.\n'

    static #oppositeCopperHelperPatched =
        '/**\n' +
        ' * Checks whether an item is opposite-side copper for contextual rendering.\n' +
        ' * @param {object} item Renderable item.\n' +
        " * @param {'front' | 'back'} side Active side.\n" +
        ' * @returns {boolean}\n' +
        ' */\n' +
        'function isOppositeSideCopper(item, side) {\n' +
        "    if (item.material !== 'copper') return false\n" +
        '    if (!isRenderableBoardLayer(item)) return false\n' +
        "    return side === 'front'\n" +
        "        ? isVisibleOnSide(item, 'back')\n" +
        "        : isVisibleOnSide(item, 'front')\n" +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Checks side visibility.\n'

    static #segmentVectorEffectOriginal =
        '    return `<line class="pcb-segment"${optionalAttribute(metadata)} stroke="${style.borderColor}" stroke-width="${formatNumber(strokeWidth)}" ${roundedStrokeAttributes} vector-effect="non-scaling-stroke" x1="${formatNumber(segment.start.x)}" y1="${formatNumber(segment.start.y)}" x2="${formatNumber(segment.end.x)}" y2="${formatNumber(segment.end.y)}"/>`'

    static #segmentVectorEffectPatched =
        '    return `<line class="pcb-segment"${optionalAttribute(metadata)} stroke="${style.borderColor}" stroke-width="${formatNumber(strokeWidth)}" ${roundedStrokeAttributes} x1="${formatNumber(segment.start.x)}" y1="${formatNumber(segment.start.y)}" x2="${formatNumber(segment.end.x)}" y2="${formatNumber(segment.end.y)}"/>`'

    static #arcVectorEffectOriginal =
        '    return `<path class="pcb-arc"${optionalAttribute(metadata)} stroke="${style.borderColor}" stroke-width="${formatNumber(strokeWidth)}" ${roundedStrokeAttributes} vector-effect="non-scaling-stroke" d="${arcPath(arc)}" fill="none"/>`'

    static #arcVectorEffectPatched =
        '    return `<path class="pcb-arc"${optionalAttribute(metadata)} stroke="${style.borderColor}" stroke-width="${formatNumber(strokeWidth)}" ${roundedStrokeAttributes} d="${arcPath(arc)}" fill="none"/>`'

    static #schematicImportOriginal =
        "import { KicadStrokeFont } from './KicadStrokeFont.mjs'"

    static #schematicImportPatched =
        "import { KicadStrokeFont } from './KicadStrokeFont.mjs'\n" +
        "import { SchematicSvgShapeRenderer } from './SchematicSvgShapeRenderer.mjs'"

    static #schematicShapeThemeOriginal =
        '        const lineCount = (schematic.lines || []).length\n' +
        '        const componentCount = (schematic.components || []).length'

    static #schematicShapeThemePatched =
        '        const lineCount = (schematic.lines || []).length\n' +
        '        const componentCount = (schematic.components || []).length\n' +
        '        const shapeTheme = {\n' +
        '            resolveFillColor: resolveSchematicFillColor,\n' +
        '            resolveInkColor: resolveSchematicInkColor\n' +
        '        }'

    static #schematicBackdropOriginal =
        '            `<rect class="sheet-backdrop" x="0" y="0" width="${formatNumber(width)}" height="${formatNumber(height)}" rx="18"/>`,\n' +
        '            renderSheetChrome(sheet, width, height, documentModel?.fileName),'

    static #schematicBackdropPatched =
        '            `<rect class="sheet-backdrop" x="0" y="0" width="${formatNumber(width)}" height="${formatNumber(height)}" rx="0"/>`,\n' +
        '            SchematicSvgShapeRenderer.renderGrid(sheet, width, height, {\n' +
        '                displayScale,\n' +
        '                frameColor\n' +
        '            }),\n' +
        '            renderSheetChrome(sheet, width, height, documentModel?.fileName),'

    static #schematicShapeRenderOriginal =
        '            renderSheetSymbols(schematic.sheetSymbols || []),\n' +
        '            renderRectangles(schematic.rectangles || []),\n' +
        '            renderLines(schematic.lines || []),'

    static #schematicShapeRenderPatched =
        '            renderSheetSymbols(schematic.sheetSymbols || []),\n' +
        '            SchematicSvgShapeRenderer.renderPolygons(\n' +
        '                schematic.polygons || [],\n' +
        '                shapeTheme\n' +
        '            ),\n' +
        '            renderRectangles(schematic.rectangles || []),\n' +
        '            SchematicSvgShapeRenderer.renderEllipses(\n' +
        '                schematic.ellipses || [],\n' +
        '                shapeTheme\n' +
        '            ),\n' +
        '            SchematicSvgShapeRenderer.renderArcs(\n' +
        '                schematic.arcs || [],\n' +
        '                shapeTheme\n' +
        '            ),\n' +
        '            SchematicSvgShapeRenderer.renderBeziers(\n' +
        '                schematic.beziers || [],\n' +
        '                shapeTheme\n' +
        '            ),\n' +
        '            renderLines(schematic.lines || []),'

    static #schematicHiddenPinOriginal =
        '        .map((pin) => {\n' +
        '            const end = pinConnectionPoint(pin)'

    static #schematicHiddenPinPatched =
        '        .map((pin) => {\n' +
        '            if (pin.visible === false) return \'\'\n' +
        '            const end = pinConnectionPoint(pin)'

    static #hiddenEffectOriginal =
        'function hasHiddenEffect(node) {\n' +
        '    return (\n' +
        '        children(node).some(\n' +
        "            (entry) => entry[0] === 'effects' && hasChild(entry, 'hide')\n" +
        '        ) || hasChild(node, \'hide\')\n' +
        '    )\n' +
        '}'

    static #hiddenEffectPatched =
        'function hasHiddenEffect(node) {\n' +
        "    const effects = child(node, 'effects')\n" +
        '    return (\n' +
        "        hasScalar(node, 'hide') ||\n" +
        "        hasScalar(effects, 'hide') ||\n" +
        '        children(node).some(\n' +
        "            (entry) => entry[0] === 'effects' && hasChild(entry, 'hide')\n" +
        '        ) ||\n' +
        "        hasChild(node, 'hide')\n" +
        '    )\n' +
        '}'

    static #parserHasScalarOriginal =
        'function hasChild(node, name) {\n' +
        '    return Boolean(child(node, name))\n' +
        '}'

    static #parserHasScalarPatched =
        'function hasChild(node, name) {\n' +
        '    return Boolean(child(node, name))\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Checks whether a node contains a scalar token.\n' +
        ' * @param {Array | undefined} node Node.\n' +
        ' * @param {string} name Token name.\n' +
        ' * @returns {boolean}\n' +
        ' */\n' +
        'function hasScalar(node, name) {\n' +
        '    return (node || []).slice(1).some((value) => String(value) === name)\n' +
        '}'

    static #sheetZonesOriginal =
        '    const size = pageSizeForPaper(paper)\n' +
        '    const comments = parseTitleBlockComments(titleBlock)'

    static #sheetZonesPatched =
        '    const size = pageSizeForPaper(paper)\n' +
        '    const zones = drawingSheetZonesForPaper(paper)\n' +
        '    const comments = parseTitleBlockComments(titleBlock)'

    static #sheetZoneCountsOriginal =
        '        xZones: 6,\n' + '        yZones: 4,'

    static #sheetZoneCountsPatched =
        '        xZones: zones.x,\n' + '        yZones: zones.y,'

    static #sheetMarginOriginal = '        marginWidth: 5,'

    static #sheetMarginPatched = '        marginWidth: 10,'

    static #sheetZoneResolverOriginal =
        'function pageSizeForPaper(paper) {\n' +
        "    const normalized = String(paper || '').toUpperCase()\n" +
        '    const sizes = {\n' +
        '        A5: { width: 210, height: 148 },\n' +
        '        A4: { width: 297, height: 210 },\n' +
        '        A3: { width: 420, height: 297 },\n' +
        '        A2: { width: 594, height: 420 },\n' +
        '        A1: { width: 841, height: 594 },\n' +
        '        A0: { width: 1189, height: 841 },\n' +
        '        LETTER: { width: 279.4, height: 215.9 },\n' +
        '        LEGAL: { width: 355.6, height: 215.9 }\n' +
        '    }\n' +
        '    return sizes[normalized] || sizes.A4\n' +
        '}'

    static #sheetZoneResolverPatched =
        'function pageSizeForPaper(paper) {\n' +
        "    const normalized = String(paper || '').toUpperCase()\n" +
        '    const sizes = {\n' +
        '        A5: { width: 210, height: 148 },\n' +
        '        A4: { width: 297, height: 210 },\n' +
        '        A3: { width: 420, height: 297 },\n' +
        '        A2: { width: 594, height: 420 },\n' +
        '        A1: { width: 841, height: 594 },\n' +
        '        A0: { width: 1189, height: 841 },\n' +
        '        LETTER: { width: 279.4, height: 215.9 },\n' +
        '        LEGAL: { width: 355.6, height: 215.9 }\n' +
        '    }\n' +
        '    return sizes[normalized] || sizes.A4\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        " * Resolves KiCad's default drawing sheet zone counts for one paper size.\n" +
        ' * @param {string} paper Paper token.\n' +
        ' * @returns {{ x: number, y: number }}\n' +
        ' */\n' +
        'function drawingSheetZonesForPaper(paper) {\n' +
        "    const normalized = String(paper || '').toUpperCase()\n" +
        '    const zones = {\n' +
        '        A5: { x: 4, y: 4 },\n' +
        '        A4: { x: 6, y: 4 },\n' +
        '        A3: { x: 8, y: 6 },\n' +
        '        A2: { x: 12, y: 8 },\n' +
        '        A1: { x: 16, y: 12 },\n' +
        '        A0: { x: 24, y: 16 },\n' +
        '        LETTER: { x: 6, y: 4 },\n' +
        '        LEGAL: { x: 8, y: 4 }\n' +
        '    }\n' +
        '    return zones[normalized] || zones.A4\n' +
        '}'

    static #symbolVisibleOriginal =
        '            const at = parseAt(child(node, \'at\'))\n' +
        '            const numberFont = parsePinTextFont(child(node, \'number\'))\n' +
        '            const connection = transformPoint({ x: at.x, y: at.y }, transform)'

    static #symbolVisiblePatched =
        '            const at = parseAt(child(node, \'at\'))\n' +
        '            const numberFont = parsePinTextFont(child(node, \'number\'))\n' +
        '            const visible = !pinHidden(node)\n' +
        '            const connection = transformPoint({ x: at.x, y: at.y }, transform)'

    static #symbolPinFieldsOriginal =
        '                numberFontSize: numberFont.size,\n' +
        '                numberVisible: numberFont.visible && !hidePinNumbers,\n' +
        '                orientation,\n' +
        '                electrical: 4,\n' +
        '                color: defaultInkColor,\n' +
        '                labelColor: defaultInkColor,\n' +
        '                labelMode: \'number-only\',\n' +
        '                endpointVisible: Boolean(transform.endpointVisible),\n' +
        '                ownerIndex'

    static #symbolPinFieldsPatched =
        '                numberFontSize: numberFont.size,\n' +
        '                numberVisible: visible && numberFont.visible && !hidePinNumbers,\n' +
        '                orientation,\n' +
        '                electrical: 4,\n' +
        '                color: defaultInkColor,\n' +
        '                labelColor: defaultInkColor,\n' +
        '                labelMode: \'number-only\',\n' +
        '                endpointVisible: visible && Boolean(transform.endpointVisible),\n' +
        '                visible,\n' +
        '                ownerIndex'

    static #symbolPinHiddenOriginal =
        '/**\n' + ' * Parses pin-number font visibility and size.\n'

    static #symbolPinHiddenPatched =
        '/**\n' +
        ' * Checks whether a pin is hidden in the KiCad library symbol.\n' +
        ' * @param {Array | undefined} node Pin node.\n' +
        ' * @returns {boolean}\n' +
        ' */\n' +
        'function pinHidden(node) {\n' +
        "    return hasScalar(node, 'hide') || hasChild(node, 'hide')\n" +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Parses pin-number font visibility and size.\n'

    static #symbolHasScalarOriginal =
        'function hasChild(node, name) {\n' +
        '    return children(node, name).length > 0\n' +
        '}'

    static #symbolHasScalarPatched =
        'function hasChild(node, name) {\n' +
        '    return children(node, name).length > 0\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Checks whether a node contains a scalar token.\n' +
        ' * @param {Array | undefined} node Node.\n' +
        ' * @param {string} name Token name.\n' +
        ' * @returns {boolean}\n' +
        ' */\n' +
        'function hasScalar(node, name) {\n' +
        '    return (node || []).slice(1).some((value) => String(value) === name)\n' +
        '}'

    /**
     * Applies KiCad renderer patches.
     * @returns {Promise<void>}
     */
    static async run() {
        await KicadToolkitPcbRendererPatcher.#applyPcbPatches()
        await KicadToolkitPcbRendererPatcher.#applySchematicPatches()
    }

    /**
     * Applies KiCad PCB renderer patches.
     * @returns {Promise<void>}
     */
    static async #applyPcbPatches() {
        if (await KicadToolkitPcbRendererPatcher.#usesUpstreamRenderer()) {
            return
        }

        await KicadToolkitPcbRendererPatcher.#writeOutlineBuilder()
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            original: KicadToolkitPcbRendererPatcher.#rendererImportOriginal,
            patched: KicadToolkitPcbRendererPatcher.#rendererImportPatched,
            label: 'PCB outline builder import'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            original:
                KicadToolkitPcbRendererPatcher.#oppositeCopperOptionOriginal,
            patched:
                KicadToolkitPcbRendererPatcher.#oppositeCopperOptionPatched,
            label: 'PCB opposite copper option'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            original: KicadToolkitPcbRendererPatcher.#visibleDrawingsOriginal,
            patched: KicadToolkitPcbRendererPatcher.#visibleDrawingsPatched,
            label: 'PCB opposite copper drawing filter'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            original: KicadToolkitPcbRendererPatcher.#edgeOutlineOriginal,
            patched: KicadToolkitPcbRendererPatcher.#edgeOutlinePatched,
            label: 'PCB Edge.Cuts outline builder'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            original: KicadToolkitPcbRendererPatcher.#edgeOutlineRenderOriginal,
            patched: KicadToolkitPcbRendererPatcher.#edgeOutlineRenderPatched,
            label: 'PCB Edge.Cuts outline render'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            original:
                KicadToolkitPcbRendererPatcher.#oppositeCopperHelperOriginal,
            patched:
                KicadToolkitPcbRendererPatcher.#oppositeCopperHelperPatched,
            label: 'PCB opposite copper helper'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            original:
                KicadToolkitPcbRendererPatcher.#segmentVectorEffectOriginal,
            patched:
                KicadToolkitPcbRendererPatcher.#segmentVectorEffectPatched,
            label: 'PCB routed segment scaling'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            original: KicadToolkitPcbRendererPatcher.#arcVectorEffectOriginal,
            patched: KicadToolkitPcbRendererPatcher.#arcVectorEffectPatched,
            label: 'PCB routed arc scaling'
        })
    }

    /**
     * Applies KiCad schematic renderer and parser patches.
     * @returns {Promise<void>}
     */
    static async #applySchematicPatches() {
        await KicadToolkitPcbRendererPatcher.#writeSchematicRenderer()
        await KicadToolkitPcbRendererPatcher.#writeSchematicShapeRenderer()
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            sourcePath:
                KicadToolkitPcbRendererPatcher.#resolveSchematicParserSourcePath(),
            original: KicadToolkitPcbRendererPatcher.#hiddenEffectOriginal,
            patched: KicadToolkitPcbRendererPatcher.#hiddenEffectPatched,
            label: 'schematic scalar hidden properties'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            sourcePath:
                KicadToolkitPcbRendererPatcher.#resolveSchematicParserSourcePath(),
            original: KicadToolkitPcbRendererPatcher.#parserHasScalarOriginal,
            patched: KicadToolkitPcbRendererPatcher.#parserHasScalarPatched,
            label: 'schematic parser scalar helper'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            sourcePath:
                KicadToolkitPcbRendererPatcher.#resolveSchematicParserSourcePath(),
            original: KicadToolkitPcbRendererPatcher.#sheetZonesOriginal,
            patched: KicadToolkitPcbRendererPatcher.#sheetZonesPatched,
            label: 'schematic sheet zone resolver'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            sourcePath:
                KicadToolkitPcbRendererPatcher.#resolveSchematicParserSourcePath(),
            original: KicadToolkitPcbRendererPatcher.#sheetZoneCountsOriginal,
            patched: KicadToolkitPcbRendererPatcher.#sheetZoneCountsPatched,
            label: 'schematic sheet zone counts'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            sourcePath:
                KicadToolkitPcbRendererPatcher.#resolveSchematicParserSourcePath(),
            original: KicadToolkitPcbRendererPatcher.#sheetMarginOriginal,
            patched: KicadToolkitPcbRendererPatcher.#sheetMarginPatched,
            label: 'schematic worksheet margin'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            sourcePath:
                KicadToolkitPcbRendererPatcher.#resolveSchematicParserSourcePath(),
            original: KicadToolkitPcbRendererPatcher.#sheetZoneResolverOriginal,
            patched: KicadToolkitPcbRendererPatcher.#sheetZoneResolverPatched,
            label: 'schematic sheet zone paper defaults'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            sourcePath:
                KicadToolkitPcbRendererPatcher.#resolveSchematicSymbolParserSourcePath(),
            original: KicadToolkitPcbRendererPatcher.#symbolVisibleOriginal,
            patched: KicadToolkitPcbRendererPatcher.#symbolVisiblePatched,
            label: 'schematic symbol hidden pin visibility'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            sourcePath:
                KicadToolkitPcbRendererPatcher.#resolveSchematicSymbolParserSourcePath(),
            original: KicadToolkitPcbRendererPatcher.#symbolPinFieldsOriginal,
            patched: KicadToolkitPcbRendererPatcher.#symbolPinFieldsPatched,
            label: 'schematic symbol hidden pin fields'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            sourcePath:
                KicadToolkitPcbRendererPatcher.#resolveSchematicSymbolParserSourcePath(),
            original: KicadToolkitPcbRendererPatcher.#symbolPinHiddenOriginal,
            patched: KicadToolkitPcbRendererPatcher.#symbolPinHiddenPatched,
            label: 'schematic symbol hidden pin helper'
        })
        await KicadToolkitPcbRendererPatcher.#applyPatch({
            sourcePath:
                KicadToolkitPcbRendererPatcher.#resolveSchematicSymbolParserSourcePath(),
            original: KicadToolkitPcbRendererPatcher.#symbolHasScalarOriginal,
            patched: KicadToolkitPcbRendererPatcher.#symbolHasScalarPatched,
            label: 'schematic symbol scalar helper'
        })
    }

    /**
     * Applies one text patch idempotently.
     * @param {{ sourcePath?: string, original: string, patched: string, label: string }} patch Patch.
     * @returns {Promise<void>}
     */
    static async #applyPatch(patch) {
        const sourcePath =
            patch.sourcePath ||
            KicadToolkitPcbRendererPatcher.#resolveRendererSourcePath()
        const source = await readFile(sourcePath, 'utf8')
        if (source.includes(patch.patched)) return
        if (!source.includes(patch.original)) {
            throw new Error(
                'Unable to patch kicad-toolkit: expected ' +
                    patch.label +
                    ' block was not found.'
            )
        }

        await writeFile(
            sourcePath,
            source.replace(patch.original, patch.patched)
        )
    }

    /**
     * Writes the outline helper module used by the renderer patch.
     * @returns {Promise<void>}
     */
    static async #writeOutlineBuilder() {
        const outlinePath =
            KicadToolkitPcbRendererPatcher.#resolveOutlineBuilderPath()
        await mkdir(path.dirname(outlinePath), { recursive: true })
        await writeFile(
            outlinePath,
            KicadToolkitPcbRendererPatcher.#outlineBuilderSource
        )
    }

    /**
     * Writes the schematic renderer module used by the app patch.
     * @returns {Promise<void>}
     */
    static async #writeSchematicRenderer() {
        const rendererPath =
            KicadToolkitPcbRendererPatcher.#resolveSchematicRendererSourcePath()
        const templateSource = await readFile(
            KicadToolkitPcbRendererPatcher.#resolveSchematicRendererTemplatePath(),
            'utf8'
        )
        await mkdir(path.dirname(rendererPath), { recursive: true })
        await writeFile(rendererPath, templateSource)
    }

    /**
     * Writes the schematic shape helper module used by the renderer patch.
     * @returns {Promise<void>}
     */
    static async #writeSchematicShapeRenderer() {
        const shapePath =
            KicadToolkitPcbRendererPatcher.#resolveSchematicShapeRendererPath()
        const templateSource = await readFile(
            KicadToolkitPcbRendererPatcher.#resolveSchematicShapeRendererTemplatePath(),
            'utf8'
        )
        await mkdir(path.dirname(shapePath), { recursive: true })
        await writeFile(shapePath, templateSource)
    }

    /**
     * Returns true when the installed package already has the renderer fixes.
     * @returns {Promise<boolean>}
     */
    static async #usesUpstreamRenderer() {
        const packageJson = JSON.parse(
            await readFile(
                KicadToolkitPcbRendererPatcher.#resolvePackageManifestPath(),
                'utf8'
            )
        )

        return KicadToolkitPcbRendererPatcher.#isAtLeastVersion(
            packageJson.version,
            '0.2.17'
        )
    }

    /**
     * Compares semantic version strings by major, minor, and patch numbers.
     * @param {string} version Version.
     * @param {string} minimum Minimum version.
     * @returns {boolean}
     */
    static #isAtLeastVersion(version, minimum) {
        const currentParts =
            KicadToolkitPcbRendererPatcher.#versionParts(version)
        const minimumParts =
            KicadToolkitPcbRendererPatcher.#versionParts(minimum)

        for (let index = 0; index < minimumParts.length; index += 1) {
            if (currentParts[index] > minimumParts[index]) return true
            if (currentParts[index] < minimumParts[index]) return false
        }

        return true
    }

    /**
     * Extracts major, minor, and patch numbers from one version string.
     * @param {string} version Version.
     * @returns {number[]}
     */
    static #versionParts(version) {
        return String(version)
            .split(/[.-]/u)
            .slice(0, 3)
            .map((part) => Number(part) || 0)
    }

    /**
     * Resolves the installed package manifest path.
     * @returns {string}
     */
    static #resolvePackageManifestPath() {
        return path.resolve(
            KicadToolkitPcbRendererPatcher.#rootDirectory(),
            'node_modules',
            'kicad-toolkit',
            'package.json'
        )
    }

    /**
     * Resolves the installed PCB SVG renderer source path.
     * @returns {string}
     */
    static #resolveRendererSourcePath() {
        return path.resolve(
            KicadToolkitPcbRendererPatcher.#rootDirectory(),
            'node_modules',
            'kicad-toolkit',
            'src',
            'ui',
            'PcbSvgRenderer.mjs'
        )
    }

    /**
     * Resolves the installed schematic SVG renderer source path.
     * @returns {string}
     */
    static #resolveSchematicRendererSourcePath() {
        return path.resolve(
            KicadToolkitPcbRendererPatcher.#rootDirectory(),
            'node_modules',
            'kicad-toolkit',
            'src',
            'ui',
            'SchematicSvgRenderer.mjs'
        )
    }

    /**
     * Resolves the installed schematic parser source path.
     * @returns {string}
     */
    static #resolveSchematicParserSourcePath() {
        return path.resolve(
            KicadToolkitPcbRendererPatcher.#rootDirectory(),
            'node_modules',
            'kicad-toolkit',
            'src',
            'core',
            'kicad',
            'KicadSchematicParser.mjs'
        )
    }

    /**
     * Resolves the installed schematic symbol parser source path.
     * @returns {string}
     */
    static #resolveSchematicSymbolParserSourcePath() {
        return path.resolve(
            KicadToolkitPcbRendererPatcher.#rootDirectory(),
            'node_modules',
            'kicad-toolkit',
            'src',
            'core',
            'kicad',
            'KicadSchematicSymbolParser.mjs'
        )
    }

    /**
     * Resolves the installed outline helper source path.
     * @returns {string}
     */
    static #resolveOutlineBuilderPath() {
        return path.resolve(
            KicadToolkitPcbRendererPatcher.#rootDirectory(),
            'node_modules',
            'kicad-toolkit',
            'src',
            'ui',
            'PcbSvgBoardOutlineBuilder.mjs'
        )
    }

    /**
     * Resolves the installed schematic shape helper source path.
     * @returns {string}
     */
    static #resolveSchematicShapeRendererPath() {
        return path.resolve(
            KicadToolkitPcbRendererPatcher.#rootDirectory(),
            'node_modules',
            'kicad-toolkit',
            'src',
            'ui',
            'SchematicSvgShapeRenderer.mjs'
        )
    }

    /**
     * Resolves the schematic renderer template source path.
     * @returns {string}
     */
    static #resolveSchematicRendererTemplatePath() {
        return path.resolve(
            KicadToolkitPcbRendererPatcher.#rootDirectory(),
            'scripts',
            'patches',
            'SchematicSvgRenderer.mjs'
        )
    }

    /**
     * Resolves the schematic shape helper template source path.
     * @returns {string}
     */
    static #resolveSchematicShapeRendererTemplatePath() {
        return path.resolve(
            KicadToolkitPcbRendererPatcher.#rootDirectory(),
            'scripts',
            'patches',
            'SchematicSvgShapeRenderer.mjs'
        )
    }

    /**
     * Resolves the app root directory.
     * @returns {string}
     */
    static #rootDirectory() {
        return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    }
}

await KicadToolkitPcbRendererPatcher.run()
