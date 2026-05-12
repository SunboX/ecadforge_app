import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Applies local dependency patches needed until upstream releases them.
 */
class AltiumToolkitPatcher {
    static #rawRecordOriginal =
        '            rawRecords.push(\n' +
        '                ...slices.map((slice) =>\n' +
        '                    PcbRawRecordRegistry.#normalizePcbDocRecord(\n' +
        '                        descriptor,\n' +
        '                        slice,\n' +
        '                        parsedCount\n' +
        '                    )\n' +
        '                )\n' +
        '            )'

    static #rawRecordPatched =
        '            for (const slice of slices) {\n' +
        '                rawRecords.push(\n' +
        '                    PcbRawRecordRegistry.#normalizePcbDocRecord(\n' +
        '                        descriptor,\n' +
        '                        slice,\n' +
        '                        parsedCount\n' +
        '                    )\n' +
        '                )\n' +
        '            }'

    static #footprintDetailOriginal =
        '     * Returns true when one component already has authored local geometry from\n' +
        '     * selected top-side documentation layers.\n' +
        '     * @param {{ x: number, y: number, pattern: string }} component\n' +
        '     * @param {{ fills: { x1: number, y1: number, x2: number, y2: number }[], tracks: { x1: number, y1: number, x2: number, y2: number }[], arcs: { x: number, y: number, radius: number, width?: number }[], regions?: { points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] }[] }} footprintPrimitives\n' +
        '     * @param {{ x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, rotation?: number, offsetTopX?: number, offsetTopY?: number, holeDiameter?: number }[]} pads\n' +
        '     * @returns {boolean}\n' +
        '     */\n' +
        '    static #hasAuthoredFootprintDetail(component, footprintPrimitives, pads) {\n' +
        '        const bounds = PcbSvgRenderer.#footprintDetailBounds(component)\n'

    static #footprintDetailPatched =
        '     * Returns true when one component already has authored geometry, either by\n' +
        '     * an explicit component ownership link or by nearby recovered primitives.\n' +
        '     * @param {{ componentIndex?: number | null, x: number, y: number, pattern: string }} component\n' +
        '     * @param {{ fills: { componentIndex?: number | null, x1: number, y1: number, x2: number, y2: number }[], tracks: { componentIndex?: number | null, x1: number, y1: number, x2: number, y2: number }[], arcs: { componentIndex?: number | null, x: number, y: number, radius: number, width?: number }[], regions?: { componentIndex?: number | null, points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] }[] }} footprintPrimitives\n' +
        '     * @param {{ componentIndex?: number | null, x: number, y: number, sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, rotation?: number, offsetTopX?: number, offsetTopY?: number, holeDiameter?: number }[]} pads\n' +
        '     * @returns {boolean}\n' +
        '     */\n' +
        '    static #hasAuthoredFootprintDetail(component, footprintPrimitives, pads) {\n' +
        '        if (\n' +
        '            PcbSvgRenderer.#hasComponentOwnedFootprintDetail(\n' +
        '                component,\n' +
        '                footprintPrimitives,\n' +
        '                pads\n' +
        '            )\n' +
        '        ) {\n' +
        '            return true\n' +
        '        }\n' +
        '\n' +
        '        const bounds = PcbSvgRenderer.#footprintDetailBounds(component)\n'

    static #componentOwnedOriginal =
        '    /**\n' +
        '     * Returns true when one recovered pad surface overlaps a component-local\n'

    static #componentOwnedPatched =
        '    /**\n' +
        '     * Returns true when recovered primitives directly reference the component.\n' +
        '     * @param {{ componentIndex?: number | null }} component\n' +
        '     * @param {{ fills?: { componentIndex?: number | null }[], tracks?: { componentIndex?: number | null }[], arcs?: { componentIndex?: number | null }[], regions?: { componentIndex?: number | null }[] }} footprintPrimitives\n' +
        '     * @param {{ componentIndex?: number | null }[]} pads\n' +
        '     * @returns {boolean}\n' +
        '     */\n' +
        '    static #hasComponentOwnedFootprintDetail(\n' +
        '        component,\n' +
        '        footprintPrimitives,\n' +
        '        pads\n' +
        '    ) {\n' +
        '        const componentIndex = Number(component?.componentIndex)\n' +
        '        if (!Number.isInteger(componentIndex)) {\n' +
        '            return false\n' +
        '        }\n' +
        '\n' +
        '        return [\n' +
        '            ...(footprintPrimitives.tracks || []),\n' +
        '            ...(footprintPrimitives.fills || []),\n' +
        '            ...(footprintPrimitives.arcs || []),\n' +
        '            ...(footprintPrimitives.regions || []),\n' +
        '            ...(pads || [])\n' +
        '        ].some((primitive) => Number(primitive?.componentIndex) === componentIndex)\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Returns true when one recovered pad surface overlaps a component-local\n'

    static #schematicImportOriginal =
        'const displayScale = 10\n' +
        "const wireColor = 'var(--schematic-default-ink-color)'"

    static #schematicImportPatched =
        "import { KicadStrokeFont } from './KicadStrokeFont.mjs'\n" +
        '\n' +
        'const displayScale = 10\n' +
        'const kicadTextLineSpacingRatio = 1.61\n' +
        'const kicadFirstLineHeightRatio = 1.17\n' +
        'const kicadStrokeBaselineFudgeRatio = 0.052\n' +
        "const wireColor = 'var(--schematic-default-ink-color)'"

    static #schematicPinMarkerColorOriginal =
        "const symbolFillColor = 'var(--schematic-fill-color)'"

    static #schematicPinMarkerColorPatched =
        "const symbolFillColor = 'var(--schematic-fill-color)'\n" +
        "const pinMarkerFillColor = 'var(--schematic-pin-marker-fill)'"

    static #schematicRenderTextsOriginal =
        'function renderTexts(texts) {\n' +
        '    return texts\n' +
        '        .map(\n' +
        '            (text) =>\n' +
        '                `<text class="${resolveSchematicTextClass(text)}" x="${formatNumber(text.x)}" y="${formatNumber(text.y)}" fill="${resolveSchematicTextColor(text)}" font-size="${formatNumber(resolveTextFontSize(text))}" text-anchor="${resolveTextAnchor(text)}" dominant-baseline="${resolveTextBaseline(text)}"${renderTextTransform(text)}>${escapeHtml(text.text || text.value || \'\')}</text>`\n' +
        '        )\n' +
        "        .join('')\n" +
        '}'

    static #schematicRenderTextsPatched =
        'function renderTexts(texts) {\n' +
        '    return texts\n' +
        '        .map(\n' +
        '            (text) =>\n' +
        '                renderStrokeText({\n' +
        '                    className: resolveSchematicTextClass(text),\n' +
        '                    x: text.x,\n' +
        '                    y: text.y,\n' +
        "                    value: text.text || text.value || '',\n" +
        '                    color: resolveSchematicTextColor(text),\n' +
        '                    sizeX: resolveTextWidth(text),\n' +
        '                    sizeY: resolveTextHeight(text),\n' +
        '                    hAlign: resolveTextHAlign(text),\n' +
        '                    vAlign: resolveTextVAlign(text),\n' +
        '                    rotation: resolveRenderedTextRotation(text)\n' +
        '                })\n' +
        '        )\n' +
        "        .join('')\n" +
        '}'

    static #schematicPinNumberOriginal =
        '    const offset = 0.35\n' +
        '    const fontSize = Number(pin.numberFontSize || 0.85)\n' +
        '    const x =\n' +
        "        pin.orientation === 'left'\n" +
        '            ? pin.x + offset\n' +
        "            : pin.orientation === 'right'\n" +
        '              ? pin.x - offset\n' +
        '              : pin.x + offset\n' +
        '    const y =\n' +
        "        pin.orientation === 'top'\n" +
        '            ? pin.y - offset\n' +
        "            : pin.orientation === 'bottom'\n" +
        '              ? pin.y + offset\n' +
        '              : pin.y - offset\n' +
        "    const anchor = pin.orientation === 'right' ? 'end' : 'start'\n" +
        '    return `<text class="schematic-pin-number" x="${formatNumber(x)}" y="${formatNumber(y)}" fill="${symbolColor}" font-size="${formatNumber(fontSize)}" text-anchor="${anchor}" dominant-baseline="central">${escapeHtml(label)}</text>`'

    static #schematicPinNumberPatched =
        '    const offset = 0.35\n' +
        '    const fontSize = Number(pin.numberFontSize || 0.85)\n' +
        '    const x =\n' +
        "        pin.orientation === 'left'\n" +
        '            ? pin.x - offset\n' +
        "            : pin.orientation === 'right'\n" +
        '              ? pin.x + offset\n' +
        '              : pin.x + offset\n' +
        '    const y =\n' +
        "        pin.orientation === 'top'\n" +
        '            ? pin.y + offset\n' +
        "            : pin.orientation === 'bottom'\n" +
        '              ? pin.y - offset\n' +
        '              : pin.y - offset\n' +
        '    return renderStrokeText({\n' +
        "        className: 'schematic-pin-number',\n" +
        '        x,\n' +
        '        y,\n' +
        '        value: label,\n' +
        '        color: symbolColor,\n' +
        '        sizeX: fontSize,\n' +
        '        sizeY: fontSize,\n' +
        "        hAlign: pin.orientation === 'left' ? 'right' : 'left',\n" +
        '        vAlign:\n' +
        "            pin.orientation === 'top'\n" +
        "                ? 'top'\n" +
        "                : pin.orientation === 'bottom'\n" +
        "                  ? 'bottom'\n" +
        "                  : 'center',\n" +
        '        rotation: 0\n' +
        '    })'

    static #schematicPinEndpointCallOriginal =
        '                `<line class="schematic-pin-line" x1="${formatNumber(pin.x)}" y1="${formatNumber(pin.y)}" x2="${formatNumber(end.x)}" y2="${formatNumber(end.y)}" stroke="${symbolColor}" stroke-width="0.08"/>`,\n' +
        '                renderPinNumber(pin)'

    static #schematicPinEndpointCallPatched =
        '                `<line class="schematic-pin-line" x1="${formatNumber(pin.x)}" y1="${formatNumber(pin.y)}" x2="${formatNumber(end.x)}" y2="${formatNumber(end.y)}" stroke="${symbolColor}" stroke-width="0.08"/>`,\n' +
        '                renderPinEndpoint(pin),\n' +
        '                renderPinNumber(pin)'

    static #schematicPinEndpointHelperOriginal =
        '/**\n' +
        ' * Renders one KiCad pin number near the symbol body.\n' +
        ' * @param {object} pin Pin.\n' +
        ' * @returns {string}\n' +
        ' */\n' +
        'function renderPinNumber(pin) {'

    static #schematicPinEndpointHelperPatched =
        '/**\n' +
        ' * Renders one visible KiCad pin endpoint at the symbol body.\n' +
        ' * @param {object} pin Pin.\n' +
        ' * @returns {string}\n' +
        ' */\n' +
        'function renderPinEndpoint(pin) {\n' +
        "    if (!pin.endpointVisible) return ''\n" +
        '    return `<circle class="schematic-pin-endpoint" cx="${formatNumber(pin.x)}" cy="${formatNumber(pin.y)}" r="0.42" fill="${pinMarkerFillColor}" stroke="${symbolColor}" stroke-width="0.12"/>`\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Renders one KiCad pin number near the symbol body.\n' +
        ' * @param {object} pin Pin.\n' +
        ' * @returns {string}\n' +
        ' */\n' +
        'function renderPinNumber(pin) {'

    static #schematicTextHelpersOriginal =
        '/**\n' +
        ' * Resolves SVG text-anchor from parsed KiCad justification.\n' +
        ' * @param {object} text Text primitive.\n' +
        " * @returns {'start' | 'middle' | 'end'}\n" +
        ' */\n' +
        'function resolveTextAnchor(text) {\n' +
        "    if (['start', 'middle', 'end'].includes(text?.anchor)) return text.anchor\n" +
        '    const hAlign = text?.font?.hAlign\n' +
        "    if (hAlign === 'right') return 'end'\n" +
        "    if (hAlign === 'center') return 'middle'\n" +
        "    return 'start'\n" +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Resolves SVG baseline from parsed KiCad justification.\n' +
        ' * @param {object} text Text primitive.\n' +
        ' * @returns {string}\n' +
        ' */\n' +
        'function resolveTextBaseline(text) {\n' +
        '    const vAlign = text?.vAlign || text?.font?.vAlign\n' +
        "    if (vAlign === 'top') return 'hanging'\n" +
        "    if (vAlign === 'center') return 'central'\n" +
        "    return 'alphabetic'\n" +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Resolves browser font size from KiCad stroke-font height.\n' +
        ' * @param {object} text Text primitive.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function resolveTextFontSize(text) {\n' +
        '    return Number(text?.fontSize || text?.size || 2.2) * (4 / 3)\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Renders a rotation transform for KiCad text.\n' +
        ' * @param {object} text Text primitive.\n' +
        ' * @returns {string}\n' +
        ' */\n' +
        'function renderTextTransform(text) {\n' +
        '    const rotation = resolveRenderedTextRotation(text)\n' +
        "    if (Math.abs(rotation) < 0.001) return ''\n" +
        '    return ` transform="rotate(${formatNumber(rotation)} ${formatNumber(text.x)} ${formatNumber(text.y)})"`\n' +
        '}'

    static #schematicTextHelpersPatched =
        '/**\n' +
        ' * Renders one KiCad stroke-font text item.\n' +
        ' * @param {{ className: string, x: number, y: number, value: string, color: string, sizeX: number, sizeY: number, hAlign: string, vAlign: string, rotation: number }} text Text item.\n' +
        ' * @returns {string}\n' +
        ' */\n' +
        'function renderStrokeText(text) {\n' +
        "    const lines = String(text.value || '').split('\\n')\n" +
        '    const lineSpacing = textLineSpacing(text)\n' +
        '    const strokeWidth = textStrokeWidth(text)\n' +
        '    const attrs = [\n' +
        '        `class="${text.className}"`,\n' +
        '        `aria-label="${escapeAttribute(text.value)}"`,\n' +
        '        \'fill="none"\',\n' +
        '        `stroke="${text.color}"`,\n' +
        '        `stroke-width="${formatNumber(strokeWidth)}"`,\n' +
        '        \'stroke-linecap="round"\',\n' +
        '        \'stroke-linejoin="round"\',\n' +
        '        renderStrokeTextTransform(text)\n' +
        "    ].join(' ')\n" +
        '\n' +
        "    return `<g ${attrs}>${lines.map((line, index) => renderStrokeTextLine(text, line, index, lines.length, lineSpacing)).join('')}</g>`\n" +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Renders one KiCad stroke-font text line.\n' +
        ' * @param {object} text Text item.\n' +
        ' * @param {string} line Line value.\n' +
        ' * @param {number} index Line index.\n' +
        ' * @param {number} lineCount Total line count.\n' +
        ' * @param {number} lineSpacing Line spacing.\n' +
        ' * @returns {string}\n' +
        ' */\n' +
        'function renderStrokeTextLine(text, line, index, lineCount, lineSpacing) {\n' +
        '    const sizeX = textWidth(text)\n' +
        '    const sizeY = textHeight(text)\n' +
        '    const lineWidth = KicadStrokeFont.measureLine(line, sizeX)\n' +
        '    const x = textLineX(text, lineWidth)\n' +
        '    const y = textLineY(text, index, lineCount, lineSpacing)\n' +
        '    const strokes = KicadStrokeFont.strokeLine(line, { x, y, sizeX, sizeY })\n' +
        '    const attrs = [\n' +
        '        \'class="schematic-text-line"\',\n' +
        '        `data-line="${escapeAttribute(line)}"`,\n' +
        '        `data-x="${formatNumber(x)}"`,\n' +
        '        `data-y="${formatNumber(y)}"`\n' +
        "    ].join(' ')\n" +
        '\n' +
        "    return `<g ${attrs}>${strokes.map(renderStrokeTextStroke).join('')}</g>`\n" +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Renders one KiCad stroke-font stroke.\n' +
        ' * @param {{ x: number, y: number }[]} points Stroke points.\n' +
        ' * @returns {string}\n' +
        ' */\n' +
        'function renderStrokeTextStroke(points) {\n' +
        '    return `<path class="schematic-text-stroke" d="${pathFromPoints(points)}"/>`\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        " * Resolves KiCad's horizontal text justification.\n" +
        ' * @param {object} text Text primitive.\n' +
        " * @returns {'left' | 'center' | 'right'}\n" +
        ' */\n' +
        'function resolveTextHAlign(text) {\n' +
        "    if (text?.symbolKind === 'power') return 'center'\n" +
        "    if (text?.anchor === 'end') return 'right'\n" +
        "    if (text?.anchor === 'middle') return 'center'\n" +
        '    const hAlign = text?.font?.hAlign\n' +
        "    if (hAlign === 'right') return 'right'\n" +
        "    if (hAlign === 'center') return 'center'\n" +
        "    return 'left'\n" +
        '}\n' +
        '\n' +
        '/**\n' +
        " * Resolves KiCad's vertical text justification.\n" +
        ' * @param {object} text Text primitive.\n' +
        ' * @returns {string}\n' +
        ' */\n' +
        'function resolveTextVAlign(text) {\n' +
        '    const vAlign = text?.vAlign || text?.font?.vAlign\n' +
        "    if (vAlign === 'top') return 'top'\n" +
        "    if (vAlign === 'center') return 'center'\n" +
        "    return 'bottom'\n" +
        '}\n' +
        '\n' +
        '/**\n' +
        " * Resolves KiCad's horizontal stroke size.\n" +
        ' * @param {object} text Text primitive.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function resolveTextWidth(text) {\n' +
        '    return positiveTextSize(text?.font?.width, text?.fontSize || text?.size)\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        " * Resolves KiCad's vertical stroke size.\n" +
        ' * @param {object} text Text primitive.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function resolveTextHeight(text) {\n' +
        '    return positiveTextSize(text?.font?.height, text?.fontSize || text?.size)\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Resolves a KiCad stroke-font size.\n' +
        ' * @param {number | undefined} primary Primary value.\n' +
        ' * @param {number | undefined} secondary Secondary value.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function positiveTextSize(primary, secondary) {\n' +
        '    const value = Number(primary) || Number(secondary) || 1\n' +
        '    return Math.max(value, 0.001)\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Renders a rotation transform for KiCad stroke text.\n' +
        ' * @param {object} text Text primitive.\n' +
        ' * @returns {string}\n' +
        ' */\n' +
        'function renderStrokeTextTransform(text) {\n' +
        '    const rotation = Number(text.rotation || 0)\n' +
        "    if (Math.abs(rotation) < 0.001) return ''\n" +
        '    return `transform="rotate(${formatNumber(rotation)} ${formatNumber(text.x)} ${formatNumber(text.y)})"`\n' +
        '}'

    static #schematicMetricsOriginal =
        '/**\n' + ' * Returns the file basename.\n'

    static #schematicMetricsPatched =
        '/**\n' +
        ' * Calculates KiCad-like baseline spacing for multiline text.\n' +
        ' * @param {object} text Text item.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function textLineSpacing(text) {\n' +
        '    return textHeight(text) * kicadTextLineSpacingRatio\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        " * Resolves KiCad's vertical stroke size for font and baseline metrics.\n" +
        ' * @param {object} text Text item.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function textHeight(text) {\n' +
        '    return positiveTextSize(text.sizeY, text.sizeX)\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        " * Resolves KiCad's horizontal stroke size for glyph scaling.\n" +
        ' * @param {object} text Text item.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function textWidth(text) {\n' +
        '    return positiveTextSize(text.sizeX, text.sizeY)\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Calculates line origin from KiCad horizontal justification.\n' +
        ' * @param {object} text Text item.\n' +
        ' * @param {number} lineWidth Line width.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function textLineX(text, lineWidth) {\n' +
        "    if (text.hAlign === 'left') return text.x\n" +
        "    if (text.hAlign === 'right') return text.x - lineWidth\n" +
        '    return text.x - lineWidth / 2\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Calculates one line baseline from KiCad vertical justification.\n' +
        ' * @param {object} text Text item.\n' +
        ' * @param {number} index Line index.\n' +
        ' * @param {number} lineCount Total line count.\n' +
        ' * @param {number} lineSpacing Line spacing.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function textLineY(text, index, lineCount, lineSpacing) {\n' +
        '    const height = textHeight(text)\n' +
        '    const blockHeight =\n' +
        '        height * kicadFirstLineHeightRatio + lineSpacing * (lineCount - 1)\n' +
        '    let baseline = text.y + height - textStrokeBaselineFudge(text)\n' +
        '\n' +
        "    if (text.vAlign === 'bottom') {\n" +
        '        baseline -= blockHeight\n' +
        "    } else if (text.vAlign === 'center') {\n" +
        '        baseline -= blockHeight / 2\n' +
        '    }\n' +
        '\n' +
        '    return baseline + lineSpacing * index\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        " * Mirrors KiCad's small stroke-font baseline adjustment.\n" +
        ' * @param {object} text Text item.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function textStrokeBaselineFudge(text) {\n' +
        '    return textStrokeWidth(text) * kicadStrokeBaselineFudgeRatio\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Resolves KiCad text stroke width.\n' +
        ' * @param {object} text Text item.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function textStrokeWidth(text) {\n' +
        '    return Math.max(Number(text.thickness) || 0.12, 0.01)\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Converts points to an SVG path.\n' +
        ' * @param {{ x: number, y: number }[]} points Points.\n' +
        ' * @returns {string}\n' +
        ' */\n' +
        'function pathFromPoints(points) {\n' +
        "    if (!points.length) return ''\n" +
        '    const [first, ...rest] = points\n' +
        '    const commands = [`M ${formatNumber(first.x)} ${formatNumber(first.y)}`]\n' +
        '    rest.forEach((point) => {\n' +
        '        commands.push(`L ${formatNumber(point.x)} ${formatNumber(point.y)}`)\n' +
        '    })\n' +
        "    return commands.join(' ')\n" +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Returns the file basename.\n'

    static #schematicParserFontOriginal =
        'function parseTextFont(node) {\n' +
        "    const effects = child(node, 'effects')\n" +
        "    const font = child(effects, 'font')\n" +
        "    const size = child(font, 'size') || ['size', 1.27, 1.27]\n" +
        "    const justify = child(effects, 'justify') || []\n" +
        '    return {\n' +
        '        size: numberValue(size[2], numberValue(size[1], 1.27)),\n' +
        "        hAlign: firstJustify(justify, ['left', 'center', 'right']) || 'left',\n" +
        "        vAlign: firstJustify(justify, ['top', 'center', 'bottom']) || 'bottom'\n" +
        '    }\n' +
        '}'

    static #schematicParserFontPatched =
        'function parseTextFont(node) {\n' +
        "    const effects = child(node, 'effects')\n" +
        "    const font = child(effects, 'font')\n" +
        "    const size = child(font, 'size') || ['size', 1.27, 1.27]\n" +
        "    const justify = child(effects, 'justify') || []\n" +
        '    const width = numberValue(size[1], 1.27)\n' +
        '    const height = numberValue(size[2], width)\n' +
        '    return {\n' +
        '        size: height,\n' +
        '        width,\n' +
        '        height,\n' +
        "        hAlign: firstJustify(justify, ['left', 'center', 'right']) || 'left',\n" +
        "        vAlign: firstJustify(justify, ['top', 'center', 'bottom']) || 'center'\n" +
        '    }\n' +
        '}'

    static #schematicParserFontPatchedBottom =
        'function parseTextFont(node) {\n' +
        "    const effects = child(node, 'effects')\n" +
        "    const font = child(effects, 'font')\n" +
        "    const size = child(font, 'size') || ['size', 1.27, 1.27]\n" +
        "    const justify = child(effects, 'justify') || []\n" +
        '    const width = numberValue(size[1], 1.27)\n' +
        '    const height = numberValue(size[2], width)\n' +
        '    return {\n' +
        '        size: height,\n' +
        '        width,\n' +
        '        height,\n' +
        "        hAlign: firstJustify(justify, ['left', 'center', 'right']) || 'left',\n" +
        "        vAlign: firstJustify(justify, ['top', 'center', 'bottom']) || 'bottom'\n" +
        '    }\n' +
        '}'

    static #schematicParserPropertyTransformOriginal =
        '    const texts = parseSymbolPropertyTexts(properties, uuid, {\n' +
        '        mirror,\n' +
        '        powerSymbol: isPowerSymbol(librarySymbol, libId)\n' +
        '    })'

    static #schematicParserPropertyTransformPatched =
        '    const texts = parseSymbolPropertyTexts(properties, uuid, {\n' +
        '        mirror,\n' +
        '        rotation: at.rotation,\n' +
        '        powerSymbol: isPowerSymbol(librarySymbol, libId)\n' +
        '    })'

    static #schematicParserPinEndpointTransformOriginal =
        '    const pins = KicadSchematicSymbolParser.parsePins(\n' +
        '        librarySymbol,\n' +
        '        uuid,\n' +
        '        transform,\n' +
        '        selection\n' +
        '    )'

    static #schematicParserPinEndpointTransformPatched =
        '    const pins = KicadSchematicSymbolParser.parsePins(\n' +
        '        librarySymbol,\n' +
        '        uuid,\n' +
        '        {\n' +
        '            ...transform,\n' +
        '            endpointVisible: hasConnectorPinEndpointMarkers(libId)\n' +
        '        },\n' +
        '        selection\n' +
        '    )'

    static #schematicParserPinEndpointHelperOriginal =
        '/**\n' + ' * Parses visible symbol property text.\n'

    static #schematicParserPinEndpointHelperPatched =
        '/**\n' +
        ' * Checks whether a symbol family displays circular connector pin endpoints.\n' +
        ' * @param {string} libId Symbol library id.\n' +
        ' * @returns {boolean}\n' +
        ' */\n' +
        'function hasConnectorPinEndpointMarkers(libId) {\n' +
        "    return /^Connector_Generic:Conn_/u.test(String(libId || ''))\n" +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Parses visible symbol property text.\n'

    static #schematicParserPropertyRotationOriginal =
        '            rotation: property.rotation,\n'

    static #schematicParserPropertyRotationPatched =
        '            rotation: symbolPropertyTextRotation(property, transform),\n'

    static #schematicParserPropertyRotationHelperOriginal =
        '/**\n' +
        ' * Mirrors horizontal text justification for mirrored symbols.\n'

    static #schematicParserPropertyRotationHelperPatched =
        '/**\n' +
        ' * Resolves visible field rotation for placed symbol properties.\n' +
        ' * @param {object} property Symbol property.\n' +
        ' * @param {{ rotation?: number }} transform Symbol placement transform.\n' +
        ' * @returns {number}\n' +
        ' */\n' +
        'function symbolPropertyTextRotation(property, transform) {\n' +
        '    const propertyRotation = numberValue(property?.rotation, 0)\n' +
        '    if (Math.abs(propertyRotation) > 0.001) return propertyRotation\n' +
        '\n' +
        '    const symbolRotation = numberValue(transform?.rotation, 0)\n' +
        '    const normalized = ((symbolRotation % 360) + 360) % 360\n' +
        '    if (Math.abs(normalized - 90) < 0.001) return 90\n' +
        '    if (Math.abs(normalized - 270) < 0.001) return 270\n' +
        '    return propertyRotation\n' +
        '}\n' +
        '\n' +
        '/**\n' +
        ' * Mirrors horizontal text justification for mirrored symbols.\n'

    static #schematicSymbolParserEndpointOriginal =
        '                labelColor: defaultInkColor,\n' +
        "                labelMode: 'number-only',\n" +
        '                ownerIndex\n'

    static #schematicSymbolParserEndpointPatched =
        '                labelColor: defaultInkColor,\n' +
        "                labelMode: 'number-only',\n" +
        '                endpointVisible: Boolean(transform.endpointVisible),\n' +
        '                ownerIndex\n'

    /**
     * Applies local toolkit patches.
     * @returns {Promise<void>}
     */
    static async run() {
        if (await AltiumToolkitPatcher.#usesUpstreamPatchedToolkits()) {
            return
        }

        await AltiumToolkitPatcher.#applyPatch({
            sourcePath: AltiumToolkitPatcher.#resolveRawRecordSourcePath(),
            original: AltiumToolkitPatcher.#rawRecordOriginal,
            patched: AltiumToolkitPatcher.#rawRecordPatched,
            label: 'raw-record collection'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath: AltiumToolkitPatcher.#resolveRendererSourcePath(),
            original: AltiumToolkitPatcher.#footprintDetailOriginal,
            patched: AltiumToolkitPatcher.#footprintDetailPatched,
            label: 'PCB fallback body ownership'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath: AltiumToolkitPatcher.#resolveRendererSourcePath(),
            original: AltiumToolkitPatcher.#componentOwnedOriginal,
            patched: AltiumToolkitPatcher.#componentOwnedPatched,
            label: 'PCB fallback body ownership helper'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath:
                AltiumToolkitPatcher.#resolveKicadSchematicRendererPath(),
            original: AltiumToolkitPatcher.#schematicImportOriginal,
            patched: AltiumToolkitPatcher.#schematicImportPatched,
            label: 'KiCad schematic stroke-font import'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath:
                AltiumToolkitPatcher.#resolveKicadSchematicRendererPath(),
            original: AltiumToolkitPatcher.#schematicPinMarkerColorOriginal,
            patched: AltiumToolkitPatcher.#schematicPinMarkerColorPatched,
            label: 'KiCad schematic pin marker color'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath:
                AltiumToolkitPatcher.#resolveKicadSchematicRendererPath(),
            original: AltiumToolkitPatcher.#schematicRenderTextsOriginal,
            patched: AltiumToolkitPatcher.#schematicRenderTextsPatched,
            label: 'KiCad schematic text rendering'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath:
                AltiumToolkitPatcher.#resolveKicadSchematicRendererPath(),
            original: AltiumToolkitPatcher.#schematicPinNumberOriginal,
            patched: AltiumToolkitPatcher.#schematicPinNumberPatched,
            label: 'KiCad schematic pin number rendering'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath:
                AltiumToolkitPatcher.#resolveKicadSchematicRendererPath(),
            original: AltiumToolkitPatcher.#schematicPinEndpointCallOriginal,
            patched: AltiumToolkitPatcher.#schematicPinEndpointCallPatched,
            label: 'KiCad schematic pin endpoint rendering'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath:
                AltiumToolkitPatcher.#resolveKicadSchematicRendererPath(),
            original: AltiumToolkitPatcher.#schematicPinEndpointHelperOriginal,
            patched: AltiumToolkitPatcher.#schematicPinEndpointHelperPatched,
            label: 'KiCad schematic pin endpoint helper'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath:
                AltiumToolkitPatcher.#resolveKicadSchematicRendererPath(),
            original: AltiumToolkitPatcher.#schematicTextHelpersOriginal,
            patched: AltiumToolkitPatcher.#schematicTextHelpersPatched,
            label: 'KiCad schematic text helpers'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath:
                AltiumToolkitPatcher.#resolveKicadSchematicRendererPath(),
            original: AltiumToolkitPatcher.#schematicMetricsOriginal,
            patched: AltiumToolkitPatcher.#schematicMetricsPatched,
            label: 'KiCad schematic text metrics'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath: AltiumToolkitPatcher.#resolveKicadSchematicParserPath(),
            original: [
                AltiumToolkitPatcher.#schematicParserFontOriginal,
                AltiumToolkitPatcher.#schematicParserFontPatchedBottom
            ],
            patched: AltiumToolkitPatcher.#schematicParserFontPatched,
            label: 'KiCad schematic parser text font dimensions'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath: AltiumToolkitPatcher.#resolveKicadSchematicParserPath(),
            original:
                AltiumToolkitPatcher.#schematicParserPropertyTransformOriginal,
            patched:
                AltiumToolkitPatcher.#schematicParserPropertyTransformPatched,
            label: 'KiCad schematic parser property transform'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath: AltiumToolkitPatcher.#resolveKicadSchematicParserPath(),
            original:
                AltiumToolkitPatcher
                    .#schematicParserPinEndpointTransformOriginal,
            patched:
                AltiumToolkitPatcher
                    .#schematicParserPinEndpointTransformPatched,
            label: 'KiCad schematic parser pin endpoint transform'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath: AltiumToolkitPatcher.#resolveKicadSchematicParserPath(),
            original:
                AltiumToolkitPatcher.#schematicParserPinEndpointHelperOriginal,
            patched:
                AltiumToolkitPatcher.#schematicParserPinEndpointHelperPatched,
            label: 'KiCad schematic parser pin endpoint helper'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath: AltiumToolkitPatcher.#resolveKicadSchematicParserPath(),
            original:
                AltiumToolkitPatcher.#schematicParserPropertyRotationOriginal,
            patched:
                AltiumToolkitPatcher.#schematicParserPropertyRotationPatched,
            label: 'KiCad schematic parser property rotation'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath: AltiumToolkitPatcher.#resolveKicadSchematicParserPath(),
            original:
                AltiumToolkitPatcher
                    .#schematicParserPropertyRotationHelperOriginal,
            patched:
                AltiumToolkitPatcher
                    .#schematicParserPropertyRotationHelperPatched,
            label: 'KiCad schematic parser property rotation helper'
        })
        await AltiumToolkitPatcher.#applyPatch({
            sourcePath:
                AltiumToolkitPatcher.#resolveKicadSchematicSymbolParserPath(),
            original:
                AltiumToolkitPatcher.#schematicSymbolParserEndpointOriginal,
            patched: AltiumToolkitPatcher.#schematicSymbolParserEndpointPatched,
            label: 'KiCad schematic symbol parser pin endpoint flag'
        })
    }

    /**
     * Applies one text patch idempotently.
     * @param {{ sourcePath: string, original: string | string[], patched: string, label: string }} patch
     * @returns {Promise<void>}
     */
    static async #applyPatch(patch) {
        const source = await readFile(patch.sourcePath, 'utf8')
        const originals = Array.isArray(patch.original)
            ? patch.original
            : [patch.original]

        if (source.includes(patch.patched)) {
            return
        }

        const original = originals.find((candidate) =>
            source.includes(candidate)
        )
        if (!original) {
            throw new Error(
                'Unable to patch altium-toolkit: expected ' +
                    patch.label +
                    ' block was not found.'
            )
        }

        await writeFile(
            patch.sourcePath,
            source.replace(original, patch.patched)
        )
    }

    /**
     * Returns true when installed toolkit releases already include these fixes.
     * @returns {Promise<boolean>}
     */
    static async #usesUpstreamPatchedToolkits() {
        const [altiumVersion, kicadVersion] = await Promise.all([
            AltiumToolkitPatcher.#readPackageVersion('altium-toolkit'),
            AltiumToolkitPatcher.#readPackageVersion('kicad-toolkit')
        ])

        return (
            AltiumToolkitPatcher.#isAtLeastVersion(altiumVersion, '0.1.17') &&
            AltiumToolkitPatcher.#isAtLeastVersion(kicadVersion, '0.2.15')
        )
    }

    /**
     * Reads the installed npm package version.
     * @param {string} packageName
     * @returns {Promise<string>}
     */
    static async #readPackageVersion(packageName) {
        const packageJson = JSON.parse(
            await readFile(
                AltiumToolkitPatcher.#resolvePackageManifestPath(packageName),
                'utf8'
            )
        )

        return String(packageJson.version || '')
    }

    /**
     * Compares semantic version strings by major, minor, and patch numbers.
     * @param {string} version
     * @param {string} minimum
     * @returns {boolean}
     */
    static #isAtLeastVersion(version, minimum) {
        const currentParts = AltiumToolkitPatcher.#versionParts(version)
        const minimumParts = AltiumToolkitPatcher.#versionParts(minimum)

        for (let index = 0; index < minimumParts.length; index += 1) {
            if (currentParts[index] > minimumParts[index]) {
                return true
            }
            if (currentParts[index] < minimumParts[index]) {
                return false
            }
        }

        return true
    }

    /**
     * Extracts major, minor, and patch numbers from one version string.
     * @param {string} version
     * @returns {number[]}
     */
    static #versionParts(version) {
        return String(version)
            .split(/[.-]/u)
            .slice(0, 3)
            .map((part) => Number(part) || 0)
    }

    /**
     * Resolves an installed toolkit package manifest path.
     * @param {string} packageName
     * @returns {string}
     */
    static #resolvePackageManifestPath(packageName) {
        const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
        return path.resolve(
            scriptDirectory,
            '..',
            'node_modules',
            packageName,
            'package.json'
        )
    }

    /**
     * Resolves the installed raw-record registry source path.
     * @returns {string}
     */
    static #resolveRawRecordSourcePath() {
        const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
        return path.resolve(
            scriptDirectory,
            '..',
            'node_modules',
            'altium-toolkit',
            'src',
            'core',
            'altium',
            'PcbRawRecordRegistry.mjs'
        )
    }

    /**
     * Resolves the installed PCB SVG renderer source path.
     * @returns {string}
     */
    static #resolveRendererSourcePath() {
        const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
        return path.resolve(
            scriptDirectory,
            '..',
            'node_modules',
            'altium-toolkit',
            'src',
            'ui',
            'PcbSvgRenderer.mjs'
        )
    }

    /**
     * Resolves the installed KiCad schematic SVG renderer source path.
     * @returns {string}
     */
    static #resolveKicadSchematicRendererPath() {
        const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
        return path.resolve(
            scriptDirectory,
            '..',
            'node_modules',
            'kicad-toolkit',
            'src',
            'ui',
            'SchematicSvgRenderer.mjs'
        )
    }

    /**
     * Resolves the installed KiCad schematic parser source path.
     * @returns {string}
     */
    static #resolveKicadSchematicParserPath() {
        const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
        return path.resolve(
            scriptDirectory,
            '..',
            'node_modules',
            'kicad-toolkit',
            'src',
            'core',
            'kicad',
            'KicadSchematicParser.mjs'
        )
    }

    /**
     * Resolves the installed KiCad schematic symbol parser source path.
     * @returns {string}
     */
    static #resolveKicadSchematicSymbolParserPath() {
        const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
        return path.resolve(
            scriptDirectory,
            '..',
            'node_modules',
            'kicad-toolkit',
            'src',
            'core',
            'kicad',
            'KicadSchematicSymbolParser.mjs'
        )
    }
}

await AltiumToolkitPatcher.run()
