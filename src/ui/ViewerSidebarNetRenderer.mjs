import { NetSelectionModel } from '../core/NetSelectionModel.mjs'

/**
 * Renders the sidebar net browser.
 */
export class ViewerSidebarNetRenderer {
    /**
     * Renders net rows for one viewer snapshot.
     * @param {{ activeDocumentId?: string, selectedNets?: { [documentId: string]: string }, documentModel?: any }} snapshot Viewer snapshot.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static render(snapshot, translate) {
        const nets = ViewerSidebarNetRenderer.#resolveRows(
            snapshot?.documentModel,
            String(snapshot?.activeDocumentId || ''),
            snapshot?.selectedNets || {}
        )

        return (
            ViewerSidebarNetRenderer.#renderPanelHeader(
                translate('sidebar.nets')
            ) +
            (nets.length
                ? ViewerSidebarNetRenderer.#renderNetBrowser(nets, translate)
                : ViewerSidebarNetRenderer.#renderEmpty(
                      translate('sidebar.noNets')
                  ))
        )
    }

    /**
     * Renders the searchable net browser.
     * @param {{ detail: string, documentId: string, key: string, label: string, search: string, selected: boolean }[]} nets Net rows.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderNetBrowser(nets, translate) {
        return (
            ViewerSidebarNetRenderer.#renderSearch(translate) +
            ViewerSidebarNetRenderer.#renderGroup(
                translate('sidebar.nets'),
                nets,
                translate
            )
        )
    }

    /**
     * Builds normalized net rows.
     * @param {any} documentModel Active document model.
     * @param {string} documentId Active document id.
     * @param {{ [documentId: string]: string }} selectedNets Selected net map.
     * @returns {{ detail: string, documentId: string, key: string, label: string, search: string, selected: boolean }[]}
     */
    static #resolveRows(documentModel, documentId, selectedNets) {
        const selectedKey = NetSelectionModel.resolveSelectedKey(
            selectedNets,
            documentId
        )
        const showDetail =
            !documentModel?.pcb &&
            String(documentModel?.kind || '').toLowerCase() !== 'pcb'
        const rowsByKey = new Map()
        ViewerSidebarNetRenderer.#resolveNetEntries(documentModel).forEach(
            (net, index) => {
                const key = NetSelectionModel.resolveNetKey(net, index)
                if (!key || rowsByKey.has(key)) return

                const detail = showDetail
                    ? ViewerSidebarNetRenderer.#formatNetDetail(net)
                    : ''
                rowsByKey.set(key, {
                    detail,
                    documentId,
                    key,
                    label: key,
                    search: [key, detail]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase(),
                    selected: Boolean(selectedKey && key === selectedKey)
                })
            }
        )

        return [...rowsByKey.values()].sort((left, right) =>
            left.label.localeCompare(right.label, undefined, {
                numeric: true,
                sensitivity: 'base'
            })
        )
    }

    /**
     * Resolves explicit and primitive-derived net entries.
     * @param {any} documentModel Active document model.
     * @returns {any[]}
     */
    static #resolveNetEntries(documentModel) {
        const explicit = [
            ...(Array.isArray(documentModel?.nets) ? documentModel.nets : []),
            ...(Array.isArray(documentModel?.pcb?.nets)
                ? documentModel.pcb.nets
                : []),
            ...(Array.isArray(documentModel?.schematic?.nets)
                ? documentModel.schematic.nets
                : [])
        ]
        const explicitNames = new Set(
            explicit
                .map((net, index) =>
                    NetSelectionModel.resolveNetKey(net, index)
                )
                .filter(Boolean)
        )
        const implicit = NetSelectionModel.resolveDocumentNetNames(
            documentModel
        )
            .filter((name) => !explicitNames.has(name))
            .map((name) => ({ name }))

        return [...explicit, ...implicit]
    }

    /**
     * Formats one net detail string.
     * @param {any} net Net metadata.
     * @returns {string}
     */
    static #formatNetDetail(net) {
        const count =
            net?.pinCount ??
            net?.pins?.length ??
            net?.nodes?.length ??
            net?.members?.length ??
            0
        return String(count) + ' pins'
    }

    /**
     * Renders the search field.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderSearch(translate) {
        const label = translate('sidebar.searchNets')

        return (
            '<label class="viewer-sidebar__search"><span class="sr-only">' +
            ViewerSidebarNetRenderer.#escapeHtml(label) +
            '</span><svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
            '<circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>' +
            '<input type="search" data-net-filter placeholder="' +
            ViewerSidebarNetRenderer.#escapeHtml(translate('sidebar.search')) +
            '" aria-label="' +
            ViewerSidebarNetRenderer.#escapeHtml(label) +
            '"></label>'
        )
    }

    /**
     * Renders the single net group.
     * @param {string} groupLabel Group label.
     * @param {{ detail: string, documentId: string, key: string, label: string, search: string, selected: boolean }[]} rows Net rows.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderGroup(groupLabel, rows, translate) {
        return (
            '<div class="viewer-sidebar__component-group" data-net-group="nets"><h4>' +
            ViewerSidebarNetRenderer.#escapeHtml(groupLabel) +
            '</h4><div class="viewer-sidebar__component-list">' +
            rows
                .map((row) =>
                    ViewerSidebarNetRenderer.#renderNetRow(row, translate)
                )
                .join('') +
            '</div></div>'
        )
    }

    /**
     * Renders one net row.
     * @param {{ detail: string, documentId: string, key: string, label: string, search: string, selected: boolean }} row Net row.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderNetRow(row, translate) {
        const copyLabel = translate('sidebar.copyNetName')
        const title = [row.label, row.detail].filter(Boolean).join(' ')
        return (
            '<div class="viewer-sidebar__component-row-shell' +
            (row.selected ? ' is-active' : '') +
            '" data-net-search="' +
            ViewerSidebarNetRenderer.#escapeHtml(row.search) +
            '"><button class="viewer-sidebar__component-row viewer-sidebar__net-row' +
            (row.detail ? '' : ' viewer-sidebar__net-row--label-only') +
            (row.selected ? ' is-active' : '') +
            '" type="button" data-pcb-net-key="' +
            ViewerSidebarNetRenderer.#escapeHtml(row.key) +
            '" data-document-id="' +
            ViewerSidebarNetRenderer.#escapeHtml(row.documentId) +
            '" aria-pressed="' +
            (row.selected ? 'true' : 'false') +
            '" title="' +
            ViewerSidebarNetRenderer.#escapeHtml(title) +
            '"><span class="viewer-sidebar__component-ref">' +
            ViewerSidebarNetRenderer.#escapeHtml(row.label) +
            '</span>' +
            (row.detail
                ? '<span class="viewer-sidebar__component-detail viewer-sidebar__net-detail">' +
                  ViewerSidebarNetRenderer.#escapeHtml(row.detail) +
                  '</span>'
                : '') +
            '</button><button class="viewer-sidebar__component-copy" type="button" data-component-detail-copy="true" data-component-copy-text="' +
            ViewerSidebarNetRenderer.#escapeHtml(row.label) +
            '" title="' +
            ViewerSidebarNetRenderer.#escapeHtml(copyLabel) +
            '" aria-label="' +
            ViewerSidebarNetRenderer.#escapeHtml(copyLabel) +
            '">' +
            ViewerSidebarNetRenderer.#renderCopyIcon() +
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
     * Renders a panel heading.
     * @param {string} title Panel title.
     * @returns {string}
     */
    static #renderPanelHeader(title) {
        return (
            '<header class="viewer-sidebar__panel-header"><h3>' +
            ViewerSidebarNetRenderer.#escapeHtml(title) +
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
            ViewerSidebarNetRenderer.#escapeHtml(message) +
            '</p>'
        )
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
