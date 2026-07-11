import { ViewerSidebarManufacturingActions } from './ViewerSidebarManufacturingActions.mjs'
import { ViewerSidebarSupportCoverageRenderer } from './ViewerSidebarSupportCoverageRenderer.mjs'
import { SimulationResultPanelRenderer } from './SimulationResultPanelRenderer.mjs'
import { EcadDocumentDiagnostics } from '../core/ecad/EcadDocumentDiagnostics.mjs'
import { EcadDocumentBom } from '../core/ecad/EcadDocumentBom.mjs'
import { EcadDocumentSupportMatrix } from '../core/ecad/EcadDocumentSupportMatrix.mjs'
import { EcadDocumentSummary } from '../core/ecad/EcadDocumentSummary.mjs'
import { EcadDocumentType } from '../core/ecad/EcadDocumentType.mjs'

/**
 * Renders the loaded-document overview shown in the viewer sidebar.
 */
export class ViewerSidebarOverviewRenderer {
    /**
     * Renders the overview panel for the active document.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {{ showModelZipExport?: boolean, documentId?: string }} [options] Render options.
     * @returns {string}
     */
    static render(documentModel, translate, options = {}) {
        const title = EcadDocumentType.isPcb(documentModel)
            ? translate('sidebar.boardOverview')
            : translate('sidebar.sheetOverview')

        return (
            '<div class="viewer-sidebar__overview">' +
            '<header class="viewer-sidebar__panel-header"><h3>' +
            ViewerSidebarOverviewRenderer.#escapeHtml(title) +
            '</h3></header>' +
            ViewerSidebarOverviewRenderer.#renderPreviewCard(
                documentModel,
                translate
            ) +
            ViewerSidebarOverviewRenderer.#renderOverviewActions(
                documentModel,
                translate,
                options
            ) +
            ViewerSidebarOverviewRenderer.#renderOverviewGrid(
                documentModel,
                translate
            ) +
            ViewerSidebarSupportCoverageRenderer.render(
                EcadDocumentSupportMatrix.resolve(documentModel)
            ) +
            SimulationResultPanelRenderer.render(documentModel) +
            ViewerSidebarOverviewRenderer.#renderOverviewMeta(
                documentModel,
                translate
            ) +
            '</div>'
        )
    }

    /**
     * Renders document-level actions in the overview panel.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {{ showModelZipExport?: boolean, documentId?: string }} options Render options.
     * @returns {string}
     */
    static #renderOverviewActions(documentModel, translate, options) {
        const documentId = String(options?.documentId || '')
        const actions =
            EcadDocumentType.isPcb(documentModel) &&
            options.showModelZipExport === true
                ? [
                      {
                          attribute: 'data-pcb-assembly-export-format="step"',
                          label: translate('scene3d.exportAssemblyStep')
                      },
                      {
                          attribute: 'data-pcb-assembly-export-format="wrl"',
                          label: translate('scene3d.exportAssemblyWrl')
                      },
                      {
                          attribute: 'data-pcb-assembly-export-format="glb"',
                          label: translate('scene3d.exportAssemblyGlb')
                      },
                      {
                          attribute: 'data-scene-3d-export="models-zip"',
                          label: translate('scene3d.downloadModelsZip')
                      }
                  ]
                : []
        actions.push(...ViewerSidebarManufacturingActions.build(documentModel))
        if (!actions.length) return ''

        return (
            '<div class="viewer-sidebar__model-export viewer-sidebar__overview-actions">' +
            '<div class="viewer-sidebar__model-export-actions">' +
            actions
                .map(
                    (action) =>
                        '<button class="viewer-sidebar__model-export-button viewer-sidebar__overview-action" type="button" data-document-id="' +
                        ViewerSidebarOverviewRenderer.#escapeHtml(documentId) +
                        '" ' +
                        action.attribute +
                        '>' +
                        ViewerSidebarOverviewRenderer.#renderOverviewActionIcon() +
                        '<span class="viewer-sidebar__model-export-label">' +
                        ViewerSidebarOverviewRenderer.#escapeHtml(
                            action.label
                        ) +
                        '</span></button>'
                )
                .join('') +
            '</div></div>'
        )
    }

    /**
     * Renders the thumbnail and primary title card.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderPreviewCard(documentModel, translate) {
        const title = ViewerSidebarOverviewRenderer.#documentTitle(
            documentModel,
            translate
        )
        const revision =
            documentModel?.source?.revision ||
            documentModel?.summary?.revision ||
            documentModel?.revision ||
            documentModel?.pcb?.revision ||
            ''

        return (
            '<article class="viewer-sidebar__preview-card">' +
            '<span class="viewer-sidebar__preview-viewport" aria-hidden="true">' +
            ViewerSidebarOverviewRenderer.#renderMiniature(documentModel) +
            '</span><span class="viewer-sidebar__preview-copy"><strong>' +
            ViewerSidebarOverviewRenderer.#escapeHtml(title) +
            '</strong>' +
            (revision
                ? '<span class="viewer-sidebar__revision">' +
                  ViewerSidebarOverviewRenderer.#escapeHtml(String(revision)) +
                  '</span>'
                : '') +
            '</span></article>'
        )
    }

    /**
     * Renders compact overview rows.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderOverviewGrid(documentModel, translate) {
        const rows = ViewerSidebarOverviewRenderer.#overviewRows(
            documentModel,
            translate
        )

        return (
            '<div class="viewer-sidebar__overview-grid">' +
            rows
                .map((row) =>
                    ViewerSidebarOverviewRenderer.#renderOverviewRow(row)
                )
                .join('') +
            '</div>'
        )
    }

    /**
     * Renders one overview metric row.
     * @param {{ key: string, icon: string, label: string, value: string, secondaryValue?: string }} row Row definition.
     * @returns {string}
     */
    static #renderOverviewRow(row) {
        return (
            '<article class="viewer-sidebar__overview-row" data-overview-key="' +
            ViewerSidebarOverviewRenderer.#escapeHtml(row.key) +
            '">' +
            '<span class="viewer-sidebar__overview-icon" aria-hidden="true">' +
            ViewerSidebarOverviewRenderer.#renderIcon(row.icon) +
            '</span><span class="viewer-sidebar__overview-label">' +
            ViewerSidebarOverviewRenderer.#escapeHtml(row.label) +
            '</span>' +
            ViewerSidebarOverviewRenderer.#renderOverviewValue(row) +
            '</article>'
        )
    }

    /**
     * Renders the primary and optional secondary overview value.
     * @param {{ value: string, secondaryValue?: string }} row Row definition.
     * @returns {string}
     */
    static #renderOverviewValue(row) {
        if (!row.secondaryValue) {
            return (
                '<strong>' +
                ViewerSidebarOverviewRenderer.#escapeHtml(row.value || '-') +
                '</strong>'
            )
        }

        return (
            '<strong class="viewer-sidebar__overview-value viewer-sidebar__overview-value--stacked">' +
            '<span>' +
            ViewerSidebarOverviewRenderer.#escapeHtml(row.value || '-') +
            '</span><span class="viewer-sidebar__overview-subvalue">' +
            ViewerSidebarOverviewRenderer.#escapeHtml(row.secondaryValue) +
            '</span></strong>'
        )
    }

    /**
     * Builds overview row definitions for PCB and schematic documents.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {{ key: string, icon: string, label: string, value: string, secondaryValue?: string }[]}
     */
    static #overviewRows(documentModel, translate) {
        const summary = EcadDocumentSummary.resolve(documentModel)
        if (summary.kind === 'pcb') {
            const boardDimensions =
                ViewerSidebarOverviewRenderer.#formatBoardDimensions(
                    documentModel
                )

            return [
                {
                    key: 'active-file',
                    icon: 'file',
                    label: translate('app.activeFile'),
                    value: summary.fileName || '-'
                },
                {
                    key: 'diagnostics',
                    icon: 'status',
                    label: translate('app.diagnostics'),
                    value: ViewerSidebarOverviewRenderer.#formatDiagnosticsCount(
                        documentModel,
                        translate
                    )
                },
                {
                    key: 'title',
                    icon: 'file',
                    label: translate('sidebar.infoTitle'),
                    value: ViewerSidebarOverviewRenderer.#documentTitle(
                        documentModel,
                        translate
                    )
                },
                {
                    key: 'footprint',
                    icon: 'target',
                    label: translate('scene3d.footprint'),
                    value: boardDimensions.value,
                    secondaryValue: boardDimensions.secondaryValue
                },
                {
                    key: 'placements',
                    icon: 'chip',
                    label: translate('scene3d.placements'),
                    value: ViewerSidebarOverviewRenderer.#formatPlacementCount(
                        documentModel,
                        translate
                    )
                },
                {
                    key: 'bom-groups',
                    icon: 'list',
                    label: translate('scene3d.bomGroups'),
                    value: String(
                        ViewerSidebarOverviewRenderer.#bomGroupCount(
                            documentModel
                        )
                    )
                },
                {
                    key: 'layers',
                    icon: 'layers',
                    label: translate('summary.layers'),
                    value: String(summary.layerCount || 0)
                },
                {
                    key: 'outline',
                    icon: 'outline',
                    label: translate('summary.outlineSegments'),
                    value: String(
                        ViewerSidebarOverviewRenderer.#outlineSegmentCount(
                            documentModel
                        )
                    )
                },
                {
                    key: 'line-segments',
                    icon: 'list',
                    label: translate('summary.lineSegments'),
                    value: String(
                        ViewerSidebarOverviewRenderer.#lineSegmentCount(
                            documentModel
                        )
                    )
                },
                {
                    key: 'tracks',
                    icon: 'nets',
                    label: translate('sidebar.objectTracks'),
                    value: String(summary.trackCount || 0)
                },
                {
                    key: 'vias',
                    icon: 'objects',
                    label: translate('sidebar.objectVias'),
                    value: String(summary.viaCount || 0)
                }
            ]
        }

        return [
            {
                key: 'active-file',
                icon: 'file',
                label: translate('app.activeFile'),
                value: summary.fileName || '-'
            },
            {
                key: 'diagnostics',
                icon: 'status',
                label: translate('app.diagnostics'),
                value: ViewerSidebarOverviewRenderer.#formatDiagnosticsCount(
                    documentModel,
                    translate
                )
            },
            {
                key: 'title',
                icon: 'file',
                label: translate('sidebar.infoTitle'),
                value: ViewerSidebarOverviewRenderer.#documentTitle(
                    documentModel,
                    translate
                )
            },
            {
                key: 'size',
                icon: 'outline',
                label: translate('sidebar.infoSize'),
                value: summary.sheetSize || '-'
            },
            {
                key: 'components',
                icon: 'chip',
                label: translate('sidebar.symbols'),
                value: String(summary.componentCount || 0)
            },
            {
                key: 'line-segments',
                icon: 'list',
                label: translate('summary.lineSegments'),
                value: String(
                    ViewerSidebarOverviewRenderer.#lineSegmentCount(
                        documentModel
                    )
                )
            },
            {
                key: 'texts',
                icon: 'list',
                label: translate('summary.texts'),
                value: String(summary.textCount || 0)
            }
        ]
    }

    /**
     * Renders secondary metadata rows.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderOverviewMeta(documentModel, translate) {
        const modified = ViewerSidebarOverviewRenderer.#firstValue(
            documentModel?.source || documentModel,
            ['modifiedAt', 'lastModified', 'sourceModifiedAt']
        )

        if (!modified) {
            return ''
        }

        return (
            '<dl class="viewer-sidebar__overview-meta">' +
            '<div><dt>' +
            ViewerSidebarOverviewRenderer.#escapeHtml(
                translate('sidebar.lastUpdated')
            ) +
            '</dt><dd>' +
            ViewerSidebarOverviewRenderer.#escapeHtml(modified) +
            '</dd></div></dl>'
        )
    }

    /**
     * Renders a compact decorative document miniature.
     * @param {any} documentModel Active document model.
     * @returns {string}
     */
    static #renderMiniature(documentModel) {
        if (!EcadDocumentType.isPcb(documentModel)) {
            return (
                '<svg viewBox="0 0 120 90" class="viewer-sidebar__miniature viewer-sidebar__miniature--schematic">' +
                '<rect x="18" y="16" width="84" height="58" rx="4" />' +
                '<path d="M30 34h18m12 0h20M42 52h32" />' +
                '<circle cx="54" cy="34" r="3" /><circle cx="82" cy="52" r="3" />' +
                '</svg>'
            )
        }

        return (
            '<svg viewBox="0 0 120 90" class="viewer-sidebar__miniature viewer-sidebar__miniature--pcb">' +
            '<rect x="20" y="12" width="80" height="66" rx="7" />' +
            '<path d="M36 22v56M84 22v56" />' +
            '<path d="M38 32h18l9 10h18M38 45h24l10 12h12M38 58h16l11-9h18" />' +
            '<path d="M56 42h18M55 57h17" />' +
            '<circle cx="35" cy="25" r="3" /><circle cx="35" cy="37" r="3" />' +
            '<circle cx="35" cy="49" r="3" /><circle cx="35" cy="61" r="3" />' +
            '<circle cx="85" cy="25" r="3" /><circle cx="85" cy="37" r="3" />' +
            '<circle cx="85" cy="49" r="3" /><circle cx="85" cy="61" r="3" />' +
            '<rect x="55" y="34" width="20" height="20" rx="3" />' +
            '</svg>'
        )
    }

    /**
     * Resolves a display title.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #documentTitle(documentModel, translate) {
        return (
            EcadDocumentSummary.resolve(documentModel).title ||
            translate('summary.document')
        )
    }

    /**
     * Formats board dimensions in imperial and metric units.
     * @param {any} documentModel Active document model.
     * @returns {{ value: string, secondaryValue: string }}
     */
    static #formatBoardDimensions(documentModel) {
        const summary = EcadDocumentSummary.resolve(documentModel)
        const width = ViewerSidebarOverviewRenderer.#positiveNumber(
            summary.boardWidthMil
        )
        const height = ViewerSidebarOverviewRenderer.#positiveNumber(
            summary.boardHeightMil
        )

        if (!width || !height) {
            return { value: '', secondaryValue: '' }
        }

        return {
            value:
                ViewerSidebarOverviewRenderer.#formatDimensionNumber(width) +
                ' x ' +
                ViewerSidebarOverviewRenderer.#formatDimensionNumber(height) +
                ' mil',
            secondaryValue:
                ViewerSidebarOverviewRenderer.#formatDimensionNumber(
                    width * 0.0254
                ) +
                ' x ' +
                ViewerSidebarOverviewRenderer.#formatDimensionNumber(
                    height * 0.0254
                ) +
                ' mm'
        }
    }

    /**
     * Formats a dimension number without unnecessary trailing decimals.
     * @param {number} value Dimension value.
     * @returns {string}
     */
    static #formatDimensionNumber(value) {
        return value.toFixed(2).replace(/\.?0+$/, '')
    }

    /**
     * Resolves a positive finite number.
     * @param {unknown} value Candidate value.
     * @returns {number | null}
     */
    static #positiveNumber(value) {
        const number = Number(value)

        return Number.isFinite(number) && number > 0 ? number : null
    }

    /**
     * Formats the 3D placement count with the same suffix used in the scene.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #formatPlacementCount(documentModel, translate) {
        return (
            String(
                ViewerSidebarOverviewRenderer.#placementCount(documentModel)
            ) +
            ' ' +
            translate('scene3d.componentsSuffix')
        )
    }

    /**
     * Counts PCB placements from the source used by the 3D scene shell.
     * @param {any} documentModel Active document model.
     * @returns {number}
     */
    static #placementCount(documentModel) {
        const summaryCount = Number(
            EcadDocumentSummary.resolve(documentModel).placementCount
        )
        return Number.isFinite(summaryCount) ? summaryCount : 0
    }

    /**
     * Counts BOM groups from the loaded BOM table metadata.
     * @param {any} documentModel Active document model.
     * @returns {number}
     */
    static #bomGroupCount(documentModel) {
        const bomRows = EcadDocumentBom.resolve(documentModel)
        if (bomRows.length) return bomRows.length

        const summaryCount = Number(
            documentModel?.summary?.bomGroupCount ??
                documentModel?.summary?.bomRowCount
        )
        return Number.isFinite(summaryCount) ? summaryCount : 0
    }

    /**
     * Formats the diagnostics count like the removed summary strip.
     * @param {any} documentModel Active document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #formatDiagnosticsCount(documentModel, translate) {
        const count = EcadDocumentDiagnostics.resolve(documentModel).length

        return String(count) + ' ' + translate('summary.records')
    }

    /**
     * Resolves board outline segment count from summary or board metadata.
     * @param {any} documentModel Active document model.
     * @returns {number}
     */
    static #outlineSegmentCount(documentModel) {
        const summaryCount = Number(
            EcadDocumentSummary.resolve(documentModel).outlineSegmentCount
        )
        if (Number.isFinite(summaryCount) && summaryCount > 0) {
            return summaryCount
        }

        const outline = documentModel?.pcb?.boardOutline || {}
        const candidates = [
            outline.segments,
            outline.outlineSegments,
            documentModel?.pcb?.outlineSegments
        ]

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate.length
            }
        }

        return 0
    }

    /**
     * Resolves the visible line-segment metric from summary or object arrays.
     * @param {any} documentModel Active document model.
     * @returns {number}
     */
    static #lineSegmentCount(documentModel) {
        const summary = EcadDocumentSummary.resolve(documentModel)
        const summaryCount = Number(summary.lineSegmentCount)
        if (Number.isFinite(summaryCount) && summaryCount >= 0) {
            return summaryCount
        }

        const trackCount = Number(summary.trackCount)
        if (Number.isFinite(trackCount) && trackCount >= 0) {
            return trackCount
        }

        const candidates = [
            documentModel?.pcb?.tracks,
            documentModel?.pcb?.kicadBoard?.tracks,
            documentModel?.pcb?.kicadBoard?.drawings,
            documentModel?.schematic?.lines
        ]

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate.length
            }
        }

        return 0
    }

    /**
     * Returns the first present value from a source object.
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
     * Renders a compact icon.
     * @param {string} icon Icon id.
     * @returns {string}
     */
    static #renderIcon(icon) {
        const paths = {
            file: '<path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5" />',
            outline:
                '<rect x="5" y="5" width="14" height="14" rx="3" /><path d="M9 5V3" /><path d="M15 19v2" /><path d="M19 9h2" /><path d="M3 15h2" />',
            chip: '<rect x="7" y="7" width="10" height="10" rx="2" /><path d="M4 10h3" /><path d="M4 14h3" /><path d="M17 10h3" /><path d="M17 14h3" />',
            layers: '<path d="m12 3 8 4.5-8 4.5-8-4.5z" /><path d="m4 12 8 4.5 8-4.5" />',
            nets: '<circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 11 16 7" /><path d="M8 13 16 17" />',
            objects:
                '<path d="M12 3v5" /><path d="M12 16v5" /><path d="M3 12h5" /><path d="M16 12h5" /><circle cx="12" cy="12" r="4" />',
            list: '<path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />',
            status: '<path d="M4 12h4l2-6 4 12 2-6h4" />',
            target: '<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" />'
        }

        return (
            '<svg class="icon" viewBox="0 0 24 24">' +
            (paths[icon] || paths.file) +
            '</svg>'
        )
    }

    /**
     * Renders the overview action download icon.
     * @returns {string}
     */
    static #renderOverviewActionIcon() {
        return (
            '<svg class="icon viewer-sidebar__model-export-icon" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M12 3v12" />' +
            '<path d="m7 10 5 5 5-5" />' +
            '<path d="M5 21h14" />' +
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
