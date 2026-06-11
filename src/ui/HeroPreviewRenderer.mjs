import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'
import { PcbScene3dShellRenderer as Scene3dRenderer } from '../../node_modules/pcb-scene3d-viewer/src/PcbScene3dShellRenderer.mjs'
import { UiText } from './UiText.mjs'

/**
 * Renders the landing-page preview from the same document renderers used by
 * the full viewer.
 */
export class HeroPreviewRenderer {
    /**
     * Renders one hero preview view.
     * @param {any[]} documentModels Parsed document models.
     * @param {string} activeView Selected preview view.
     * @param {((key: string) => string) | null} [translate] Translation lookup.
     * @returns {string}
     */
    static render(documentModels, activeView, translate = null) {
        const t = UiText.createTranslator(translate)
        const documentModel = HeroPreviewRenderer.resolveDocument(
            documentModels,
            activeView
        )
        if (!documentModel) {
            return HeroPreviewRenderer.#renderPreviewSummary(
                t('preview.label'),
                t('preview.unavailable'),
                t('preview.noCompatibleDemo')
            )
        }

        if (activeView === 'schematic') {
            return HeroPreviewRenderer.#renderSchematic(documentModel)
        }

        if (activeView === 'pcb') {
            return HeroPreviewRenderer.#renderPcb(documentModel)
        }

        if (activeView === '3d') {
            return HeroPreviewRenderer.#renderScene3d(documentModel, t)
        }

        if (activeView === 'bom') {
            return HeroPreviewRenderer.#renderBom(documentModel)
        }

        return HeroPreviewRenderer.#renderDiagnostics(documentModel, t)
    }

    /**
     * Resolves the best document for the requested view.
     * @param {any[]} documentModels Parsed document models.
     * @param {string} activeView Selected preview view.
     * @returns {any | null}
     */
    static resolveDocument(documentModels, activeView) {
        const documents = Array.isArray(documentModels) ? documentModels : []
        return (
            documents.find((documentModel) =>
                HeroPreviewRenderer.#supportsView(documentModel, activeView)
            ) || null
        )
    }

    /**
     * Renders a schematic preview using the real schematic SVG renderer.
     * @param {any} documentModel Parsed document model.
     * @returns {string}
     */
    static #renderSchematic(documentModel) {
        return HeroPreviewRenderer.#extractPreviewSvgMarkup(
            EcadRendererService.renderSchematic(documentModel),
            'schematic-svg',
            'hero-proof__svg hero-proof__svg--schematic',
            'hero-schematic'
        )
    }

    /**
     * Renders a PCB preview using the real PCB SVG renderer.
     * @param {any} documentModel Parsed document model.
     * @returns {string}
     */
    static #renderPcb(documentModel) {
        return HeroPreviewRenderer.#extractPreviewSvgMarkup(
            EcadRendererService.renderPcb(documentModel),
            'pcb-svg',
            'hero-proof__svg hero-proof__svg--pcb',
            'hero-pcb'
        )
    }

    /**
     * Renders the compact 3D shell with the real 3D scene renderer.
     * @param {any} documentModel Parsed document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderScene3d(documentModel, translate) {
        return (
            '<div class="hero-proof__scene" data-hero-preview-view="3d">' +
            Scene3dRenderer.render(documentModel, translate) +
            '</div>'
        )
    }

    /**
     * Renders the compact BOM table with the real BOM renderer.
     * @param {any} documentModel Parsed document model.
     * @returns {string}
     */
    static #renderBom(documentModel) {
        return (
            '<div class="hero-proof__table" data-hero-preview-view="bom">' +
            EcadRendererService.renderBom(documentModel) +
            '</div>'
        )
    }

    /**
     * Renders parser diagnostics for the landing preview.
     * @param {any} documentModel Parsed document model.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderDiagnostics(documentModel, translate) {
        const diagnostics = Array.isArray(documentModel?.diagnostics)
            ? documentModel.diagnostics
            : []
        if (!diagnostics.length) {
            return (
                '<section class="hero-proof__diagnostics" data-hero-preview-view="diagnostics"><strong>' +
                HeroPreviewRenderer.#escapeHtml(
                    translate('preview.noDiagnostics')
                ) +
                '</strong><p>' +
                HeroPreviewRenderer.#escapeHtml(
                    translate('preview.demoNoDiagnostics')
                ) +
                '</p></section>'
            )
        }

        return (
            '<section class="hero-proof__diagnostics" data-hero-preview-view="diagnostics"><strong>' +
            String(diagnostics.length) +
            ' ' +
            HeroPreviewRenderer.#escapeHtml(
                translate('diagnostics.messagesSuffix')
            ) +
            '</strong><ul>' +
            diagnostics
                .map(
                    (diagnostic) =>
                        '<li><span>' +
                        HeroPreviewRenderer.#escapeHtml(
                            diagnostic.severity || 'info'
                        ) +
                        '</span>' +
                        HeroPreviewRenderer.#escapeHtml(
                            diagnostic.message || ''
                        ) +
                        '</li>'
                )
                .join('') +
            '</ul></section>'
        )
    }

    /**
     * Extracts the rendered SVG from a full renderer panel and rewrites its
     * ids and root class for safe use inside the hero preview.
     * @param {string} markup Full renderer markup.
     * @param {string} sourceClassName Source SVG class.
     * @param {string} previewClassName Preview SVG class.
     * @param {string} idPrefix SVG id prefix.
     * @returns {string}
     */
    static #extractPreviewSvgMarkup(
        markup,
        sourceClassName,
        previewClassName,
        idPrefix
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
            return HeroPreviewRenderer.#renderPreviewSummary(
                UiText.fallback('preview.label'),
                UiText.fallback('preview.unavailable'),
                UiText.fallback('preview.markupUnavailable')
            )
        }

        const previewSvgMarkup = svgMatch[0].replace(
            /class="[^"]*"/,
            'class="' +
                HeroPreviewRenderer.#previewSvgClassName(
                    svgMatch[1],
                    previewClassName
                ) +
                '"'
        )

        return HeroPreviewRenderer.#prefixSvgMarkupIds(
            previewSvgMarkup,
            idPrefix
        )
    }

    /**
     * Preserves source renderer classes on preview SVGs.
     * @param {string} sourceClassList Original SVG class attribute.
     * @param {string} previewClassName Preview class replacement.
     * @returns {string}
     */
    static #previewSvgClassName(sourceClassList, previewClassName) {
        const sourceClasses = String(sourceClassList)
            .split(/\s+/)
            .filter(Boolean)
        const previewClasses = String(previewClassName)
            .split(/\s+/)
            .filter(Boolean)

        return [
            ...previewClasses,
            ...sourceClasses.filter(
                (className) => !previewClasses.includes(className)
            )
        ].join(' ')
    }

    /**
     * Prefixes ids and matching SVG references.
     * @param {string} markup SVG markup.
     * @param {string} prefix New id prefix.
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
     * Renders one compact fallback summary.
     * @param {string} label Preview label.
     * @param {string} value Preview value.
     * @param {string} detail Preview detail.
     * @returns {string}
     */
    static #renderPreviewSummary(label, value, detail) {
        return (
            '<section class="hero-proof__summary"><span>' +
            HeroPreviewRenderer.#escapeHtml(label) +
            '</span><strong>' +
            HeroPreviewRenderer.#escapeHtml(value) +
            '</strong><p>' +
            HeroPreviewRenderer.#escapeHtml(detail) +
            '</p></section>'
        )
    }

    /**
     * Returns true when the document model supports one preview view.
     * @param {any} documentModel Parsed document model.
     * @param {string} activeView Selected preview view.
     * @returns {boolean}
     */
    static #supportsView(documentModel, activeView) {
        if (activeView === 'schematic') {
            return Boolean(documentModel?.schematic)
        }

        if (activeView === 'pcb') {
            return Boolean(documentModel?.pcb)
        }

        if (activeView === '3d') {
            return (
                Boolean(documentModel?.pcb) ||
                EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
                    'circuitjson'
            )
        }

        if (activeView === 'bom') {
            return Array.isArray(documentModel?.bom)
        }

        if (activeView === 'diagnostics') {
            return Array.isArray(documentModel?.diagnostics)
        }

        return false
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
