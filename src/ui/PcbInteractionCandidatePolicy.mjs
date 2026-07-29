const SELECTABLE_KINDS = new Set([
    'component',
    'footprint',
    'pad',
    'pcb-component',
    'pcb-pad',
    'pcb-smtpad',
    'pcb-trace',
    'pcb-via',
    'trace',
    'track',
    'via'
])

const GERBER_COPPER_KINDS = new Set(['arc', 'flash', 'line'])
const GERBER_VIA_KINDS = new Set(['drill', 'slot'])
const TRACE_KINDS = new Set(['pcb-trace', 'trace', 'track'])
const NON_COPPER_TRACE_LAYER_PATTERN =
    /(?:^|[^a-z0-9])(assembly|comment|courtyard|dimension|drawing|drill|dwg|edge|fab|keepout|legend|margin|mask|mechanical|overlay|paste|silk|silks|silkscreen|solder|user)(?:[^a-z0-9]|$)/

/**
 * Filters cross-format PCB interaction candidates by selectable semantics.
 */
export class PcbInteractionCandidatePolicy {
    /**
     * Returns selectable candidates without changing their order or identity.
     * @param {object[]} candidates Raw hit-test candidates.
     * @returns {object[]}
     */
    static filter(candidates = []) {
        return (Array.isArray(candidates) ? candidates : []).filter(
            (candidate) =>
                PcbInteractionCandidatePolicy.#isSelectable(candidate)
        )
    }

    /**
     * Returns whether one candidate represents an interactive PCB object.
     * @param {object | null | undefined} candidate Hit-test candidate.
     * @returns {boolean}
     */
    static #isSelectable(candidate) {
        if (!candidate || typeof candidate !== 'object') return false
        const kind = PcbInteractionCandidatePolicy.#token(
            candidate.kind ?? candidate.type ?? candidate.role
        )
        if (SELECTABLE_KINDS.has(kind)) {
            return (
                !TRACE_KINDS.has(kind) ||
                PcbInteractionCandidatePolicy.#isSelectableTraceLayer(candidate)
            )
        }
        return PcbInteractionCandidatePolicy.#isSelectableGerber(
            candidate,
            kind
        )
    }

    /**
     * Returns whether a trace-shaped candidate belongs to copper rather than
     * overlay, mechanical, mask, or other board artwork.
     * @param {object} candidate Trace-shaped hit-test candidate.
     * @returns {boolean}
     */
    static #isSelectableTraceLayer(candidate) {
        const source =
            candidate.source && typeof candidate.source === 'object'
                ? candidate.source
                : {}
        const layerLabels = [
            ...(Array.isArray(candidate.layerKeys) ? candidate.layerKeys : []),
            candidate.layer,
            candidate.layerName,
            candidate.layerDisplayName,
            source.layer,
            source.layerName,
            source.layerDisplayName
        ]
            .map((value) =>
                String(value || '')
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean)

        return !layerLabels.some((layerLabel) =>
            NON_COPPER_TRACE_LAYER_PATTERN.test(layerLabel)
        )
    }

    /**
     * Maps raw Gerber primitive kinds only when their fabrication role is
     * unambiguous.
     * @param {object} candidate Gerber hit-test candidate.
     * @param {string} kind Normalized primitive kind.
     * @returns {boolean}
     */
    static #isSelectableGerber(candidate, kind) {
        if (
            PcbInteractionCandidatePolicy.#token(candidate.sourceFormat) !==
            'gerber'
        ) {
            return false
        }
        if (GERBER_VIA_KINDS.has(kind)) return true
        const role = PcbInteractionCandidatePolicy.#token(candidate.role)
        return role.includes('copper') && GERBER_COPPER_KINDS.has(kind)
    }

    /**
     * Normalizes one format-specific interaction token.
     * @param {unknown} value Raw token.
     * @returns {string}
     */
    static #token(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replaceAll('_', '-')
    }
}
