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
        if (SELECTABLE_KINDS.has(kind)) return true
        return PcbInteractionCandidatePolicy.#isSelectableGerber(
            candidate,
            kind
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
