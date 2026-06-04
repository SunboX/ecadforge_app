import { UiText } from './UiText.mjs'
import { PcbObjectVisibilityModel } from '../core/PcbObjectVisibilityModel.mjs'
import { DocumentRailRenderer } from './DocumentRailRenderer.mjs'
import { ViewerSidebarComponentRenderer } from './ViewerSidebarComponentRenderer.mjs'
import { ViewerSidebarLayerRenderer } from './ViewerSidebarLayerRenderer.mjs'
import { ViewerSidebarOverviewRenderer } from './ViewerSidebarOverviewRenderer.mjs'

const SIDEBAR_TABS = [
    { id: 'project', icon: 'folder', labelKey: 'sidebar.project' },
    { id: 'layers', icon: 'layers', labelKey: 'sidebar.layers' },
    { id: 'objects', icon: 'objects', labelKey: 'sidebar.objects' },
    { id: 'components', icon: 'chip', labelKey: 'sidebar.components' },
    { id: 'nets', icon: 'nets', labelKey: 'sidebar.nets' },
    { id: 'properties', icon: 'list', labelKey: 'sidebar.properties' },
    { id: 'info', icon: 'info', labelKey: 'sidebar.info' },
    {
        id: 'preferences',
        icon: 'settings',
        labelKey: 'sidebar.preferences',
        placement: 'bottom'
    },
    { id: 'help', icon: 'help', labelKey: 'sidebar.help', placement: 'bottom' }
]

/**
 * Renders the left viewer activity sidebar and active inspector panel.
 */
export class ViewerSidebarRenderer {
    /**
     * Renders the full sidebar for one app snapshot.
     * @param {{ activeSidebarTab?: string, activeView?: string, activeDocumentId?: string, hiddenPcbLayers?: { [documentId: string]: string[] }, hiddenPcbObjects?: { [documentId: string]: string[] }, documents?: { id: string, documentModel: any }[], sessionAssets?: any[], documentModel?: any }} snapshot Viewer snapshot.
     * @param {((key: string) => string) | null} [translate] Translation lookup.
     * @returns {string}
     */
    static render(snapshot, translate = null) {
        const t = UiText.createTranslator(translate)
        const activeTab = ViewerSidebarRenderer.#normalizeTab(
            snapshot?.activeSidebarTab
        )
        const documentModel = snapshot?.documentModel || null

        return (
            '<div class="viewer-sidebar" data-active-sidebar-tab="' +
            ViewerSidebarRenderer.#escapeHtml(activeTab) +
            '" data-active-document-id="' +
            ViewerSidebarRenderer.#escapeHtml(
                String(snapshot?.activeDocumentId || '')
            ) +
            '">' +
            ViewerSidebarRenderer.#renderTabs(activeTab, documentModel, t) +
            '<section class="viewer-sidebar__panel" aria-live="polite">' +
            ViewerSidebarRenderer.#renderPanel(snapshot || {}, activeTab, t) +
            '</section></div>'
        )
    }

    /**
     * Renders the compact control used while the sidebar is hidden.
     * @param {((key: string) => string) | null} [translate] Translation lookup.
     * @returns {string}
     */
    static renderCollapsedToggle(translate = null) {
        const t = UiText.createTranslator(translate)
        const label = t('sidebar.show')

        return (
            '<button class="viewer-sidebar__expand" type="button" data-sidebar-expand="true" title="' +
            ViewerSidebarRenderer.#escapeHtml(label) +
            '" aria-label="' +
            ViewerSidebarRenderer.#escapeHtml(label) +
            '">' +
            ViewerSidebarRenderer.#renderHideSidebarIcon(
                'viewer-sidebar__hide-icon--restore'
            ) +
            '<span class="sr-only">' +
            ViewerSidebarRenderer.#escapeHtml(label) +
            '</span></button>'
        )
    }

    /**
     * Renders the activity buttons.
     * @param {string} activeTab Active tab id.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderTabs(activeTab, documentModel, translate) {
        const topTabs = SIDEBAR_TABS.filter((tab) => tab.placement !== 'bottom')
        const bottomTabs = SIDEBAR_TABS.filter(
            (tab) => tab.placement === 'bottom'
        )

        return (
            '<nav class="viewer-sidebar__tabs" role="tablist" aria-label="' +
            ViewerSidebarRenderer.#escapeHtml(translate('sidebar.aria')) +
            '">' +
            '<div class="viewer-sidebar__tab-group">' +
            topTabs
                .map((tab) =>
                    ViewerSidebarRenderer.#renderTabButton(
                        tab,
                        activeTab,
                        documentModel,
                        translate
                    )
                )
                .join('') +
            '</div><div class="viewer-sidebar__tab-group viewer-sidebar__tab-group--bottom">' +
            bottomTabs
                .map((tab) =>
                    ViewerSidebarRenderer.#renderTabButton(
                        tab,
                        activeTab,
                        documentModel,
                        translate
                    )
                )
                .join('') +
            '</div></nav>'
        )
    }

    /**
     * Renders one sidebar tab button.
     * @param {{ id: string, icon: string, labelKey: string }} tab Tab metadata.
     * @param {string} activeTab Active tab id.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderTabButton(tab, activeTab, documentModel, translate) {
        const selected = tab.id === activeTab
        const label =
            tab.id === 'components'
                ? ViewerSidebarComponentRenderer.panelTitle(
                      documentModel,
                      translate
                  )
                : translate(tab.labelKey)

        return (
            '<button class="viewer-sidebar__tab' +
            (selected ? ' is-active' : '') +
            '" type="button" role="tab" data-sidebar-tab="' +
            ViewerSidebarRenderer.#escapeHtml(tab.id) +
            '" aria-selected="' +
            (selected ? 'true' : 'false') +
            '" title="' +
            ViewerSidebarRenderer.#escapeHtml(label) +
            '" aria-label="' +
            ViewerSidebarRenderer.#escapeHtml(label) +
            '">' +
            ViewerSidebarRenderer.#renderIcon(tab.icon) +
            '<span class="sr-only">' +
            ViewerSidebarRenderer.#escapeHtml(label) +
            '</span></button>'
        )
    }

    /**
     * Renders the active sidebar panel.
     * @param {{ activeView?: string, activeDocumentId?: string, hiddenPcbLayers?: { [documentId: string]: string[] }, hiddenPcbObjects?: { [documentId: string]: string[] }, documents?: { id: string, documentModel: any }[], sessionAssets?: any[], documentModel?: any }} snapshot Viewer snapshot.
     * @param {string} activeTab Active tab id.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderPanel(snapshot, activeTab, translate) {
        const panelMarkup = (() => {
            if (activeTab === 'project') {
                return ViewerSidebarRenderer.#renderProjectPanel(
                    snapshot,
                    translate
                )
            }

            if (activeTab === 'layers') {
                return ViewerSidebarLayerRenderer.render(snapshot, translate)
            }

            if (activeTab === 'objects') {
                return ViewerSidebarRenderer.#renderObjectsPanel(
                    snapshot,
                    translate
                )
            }

            if (activeTab === 'components') {
                return ViewerSidebarComponentRenderer.render(
                    snapshot,
                    translate
                )
            }

            if (activeTab === 'nets') {
                return ViewerSidebarRenderer.#renderNetsPanel(
                    snapshot.documentModel,
                    translate
                )
            }

            if (activeTab === 'properties') {
                return ViewerSidebarRenderer.#renderPropertiesPanel(
                    snapshot.documentModel,
                    translate
                )
            }

            if (activeTab === 'preferences') {
                return ViewerSidebarRenderer.#renderPreferencesPanel(translate)
            }

            if (activeTab === 'help') {
                return ViewerSidebarRenderer.#renderHelpPanel(translate)
            }

            return ViewerSidebarRenderer.#renderInfoPanel(
                snapshot.documentModel,
                translate
            )
        })()
        return ViewerSidebarRenderer.#attachCollapseControl(
            panelMarkup,
            translate
        )
    }

    /**
     * Renders the project document list.
     * @param {{ activeView?: string, activeDocumentId?: string, documents?: { id: string, documentModel: any }[], sessionAssets?: any[] }} snapshot Viewer snapshot.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderProjectPanel(snapshot, translate) {
        const documents = Array.isArray(snapshot.documents)
            ? snapshot.documents
            : []
        const assets = Array.isArray(snapshot.sessionAssets)
            ? snapshot.sessionAssets
            : []
        const activeView = String(snapshot.activeView || '')
        const visibleDocuments = activeView
            ? DocumentRailRenderer.filterDocumentsForView(documents, activeView)
            : documents

        return (
            ViewerSidebarRenderer.#renderDocumentListSection(
                visibleDocuments,
                snapshot.activeDocumentId,
                translate
            ) + ViewerSidebarRenderer.#renderAssetList(assets, translate)
        )
    }

    /**
     * Renders the open document selection panel.
     * @param {{ id: string, documentModel: any }[]} documents Session documents.
     * @param {string | undefined} activeDocumentId Active document id.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderDocumentListSection(documents, activeDocumentId, translate) {
        return (
            ViewerSidebarRenderer.#renderPanelHeader(
                translate('sidebar.openDocuments')
            ) +
            '<div class="viewer-sidebar__list viewer-sidebar__list--documents">' +
            (documents.length
                ? documents
                      .map((entry) =>
                          ViewerSidebarRenderer.#renderDocumentButton(
                              entry,
                              activeDocumentId,
                              translate
                          )
                      )
                      .join('')
                : ViewerSidebarRenderer.#renderEmpty(
                      translate('sidebar.noDocuments')
                  )) +
            '</div>'
        )
    }

    /**
     * Renders one selectable document row.
     * @param {{ id: string, documentModel: any }} entry Document entry.
     * @param {string | undefined} activeDocumentId Active document id.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderDocumentButton(entry, activeDocumentId, translate) {
        const documentModel = entry.documentModel || {}
        const selected = entry.id === activeDocumentId
        const title =
            documentModel.fileName ||
            documentModel.summary?.title ||
            translate('summary.document')

        return (
            '<button class="viewer-sidebar__row viewer-sidebar__row--button' +
            (selected ? ' is-active' : '') +
            '" type="button" data-document-id="' +
            ViewerSidebarRenderer.#escapeHtml(entry.id) +
            '" aria-pressed="' +
            (selected ? 'true' : 'false') +
            '">' +
            '<strong>' +
            ViewerSidebarRenderer.#escapeHtml(title) +
            '</strong><span>' +
            ViewerSidebarRenderer.#escapeHtml(
                ViewerSidebarRenderer.#formatDocumentKind(
                    documentModel,
                    translate
                )
            ) +
            '</span></button>'
        )
    }

    /**
     * Renders companion assets for the current session.
     * @param {any[]} assets Session assets.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderAssetList(assets, translate) {
        if (!assets.length) {
            return ''
        }

        return (
            '<div class="viewer-sidebar__section"><h4>' +
            ViewerSidebarRenderer.#escapeHtml(translate('sidebar.assets')) +
            '</h4><div class="viewer-sidebar__list">' +
            assets
                .map(
                    (asset) =>
                        '<span class="viewer-sidebar__row"><strong>' +
                        ViewerSidebarRenderer.#escapeHtml(
                            asset?.name || asset?.relativePath || ''
                        ) +
                        '</strong><span>' +
                        ViewerSidebarRenderer.#escapeHtml(
                            asset?.format || translate('sidebar.asset')
                        ) +
                        '</span></span>'
                )
                .join('') +
            '</div></div>'
        )
    }

    /**
     * Renders object category controls.
     * @param {{ activeDocumentId?: string, hiddenPcbObjects?: { [documentId: string]: string[] }, pcbObjectOpacities?: { [documentId: string]: { [objectKey: string]: number } }, documentModel?: any }} snapshot Viewer snapshot.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderObjectsPanel(snapshot, translate) {
        const documentModel = snapshot?.documentModel
        if (documentModel?.pcb) {
            const documentId = String(snapshot?.activeDocumentId || '')
            const categories =
                PcbObjectVisibilityModel.resolveObjectCategories()

            return (
                ViewerSidebarRenderer.#renderPanelHeader(
                    translate('sidebar.objects')
                ) +
                '<div class="viewer-sidebar__list viewer-sidebar__list--objects">' +
                categories
                    .map((category) =>
                        ViewerSidebarRenderer.#renderObjectVisibilityRow(
                            category,
                            documentId,
                            snapshot?.hiddenPcbObjects || {},
                            snapshot?.pcbObjectOpacities || {},
                            translate
                        )
                    )
                    .join('') +
                '</div>'
            )
        }

        const rows = [
            [
                'sidebar.objectTracks',
                ViewerSidebarRenderer.#count(documentModel?.pcb?.tracks)
            ],
            [
                'sidebar.objectVias',
                ViewerSidebarRenderer.#count(documentModel?.pcb?.vias)
            ],
            [
                'sidebar.objectPads',
                ViewerSidebarRenderer.#count(documentModel?.pcb?.pads)
            ],
            [
                'sidebar.objectFills',
                ViewerSidebarRenderer.#count(documentModel?.pcb?.fills) +
                    ViewerSidebarRenderer.#count(documentModel?.pcb?.polygons)
            ],
            [
                'sidebar.objectTexts',
                ViewerSidebarRenderer.#count(documentModel?.pcb?.texts) +
                    ViewerSidebarRenderer.#count(
                        documentModel?.schematic?.texts
                    )
            ],
            [
                'sidebar.objectPins',
                ViewerSidebarRenderer.#count(documentModel?.schematic?.pins)
            ]
        ].filter((row) => row[1] > 0)

        return (
            ViewerSidebarRenderer.#renderPanelHeader(
                translate('sidebar.objects')
            ) +
            (rows.length
                ? ViewerSidebarRenderer.#renderKeyValueRows(rows, translate)
                : ViewerSidebarRenderer.#renderEmpty(
                      translate('sidebar.noObjects')
                  ))
        )
    }

    /**
     * Renders one PCB object opacity row.
     * @param {{ key: string, labelKey: string }} category Object category metadata.
     * @param {string} documentId Active document id.
     * @param {{ [documentId: string]: string[] }} hiddenPcbObjects Hidden object map.
     * @param {{ [documentId: string]: { [objectKey: string]: number } }} pcbObjectOpacities Opacity map.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderObjectVisibilityRow(
        category,
        documentId,
        hiddenPcbObjects,
        pcbObjectOpacities,
        translate
    ) {
        const opacity = PcbObjectVisibilityModel.isObjectHidden(
            hiddenPcbObjects,
            documentId,
            category.key
        )
            ? 0
            : PcbObjectVisibilityModel.resolveObjectOpacity(
                  pcbObjectOpacities,
                  documentId,
                  category.key
              )
        const label = translate(category.labelKey)

        return (
            '<label class="viewer-sidebar__row viewer-sidebar__row--object">' +
            '<strong>' +
            ViewerSidebarRenderer.#escapeHtml(label) +
            '</strong><span class="viewer-sidebar__object-slider"><input class="viewer-sidebar__object-opacity" type="range" min="0" max="100" step="5" data-pcb-object-opacity-key="' +
            ViewerSidebarRenderer.#escapeHtml(category.key) +
            '" data-document-id="' +
            ViewerSidebarRenderer.#escapeHtml(documentId) +
            '" value="' +
            ViewerSidebarRenderer.#escapeHtml(opacity) +
            '"><span class="viewer-sidebar__object-opacity-value" aria-hidden="true">' +
            ViewerSidebarRenderer.#escapeHtml(opacity) +
            '%</span></span></label>'
        )
    }

    /**
     * Renders net rows.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderNetsPanel(documentModel, translate) {
        const nets = ViewerSidebarRenderer.#resolveNets(documentModel)

        return (
            ViewerSidebarRenderer.#renderPanelHeader(
                translate('sidebar.nets')
            ) +
            (nets.length
                ? '<div class="viewer-sidebar__list">' +
                  nets
                      .map(
                          (net) =>
                              '<span class="viewer-sidebar__row"><strong>' +
                              ViewerSidebarRenderer.#escapeHtml(net.name) +
                              '</strong><span>' +
                              ViewerSidebarRenderer.#escapeHtml(net.detail) +
                              '</span></span>'
                      )
                      .join('') +
                  '</div>'
                : ViewerSidebarRenderer.#renderEmpty(
                      translate('sidebar.noNets')
                  ))
        )
    }

    /**
     * Renders document-level properties.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderPropertiesPanel(documentModel, translate) {
        const rows = [
            ['sidebar.propertyFile', documentModel?.fileName],
            [
                'sidebar.propertyType',
                ViewerSidebarRenderer.#formatDocumentKind(
                    documentModel,
                    translate
                )
            ],
            ['summary.components', documentModel?.summary?.componentCount],
            ['summary.layers', documentModel?.summary?.layerCount],
            ['sidebar.objectTracks', documentModel?.summary?.trackCount],
            ['sidebar.objectVias', documentModel?.summary?.viaCount],
            [
                'view.diagnostics',
                Array.isArray(documentModel?.diagnostics)
                    ? documentModel.diagnostics.length
                    : 0
            ]
        ].filter((row) => row[1] !== undefined && row[1] !== '')

        return (
            ViewerSidebarRenderer.#renderPanelHeader(
                translate('sidebar.properties')
            ) + ViewerSidebarRenderer.#renderKeyValueRows(rows, translate)
        )
    }

    /**
     * Renders document info rows.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderInfoPanel(documentModel, translate) {
        if (documentModel?.pcb || documentModel?.schematic) {
            return ViewerSidebarOverviewRenderer.render(
                documentModel,
                translate
            )
        }

        return (
            ViewerSidebarRenderer.#renderPanelHeader(
                translate('sidebar.info')
            ) +
            ViewerSidebarRenderer.#renderEmpty(translate('sidebar.noDocument'))
        )
    }

    /**
     * Renders available preferences.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderPreferencesPanel(translate) {
        const rows = [
            [
                'sidebar.preferenceTheme',
                translate('sidebar.preferenceThemeValue')
            ],
            [
                'sidebar.preferenceDensity',
                translate('sidebar.preferenceDensityValue')
            ],
            [
                'sidebar.preferenceSwatches',
                translate('sidebar.preferenceSwatchesValue')
            ]
        ]

        return (
            ViewerSidebarRenderer.#renderPanelHeader(
                translate('sidebar.preferences')
            ) + ViewerSidebarRenderer.#renderKeyValueRows(rows, translate)
        )
    }

    /**
     * Renders compact help content.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderHelpPanel(translate) {
        return (
            ViewerSidebarRenderer.#renderPanelHeader(
                translate('sidebar.help')
            ) +
            '<div class="viewer-sidebar__list">' +
            ['sidebar.helpOpen', 'sidebar.helpSwitch', 'sidebar.helpInspect']
                .map(
                    (key) =>
                        '<span class="viewer-sidebar__row"><strong>' +
                        ViewerSidebarRenderer.#escapeHtml(translate(key)) +
                        '</strong></span>'
                )
                .join('') +
            '</div>'
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
            ViewerSidebarRenderer.#escapeHtml(title) +
            '</h3></header>'
        )
    }

    /**
     * Adds the shared hide control to the first panel heading.
     * @param {string} panelMarkup Active panel HTML.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #attachCollapseControl(panelMarkup, translate) {
        const markup = String(panelMarkup || '')
        const headerEnd = '</h3></header>'
        const button = ViewerSidebarRenderer.#renderCollapseButton(translate)

        return markup.includes(headerEnd)
            ? markup.replace(headerEnd, '</h3>' + button + '</header>')
            : button + markup
    }

    /**
     * Renders the sidebar hide button.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderCollapseButton(translate) {
        const label = translate('sidebar.hide')

        return (
            '<button class="viewer-sidebar__collapse" type="button" data-sidebar-collapse="true" title="' +
            ViewerSidebarRenderer.#escapeHtml(label) +
            '" aria-label="' +
            ViewerSidebarRenderer.#escapeHtml(label) +
            '">' +
            ViewerSidebarRenderer.#renderHideSidebarIcon() +
            '<span class="sr-only">' +
            ViewerSidebarRenderer.#escapeHtml(label) +
            '</span></button>'
        )
    }

    /**
     * Renders key/value rows.
     * @param {[string, any][]} rows Label/value tuples.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderKeyValueRows(rows, translate) {
        return (
            '<table class="viewer-sidebar__table"><tbody>' +
            rows
                .map(
                    ([labelKey, value]) =>
                        '<tr><th>' +
                        ViewerSidebarRenderer.#escapeHtml(translate(labelKey)) +
                        '</th><td>' +
                        ViewerSidebarRenderer.#escapeHtml(String(value)) +
                        '</td></tr>'
                )
                .join('') +
            '</tbody></table>'
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
            ViewerSidebarRenderer.#escapeHtml(message) +
            '</p>'
        )
    }

    /**
     * Resolves normalized net rows from known model locations.
     * @param {any} documentModel Active document model.
     * @returns {{ name: string, detail: string }[]}
     */
    static #resolveNets(documentModel) {
        const nets =
            documentModel?.nets ||
            documentModel?.pcb?.nets ||
            documentModel?.schematic?.nets ||
            []

        if (!Array.isArray(nets)) {
            return []
        }

        return nets
            .map((net) => {
                if (typeof net === 'string') {
                    return { name: net, detail: '' }
                }

                return {
                    name: String(net?.name || net?.label || net?.netName || ''),
                    detail: ViewerSidebarRenderer.#formatNetDetail(net)
                }
            })
            .filter((net) => net.name)
    }

    /**
     * Formats one document type label.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #formatDocumentKind(documentModel, translate) {
        if (documentModel?.pcb) {
            return translate('view.pcb')
        }

        if (documentModel?.schematic) {
            return translate('view.schematic')
        }

        return String(documentModel?.kind || translate('summary.document'))
    }

    /**
     * Formats a net detail string.
     * @param {any} net Net metadata.
     * @returns {string}
     */
    static #formatNetDetail(net) {
        const count =
            net?.pinCount ??
            net?.pins?.length ??
            net?.nodes?.length ??
            net?.members?.length
        return count ? String(count) + ' pins' : ''
    }

    /**
     * Counts array-like model values.
     * @param {any} value Raw value.
     * @returns {number}
     */
    static #count(value) {
        return Array.isArray(value) ? value.length : 0
    }

    /**
     * Normalizes sidebar tab ids.
     * @param {any} value Raw tab id.
     * @returns {string}
     */
    static #normalizeTab(value) {
        const normalized = String(value || 'info')
        return SIDEBAR_TABS.some((tab) => tab.id === normalized)
            ? normalized
            : 'info'
    }

    /**
     * Renders one icon.
     * @param {string} icon Icon id.
     * @returns {string}
     */
    static #renderIcon(icon) {
        const paths = {
            folder: '<path d="M3 7h6l2 2h10v10H3z" />',
            layers: '<path d="m12 3 8 4.5-8 4.5-8-4.5z" /><path d="m4 12 8 4.5 8-4.5" /><path d="m4 16.5 8 4.5 8-4.5" />',
            objects:
                '<path d="M12 3v5" /><path d="M12 16v5" /><path d="M3 12h5" /><path d="M16 12h5" /><circle cx="12" cy="12" r="4" />',
            chip: '<rect x="7" y="7" width="10" height="10" rx="2" /><path d="M4 10h3" /><path d="M4 14h3" /><path d="M17 10h3" /><path d="M17 14h3" /><path d="M10 4v3" /><path d="M14 4v3" /><path d="M10 17v3" /><path d="M14 17v3" />',
            nets: '<circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 11 16 7" /><path d="M8 13 16 17" />',
            list: '<path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h1" /><path d="M3 12h1" /><path d="M3 18h1" />',
            info: '<circle cx="12" cy="12" r="9" /><path d="M12 10v6" /><path d="M12 7h.01" />',
            settings:
                '<circle cx="12" cy="12" r="3" /><path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="m5.6 5.6 2.1 2.1" /><path d="m16.3 16.3 2.1 2.1" /><path d="m18.4 5.6-2.1 2.1" /><path d="m7.7 16.3-2.1 2.1" />',
            help: '<circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.1 2.3c-.9.5-1.6 1.1-1.6 2.2" /><path d="M12 17h.01" />'
        }

        return (
            '<svg class="icon viewer-sidebar__icon" viewBox="0 0 24 24" aria-hidden="true">' +
            (paths[icon] || paths.info) +
            '</svg>'
        )
    }

    /**
     * Renders the sidebar hide glyph.
     * @param {string} [extraClass] Additional SVG class.
     * @returns {string}
     */
    static #renderHideSidebarIcon(extraClass = '') {
        return (
            '<svg class="icon viewer-sidebar__hide-icon' +
            (extraClass
                ? ' ' + ViewerSidebarRenderer.#escapeHtml(extraClass)
                : '') +
            '" viewBox="0 0 24 24" aria-hidden="true">' +
            '<rect x="4" y="5" width="16" height="14" rx="2" />' +
            '<path d="M9 5v14" />' +
            '<path d="M17 12h-6" />' +
            '<path d="m13 9-3 3 3 3" />' +
            '</svg>'
        )
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
