import { PcbComponentSelectionModel } from '../core/PcbComponentSelectionModel.mjs'

/**
 * Renders the sidebar component and footprint browser.
 */
export class ViewerSidebarComponentRenderer {
    /**
     * Renders component rows for one viewer snapshot.
     * @param {{ activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string }, documents?: { id: string, documentModel: any }[], documentModel?: any }} snapshot Viewer snapshot.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static render(snapshot, translate) {
        const documentModel = snapshot?.documentModel
        const components =
            ViewerSidebarComponentRenderer.#resolveComponents(documentModel)
        const title = ViewerSidebarComponentRenderer.panelTitle(
            documentModel,
            translate
        )

        return (
            ViewerSidebarComponentRenderer.#renderPanelHeader(title) +
            (components.length
                ? ViewerSidebarComponentRenderer.#renderComponentBrowser(
                      snapshot,
                      components,
                      title,
                      translate
                  )
                : ViewerSidebarComponentRenderer.#renderEmpty(
                      translate('sidebar.noComponents')
                  ))
        )
    }

    /**
     * Returns the panel title for symbols or footprints.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static panelTitle(documentModel, translate) {
        return documentModel?.schematic
            ? translate('sidebar.symbols')
            : translate('sidebar.footprints')
    }

    /**
     * Renders the searchable component browser.
     * @param {{ activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string }, documents?: { id: string, documentModel: any }[], documentModel?: any }} snapshot Viewer snapshot.
     * @param {any[]} components Component metadata.
     * @param {string} title Panel title.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderComponentBrowser(snapshot, components, title, translate) {
        const documentModel = snapshot?.documentModel
        const documentId = String(snapshot?.activeDocumentId || '')
        const selectedKey = PcbComponentSelectionModel.resolveSelectedKey(
            snapshot?.selectedPcbComponents || {},
            documentId
        )
        const rows = components.map((component, index) =>
            ViewerSidebarComponentRenderer.#buildComponentRow(
                component,
                index,
                documentModel,
                documentId,
                selectedKey,
                snapshot?.documents || []
            )
        )
        const renderedRows = documentModel?.schematic
            ? ViewerSidebarComponentRenderer.#deduplicateRowsByKey(rows)
            : rows

        return (
            ViewerSidebarComponentRenderer.#renderSearch(title, translate) +
            ViewerSidebarComponentRenderer.#renderGroups(
                renderedRows,
                Boolean(documentModel?.pcb),
                title,
                translate
            )
        )
    }

    /**
     * Builds one normalized component row.
     * @param {any} component Component metadata.
     * @param {number} index Component index.
     * @param {any} documentModel Active document model.
     * @param {string} documentId Active document id.
     * @param {string} selectedKey Selected component key.
     * @param {{ id: string, documentModel: any }[]} sessionDocuments Loaded session documents.
     * @returns {{ component: any, detail: string, documentId: string, group: string, key: string, label: string, search: string, selected: boolean, value: string }}
     */
    static #buildComponentRow(
        component,
        index,
        documentModel,
        documentId,
        selectedKey,
        sessionDocuments
    ) {
        const isPcb = Boolean(documentModel?.pcb)
        const key = PcbComponentSelectionModel.resolveComponentKey(
            component,
            index
        )
        const detail = ViewerSidebarComponentRenderer.#resolveDetail(
            component,
            isPcb
        )
        const value = isPcb
            ? ViewerSidebarComponentRenderer.#resolvePcbValue(
                  component,
                  documentModel,
                  sessionDocuments,
                  key,
                  detail
              )
            : ViewerSidebarComponentRenderer.#resolveSchematicValue(
                  component,
                  documentModel,
                  key,
                  detail
              )
        const searchableText = [
            key,
            detail,
            value,
            component?.source,
            component?.pattern,
            component?.footprint,
            component?.footprintName,
            component?.layer,
            component?.side,
            component?.mountSide
        ]
        const search = searchableText.filter(Boolean).join(' ').toLowerCase()

        return {
            component,
            detail,
            documentId,
            group: isPcb
                ? ViewerSidebarComponentRenderer.#resolveBoardSide(component)
                : 'symbols',
            key,
            label: key || 'Component',
            search,
            selected: Boolean(selectedKey && key === selectedKey),
            value
        }
    }

    /**
     * Resolves the package/source row detail with PCB and schematic-specific priority.
     * @param {any} component Component metadata.
     * @param {boolean} isPcb Whether the component belongs to a PCB.
     * @returns {string}
     */
    static #resolveDetail(component, isPcb) {
        const keys = isPcb
            ? [
                  'source',
                  'pattern',
                  'footprint',
                  'footprintName',
                  'package',
                  'libReference',
                  'libraryReference',
                  'description',
                  'comment',
                  'value'
              ]
            : ['libReference', 'value', 'comment', 'footprint', 'pattern']
        return (
            ViewerSidebarComponentRenderer.#firstValue(component, keys) || '-'
        )
    }

    /**
     * Resolves the electrical value shown at the row end for PCB components.
     * @param {any} component Component metadata.
     * @param {any} documentModel Active document model.
     * @param {{ id: string, documentModel: any }[]} sessionDocuments Loaded session documents.
     * @param {string} componentKey Row component key.
     * @param {string} detail Row package/source detail.
     * @returns {string}
     */
    static #resolvePcbValue(
        component,
        documentModel,
        sessionDocuments,
        componentKey,
        detail
    ) {
        const rejectedTexts =
            ViewerSidebarComponentRenderer.#pcbValueRejectedTexts(
                component,
                detail
            )
        const sessionBomValue =
            ViewerSidebarComponentRenderer.#resolveSessionBomValue(
                documentModel,
                sessionDocuments,
                componentKey,
                rejectedTexts
            )
        if (sessionBomValue) {
            return sessionBomValue
        }

        const componentValue = ViewerSidebarComponentRenderer.#firstValue(
            component,
            ['value']
        )
        if (
            ViewerSidebarComponentRenderer.#isDisplayableComponentValue(
                componentValue,
                rejectedTexts,
                true
            )
        ) {
            return componentValue
        }

        const bomValue = ViewerSidebarComponentRenderer.#resolveBomValue(
            documentModel,
            componentKey,
            rejectedTexts
        )
        if (bomValue) {
            return bomValue
        }

        return ''
    }

    /**
     * Resolves the electrical value shown at the row end for schematic symbols.
     * @param {any} component Component metadata.
     * @param {any} documentModel Active document model.
     * @param {string} componentKey Row component key.
     * @param {string} detail Row symbol/library detail.
     * @returns {string}
     */
    static #resolveSchematicValue(
        component,
        documentModel,
        componentKey,
        detail
    ) {
        const rejectedTexts =
            ViewerSidebarComponentRenderer.#schematicValueRejectedTexts(
                component,
                detail
            )
        const bomValue = ViewerSidebarComponentRenderer.#resolveBomValue(
            documentModel,
            componentKey,
            rejectedTexts
        )
        if (bomValue) {
            return bomValue
        }

        const componentValue = ViewerSidebarComponentRenderer.#firstValue(
            component,
            ['value', 'comment']
        )
        if (
            ViewerSidebarComponentRenderer.#isDisplayableComponentValue(
                componentValue,
                rejectedTexts,
                false
            )
        ) {
            return componentValue
        }

        return ''
    }

    /**
     * Resolves a value from sibling session BOMs before the active PCB BOM.
     * @param {any} activeDocumentModel Active document model.
     * @param {{ id: string, documentModel: any }[]} sessionDocuments Loaded session documents.
     * @param {string} componentKey Component designator.
     * @param {Set<string>} rejectedTexts Text values that are package/source metadata.
     * @returns {string}
     */
    static #resolveSessionBomValue(
        activeDocumentModel,
        sessionDocuments,
        componentKey,
        rejectedTexts
    ) {
        const documentModels =
            ViewerSidebarComponentRenderer.#orderedBomDocuments(
                activeDocumentModel,
                sessionDocuments
            )
        for (const documentModel of documentModels) {
            const value = ViewerSidebarComponentRenderer.#resolveBomValue(
                documentModel,
                componentKey,
                rejectedTexts
            )
            if (value) {
                return value
            }
        }

        return ''
    }

    /**
     * Returns BOM-bearing documents with sibling docs before the active PCB.
     * @param {any} activeDocumentModel Active document model.
     * @param {{ id: string, documentModel: any }[]} sessionDocuments Loaded session documents.
     * @returns {any[]}
     */
    static #orderedBomDocuments(activeDocumentModel, sessionDocuments) {
        const documentModels = (
            Array.isArray(sessionDocuments) ? sessionDocuments : []
        )
            .map((entry) => entry?.documentModel)
            .filter(Boolean)

        if (
            activeDocumentModel &&
            !documentModels.includes(activeDocumentModel)
        ) {
            documentModels.push(activeDocumentModel)
        }

        return [
            ...documentModels.filter(
                (documentModel) => documentModel !== activeDocumentModel
            ),
            ...documentModels.filter(
                (documentModel) => documentModel === activeDocumentModel
            )
        ]
    }

    /**
     * Resolves a BOM value for one component designator.
     * @param {any} documentModel Active document model.
     * @param {string} componentKey Component designator.
     * @param {Set<string>} rejectedTexts Text values that are package/source metadata.
     * @returns {string}
     */
    static #resolveBomValue(documentModel, componentKey, rejectedTexts) {
        const key = String(componentKey || '').trim()
        if (!key || !Array.isArray(documentModel?.bom)) {
            return ''
        }

        for (const row of documentModel.bom) {
            if (
                ViewerSidebarComponentRenderer.#bomDesignators(row).includes(
                    key
                )
            ) {
                const value = ViewerSidebarComponentRenderer.#firstValue(row, [
                    'value'
                ])
                if (
                    ViewerSidebarComponentRenderer.#isDisplayableComponentValue(
                        value,
                        rejectedTexts,
                        Boolean(documentModel?.pcb && !documentModel?.schematic)
                    )
                ) {
                    return value
                }
            }
        }

        return ''
    }

    /**
     * Builds source/package text values that should not be shown as BOM values.
     * @param {any} component Component metadata.
     * @param {string} detail Row package/source detail.
     * @returns {Set<string>}
     */
    static #pcbValueRejectedTexts(component, detail) {
        return new Set(
            [
                detail,
                component?.source,
                component?.pattern,
                component?.footprint,
                component?.footprintName,
                component?.package,
                component?.libReference,
                component?.libraryReference
            ]
                .map((value) =>
                    ViewerSidebarComponentRenderer.#normalizeCompareText(value)
                )
                .filter(Boolean)
        )
    }

    /**
     * Builds symbol text values that should not be repeated as component values.
     * @param {any} component Component metadata.
     * @param {string} detail Row symbol/library detail.
     * @returns {Set<string>}
     */
    static #schematicValueRejectedTexts(component, detail) {
        return new Set(
            [
                detail,
                component?.source,
                component?.pattern,
                component?.footprint,
                component?.footprintName,
                component?.package,
                component?.libReference,
                component?.libraryReference
            ]
                .map((value) =>
                    ViewerSidebarComponentRenderer.#normalizeCompareText(value)
                )
                .filter(Boolean)
        )
    }

    /**
     * Returns whether a component value is distinct from row metadata.
     * @param {unknown} value Candidate value.
     * @param {Set<string>} rejectedTexts Text values that are already shown as row metadata.
     * @param {boolean} rejectDescriptions Whether prose PCB descriptions should be rejected.
     * @returns {boolean}
     */
    static #isDisplayableComponentValue(
        value,
        rejectedTexts,
        rejectDescriptions
    ) {
        const text = String(value ?? '').trim()
        if (!text) {
            return false
        }

        const normalized =
            ViewerSidebarComponentRenderer.#normalizeCompareText(text)
        if (rejectedTexts.has(normalized)) {
            return false
        }

        return !(
            rejectDescriptions &&
            ViewerSidebarComponentRenderer.#looksLikePcbDescription(text)
        )
    }

    /**
     * Returns whether a candidate value looks like package description prose.
     * @param {string} value Candidate value.
     * @returns {boolean}
     */
    static #looksLikePcbDescription(value) {
        const text = value.toLowerCase()
        if (/\bsurface\s+mount(?:ed)?\b/.test(text)) {
            return true
        }

        if (/\bs(?:m|mt)d?\b/.test(text) && /\s/.test(text)) {
            return true
        }

        return (
            /\b(capacitor|resistor|diode|connector|transistor|switch)\b/.test(
                text
            ) &&
            text.split(/\s+/).length > 2 &&
            !/\d/.test(text)
        )
    }

    /**
     * Normalizes text for source/value comparison.
     * @param {unknown} value Candidate text.
     * @returns {string}
     */
    static #normalizeCompareText(value) {
        return String(value ?? '')
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase()
    }

    /**
     * Returns normalized designators from one BOM row.
     * @param {any} row BOM row.
     * @returns {string[]}
     */
    static #bomDesignators(row) {
        if (Array.isArray(row?.designators)) {
            return row.designators
                .map((designator) => String(designator).trim())
                .filter(Boolean)
        }

        return ViewerSidebarComponentRenderer.#firstValue(row, [
            'designator',
            'refdes',
            'reference'
        ])
            .split(',')
            .map((designator) => designator.trim())
            .filter(Boolean)
    }

    /**
     * Keeps one sidebar row per shared schematic component key.
     * @param {{ component: any, detail: string, documentId: string, group: string, key: string, label: string, search: string, selected: boolean, value: string }[]} rows Component rows.
     * @returns {{ component: any, detail: string, documentId: string, group: string, key: string, label: string, search: string, selected: boolean, value: string }[]}
     */
    static #deduplicateRowsByKey(rows) {
        const rowsByKey = new Map()
        const uniqueRows = []
        for (const row of rows) {
            const dedupeKey = row.key || row.label
            const existing = rowsByKey.get(dedupeKey)
            if (existing) {
                existing.search = [existing.search, row.search]
                    .filter(Boolean)
                    .join(' ')
                existing.selected = existing.selected || row.selected
                existing.value = existing.value || row.value
                continue
            }

            const nextRow = { ...row }
            rowsByKey.set(dedupeKey, nextRow)
            uniqueRows.push(nextRow)
        }
        return uniqueRows
    }

    /**
     * Renders the search field.
     * @param {string} title Panel title.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderSearch(title, translate) {
        const label =
            title === translate('sidebar.symbols')
                ? translate('sidebar.searchSymbols')
                : translate('sidebar.searchFootprints')

        return (
            '<label class="viewer-sidebar__search"><span class="sr-only">' +
            ViewerSidebarComponentRenderer.#escapeHtml(label) +
            '</span><svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
            '<circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>' +
            '<input type="search" data-component-filter placeholder="' +
            ViewerSidebarComponentRenderer.#escapeHtml(
                translate('sidebar.search')
            ) +
            '" aria-label="' +
            ViewerSidebarComponentRenderer.#escapeHtml(label) +
            '"></label>'
        )
    }

    /**
     * Renders component rows grouped by side.
     * @param {{ component: any, detail: string, documentId: string, group: string, key: string, label: string, search: string, selected: boolean, value: string }[]} rows Component rows.
     * @param {boolean} isPcb Whether rows belong to a PCB.
     * @param {string} title Panel title.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderGroups(rows, isPcb, title, translate) {
        const groups = isPcb
            ? [
                  ['front', translate('sidebar.front')],
                  ['back', translate('sidebar.back')],
                  ['other', translate('sidebar.otherSide')]
              ]
            : [['symbols', title]]

        return groups
            .map(([groupKey, groupLabel]) =>
                ViewerSidebarComponentRenderer.#renderGroup(
                    groupKey,
                    groupLabel,
                    rows,
                    translate
                )
            )
            .join('')
    }

    /**
     * Renders one side group.
     * @param {string} groupKey Group key.
     * @param {string} groupLabel Group label.
     * @param {{ component: any, detail: string, documentId: string, group: string, key: string, label: string, search: string, selected: boolean, value: string }[]} rows Component rows.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderGroup(groupKey, groupLabel, rows, translate) {
        const groupRows = rows
            .filter((row) => row.group === groupKey)
            .sort((left, right) =>
                left.label.localeCompare(right.label, undefined, {
                    numeric: true,
                    sensitivity: 'base'
                })
            )
        if (!groupRows.length) return ''

        return (
            '<div class="viewer-sidebar__component-group" data-component-group="' +
            ViewerSidebarComponentRenderer.#escapeHtml(groupKey) +
            '"><h4>' +
            ViewerSidebarComponentRenderer.#escapeHtml(groupLabel) +
            '</h4><div class="viewer-sidebar__component-list">' +
            groupRows
                .map((row) =>
                    ViewerSidebarComponentRenderer.#renderComponentRow(
                        row,
                        translate
                    )
                )
                .join('') +
            '</div></div>'
        )
    }

    /**
     * Renders one footprint row.
     * @param {{ detail: string, documentId: string, key: string, label: string, search: string, selected: boolean, value: string }} row Component row.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderComponentRow(row, translate) {
        const copyLabel = translate('sidebar.copyComponentName')
        const titleText = [row.label, row.detail, row.value]
            .filter(Boolean)
            .join(' ')
        const valueMarkup = row.value
            ? '<span class="viewer-sidebar__component-value">' +
              ViewerSidebarComponentRenderer.#escapeHtml(row.value) +
              '</span>'
            : ''
        return (
            '<div class="viewer-sidebar__component-row-shell' +
            (row.selected ? ' is-active' : '') +
            '" data-component-search="' +
            ViewerSidebarComponentRenderer.#escapeHtml(row.search) +
            '"><button class="viewer-sidebar__component-row' +
            (row.selected ? ' is-active' : '') +
            '" type="button" data-pcb-component-key="' +
            ViewerSidebarComponentRenderer.#escapeHtml(row.key) +
            '" data-document-id="' +
            ViewerSidebarComponentRenderer.#escapeHtml(row.documentId) +
            '" aria-pressed="' +
            (row.selected ? 'true' : 'false') +
            '" title="' +
            ViewerSidebarComponentRenderer.#escapeHtml(titleText) +
            '"><span class="viewer-sidebar__component-ref">' +
            ViewerSidebarComponentRenderer.#escapeHtml(row.label) +
            '</span><span class="viewer-sidebar__component-detail">' +
            ViewerSidebarComponentRenderer.#escapeHtml(row.detail) +
            '</span>' +
            valueMarkup +
            '</button><button class="viewer-sidebar__component-copy" type="button" data-component-detail-copy="true" data-component-copy-text="' +
            ViewerSidebarComponentRenderer.#escapeHtml(row.detail) +
            '" title="' +
            ViewerSidebarComponentRenderer.#escapeHtml(copyLabel) +
            '" aria-label="' +
            ViewerSidebarComponentRenderer.#escapeHtml(copyLabel) +
            '">' +
            ViewerSidebarComponentRenderer.#renderCopyIcon() +
            '</button></div>'
        )
    }

    /**
     * Renders the standard copy action icon.
     * @returns {string}
     */
    static #renderCopyIcon() {
        return (
            '<svg class="icon viewer-sidebar__component-copy-icon" viewBox="0 0 24 24" aria-hidden="true">' +
            '<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />' +
            '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />' +
            '</svg>'
        )
    }

    /**
     * Resolves board-side group from component metadata.
     * @param {any} component Component metadata.
     * @returns {string}
     */
    static #resolveBoardSide(component) {
        const text = String(
            component?.side || component?.mountSide || component?.layer || ''
        ).toLowerCase()
        if (/(^|[^a-z])(back|bottom|bot|b\.cu|b$)/.test(text)) return 'back'
        if (/(^|[^a-z])(front|top|f\.cu|f$)/.test(text)) return 'front'
        return 'other'
    }

    /**
     * Renders a panel heading.
     * @param {string} title Panel title.
     * @returns {string}
     */
    static #renderPanelHeader(title) {
        return (
            '<header class="viewer-sidebar__panel-header"><h3>' +
            ViewerSidebarComponentRenderer.#escapeHtml(title) +
            '</h3></header>'
        )
    }

    /**
     * Renders an empty panel message.
     * @param {string} message Empty message.
     * @returns {string}
     */
    static #renderEmpty(message) {
        return (
            '<p class="viewer-sidebar__empty">' +
            ViewerSidebarComponentRenderer.#escapeHtml(message) +
            '</p>'
        )
    }

    /**
     * Resolves component metadata from schematic or PCB documents.
     * @param {any} documentModel Active document model.
     * @returns {any[]}
     */
    static #resolveComponents(documentModel) {
        if (Array.isArray(documentModel?.pcb?.components)) {
            return documentModel.pcb.components
        }

        if (Array.isArray(documentModel?.schematic?.components)) {
            return documentModel.schematic.components
        }

        return []
    }

    /**
     * Returns the first non-empty property value.
     * @param {any} source Source object.
     * @param {string[]} keys Candidate keys.
     * @returns {string}
     */
    static #firstValue(source, keys) {
        for (const key of keys) {
            const value = source?.[key]
            if (value !== undefined && value !== null && value !== '') {
                return String(value)
            }
        }

        return ''
    }

    /**
     * Escapes text for safe HTML insertion.
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
