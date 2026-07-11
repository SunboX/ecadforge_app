import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { EcadDocumentDiagnostics } from '../core/ecad/EcadDocumentDiagnostics.mjs'
import { EcadDocumentBom } from '../core/ecad/EcadDocumentBom.mjs'
import { EcadDocumentSummary } from '../core/ecad/EcadDocumentSummary.mjs'
import { EcadDocumentType } from '../core/ecad/EcadDocumentType.mjs'
import { DocumentViewCompatibility } from '../DocumentViewCompatibility.mjs'
import { UiText } from './UiText.mjs'

/**
 * Renders multi-document rail cards and diagnostics-only panels.
 */
export class DocumentRailRenderer {
    /**
     * Renders the diagnostics tab.
     * @param {{ severity: string, message: string }[]} diagnostics
     * @param {((key: string) => string) | null} [translate] Translation lookup.
     * @returns {string}
     */
    static renderDiagnostics(diagnostics, translate = null) {
        const t = UiText.createTranslator(translate)
        if (!diagnostics.length) {
            return (
                '<section class="viewer-empty">' +
                DocumentRailRenderer.#escapeHtml(t('diagnostics.none')) +
                '</section>'
            )
        }

        return (
            '<section class="diagnostics-panel"><header class="svg-panel__header"><h3>' +
            DocumentRailRenderer.#escapeHtml(t('diagnostics.title')) +
            '</h3><p>' +
            diagnostics.length +
            ' ' +
            DocumentRailRenderer.#escapeHtml(t('diagnostics.messagesSuffix')) +
            '</p></header><ul class="diagnostics-list">' +
            diagnostics
                .map(
                    (diagnostic) =>
                        '<li class="diagnostic diagnostic--' +
                        DocumentRailRenderer.#escapeHtml(diagnostic.severity) +
                        '"><span class="diagnostic__severity">' +
                        DocumentRailRenderer.#escapeHtml(diagnostic.severity) +
                        '</span><p>' +
                        DocumentRailRenderer.#escapeHtml(diagnostic.message) +
                        '</p></li>'
                )
                .join('') +
            '</ul></section>'
        )
    }

    /**
     * Filters session documents to the files that can render the active view.
     * @param {{ id: string, documentModel: any }[]} documents
     * @param {string} activeView
     * @returns {{ id: string, documentModel: any }[]}
     */
    static filterDocumentsForView(documents, activeView) {
        return documents.filter((entry) =>
            DocumentRailRenderer.#supportsView(entry.documentModel, activeView)
        )
    }

    /**
     * Renders one preview-rail card for a loaded document.
     * @param {{ id: string, documentModel: any }} entry
     * @param {string} activeDocumentId
     * @param {string} activeView
     * @param {((key: string) => string) | null} [translate] Translation lookup.
     * @returns {string}
     */
    static renderCard(entry, activeDocumentId, activeView, translate = null) {
        const t = UiText.createTranslator(translate)
        const isActive = entry.id === activeDocumentId
        const documentModel = entry.documentModel
        const summary = EcadDocumentSummary.resolve(documentModel)
        const previewMarkup = DocumentRailRenderer.#renderDocumentPreview(
            entry.id,
            documentModel,
            activeView,
            t
        )

        return (
            '<button class="document-rail__item' +
            (isActive ? ' is-active' : '') +
            '" type="button" data-document-id="' +
            DocumentRailRenderer.#escapeHtml(entry.id) +
            '" aria-pressed="' +
            (isActive ? 'true' : 'false') +
            '">' +
            '<span class="document-rail__preview">' +
            previewMarkup +
            '</span>' +
            '<span class="document-rail__name">' +
            DocumentRailRenderer.#escapeHtml(
                summary.fileName ||
                    summary.title ||
                    t('summary.document')
            ) +
            '</span>' +
            '</button>'
        )
    }

    /**
     * Renders one compact preview for the preview rail.
     * @param {string} documentId
     * @param {any} documentModel
     * @param {string} activeView
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderDocumentPreview(
        documentId,
        documentModel,
        activeView,
        translate
    ) {
        if (activeView === 'schematic') {
            return DocumentRailRenderer.#extractPreviewSvgMarkup(
                EcadRendererService.renderSchematic(documentModel),
                'schematic-svg',
                'document-preview__svg document-preview__svg--schematic',
                documentId,
                translate
            )
        }

        if (activeView === 'pcb') {
            return DocumentRailRenderer.#extractPreviewSvgMarkup(
                EcadRendererService.renderPcb(documentModel),
                'pcb-svg',
                'document-preview__svg document-preview__svg--pcb',
                documentId,
                translate
            )
        }

        if (activeView === 'bom') {
            return DocumentRailRenderer.#renderPreviewSummary(
                'BOM',
                String(EcadDocumentBom.resolve(documentModel).length) +
                    ' ' +
                    translate('preview.groupedRows'),
                EcadDocumentType.isSchematic(documentModel)
                    ? translate('preview.recoveredFromSheet')
                    : translate('preview.recoveredFromBoard')
            )
        }

        if (activeView === '3d') {
            const summary = EcadDocumentSummary.resolve(documentModel)
            return DocumentRailRenderer.#renderPreviewSummary(
                '3D',
                String(summary.boardWidthMil || 0) +
                    ' x ' +
                    String(summary.boardHeightMil || 0) +
                    ' mil',
                String(summary.placementCount || 0) +
                    ' ' +
                    translate('preview.placementsSuffix')
            )
        }

        const diagnosticsCount =
            EcadDocumentDiagnostics.resolve(documentModel).length
        return DocumentRailRenderer.#renderPreviewSummary(
            translate('view.diagnostics'),
            String(diagnosticsCount) +
                ' ' +
                translate('diagnostics.messagesSuffix'),
            diagnosticsCount > 0
                ? translate('preview.parserFindings')
                : translate('preview.noDiagnosticsEmitted')
        )
    }

    /**
     * Extracts the rendered SVG from a full renderer panel and rewrites its
     * ids and root class for safe use inside the preview rail.
     * @param {string} markup
     * @param {string} sourceClassName
     * @param {string} previewClassName
     * @param {string} documentId
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #extractPreviewSvgMarkup(
        markup,
        sourceClassName,
        previewClassName,
        documentId,
        translate
    ) {
        const escapedClassName = sourceClassName.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        )
        const svgMatch = markup.match(
            new RegExp(
                '<svg\\b(?=[^>]*\\bclass="([^"]*\\b' +
                    escapedClassName +
                    '\\b[^"]*)")[^>]*>[\\s\\S]*?<\\/svg>'
            )
        )

        if (!svgMatch) {
            return DocumentRailRenderer.#renderPreviewSummary(
                translate('preview.label'),
                translate('preview.unavailable'),
                translate('preview.markupUnavailable')
            )
        }

        const previewSvgMarkup = svgMatch[0].replace(
            /class="[^"]*"/,
            'class="' +
                DocumentRailRenderer.#previewSvgClassName(
                    svgMatch[1],
                    previewClassName
                ) +
                '"'
        )

        return DocumentRailRenderer.#prefixSvgMarkupIds(
            previewSvgMarkup,
            'preview-' + documentId
        )
    }

    /**
     * Preserves source renderer modifier classes on preview SVGs.
     * @param {string} sourceClassList Original SVG class attribute.
     * @param {string} previewClassName Preview class replacement.
     * @returns {string}
     */
    static #previewSvgClassName(sourceClassList, previewClassName) {
        const retainedModifiers = String(sourceClassList)
            .split(/\s+/)
            .filter((className) => /--[a-z0-9-]+$/i.test(className))

        return [previewClassName, ...retainedModifiers].join(' ')
    }

    /**
     * Prefixes in-markup ids and matching `url(#...)` references so repeated
     * preview SVGs do not collide inside the same document.
     * @param {string} markup
     * @param {string} prefix
     * @returns {string}
     */
    static #prefixSvgMarkupIds(markup, prefix) {
        const idMap = new Map()
        let updatedMarkup = markup.replace(/\sid="([^"]+)"/g, (_match, id) => {
            const nextId = prefix + '-' + id
            idMap.set(id, nextId)
            return ' id="' + nextId + '"'
        })

        idMap.forEach((nextId, id) => {
            updatedMarkup = updatedMarkup.replaceAll(
                'url(#' + id + ')',
                'url(#' + nextId + ')'
            )
        })

        return updatedMarkup
    }

    /**
     * Renders one summary-style preview card body.
     * @param {string} label
     * @param {string} value
     * @param {string} detail
     * @returns {string}
     */
    static #renderPreviewSummary(label, value, detail) {
        return (
            '<span class="document-preview__summary">' +
            '<span class="document-preview__label">' +
            DocumentRailRenderer.#escapeHtml(label) +
            '</span>' +
            '<strong>' +
            DocumentRailRenderer.#escapeHtml(value) +
            '</strong>' +
            '<small>' +
            DocumentRailRenderer.#escapeHtml(detail) +
            '</small>' +
            '</span>'
        )
    }

    /**
     * Returns true when the document model supports the requested top-level
     * view.
     * @param {any} documentModel
     * @param {string} activeView
     * @returns {boolean}
     */
    static #supportsView(documentModel, activeView) {
        return DocumentViewCompatibility.supportsView(documentModel, activeView)
    }

    /**
     * Escapes user-facing markup.
     * @param {string} value
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
