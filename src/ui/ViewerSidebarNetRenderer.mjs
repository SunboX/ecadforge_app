import { NetSelectionModel } from '../core/NetSelectionModel.mjs'
import { EcadDocumentType } from '../core/ecad/EcadDocumentType.mjs'
import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'

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
            snapshot?.selectedNets || {},
            ViewerSidebarNetRenderer.#previewNetName(snapshot)
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
     * @param {{ color: string, detail: string, documentId: string, key: string, label: string, preview: boolean, search: string, selected: boolean }[]} nets Net rows.
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
     * @param {string} previewKey Previewed net key.
     * @returns {{ color: string, detail: string, documentId: string, key: string, label: string, preview: boolean, search: string, selected: boolean }[]}
     */
    static #resolveRows(documentModel, documentId, selectedNets, previewKey) {
        const selectedKey = NetSelectionModel.resolveSelectedKey(
            selectedNets,
            documentId
        )
        const showDetail = !EcadDocumentType.isPcb(documentModel)
        const rowsByKey = new Map()
        ViewerSidebarNetRenderer.#resolveNetEntries(documentModel).forEach(
            (net, index) => {
                const key = NetSelectionModel.resolveNetKey(net, index)
                if (!key || rowsByKey.has(key)) return

                const detail = showDetail
                    ? ViewerSidebarNetRenderer.#formatNetDetail(net)
                    : ''
                rowsByKey.set(key, {
                    color: ViewerSidebarNetRenderer.#netColor(net),
                    detail,
                    documentId,
                    key,
                    label: key,
                    preview: Boolean(previewKey && key === previewKey),
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
            ...ViewerSidebarNetRenderer.#circuitJsonNetEntries(documentModel),
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
     * Resolves explicit net entries from element-array documents.
     * @param {any} documentModel Active document model.
     * @returns {any[]}
     */
    static #circuitJsonNetEntries(documentModel) {
        const elements = ViewerSidebarNetRenderer.#elements(documentModel)
        const sourceById = new Map(
            elements
                .filter((element) => element?.type === 'source_net')
                .map((element) => [
                    String(element.source_net_id || '').trim(),
                    element
                ])
                .filter(([id]) => id)
        )
        const pcbNets = elements.filter(
            (element) => element?.type === 'pcb_net'
        )
        const entries = pcbNets
            .map((pcbNet) =>
                ViewerSidebarNetRenderer.#circuitJsonNetEntry(
                    sourceById.get(String(pcbNet.source_net_id || '').trim()),
                    pcbNet
                )
            )
            .filter(Boolean)
        const explicitSourceIds = new Set(
            entries.map((entry) => entry.sourceNetId).filter(Boolean)
        )
        const sourceEntries = [...sourceById.values()]
            .filter(
                (source) => !explicitSourceIds.has(source.source_net_id || '')
            )
            .map((source) =>
                ViewerSidebarNetRenderer.#circuitJsonNetEntry(source, {})
            )
            .filter(Boolean)
        return [...entries, ...sourceEntries]
    }

    /**
     * Builds one element-array net entry.
     * @param {any} source Source net row.
     * @param {any} pcbNet PCB net row.
     * @returns {any | null}
     */
    static #circuitJsonNetEntry(source, pcbNet) {
        const sourceNetId = String(
            source?.source_net_id || pcbNet?.source_net_id || ''
        ).trim()
        const pcbNetId = String(pcbNet?.pcb_net_id || '').trim()
        const name = String(
            pcbNet?.name ||
                pcbNet?.net ||
                source?.name ||
                source?.net ||
                sourceNetId ||
                pcbNetId ||
                ''
        ).trim()
        if (!name) return null
        return {
            name,
            sourceNetId,
            pcbNetId,
            highlightColor: ViewerSidebarNetRenderer.#safeColor(
                pcbNet?.highlight_color ||
                    pcbNet?.highlightColor ||
                    pcbNet?.color
            )
        }
    }

    /**
     * Reads element rows from document wrappers.
     * @param {any} documentModel Active document model.
     * @returns {any[]}
     */
    static #elements(documentModel) {
        return EcadFormatRegistry.circuitJsonElementsForDocument(documentModel)
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
     * Resolves a safe row color for one net.
     * @param {any} net Net metadata.
     * @returns {string}
     */
    static #netColor(net) {
        return ViewerSidebarNetRenderer.#safeColor(
            net?.highlightColor || net?.highlight_color || net?.color
        )
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
     * @param {{ color: string, detail: string, documentId: string, key: string, label: string, search: string, selected: boolean }[]} rows Net rows.
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
     * @param {{ color: string, detail: string, documentId: string, key: string, label: string, preview: boolean, search: string, selected: boolean }} row Net row.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderNetRow(row, translate) {
        const copyLabel = translate('sidebar.copyNetName')
        const title = [row.label, row.detail].filter(Boolean).join(' ')
        return (
            '<div class="viewer-sidebar__component-row-shell' +
            (row.preview ? ' is-preview' : '') +
            (row.selected ? ' is-active' : '') +
            '" data-net-search="' +
            ViewerSidebarNetRenderer.#escapeHtml(row.search) +
            '"><button class="viewer-sidebar__component-row viewer-sidebar__net-row' +
            (row.color ? ' viewer-sidebar__net-row--with-color' : '') +
            (row.detail ? '' : ' viewer-sidebar__net-row--label-only') +
            (row.preview ? ' is-preview' : '') +
            (row.selected ? ' is-active' : '') +
            '" type="button" data-pcb-net-key="' +
            ViewerSidebarNetRenderer.#escapeHtml(row.key) +
            '" data-document-id="' +
            ViewerSidebarNetRenderer.#escapeHtml(row.documentId) +
            '" aria-pressed="' +
            (row.selected ? 'true' : 'false') +
            '" title="' +
            ViewerSidebarNetRenderer.#escapeHtml(title) +
            '">' +
            ViewerSidebarNetRenderer.#renderNetSwatch(row.color) +
            '<span class="viewer-sidebar__component-ref">' +
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
     * Renders a net color swatch.
     * @param {string} color Safe color.
     * @returns {string}
     */
    static #renderNetSwatch(color) {
        if (!color) return ''
        return (
            '<span class="viewer-sidebar__net-swatch" data-net-color="' +
            ViewerSidebarNetRenderer.#escapeHtml(color) +
            '" style="--net-color: ' +
            ViewerSidebarNetRenderer.#escapeHtml(color) +
            '"></span>'
        )
    }

    /**
     * Resolves the net key currently previewed by PCB interaction.
     * @param {{ pcbInteractionPreview?: object }} snapshot Viewer snapshot.
     * @returns {string}
     */
    static #previewNetName(snapshot) {
        const preview = snapshot?.pcbInteractionPreview
        const selectedName = ViewerSidebarNetRenderer.#candidateNetName(
            preview?.selectedCandidate
        )
        if (selectedName) return selectedName

        const candidate = (
            Array.isArray(preview?.candidates) ? preview.candidates : []
        ).find((row) => ViewerSidebarNetRenderer.#candidateNetName(row))
        return ViewerSidebarNetRenderer.#candidateNetName(candidate)
    }

    /**
     * Resolves one candidate's net name.
     * @param {object | null | undefined} candidate Candidate row.
     * @returns {string}
     */
    static #candidateNetName(candidate) {
        return String(
            candidate?.netName ?? candidate?.net ?? candidate?.net_name ?? ''
        ).trim()
    }

    /**
     * Returns a color safe for inline style variables.
     * @param {unknown} value Color candidate.
     * @returns {string}
     */
    static #safeColor(value) {
        const text = String(value || '').trim()
        return /^#[0-9a-f]{3,8}$/iu.test(text) ? text : ''
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
