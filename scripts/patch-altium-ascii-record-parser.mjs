import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Applies local Altium schematic parser and renderer patches until upstream
 * altium-toolkit includes them.
 */
class AltiumSchematicPatcher {
    static #parseRecordOriginal =
        '        return { raw, fields }\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Converts one binary string into bytes without altering byte values.'

    static #parseRecordPatched =
        '        return {\n' +
        '            raw,\n' +
        '            fields: AsciiRecordParser.#createCaseInsensitiveFields(fields)\n' +
        '        }\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Wraps parsed fields so consumers can read native records regardless of\n' +
        '     * whether the printable stream used upper, lower, or mixed-case keys.\n' +
        '     * @param {Record<string, string | string[]>} fields\n' +
        '     * @returns {Record<string, string | string[]>}\n' +
        '     */\n' +
        '    static #createCaseInsensitiveFields(fields) {\n' +
        '        const normalizedKeyIndex =\n' +
        '            AsciiRecordParser.#buildCaseInsensitiveFieldIndex(fields)\n' +
        '\n' +
        '        return new Proxy(fields, {\n' +
        '            get(target, property, receiver) {\n' +
        "                if (typeof property !== 'string' || property in target) {\n" +
        '                    return Reflect.get(target, property, receiver)\n' +
        '                }\n' +
        '\n' +
        '                const normalizedKey = normalizedKeyIndex.get(\n' +
        '                    property.toLowerCase()\n' +
        '                )\n' +
        '                return normalizedKey\n' +
        '                    ? Reflect.get(target, normalizedKey, receiver)\n' +
        '                    : undefined\n' +
        '            },\n' +
        '            has(target, property) {\n' +
        "                if (typeof property !== 'string' || property in target) {\n" +
        '                    return Reflect.has(target, property)\n' +
        '                }\n' +
        '\n' +
        '                return normalizedKeyIndex.has(property.toLowerCase())\n' +
        '            }\n' +
        '        })\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Builds a lookup from lower-case field names to their source key.\n' +
        '     * @param {Record<string, string | string[]>} fields\n' +
        '     * @returns {Map<string, string>}\n' +
        '     */\n' +
        '    static #buildCaseInsensitiveFieldIndex(fields) {\n' +
        '        const normalizedKeyIndex = new Map()\n' +
        '\n' +
        '        for (const key of Object.keys(fields)) {\n' +
        '            const normalizedKey = key.toLowerCase()\n' +
        '            if (!normalizedKeyIndex.has(normalizedKey)) {\n' +
        '                normalizedKeyIndex.set(normalizedKey, key)\n' +
        '            }\n' +
        '        }\n' +
        '\n' +
        '        return normalizedKeyIndex\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Converts one binary string into bytes without altering byte values.'

    static #recordLoopOriginal =
        '        const records = []\n' +
        '\n' +
        '        for (const runBytes of runs) {'

    static #recordLoopPatched =
        '        const records = []\n' +
        "        let pendingPrefix = ''\n" +
        '\n' +
        '        for (const runBytes of runs) {'

    static #recordCandidateOriginal =
        '                const candidate = chunk.trim()\n' +
        '                if (!AsciiRecordParser.#isRecordCandidate(candidate)) continue\n' +
        '                records.push(AsciiRecordParser.#parseRecord(candidate))'

    static #recordCandidatePatched =
        '                const candidate = chunk.trim()\n' +
        '                if (!AsciiRecordParser.#isRecordCandidate(candidate)) continue\n' +
        '\n' +
        '                const headerPrefix =\n' +
        '                    AsciiRecordParser.#extractHeaderFieldPrefix(candidate)\n' +
        '                if (headerPrefix) {\n' +
        '                    pendingPrefix += headerPrefix\n' +
        '                    continue\n' +
        '                }\n' +
        '\n' +
        '                if (!AsciiRecordParser.#hasRecordMarker(candidate)) {\n' +
        '                    pendingPrefix += candidate\n' +
        '                    continue\n' +
        '                }\n' +
        '\n' +
        '                records.push(\n' +
        '                    AsciiRecordParser.#parseRecord(pendingPrefix + candidate)\n' +
        '                )\n' +
        "                pendingPrefix = ''"

    static #recordsReturnOriginal =
        '        return records\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Returns true when a printable run looks like an Altium record block.'

    static #recordsReturnPatched =
        '        if (pendingPrefix) {\n' +
        '            records.push(AsciiRecordParser.#parseRecord(pendingPrefix))\n' +
        '        }\n' +
        '\n' +
        '        return records\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Returns true when a printable run looks like an Altium record block.'

    static #recordHelpersOriginal =
        '    static #isRecordCandidate(candidate) {\n' +
        "        if (!candidate.startsWith('|')) return false\n" +
        "        if (!candidate.includes('=')) return false\n" +
        "        return candidate.split('|').length >= 4\n" +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Parses one pipe-delimited record into a field object.'

    static #recordHelpersPatched =
        '    static #isRecordCandidate(candidate) {\n' +
        "        if (!candidate.startsWith('|')) return false\n" +
        "        if (!candidate.includes('=')) return false\n" +
        "        return candidate.split('|').length >= 4\n" +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Returns true when a printable fragment contains its marker field.\n' +
        '     * @param {string} candidate\n' +
        '     * @returns {boolean}\n' +
        '     */\n' +
        '    static #hasRecordMarker(candidate) {\n' +
        '        return /(?:^|\\|)(?:HEADER|RECORD|UNICODE|SELECTION|KIND)=/.test(\n' +
        '            candidate\n' +
        '        )\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Extracts schematic sheet fields that trail a schematic header before the\n' +
        '     * first record.\n' +
        '     * @param {string} candidate\n' +
        '     * @returns {string}\n' +
        '     */\n' +
        '    static #extractHeaderFieldPrefix(candidate) {\n' +
        "        if (!candidate.startsWith('|HEADER=')) {\n" +
        "            return ''\n" +
        '        }\n' +
        '\n' +
        "        const segments = candidate.split('|').filter(Boolean)\n" +
        '        if (segments.length <= 1) {\n' +
        "            return ''\n" +
        '        }\n' +
        "        const headerValue = segments[0].slice('HEADER='.length)\n" +
        '        if (!/^Schematic Document$/i.test(headerValue)) {\n' +
        "            return ''\n" +
        '        }\n' +
        '\n' +
        "        return '|' + segments.slice(1).join('|')\n" +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Parses one pipe-delimited record into a field object.'

    static #textDocParamOriginal =
        '     * @param {{ width: number, marginWidth: number }} sheet'

    static #textDocParamPatched =
        '     * @param {{ width: number, marginWidth: number, titleBlockOn?: boolean }} sheet'

    static #textSkipOriginal =
        "        const normalizedName = String(name || '')\n" +
        '            .trim()\n' +
        '            .toLowerCase()\n' +
        "        const normalizedRawText = String(rawText || '').trim()\n" +
        "        const normalizedText = String(text || '').trim()\n" +
        '        const nonDrawableNames = new Set([\n' +
        "            'kind',\n" +
        "            'subkind',\n" +
        "            'spice prefix',\n" +
        "            'netlist',\n" +
        "            'model',\n" +
        "            'part number',\n" +
        "            'pkg type',\n" +
        "            'description'\n" +
        '        ])\n' +
        '\n' +
        '        if (nonDrawableNames.has(normalizedName)) return true\n' +
        "        if (!normalizedText || normalizedText === '*') return true\n" +
        '        if (/^=/.test(normalizedText)) return true\n' +
        '        if (SchematicTextParser.isTitleBlockFooterRecord(fields, sheet.width)) {\n' +
        '            return true\n' +
        '        }\n' +
        '        if (/^=/.test(normalizedRawText)) return true\n' +
        '\n' +
        '        return /@designator|initial voltage/i.test(normalizedText)'

    static #textSkipPatched =
        "        const normalizedName = String(name || '')\n" +
        '            .trim()\n' +
        '            .toLowerCase()\n' +
        "        const normalizedText = String(text || '').trim()\n" +
        '        const nonDrawableNames = new Set([\n' +
        "            'kind',\n" +
        "            'subkind',\n" +
        "            'spice prefix',\n" +
        "            'netlist',\n" +
        "            'model',\n" +
        "            'part number',\n" +
        "            'pkg type',\n" +
        "            'description',\n" +
        "            'vendor',\n" +
        "            'manufacturer',\n" +
        "            'supplier',\n" +
        "            'ic',\n" +
        "            'pinuniqueid',\n" +
        "            'differentialpair'\n" +
        '        ])\n' +
        '\n' +
        '        if (nonDrawableNames.has(normalizedName)) return true\n' +
        '        if (/uniqueid$/i.test(normalizedName)) return true\n' +
        "        if (!normalizedText || normalizedText === '*') return true\n" +
        '        if (/^=/.test(normalizedText)) return true\n' +
        '        if (\n' +
        '            sheet.titleBlockOn &&\n' +
        '            SchematicTextParser.isTitleBlockFooterRecord(fields, sheet.width)\n' +
        '        ) {\n' +
        '            return true\n' +
        '        }\n' +
        '\n' +
        '        return /@designator|initial voltage/i.test(normalizedText)'

    static #pinLineStyleOriginal =
        '        const segments = []\n' +
        '        const lineStyle =\n' +
        "            ParserUtils.parseNumericField(fields, 'LineStyle') || 0"

    static #pinLineStylePatched =
        '        const segments = []\n' +
        '        const lineStyle = SchematicPinParser.#resolveSchematicLineStyle(fields)'

    static #pinHelperOriginal =
        '        return segments\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Deduces the visible pins for one schematic symbol owner.'

    static #pinHelperPatched =
        '        return segments\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        "     * Resolves Altium's legacy and extended schematic line style fields.\n" +
        '     * @param {Record<string, string | string[]>} fields\n' +
        '     * @returns {number}\n' +
        '     */\n' +
        '    static #resolveSchematicLineStyle(fields) {\n' +
        '        const extendedStyle = ParserUtils.parseNumericField(\n' +
        '            fields,\n' +
        "            'LineStyleExt'\n" +
        '        )\n' +
        '\n' +
        '        if (extendedStyle !== null) {\n' +
        '            return extendedStyle\n' +
        '        }\n' +
        '\n' +
        "        return ParserUtils.parseNumericField(fields, 'LineStyle') || 0\n" +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Deduces the visible pins for one schematic symbol owner.'

    static #svgLineStyleOriginal =
        '    static #buildSchematicLineStyleAttributes(line) {\n' +
        '        if (Number(line.lineStyle || 0) !== 1) {\n' +
        "            return ''\n" +
        '        }\n' +
        '        const dashLength = Math.max(Number(line.width || 1) * 8, 8)\n' +
        '        const gapLength = Math.max(Number(line.width || 1) * 5, 5)\n' +
        '        return (\n' +
        "            ' stroke-dasharray=\"' +\n" +
        '            formatNumber(dashLength) +\n' +
        "            ' ' +\n" +
        '            formatNumber(gapLength) +\n' +
        '            \'" stroke-linecap="round"\'\n' +
        '        )\n' +
        '    }'

    static #svgLineStylePatched =
        '    static #buildSchematicLineStyleAttributes(line) {\n' +
        '        const lineStyle = Number(line.lineStyle || 0)\n' +
        "        if (lineStyle !== 1 && lineStyle !== 2 && lineStyle !== 3) return ''\n" +
        '\n' +
        '        const dashLength = Math.max(Number(line.width || 1) * 8, 8)\n' +
        '        const gapLength = Math.max(Number(line.width || 1) * 5, 5)\n' +
        '        const dotLength = Math.max(Number(line.width || 1) * 1.5, 1.5)\n' +
        '        const dashPattern =\n' +
        '            lineStyle === 1\n' +
        '                ? [dashLength, gapLength]\n' +
        '                : lineStyle === 2\n' +
        '                  ? [dotLength, gapLength]\n' +
        '                  : [dashLength, gapLength, dotLength, gapLength]\n' +
        '\n' +
        '        return (\n' +
        "            ' stroke-dasharray=\"' +\n" +
        "            dashPattern.map((part) => formatNumber(part)).join(' ') +\n" +
        '            \'" stroke-linecap="round"\'\n' +
        '        )\n' +
        '    }'

    static #shapeLineStyleOriginal =
        '    static #buildSchematicStrokeStyleAttributes(lineWidth, lineStyle) {\n' +
        '        if (Number(lineStyle || 0) !== 1) {\n' +
        "            return ''\n" +
        '        }\n' +
        '\n' +
        '        const dashLength = Math.max(Number(lineWidth || 1) * 8, 8)\n' +
        '        const gapLength = Math.max(Number(lineWidth || 1) * 5, 5)\n' +
        '\n' +
        '        return (\n' +
        "            ' stroke-dasharray=\"' +\n" +
        '            formatNumber(dashLength) +\n' +
        "            ' ' +\n" +
        '            formatNumber(gapLength) +\n' +
        '            \'" stroke-linecap="round"\'\n' +
        '        )\n' +
        '    }'

    static #shapeLineStylePatched =
        '    static #buildSchematicStrokeStyleAttributes(lineWidth, lineStyle) {\n' +
        '        const resolvedLineStyle = Number(lineStyle || 0)\n' +
        '        if (\n' +
        '            resolvedLineStyle !== 1 &&\n' +
        '            resolvedLineStyle !== 2 &&\n' +
        '            resolvedLineStyle !== 3\n' +
        '        )\n' +
        "            return ''\n" +
        '\n' +
        '        const dashLength = Math.max(Number(lineWidth || 1) * 8, 8)\n' +
        '        const gapLength = Math.max(Number(lineWidth || 1) * 5, 5)\n' +
        '        const dotLength = Math.max(Number(lineWidth || 1) * 1.5, 1.5)\n' +
        '        const dashPattern =\n' +
        '            resolvedLineStyle === 1\n' +
        '                ? [dashLength, gapLength]\n' +
        '                : resolvedLineStyle === 2\n' +
        '                  ? [dotLength, gapLength]\n' +
        '                  : [dashLength, gapLength, dotLength, gapLength]\n' +
        '\n' +
        '        return (\n' +
        "            ' stroke-dasharray=\"' +\n" +
        "            dashPattern.map((part) => formatNumber(part)).join(' ') +\n" +
        '            \'" stroke-linecap="round"\'\n' +
        '        )\n' +
        '    }'

    static #contentLayoutScaleOriginal =
        '        const virtualInnerWidth = virtualSourceSheet.width - margin * 2\n' +
        '        const scale = (width - margin * 2) / virtualInnerWidth\n' +
        '\n' +
        '        if (!Number.isFinite(scale) || scale <= 1) {\n' +
        "            return ''\n" +
        '        }\n' +
        '\n' +
        '        const pivotX = margin\n' +
        '        const pivotY = height - margin\n' +
        '        const projectedMinX = pivotX + (bounds.minX - pivotX) * scale\n' +
        '        const projectedMaxX = pivotX + (bounds.maxX - pivotX) * scale\n' +
        '        const projectedMinY = pivotY + (bounds.minY - pivotY) * scale\n' +
        '        const projectedMaxY = pivotY + (bounds.maxY - pivotY) * scale\n' +
        '        const topLimit = margin + contentPadding\n' +
        '        const bottomLimit = height - margin - footerReserve\n' +
        '        const rightLimit = width - margin\n' +
        '\n' +
        '        if (\n' +
        '            projectedMinX < margin ||\n' +
        '            projectedMaxX > rightLimit ||\n' +
        '            projectedMinY < topLimit ||\n' +
        '            projectedMaxY > bottomLimit\n' +
        '        ) {\n' +
        "            return ''\n" +
        '        }'

    static #contentLayoutScalePatched =
        '        const virtualInnerWidth = virtualSourceSheet.width - margin * 2\n' +
        '        const targetScale = (width - margin * 2) / virtualInnerWidth\n' +
        '\n' +
        '        if (!Number.isFinite(targetScale) || targetScale <= 1) {\n' +
        "            return ''\n" +
        '        }\n' +
        '\n' +
        '        const pivotX = margin\n' +
        '        const pivotY = height - margin\n' +
        '        const topLimit = margin + contentPadding * 0.2\n' +
        '        const bottomLimit = height - margin - footerReserve\n' +
        '        const rightLimit = width - margin\n' +
        '        const scale = Math.min(\n' +
        '            targetScale,\n' +
        '            ...SchematicContentLayout.#resolvePivotScaleLimits(\n' +
        '                bounds,\n' +
        '                pivotX,\n' +
        '                pivotY,\n' +
        '                margin,\n' +
        '                topLimit,\n' +
        '                rightLimit,\n' +
        '                bottomLimit\n' +
        '            )\n' +
        '        )\n' +
        '\n' +
        '        if (!Number.isFinite(scale) || scale <= 1) {\n' +
        "            return ''\n" +
        '        }\n' +
        '\n' +
        '        const projectedMinX = pivotX + (bounds.minX - pivotX) * scale\n' +
        '        const projectedMaxX = pivotX + (bounds.maxX - pivotX) * scale\n' +
        '        const projectedMinY = pivotY + (bounds.minY - pivotY) * scale\n' +
        '        const projectedMaxY = pivotY + (bounds.maxY - pivotY) * scale\n' +
        '\n' +
        '        if (\n' +
        '            projectedMinX < margin - 0.01 ||\n' +
        '            projectedMaxX > rightLimit + 0.01 ||\n' +
        '            projectedMinY < topLimit - 0.01 ||\n' +
        '            projectedMaxY > bottomLimit + 0.01\n' +
        '        ) {\n' +
        "            return ''\n" +
        '        }'

    static #contentLayoutScaleHelpersOriginal =
        '    /**\n' +
        '     * Resolves the maximum sheet-wide scale implied by source and normalized\n'

    static #contentLayoutScaleHelpersPatched =
        '    /**\n' +
        '     * Resolves per-edge maximum scale factors for a bottom-left pivot.\n' +
        '     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds\n' +
        '     * @param {number} pivotX\n' +
        '     * @param {number} pivotY\n' +
        '     * @param {number} leftLimit\n' +
        '     * @param {number} topLimit\n' +
        '     * @param {number} rightLimit\n' +
        '     * @param {number} bottomLimit\n' +
        '     * @returns {number[]}\n' +
        '     */\n' +
        '    static #resolvePivotScaleLimits(\n' +
        '        bounds,\n' +
        '        pivotX,\n' +
        '        pivotY,\n' +
        '        leftLimit,\n' +
        '        topLimit,\n' +
        '        rightLimit,\n' +
        '        bottomLimit\n' +
        '    ) {\n' +
        '        return [\n' +
        '            SchematicContentLayout.#resolvePivotScaleLimit(\n' +
        '                pivotX,\n' +
        '                bounds.minX,\n' +
        '                leftLimit,\n' +
        "                'min'\n" +
        '            ),\n' +
        '            SchematicContentLayout.#resolvePivotScaleLimit(\n' +
        '                pivotX,\n' +
        '                bounds.maxX,\n' +
        '                rightLimit,\n' +
        "                'max'\n" +
        '            ),\n' +
        '            SchematicContentLayout.#resolvePivotScaleLimit(\n' +
        '                pivotY,\n' +
        '                bounds.minY,\n' +
        '                topLimit,\n' +
        "                'min'\n" +
        '            ),\n' +
        '            SchematicContentLayout.#resolvePivotScaleLimit(\n' +
        '                pivotY,\n' +
        '                bounds.maxY,\n' +
        '                bottomLimit,\n' +
        "                'max'\n" +
        '            )\n' +
        '        ]\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Resolves one axis scale cap from an edge limit.\n' +
        '     * @param {number} pivot\n' +
        '     * @param {number} coordinate\n' +
        '     * @param {number} limit\n' +
        "     * @param {'min' | 'max'} mode\n" +
        '     * @returns {number}\n' +
        '     */\n' +
        '    static #resolvePivotScaleLimit(pivot, coordinate, limit, mode) {\n' +
        "        if (mode === 'min') {\n" +
        '            return coordinate < pivot\n' +
        '                ? (pivot - limit) / (pivot - coordinate)\n' +
        '                : Infinity\n' +
        '        }\n' +
        '\n' +
        '        return coordinate > pivot\n' +
        '            ? (limit - pivot) / (coordinate - pivot)\n' +
        '            : Infinity\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Resolves the maximum sheet-wide scale implied by source and normalized\n'

    static #contentLayoutComponentBoundsOriginal =
        '        for (const component of schematic?.components || []) {\n' +
        '            coordinates.push([\n' +
        '                component.x,\n' +
        '                projectSchematicY(sheetHeight, component.y)\n' +
        '            ])\n' +
        '        }'

    static #contentLayoutComponentBoundsPatched =
        '        for (const component of schematic?.components || []) {\n' +
        '            if (!SchematicContentLayout.#isDrawableComponentAnchor(component)) {\n' +
        '                continue\n' +
        '            }\n' +
        '\n' +
        '            coordinates.push([\n' +
        '                component.x,\n' +
        '                projectSchematicY(sheetHeight, component.y)\n' +
        '            ])\n' +
        '        }'

    static #contentLayoutComponentHelperOriginal =
        '    /**\n' +
        '     * Projects authored rectangles or regions into rendered SVG bounds.\n'

    static #contentLayoutComponentHelperPatched =
        '    /**\n' +
        '     * Returns true when one component anchor can produce visible fallback\n' +
        '     * markup and should therefore influence layout bounds.\n' +
        '     * @param {{ x?: number, y?: number, designator?: string }} component\n' +
        '     * @returns {boolean}\n' +
        '     */\n' +
        '    static #isDrawableComponentAnchor(component) {\n' +
        '        if (!component) return false\n' +
        '\n' +
        '        const hasCoordinates =\n' +
        '            Number.isFinite(component.x) &&\n' +
        '            Number.isFinite(component.y) &&\n' +
        '            (component.x !== 0 || component.y !== 0)\n' +
        '        const hasDesignator =\n' +
        "            Boolean(component.designator) && component.designator !== 'U?'\n" +
        '\n' +
        '        return hasCoordinates && hasDesignator\n' +
        '    }\n' +
        '\n' +
        '    /**\n' +
        '     * Projects authored rectangles or regions into rendered SVG bounds.\n'

    /**
     * Applies the patch when the installed package still needs it.
     * @returns {Promise<void>}
     */
    static async run() {
        if (await AltiumSchematicPatcher.#usesUpstreamPatch()) {
            return
        }

        await AltiumSchematicPatcher.#patchAsciiRecordParser()
        await AltiumSchematicPatcher.#patchTextParser()
        await AltiumSchematicPatcher.#patchPinParser()
        await AltiumSchematicPatcher.#patchSvgRenderer()
        await AltiumSchematicPatcher.#patchShapeRenderer()
        await AltiumSchematicPatcher.#patchContentLayout()
    }

    /**
     * Applies printable-record parsing patches.
     * @returns {Promise<void>}
     */
    static async #patchAsciiRecordParser() {
        const sourcePath = AltiumSchematicPatcher.#resolveSourcePath(
            'src',
            'core',
            'altium',
            'AsciiRecordParser.mjs'
        )
        let source = await readFile(sourcePath, 'utf8')

        source = AltiumSchematicPatcher.#replaceOnceIfMissing({
            source,
            original: AltiumSchematicPatcher.#recordLoopOriginal,
            patched: AltiumSchematicPatcher.#recordLoopPatched,
            sentinel: 'let pendingPrefix =',
            label: 'ASCII record prefix state'
        })
        source = AltiumSchematicPatcher.#replaceOnceIfMissing({
            source,
            original: AltiumSchematicPatcher.#recordCandidateOriginal,
            patched: AltiumSchematicPatcher.#recordCandidatePatched,
            sentinel: '#extractHeaderFieldPrefix(candidate)',
            label: 'ASCII record prefix merge'
        })
        source = AltiumSchematicPatcher.#replaceOnceIfMissing({
            source,
            original: AltiumSchematicPatcher.#recordsReturnOriginal,
            patched: AltiumSchematicPatcher.#recordsReturnPatched,
            sentinel:
                'records.push(AsciiRecordParser.#parseRecord(pendingPrefix))',
            label: 'ASCII trailing prefix flush'
        })
        source = AltiumSchematicPatcher.#replaceOnceIfMissing({
            source,
            original: AltiumSchematicPatcher.#recordHelpersOriginal,
            patched: AltiumSchematicPatcher.#recordHelpersPatched,
            sentinel: 'static #hasRecordMarker(candidate)',
            label: 'ASCII marker helpers'
        })
        source = AltiumSchematicPatcher.#replaceOnceIfMissing({
            source,
            original: AltiumSchematicPatcher.#parseRecordOriginal,
            patched: AltiumSchematicPatcher.#parseRecordPatched,
            sentinel: 'AsciiRecordParser.#createCaseInsensitiveFields(fields)',
            label: 'ASCII case-insensitive fields'
        })

        await writeFile(sourcePath, source)
    }

    /**
     * Applies schematic text filtering patches.
     * @returns {Promise<void>}
     */
    static async #patchTextParser() {
        const sourcePath = AltiumSchematicPatcher.#resolveSourcePath(
            'src',
            'core',
            'altium',
            'SchematicTextParser.mjs'
        )
        let source = await readFile(sourcePath, 'utf8')

        source = source.replaceAll(
            AltiumSchematicPatcher.#textDocParamOriginal,
            AltiumSchematicPatcher.#textDocParamPatched
        )
        source = AltiumSchematicPatcher.#replaceOnceIfMissing({
            source,
            original: AltiumSchematicPatcher.#textSkipOriginal,
            patched: AltiumSchematicPatcher.#textSkipPatched,
            sentinel: "'pinuniqueid'",
            label: 'schematic internal text filtering'
        })

        await writeFile(sourcePath, source)
    }

    /**
     * Applies schematic primitive line-style parsing patches.
     * @returns {Promise<void>}
     */
    static async #patchPinParser() {
        const sourcePath = AltiumSchematicPatcher.#resolveSourcePath(
            'src',
            'core',
            'altium',
            'SchematicPinParser.mjs'
        )
        let source = await readFile(sourcePath, 'utf8')

        if (!source.includes('static #resolveSchematicLineStyle(fields)')) {
            source = AltiumSchematicPatcher.#replaceAllRequired(
                source,
                AltiumSchematicPatcher.#pinLineStyleOriginal,
                AltiumSchematicPatcher.#pinLineStylePatched,
                2,
                'schematic extended line-style reads'
            )
            source = AltiumSchematicPatcher.#replaceOnce(
                source,
                AltiumSchematicPatcher.#pinHelperOriginal,
                AltiumSchematicPatcher.#pinHelperPatched,
                'schematic extended line-style helper'
            )
        }

        await writeFile(sourcePath, source)
    }

    /**
     * Applies schematic SVG line-style rendering patches.
     * @returns {Promise<void>}
     */
    static async #patchSvgRenderer() {
        const sourcePath = AltiumSchematicPatcher.#resolveSourcePath(
            'src',
            'ui',
            'SchematicSvgRenderer.mjs'
        )
        const source = await readFile(sourcePath, 'utf8')

        await writeFile(
            sourcePath,
            AltiumSchematicPatcher.#replaceOnceIfMissing({
                source,
                original: AltiumSchematicPatcher.#svgLineStyleOriginal,
                patched: AltiumSchematicPatcher.#svgLineStylePatched,
                sentinel: 'const dashPattern =',
                label: 'schematic SVG extended line styles'
            })
        )
    }

    /**
     * Applies schematic shape line-style rendering patches.
     * @returns {Promise<void>}
     */
    static async #patchShapeRenderer() {
        const sourcePath = AltiumSchematicPatcher.#resolveSourcePath(
            'src',
            'ui',
            'SchematicShapeRenderer.mjs'
        )
        const source = await readFile(sourcePath, 'utf8')

        await writeFile(
            sourcePath,
            AltiumSchematicPatcher.#replaceOnceIfMissing({
                source,
                original: AltiumSchematicPatcher.#shapeLineStyleOriginal,
                patched: AltiumSchematicPatcher.#shapeLineStylePatched,
                sentinel: 'const dashPattern =',
                label: 'schematic shape extended line styles'
            })
        )
    }

    /**
     * Applies schematic content layout scaling patches.
     * @returns {Promise<void>}
     */
    static async #patchContentLayout() {
        const sourcePath = AltiumSchematicPatcher.#resolveSourcePath(
            'src',
            'ui',
            'SchematicContentLayout.mjs'
        )
        let source = await readFile(sourcePath, 'utf8')

        source = AltiumSchematicPatcher.#replaceOnceIfMissing({
            source,
            original: AltiumSchematicPatcher.#contentLayoutScaleOriginal,
            patched: AltiumSchematicPatcher.#contentLayoutScalePatched,
            sentinel: '#resolvePivotScaleLimits(',
            label: 'schematic sparse custom sheet scale clamp'
        })
        source = AltiumSchematicPatcher.#replaceOnceIfMissing({
            source,
            original: AltiumSchematicPatcher.#contentLayoutScaleHelpersOriginal,
            patched: AltiumSchematicPatcher.#contentLayoutScaleHelpersPatched,
            sentinel: 'static #resolvePivotScaleLimits(',
            label: 'schematic sparse custom sheet scale helpers'
        })
        source = AltiumSchematicPatcher.#replaceOnceIfMissing({
            source,
            original:
                AltiumSchematicPatcher.#contentLayoutComponentBoundsOriginal,
            patched:
                AltiumSchematicPatcher.#contentLayoutComponentBoundsPatched,
            sentinel: '#isDrawableComponentAnchor(component)',
            label: 'schematic hidden component layout bounds'
        })
        source = AltiumSchematicPatcher.#replaceOnceIfMissing({
            source,
            original:
                AltiumSchematicPatcher.#contentLayoutComponentHelperOriginal,
            patched:
                AltiumSchematicPatcher.#contentLayoutComponentHelperPatched,
            sentinel: 'static #isDrawableComponentAnchor(component)',
            label: 'schematic visible component layout helper'
        })

        await writeFile(sourcePath, source)
    }

    /**
     * Replaces one block when the sentinel is not already present.
     * @param {{ source: string, original: string, patched: string, sentinel: string, label: string }} patch
     * @returns {string}
     */
    static #replaceOnceIfMissing({
        source,
        original,
        patched,
        sentinel,
        label
    }) {
        if (source.includes(sentinel)) {
            return source
        }

        return AltiumSchematicPatcher.#replaceOnce(
            source,
            original,
            patched,
            label
        )
    }

    /**
     * Replaces one required source block.
     * @param {string} source
     * @param {string} original
     * @param {string} patched
     * @param {string} label
     * @returns {string}
     */
    static #replaceOnce(source, original, patched, label) {
        if (!source.includes(original)) {
            throw new Error(
                'Unable to patch altium-toolkit: expected ' +
                    label +
                    ' block was not found.'
            )
        }

        return source.replace(original, patched)
    }

    /**
     * Replaces all expected occurrences of a source block.
     * @param {string} source
     * @param {string} original
     * @param {string} patched
     * @param {number} expectedCount
     * @param {string} label
     * @returns {string}
     */
    static #replaceAllRequired(
        source,
        original,
        patched,
        expectedCount,
        label
    ) {
        const occurrences = source.split(original).length - 1
        if (occurrences !== expectedCount) {
            throw new Error(
                'Unable to patch altium-toolkit: expected ' +
                    expectedCount +
                    ' ' +
                    label +
                    ' blocks but found ' +
                    occurrences +
                    '.'
            )
        }

        return source.replaceAll(original, patched)
    }

    /**
     * Returns true when the installed toolkit version already includes this.
     * @returns {Promise<boolean>}
     */
    static async #usesUpstreamPatch() {
        const packageJson = JSON.parse(
            await readFile(
                AltiumSchematicPatcher.#resolveSourcePath('package.json'),
                'utf8'
            )
        )

        return AltiumSchematicPatcher.#isAtLeastVersion(
            String(packageJson.version || ''),
            '0.1.20'
        )
    }

    /**
     * Compares semantic versions by major, minor, and patch.
     * @param {string} version Current version.
     * @param {string} minimum Required minimum.
     * @returns {boolean}
     */
    static #isAtLeastVersion(version, minimum) {
        const currentParts = AltiumSchematicPatcher.#versionParts(version)
        const minimumParts = AltiumSchematicPatcher.#versionParts(minimum)

        for (let index = 0; index < minimumParts.length; index += 1) {
            if (currentParts[index] > minimumParts[index]) return true
            if (currentParts[index] < minimumParts[index]) return false
        }

        return true
    }

    /**
     * Extracts comparable semver number parts.
     * @param {string} version Version string.
     * @returns {number[]}
     */
    static #versionParts(version) {
        return String(version)
            .split(/[.-]/u)
            .slice(0, 3)
            .map((part) => Number(part) || 0)
    }

    /**
     * Resolves an installed altium-toolkit path.
     * @param {...string} parts Path parts below the package root.
     * @returns {string}
     */
    static #resolveSourcePath(...parts) {
        return path.resolve(
            AltiumSchematicPatcher.#rootDirectory(),
            'node_modules',
            'altium-toolkit',
            ...parts
        )
    }

    /**
     * Resolves the repository root from this script location.
     * @returns {string}
     */
    static #rootDirectory() {
        return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    }
}

await AltiumSchematicPatcher.run()
