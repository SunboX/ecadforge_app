import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const DEFAULT_LONG_DISTANCE_THRESHOLD = 20

/**
 * Flags direct connection candidates that are long enough to merit a label or port.
 */
export class SchematicLongDistanceConnectionAdvisor {
    /**
     * Builds long-distance connection candidate rows.
     * @param {{ fallbackSegments?: object[], supplementalConnectionSegments?: object[] }} data Candidate source rows.
     * @param {{ threshold?: number }} [options] Advisor options.
     * @returns {{ longDistanceConnectionSegments: object[], budget: object }}
     */
    static analyze(data, options = {}) {
        const threshold = Geometry.number(
            options.threshold,
            DEFAULT_LONG_DISTANCE_THRESHOLD
        )
        const sources = this.#uniqueSources([
            ...(Array.isArray(data?.fallbackSegments)
                ? data.fallbackSegments
                : []),
            ...(Array.isArray(data?.supplementalConnectionSegments)
                ? data.supplementalConnectionSegments
                : [])
        ])
        const rows = sources
            .map((segment) => this.#candidateRow(segment, threshold))
            .filter(Boolean)

        return {
            longDistanceConnectionSegments: rows,
            budget: {
                generated: sources.length,
                accepted: rows.length,
                rejected: Math.max(sources.length - rows.length, 0)
            }
        }
    }

    /**
     * Builds one long-distance row when the source exceeds the threshold.
     * @param {object} segment Source connection segment.
     * @param {number} threshold Minimum reportable distance.
     * @returns {object | null}
     */
    static #candidateRow(segment, threshold) {
        const points = Array.isArray(segment?.points) ? segment.points : []
        if (points.length < 2) return null

        const start = points[0]
        const end = points[points.length - 1]
        const distance = Geometry.manhattan(start, end)
        if (distance <= threshold) return null

        return {
            kind: 'long-distance-connection-candidate',
            netName: segment.netName,
            points: [start, end],
            distance,
            debug: {
                sourceKind: segment.kind || 'connection-candidate',
                reason: 'prefer-label-or-port-style-connection',
                threshold,
                status: 'accepted'
            }
        }
    }

    /**
     * Deduplicates connection sources by net and endpoints.
     * @param {object[]} sources Candidate connection sources.
     * @returns {object[]}
     */
    static #uniqueSources(sources) {
        const seen = new Set()
        return sources.filter((source) => {
            const points = Array.isArray(source?.points) ? source.points : []
            if (points.length < 2) return true
            const key = [
                source.netName,
                Geometry.pointKey(points[0]),
                Geometry.pointKey(points[points.length - 1])
            ].join('|')
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }
}
