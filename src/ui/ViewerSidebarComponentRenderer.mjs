import { PcbComponentSelectionModel } from '../core/PcbComponentSelectionModel.mjs'

/**
 * Renders the sidebar component and footprint browser.
 */
export class ViewerSidebarComponentRenderer {
    /**
     * Renders component rows for one viewer snapshot.
     * @param {{ activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string }, documentModel?: any }} snapshot Viewer snapshot.
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
     * @param {{ activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string }, documentModel?: any }} snapshot Viewer snapshot.
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
                selectedKey
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
     * @returns {{ component: any, detail: string, documentId: string, group: string, key: string, label: string, search: string, selected: boolean }}
     */
    static #buildComponentRow(
        component,
        index,
        documentModel,
        documentId,
        selectedKey
    ) {
        const key = PcbComponentSelectionModel.resolveComponentKey(
            component,
            index
        )
        const detail = ViewerSidebarComponentRenderer.#resolveDetail(
            component,
            Boolean(documentModel?.pcb)
        )
        const search = [
            key,
            detail,
            component?.pattern,
            component?.footprint,
            component?.layer,
            component?.side,
            component?.mountSide
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

        return {
            component,
            detail,
            documentId,
            group: documentModel?.pcb
                ? ViewerSidebarComponentRenderer.#resolveBoardSide(component)
                : 'symbols',
            key,
            label: key || 'Component',
            search,
            selected: Boolean(selectedKey && key === selectedKey)
        }
    }

    /**
     * Keeps one sidebar row per shared schematic component key.
     * @param {{ component: any, detail: string, documentId: string, group: string, key: string, label: string, search: string, selected: boolean }[]} rows Component rows.
     * @returns {{ component: any, detail: string, documentId: string, group: string, key: string, label: string, search: string, selected: boolean }[]}
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
                continue
            }

            const nextRow = { ...row }
            rowsByKey.set(dedupeKey, nextRow)
            uniqueRows.push(nextRow)
        }
        return uniqueRows
    }

    /**
     * Resolves the row detail with PCB and schematic-specific priority.
     * @param {any} component Component metadata.
     * @param {boolean} isPcb Whether the component belongs to a PCB.
     * @returns {string}
     */
    static #resolveDetail(component, isPcb) {
        const keys = isPcb
            ? ['value', 'comment', 'pattern', 'footprint', 'libReference']
            : ['libReference', 'value', 'comment', 'footprint', 'pattern']
        return (
            ViewerSidebarComponentRenderer.#firstValue(component, keys) || '-'
        )
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
     * @param {{ component: any, detail: string, documentId: string, group: string, key: string, label: string, search: string, selected: boolean }[]} rows Component rows.
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
     * @param {{ component: any, detail: string, documentId: string, group: string, key: string, label: string, search: string, selected: boolean }[]} rows Component rows.
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
     * @param {{ detail: string, documentId: string, key: string, label: string, search: string, selected: boolean }} row Component row.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderComponentRow(row, translate) {
        const copyLabel = translate('sidebar.copyComponentName')
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
            ViewerSidebarComponentRenderer.#escapeHtml(
                row.label + ' ' + row.detail
            ) +
            '"><span class="viewer-sidebar__component-ref">' +
            ViewerSidebarComponentRenderer.#escapeHtml(row.label) +
            '</span><span class="viewer-sidebar__component-detail">' +
            ViewerSidebarComponentRenderer.#escapeHtml(row.detail) +
            '</span></button><button class="viewer-sidebar__component-copy" type="button" data-component-detail-copy="true" data-component-copy-text="' +
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
