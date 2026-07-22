/**
 * Renders transient PCB hover and bounds interaction candidates in the sidebar.
 */
export class ViewerSidebarInteractionInspectorRenderer {
    /**
     * Renders the current PCB interaction inspector.
     * @param {{ activeDocumentId?: string, pcbInteractionPreview?: object }} snapshot Viewer snapshot.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static render(snapshot, translate) {
        const preview = snapshot?.pcbInteractionPreview
        const candidates = Array.isArray(preview?.candidates)
            ? preview.candidates
            : []
        if (
            !preview ||
            !candidates.length ||
            String(preview.documentId || '') !==
                String(snapshot?.activeDocumentId || '')
        ) {
            return ''
        }

        return (
            '<section class="viewer-sidebar__interaction" data-pcb-interaction-inspector="true" data-pcb-interaction-source="' +
            ViewerSidebarInteractionInspectorRenderer.#escapeHtml(
                preview.source || ''
            ) +
            '"><h4>' +
            ViewerSidebarInteractionInspectorRenderer.#escapeHtml(
                translate('sidebar.pcbInteraction')
            ) +
            '</h4><div class="viewer-sidebar__interaction-point">' +
            ViewerSidebarInteractionInspectorRenderer.#formatPoint(
                preview.point
            ) +
            '</div><div class="viewer-sidebar__interaction-list">' +
            candidates
                .map((candidate, index) =>
                    ViewerSidebarInteractionInspectorRenderer.#renderCandidate(
                        candidate,
                        index,
                        preview.selectedCandidate
                    )
                )
                .join('') +
            '</div></section>'
        )
    }

    /**
     * Renders one interaction candidate row.
     * @param {object} candidate Candidate row.
     * @param {number} index Candidate index.
     * @param {object | null} selectedCandidate Selected candidate.
     * @returns {string}
     */
    static #renderCandidate(candidate, index, selectedCandidate) {
        const selected =
            candidate &&
            selectedCandidate &&
            candidate.kind === selectedCandidate.kind &&
            candidate.componentKey === selectedCandidate.componentKey &&
            ViewerSidebarInteractionInspectorRenderer.#netName(candidate) ===
                ViewerSidebarInteractionInspectorRenderer.#netName(
                    selectedCandidate
                )
        const label = String(candidate?.kind || candidate?.role || 'item')
        const detail = [
            candidate?.componentKey,
            ViewerSidebarInteractionInspectorRenderer.#netName(candidate),
            candidate?.layer || candidate?.layerKey
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
            .join(' · ')

        return (
            '<span class="viewer-sidebar__interaction-row' +
            (selected ? ' is-selected' : '') +
            '" data-pcb-interaction-candidate="' +
            ViewerSidebarInteractionInspectorRenderer.#escapeHtml(index) +
            '"><strong>' +
            ViewerSidebarInteractionInspectorRenderer.#escapeHtml(label) +
            '</strong><span>' +
            ViewerSidebarInteractionInspectorRenderer.#escapeHtml(
                detail || '-'
            ) +
            '</span>' +
            ViewerSidebarInteractionInspectorRenderer.#renderGroups(candidate) +
            '</span>'
        )
    }

    /**
     * Renders group summary rows for one candidate.
     * @param {object} candidate Candidate row.
     * @returns {string}
     */
    static #renderGroups(candidate) {
        const groups = Array.isArray(candidate?.groups) ? candidate.groups : []
        if (!groups.length) return ''
        return (
            '<span class="viewer-sidebar__interaction-groups">' +
            groups
                .map((group) =>
                    ViewerSidebarInteractionInspectorRenderer.#renderGroup(
                        group
                    )
                )
                .join('') +
            '</span>'
        )
    }

    /**
     * Renders one group summary.
     * @param {object} group Group summary.
     * @returns {string}
     */
    static #renderGroup(group) {
        const detail = [
            ViewerSidebarInteractionInspectorRenderer.#plural(
                group.componentCount,
                'component'
            ),
            ViewerSidebarInteractionInspectorRenderer.#plural(
                group.memberCount,
                'member'
            ),
            group.anchorAlignment,
            group.positionMode,
            group.childLayoutMode,
            group.layoutMode,
            ViewerSidebarInteractionInspectorRenderer.#traceClearance(group)
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
            .join(' | ')

        return (
            '<span class="viewer-sidebar__interaction-group" data-pcb-interaction-group-id="' +
            ViewerSidebarInteractionInspectorRenderer.#escapeHtml(
                group.id || ''
            ) +
            '"><strong>' +
            ViewerSidebarInteractionInspectorRenderer.#escapeHtml(
                group.name || group.id || 'Group'
            ) +
            '</strong><span>' +
            ViewerSidebarInteractionInspectorRenderer.#escapeHtml(detail) +
            '</span></span>'
        )
    }

    /**
     * Formats a plural count label.
     * @param {unknown} value Count value.
     * @param {string} noun Singular noun.
     * @returns {string}
     */
    static #plural(value, noun) {
        const count = Number(value)
        if (!Number.isFinite(count) || count <= 0) return ''
        return count + ' ' + noun + (count === 1 ? '' : 's')
    }

    /**
     * Formats autorouter trace clearance.
     * @param {object} group Group summary.
     * @returns {string}
     */
    static #traceClearance(group) {
        const value = Number(group?.autorouterTraceClearance)
        if (!Number.isFinite(value)) return ''
        return (
            ViewerSidebarInteractionInspectorRenderer.#compactNumber(value) +
            ' mm'
        )
    }

    /**
     * Formats a compact number.
     * @param {number} value Numeric value.
     * @returns {string}
     */
    static #compactNumber(value) {
        return value.toFixed(3).replace(/0+$/u, '').replace(/\.$/u, '')
    }

    /**
     * Formats an interaction point with stable decimal precision.
     * @param {object | null | undefined} point Point candidate.
     * @returns {string}
     */
    static #formatPoint(point) {
        return [
            ViewerSidebarInteractionInspectorRenderer.#number(point?.x),
            ViewerSidebarInteractionInspectorRenderer.#number(point?.y)
        ].join(', ')
    }

    /**
     * Returns one candidate net name.
     * @param {object | null | undefined} candidate Candidate row.
     * @returns {string}
     */
    static #netName(candidate) {
        return String(
            candidate?.netName ?? candidate?.net ?? candidate?.net_name ?? ''
        ).trim()
    }

    /**
     * Formats one numeric value.
     * @param {unknown} value Numeric value.
     * @returns {string}
     */
    static #number(value) {
        const number = Number(value)
        return Number.isFinite(number) ? number.toFixed(2) : '0.00'
    }

    /**
     * Escapes markup text.
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
