import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const DEFAULT_MAX_DISTANCE = 50

/**
 * Suggests read-only supplemental connections between disconnected net islands.
 */
export class SchematicSupplementalConnectionAdvisor {
    /**
     * Builds supplemental connection candidates.
     * @param {object[]} netDebug Per-net debug rows.
     * @param {{ maxDistance?: number }} [options] Advisor options.
     * @returns {object[]} Supplemental connection candidates.
     */
    static suggest(netDebug, options = {}) {
        const maxDistance = Geometry.number(
            options.maxDistance,
            DEFAULT_MAX_DISTANCE
        )
        return (Array.isArray(netDebug) ? netDebug : []).flatMap((net) =>
            this.#suggestForNet(net, maxDistance)
        )
    }

    /**
     * Builds candidates for one net.
     * @param {object} net Net debug row.
     * @param {number} maxDistance Maximum candidate distance.
     * @returns {object[]}
     */
    static #suggestForNet(net, maxDistance) {
        const islands = this.#islandsForSegments(net?.name, net?.segments)
        if (islands.length < 2) return []

        const pairs = this.#minimumIslandPairs(islands)
        return pairs
            .filter((pair) => pair.distance <= maxDistance)
            .map((pair) => ({
                kind: 'supplemental-connection-candidate',
                netName: net.name,
                points: pair.points,
                distance: pair.distance,
                debug: {
                    sourceIslandIds: [pair.from.id, pair.to.id],
                    reason: 'nearest-disconnected-islands'
                }
            }))
    }

    /**
     * Groups orthogonal segments into connected islands.
     * @param {string} netName Net name.
     * @param {object[]} segments Orthogonal segment parts.
     * @returns {object[]}
     */
    static #islandsForSegments(netName, segments) {
        const rows = Array.isArray(segments) ? segments : []
        if (!rows.length) return []

        const parent = new Map()
        const find = (key) => {
            if (!parent.has(key)) parent.set(key, key)
            const current = parent.get(key)
            if (current === key) return key
            const root = find(current)
            parent.set(key, root)
            return root
        }
        const union = (left, right) => parent.set(find(left), find(right))

        for (const segment of rows) {
            union(
                Geometry.pointKey(segment.points[0]),
                Geometry.pointKey(segment.points[1])
            )
        }

        const grouped = new Map()
        for (const segment of rows) {
            const root = find(Geometry.pointKey(segment.points[0]))
            if (!grouped.has(root)) grouped.set(root, [])
            grouped.get(root).push(segment)
        }

        return [...grouped.values()].map((items, index) => ({
            id: String(netName) + ':island-' + String(index + 1),
            points: this.#uniquePoints(items.flatMap((item) => item.points))
        }))
    }

    /**
     * Builds deterministic minimum-distance island pairs.
     * @param {object[]} islands Segment islands.
     * @returns {object[]}
     */
    static #minimumIslandPairs(islands) {
        const inTree = new Array(islands.length).fill(false)
        const pairs = []
        inTree[0] = true

        while (pairs.length < islands.length - 1) {
            let best = null
            for (let left = 0; left < islands.length; left++) {
                if (!inTree[left]) continue
                for (let right = 0; right < islands.length; right++) {
                    if (inTree[right]) continue
                    const candidate = this.#closestIslandPair(
                        islands[left],
                        islands[right]
                    )
                    if (!best || this.#isBetterPair(candidate, best)) {
                        best = candidate
                    }
                }
            }
            if (!best) break
            pairs.push(best)
            inTree[islands.indexOf(best.to)] = true
        }

        return pairs
    }

    /**
     * Finds the closest point pair between two islands.
     * @param {object} from Source island.
     * @param {object} to Target island.
     * @returns {object}
     */
    static #closestIslandPair(from, to) {
        let best = null
        for (const left of from.points) {
            for (const right of to.points) {
                const candidate = {
                    from,
                    to,
                    points: [left, right],
                    distance: Geometry.manhattan(left, right)
                }
                if (!best || this.#isBetterPair(candidate, best)) {
                    best = candidate
                }
            }
        }
        return best
    }

    /**
     * Returns whether a candidate pair sorts before the current best.
     * @param {object} candidate Candidate pair.
     * @param {object} best Current best pair.
     * @returns {boolean}
     */
    static #isBetterPair(candidate, best) {
        return (
            candidate.distance < best.distance ||
            (candidate.distance === best.distance &&
                this.#pairKey(candidate) < this.#pairKey(best))
        )
    }

    /**
     * Builds a stable pair key.
     * @param {object} pair Pair row.
     * @returns {string}
     */
    static #pairKey(pair) {
        return pair.points.map((point) => Geometry.pointKey(point)).join('|')
    }

    /**
     * Deduplicates points by coordinate key.
     * @param {object[]} points Source points.
     * @returns {object[]}
     */
    static #uniquePoints(points) {
        const seen = new Set()
        return points.filter((point) => {
            const key = Geometry.pointKey(point)
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }
}
