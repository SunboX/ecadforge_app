/**
 * Flags direct connections that cross logical schematic sections.
 */
export class SchematicSectionBoundaryAdvisor {
    /**
     * Builds section-boundary connection candidate rows and issues.
     * @param {{ fallbackSegments?: object[], supplementalConnectionSegments?: object[], netDebug?: object[] }} data Candidate source rows.
     * @returns {{ sectionBoundaryConnectionSegments: object[], issues: object[], budget: object }}
     */
    static analyze(data) {
        const anchorSections = this.#anchorSections(data?.netDebug)
        const sources = [
            ...(Array.isArray(data?.fallbackSegments)
                ? data.fallbackSegments
                : []),
            ...(Array.isArray(data?.supplementalConnectionSegments)
                ? data.supplementalConnectionSegments
                : [])
        ]
        const rows = sources
            .map((segment) => this.#candidateRow(segment, anchorSections))
            .filter(Boolean)
        return {
            sectionBoundaryConnectionSegments: rows,
            issues: rows.map((row) => this.#issueForRow(row)),
            budget: {
                generated: sources.length,
                accepted: rows.length,
                rejected: Math.max(sources.length - rows.length, 0)
            }
        }
    }

    /**
     * Builds an anchor-id to section-id lookup.
     * @param {object[]} netDebug Per-net debug rows.
     * @returns {Map<string, string>}
     */
    static #anchorSections(netDebug) {
        const sections = new Map()
        for (const net of Array.isArray(netDebug) ? netDebug : []) {
            for (const anchor of Array.isArray(net?.anchors)
                ? net.anchors
                : []) {
                const sectionId = this.#sectionId(anchor)
                if (sectionId) sections.set(anchor.id, sectionId)
            }
        }
        return sections
    }

    /**
     * Resolves a logical section id from an anchor source row.
     * @param {object} anchor Anchor row.
     * @returns {string}
     */
    static #sectionId(anchor) {
        return String(
            anchor?.source?.sectionId ||
                anchor?.source?.section ||
                anchor?.source?.sectionName ||
                anchor?.source?.sheetId ||
                anchor?.source?.groupId ||
                ''
        ).trim()
    }

    /**
     * Builds one section-boundary row when a connection spans sections.
     * @param {object} segment Source connection segment.
     * @param {Map<string, string>} anchorSections Anchor section lookup.
     * @returns {object | null}
     */
    static #candidateRow(segment, anchorSections) {
        const anchorIds = Array.isArray(segment?.anchorIds)
            ? segment.anchorIds
            : []
        const sectionIds = this.#uniqueSections(anchorIds, anchorSections)
        if (sectionIds.length < 2) return null

        return {
            kind: 'section-boundary-connection-candidate',
            netName: segment.netName,
            points: segment.points,
            debug: {
                sourceKind: segment.kind || 'connection-candidate',
                sectionIds,
                anchorIds,
                status: 'accepted'
            }
        }
    }

    /**
     * Returns unique section ids in anchor order.
     * @param {string[]} anchorIds Anchor ids.
     * @param {Map<string, string>} anchorSections Anchor section lookup.
     * @returns {string[]}
     */
    static #uniqueSections(anchorIds, anchorSections) {
        const seen = new Set()
        const rows = []
        for (const anchorId of anchorIds) {
            const sectionId = anchorSections.get(anchorId)
            if (!sectionId || seen.has(sectionId)) continue
            seen.add(sectionId)
            rows.push(sectionId)
        }
        return rows
    }

    /**
     * Builds a public issue row for one section-boundary candidate.
     * @param {object} row Section-boundary candidate row.
     * @returns {object}
     */
    static #issueForRow(row) {
        return {
            type: 'section-boundary-connection',
            severity: 'info',
            netName: row.netName,
            debug: {
                sectionBoundaryConnection: row
            }
        }
    }
}
