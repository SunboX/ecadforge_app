import { EcadBomRowAttributes } from './EcadBomRowAttributes.mjs'

const TRANSLATION_FALLBACKS = {
    'bom.designators': 'Designators',
    'bom.empty': 'No BOM rows were recovered from this file.',
    'bom.pattern': 'Pattern',
    'bom.quantity': 'Qty',
    'bom.source': 'Source',
    'bom.value': 'Value',
    'preview.groupedRows': 'grouped rows',
    'view.bom': 'BOM'
}

/**
 * Renders app-localized BOM markup independently from format dispatch.
 */
export class EcadLocalizedBomRenderer {
    /**
     * Renders localized BOM rows.
     * @param {object[]} rows BOM rows.
     * @param {{ isKiCad?: boolean, selectedComponentKey?: string, translate: (key: string) => string }} options Render options.
     * @returns {string}
     */
    static render(rows, options) {
        const normalizedRows = Array.isArray(rows) ? rows : []
        const isKiCad = options?.isKiCad === true
        const translate = options.translate
        const selectedComponentKey = String(
            options?.selectedComponentKey || ''
        ).trim()

        if (!normalizedRows.length) {
            return EcadLocalizedBomRenderer.#empty(isKiCad, translate)
        }

        const tableMarkup = EcadLocalizedBomRenderer.#table(
            normalizedRows,
            EcadLocalizedBomRenderer.#columnKeys(isKiCad),
            translate,
            selectedComponentKey
        )
        if (isKiCad) return tableMarkup

        return (
            '<section class="bom-panel"><header class="bom-panel__header"><h3>' +
            EcadLocalizedBomRenderer.#escape(
                EcadLocalizedBomRenderer.#translate(translate, 'view.bom')
            ) +
            '</h3><p>' +
            normalizedRows.length +
            ' ' +
            EcadLocalizedBomRenderer.#escape(
                EcadLocalizedBomRenderer.#translate(
                    translate,
                    'preview.groupedRows'
                )
            ) +
            '</p></header>' +
            tableMarkup +
            '</section>'
        )
    }

    /**
     * Renders an empty BOM message.
     * @param {boolean} isKiCad Whether KiCad wrapper classes are required.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #empty(isKiCad, translate) {
        const className = isKiCad ? 'bom-empty' : 'altium-renderer-empty'
        return (
            '<section class="' +
            className +
            '">' +
            EcadLocalizedBomRenderer.#escape(
                EcadLocalizedBomRenderer.#translate(translate, 'bom.empty')
            ) +
            '</section>'
        )
    }

    /**
     * Renders a localized BOM table.
     * @param {object[]} rows BOM rows.
     * @param {string[]} columnKeys Ordered column keys.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {string}
     */
    static #table(rows, columnKeys, translate, selectedComponentKey) {
        const headerMarkup = columnKeys
            .map((columnKey) =>
                EcadLocalizedBomRenderer.#headerCell(columnKey, translate)
            )
            .join('')
        const bodyMarkup = rows
            .map((row) =>
                EcadLocalizedBomRenderer.#row(
                    row,
                    columnKeys,
                    selectedComponentKey
                )
            )
            .join('')

        return (
            '<table class="bom-table"><thead><tr>' +
            headerMarkup +
            '</tr></thead><tbody>' +
            bodyMarkup +
            '</tbody></table>'
        )
    }

    /**
     * Renders one header cell.
     * @param {string} columnKey BOM column key.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #headerCell(columnKey, translate) {
        return (
            '<th>' +
            EcadLocalizedBomRenderer.#escape(
                EcadLocalizedBomRenderer.#translate(
                    translate,
                    'bom.' + columnKey
                )
            ) +
            '</th>'
        )
    }

    /**
     * Renders one BOM row.
     * @param {object} row BOM row.
     * @param {string[]} columnKeys Ordered column keys.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {string}
     */
    static #row(row, columnKeys, selectedComponentKey) {
        const cellMarkup = columnKeys
            .map((columnKey) =>
                EcadLocalizedBomRenderer.#cell(
                    row,
                    columnKey,
                    selectedComponentKey
                )
            )
            .join('')
        const attributes = EcadBomRowAttributes.render(row)
        if (!EcadLocalizedBomRenderer.#isSelected(row, selectedComponentKey)) {
            return '<tr' + attributes + '>' + cellMarkup + '</tr>'
        }

        return (
            '<tr class="bom-table__row--selected" data-bom-selected-component-key="' +
            EcadLocalizedBomRenderer.#escape(selectedComponentKey) +
            '"' +
            attributes +
            '>' +
            cellMarkup +
            '</tr>'
        )
    }

    /**
     * Renders one BOM cell.
     * @param {object} row BOM row.
     * @param {string} columnKey BOM column key.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {string}
     */
    static #cell(row, columnKey, selectedComponentKey) {
        if (columnKey === 'designators') {
            return (
                '<td>' +
                EcadLocalizedBomRenderer.#designators(
                    row,
                    selectedComponentKey
                ) +
                '</td>'
            )
        }
        return (
            '<td>' +
            EcadLocalizedBomRenderer.#escape(
                EcadLocalizedBomRenderer.#cellValue(row, columnKey)
            ) +
            '</td>'
        )
    }

    /**
     * Renders designators and emphasizes the selected component.
     * @param {object} row BOM row.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {string}
     */
    static #designators(row, selectedComponentKey) {
        const designators = EcadLocalizedBomRenderer.#rowDesignators(row)
        if (!designators.length) {
            return EcadLocalizedBomRenderer.#escape(
                EcadLocalizedBomRenderer.#cellValue(row, 'designators')
            )
        }
        return designators
            .map((designator) =>
                designator === selectedComponentKey
                    ? '<mark class="bom-table__selected-designator">' +
                      EcadLocalizedBomRenderer.#escape(designator) +
                      '</mark>'
                    : EcadLocalizedBomRenderer.#escape(designator)
            )
            .join(', ')
    }

    /**
     * Returns whether one row contains the selected designator.
     * @param {object} row BOM row.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {boolean}
     */
    static #isSelected(row, selectedComponentKey) {
        return Boolean(
            selectedComponentKey &&
            EcadLocalizedBomRenderer.#rowDesignators(row).includes(
                selectedComponentKey
            )
        )
    }

    /**
     * Resolves normalized row designators.
     * @param {object} row BOM row.
     * @returns {string[]}
     */
    static #rowDesignators(row) {
        return Array.isArray(row?.designators)
            ? row.designators.map((designator) => String(designator).trim())
            : []
    }

    /**
     * Reads one BOM cell value.
     * @param {object} row BOM row.
     * @param {string} columnKey BOM column key.
     * @returns {string}
     */
    static #cellValue(row, columnKey) {
        if (columnKey === 'designators') {
            return Array.isArray(row?.designators)
                ? row.designators.join(', ')
                : ''
        }
        if (columnKey === 'quantity') {
            return String(row?.quantity || row?.designators?.length || 0)
        }
        return String(row?.[columnKey] || '')
    }

    /**
     * Resolves source-format-compatible column order.
     * @param {boolean} isKiCad Whether KiCad column order is required.
     * @returns {string[]}
     */
    static #columnKeys(isKiCad) {
        return isKiCad
            ? ['designators', 'quantity', 'value', 'pattern', 'source']
            : ['designators', 'quantity', 'pattern', 'value', 'source']
    }

    /**
     * Translates one BOM key with an English fallback.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {string} key Message key.
     * @returns {string}
     */
    static #translate(translate, key) {
        const value = translate(key)
        return !value || value === key
            ? TRANSLATION_FALLBACKS[key] || key
            : value
    }

    /**
     * Escapes text for renderer-owned HTML.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #escape(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }
}
