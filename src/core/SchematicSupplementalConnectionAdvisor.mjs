import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const DEFAULT_MAX_DISTANCE = 50
const ROUTE_CLEARANCE = 1

/**
 * Suggests read-only supplemental connections between disconnected net islands.
 */
export class SchematicSupplementalConnectionAdvisor {
    /**
     * Builds supplemental connection candidates.
     * @param {object[]} netDebug Per-net debug rows.
     * @param {{ maxDistance?: number, obstacles?: object[] }} [options] Advisor options.
     * @returns {object[]} Supplemental connection candidates.
     */
    static suggest(netDebug, options = {}) {
        return this.analyze(netDebug, options).supplementalConnectionSegments
    }

    /**
     * Builds supplemental connection candidates and anchor-pair decisions.
     * @param {object[]} netDebug Per-net debug rows.
     * @param {{ maxDistance?: number, obstacles?: object[] }} [options] Advisor options.
     * @returns {{ supplementalConnectionSegments: object[], anchorConnectionRouteSegments: object[], candidateDecisions: object[], anchorConnectionRouteCandidateDecisions: object[], budget: object, routeBudget: object }}
     */
    static analyze(netDebug, options = {}) {
        const maxDistance = Geometry.number(
            options.maxDistance,
            DEFAULT_MAX_DISTANCE
        )
        const rows = []
        const anchorConnectionRouteSegments = []
        const candidateDecisions = []
        const anchorConnectionRouteCandidateDecisions = []
        let generated = 0
        const obstacles = Array.isArray(options.obstacles)
            ? options.obstacles
            : []

        for (const net of Array.isArray(netDebug) ? netDebug : []) {
            const anchorResult = this.#anchorPairCandidatesForNet(
                net,
                maxDistance,
                obstacles
            )
            generated += anchorResult.generated
            rows.push(...anchorResult.rows)
            candidateDecisions.push(...anchorResult.candidateDecisions)
            anchorConnectionRouteSegments.push(...anchorResult.routeRows)
            anchorConnectionRouteCandidateDecisions.push(
                ...anchorResult.routeCandidateDecisions
            )
            const islandRows = this.#suggestForNet(net, maxDistance)
            generated += islandRows.length
            rows.push(...islandRows)
        }

        return {
            supplementalConnectionSegments: rows,
            anchorConnectionRouteSegments,
            candidateDecisions,
            anchorConnectionRouteCandidateDecisions,
            budget: {
                generated,
                accepted: rows.length,
                rejected: Math.max(generated - rows.length, 0)
            },
            routeBudget: {
                generated: anchorConnectionRouteCandidateDecisions.length,
                accepted: anchorConnectionRouteSegments.length,
                rejected: anchorConnectionRouteCandidateDecisions.filter(
                    (row) => row.status === 'rejected'
                ).length
            }
        }
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
     * Builds anchor-pair candidates for one net.
     * @param {object} net Net debug row.
     * @param {number} maxDistance Maximum candidate distance.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {{ rows: object[], routeRows: object[], candidateDecisions: object[], routeCandidateDecisions: object[], generated: number }}
     */
    static #anchorPairCandidatesForNet(net, maxDistance, obstacles) {
        const pairs = this.#minimumAnchorPairs(net?.anchors)
        const rows = []
        const routeRows = []
        const candidateDecisions = []
        const routeCandidateDecisions = []

        for (const [candidateIndex, pair] of pairs.entries()) {
            const evaluation = this.#evaluateAnchorPair(
                pair,
                maxDistance,
                obstacles
            )
            if (evaluation.status === 'accepted') {
                rows.push(this.#anchorPairRow(net, pair, evaluation))
            }
            candidateDecisions.push(
                this.#anchorPairDecision(net, pair, evaluation, candidateIndex)
            )
            const routes = this.#routeRowsForAnchorPair(
                net,
                pair,
                evaluation,
                obstacles,
                routeCandidateDecisions.length
            )
            routeRows.push(...routes.rows)
            routeCandidateDecisions.push(...routes.candidateDecisions)
        }

        return {
            rows,
            routeRows,
            candidateDecisions,
            routeCandidateDecisions,
            generated: pairs.length
        }
    }

    /**
     * Computes deterministic minimum-distance anchor pairs.
     * @param {object[]} anchors Coordinate-bearing anchors.
     * @returns {Array<{ left: object, right: object, points: object[], distance: number }>}
     */
    static #minimumAnchorPairs(anchors) {
        const rows = Array.isArray(anchors)
            ? anchors.filter((anchor) => anchor?.point)
            : []
        if (rows.length <= 1) return []

        const inTree = new Array(rows.length).fill(false)
        const bestDistance = new Array(rows.length).fill(
            Number.POSITIVE_INFINITY
        )
        const parent = new Array(rows.length).fill(-1)
        bestDistance[0] = 0

        const pairs = []
        for (let iteration = 0; iteration < rows.length; iteration++) {
            const nextIndex = this.#nextTreeAnchor(rows, inTree, bestDistance)
            if (nextIndex === -1) break

            inTree[nextIndex] = true
            if (parent[nextIndex] !== -1) {
                pairs.push(
                    this.#anchorPair(rows[parent[nextIndex]], rows[nextIndex])
                )
            }

            for (let index = 0; index < rows.length; index++) {
                if (inTree[index]) continue
                const distance = Geometry.manhattan(
                    rows[nextIndex].point,
                    rows[index].point
                )
                const previousParent = parent[index]
                const previousParentId =
                    previousParent === -1 ? '' : rows[previousParent].id
                if (
                    distance < bestDistance[index] ||
                    (distance === bestDistance[index] &&
                        (!previousParentId ||
                            rows[nextIndex].id < previousParentId))
                ) {
                    bestDistance[index] = distance
                    parent[index] = nextIndex
                }
            }
        }

        return pairs
    }

    /**
     * Returns the next anchor index for Prim's algorithm.
     * @param {Array<{ id: string }>} anchors Anchors.
     * @param {boolean[]} inTree In-tree flags.
     * @param {number[]} bestDistance Best known distances.
     * @returns {number}
     */
    static #nextTreeAnchor(anchors, inTree, bestDistance) {
        let nextIndex = -1
        for (let index = 0; index < anchors.length; index++) {
            if (inTree[index]) continue
            if (
                nextIndex === -1 ||
                bestDistance[index] < bestDistance[nextIndex] ||
                (bestDistance[index] === bestDistance[nextIndex] &&
                    anchors[index].id < anchors[nextIndex].id)
            ) {
                nextIndex = index
            }
        }
        return nextIndex
    }

    /**
     * Builds normalized anchor-pair metadata.
     * @param {object} left Left anchor.
     * @param {object} right Right anchor.
     * @returns {{ left: object, right: object, points: object[], distance: number }}
     */
    static #anchorPair(left, right) {
        return {
            left,
            right,
            points: [left.point, right.point],
            distance: Geometry.manhattan(left.point, right.point)
        }
    }

    /**
     * Evaluates one anchor-pair candidate.
     * @param {object} pair Anchor-pair metadata.
     * @param {number} maxDistance Maximum candidate distance.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {{ status: string, reason: string, collisionSource: string, collisionSourceId: string }}
     */
    static #evaluateAnchorPair(pair, maxDistance, obstacles) {
        if (pair.distance > maxDistance) {
            return this.#rejected('too-far', 'distance-limit', 'max-distance')
        }

        if (this.#crossesSectionBoundary(pair)) {
            return this.#rejected('section-boundary', 'section-boundary', '')
        }

        const centerlineObstacle = this.#centerlineObstacle(pair, obstacles)
        if (centerlineObstacle) {
            return this.#rejected(
                'restricted-centerline',
                'component-centerline',
                centerlineObstacle.id
            )
        }

        const obstacle = this.#bodyObstacle(pair, obstacles)
        if (obstacle) {
            return this.#rejected(
                'obstacle-risk',
                'component-obstacle',
                obstacle.id
            )
        }

        return {
            status: 'accepted',
            reason: '',
            collisionSource: 'same-net-anchor-pair',
            collisionSourceId: ''
        }
    }

    /**
     * Builds a rejected evaluation row.
     * @param {string} reason Rejection reason.
     * @param {string} collisionSource Rejection source.
     * @param {string} collisionSourceId Source id.
     * @returns {{ status: string, reason: string, collisionSource: string, collisionSourceId: string }}
     */
    static #rejected(reason, collisionSource, collisionSourceId) {
        return {
            status: 'rejected',
            reason,
            collisionSource,
            collisionSourceId
        }
    }

    /**
     * Returns whether a pair spans logical section ids.
     * @param {object} pair Anchor-pair metadata.
     * @returns {boolean}
     */
    static #crossesSectionBoundary(pair) {
        const leftSection = this.#sectionId(pair.left)
        const rightSection = this.#sectionId(pair.right)
        return Boolean(
            leftSection && rightSection && leftSection !== rightSection
        )
    }

    /**
     * Resolves a logical section id from an anchor.
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
     * Finds a component obstacle whose centerline is crossed by a pair.
     * @param {object} pair Anchor-pair metadata.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {object | null}
     */
    static #centerlineObstacle(pair, obstacles) {
        return (
            this.#componentObstacles(obstacles).find((obstacle) =>
                this.#crossesObstacleCenterline(pair.points, obstacle)
            ) || null
        )
    }

    /**
     * Finds a component obstacle crossed by a pair.
     * @param {object} pair Anchor-pair metadata.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {object | null}
     */
    static #bodyObstacle(pair, obstacles) {
        return (
            this.#componentObstacles(obstacles).find((obstacle) =>
                Geometry.segmentIntersectsBounds(pair.points, obstacle.bounds)
            ) || null
        )
    }

    /**
     * Returns component body obstacles only.
     * @param {object[]} obstacles Schematic obstacles.
     * @returns {object[]}
     */
    static #componentObstacles(obstacles) {
        return (Array.isArray(obstacles) ? obstacles : []).filter(
            (obstacle) => obstacle?.kind === 'component'
        )
    }

    /**
     * Returns whether a pair crosses a component centerline.
     * @param {object[]} points Pair points.
     * @param {object} obstacle Component obstacle.
     * @returns {boolean}
     */
    static #crossesObstacleCenterline(points, obstacle) {
        const axis = Geometry.segmentAxis(points[0], points[1])
        if (!axis) return false

        const bounds = obstacle.bounds
        const center = {
            x: bounds.minX + bounds.width / 2,
            y: bounds.minY + bounds.height / 2
        }

        if (axis === 'x' && Math.abs(points[0].y - center.y) <= 1e-6) {
            return Boolean(
                Geometry.rangeOverlap(
                    points[0].x,
                    points[1].x,
                    bounds.minX,
                    bounds.maxX
                )
            )
        }

        if (axis === 'y' && Math.abs(points[0].x - center.x) <= 1e-6) {
            return Boolean(
                Geometry.rangeOverlap(
                    points[0].y,
                    points[1].y,
                    bounds.minY,
                    bounds.maxY
                )
            )
        }

        return false
    }

    /**
     * Builds obstacle-aware route rows for a rejected direct anchor pair.
     * @param {object} net Net debug row.
     * @param {object} pair Anchor-pair metadata.
     * @param {object} evaluation Direct pair evaluation.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {number} candidateOffset Route candidate offset.
     * @returns {{ rows: object[], candidateDecisions: object[] }}
     */
    static #routeRowsForAnchorPair(
        net,
        pair,
        evaluation,
        obstacles,
        candidateOffset
    ) {
        if (!this.#canRouteAround(evaluation)) {
            return { rows: [], candidateDecisions: [] }
        }

        const sourceObstacle = this.#componentObstacles(obstacles).find(
            (obstacle) => obstacle.id === evaluation.collisionSourceId
        )
        const variants = this.#routeVariants(pair, sourceObstacle)
        const rows = []
        const candidateDecisions = []

        variants.forEach((variant, variantIndex) => {
            const candidateIndex = candidateOffset + variantIndex
            const obstacle = this.#routeObstacle(variant.points, obstacles)
            const status = obstacle ? 'rejected' : 'accepted'
            const row = this.#routeRow({
                net,
                pair,
                variant,
                candidateIndex,
                evaluation,
                status
            })
            if (status === 'accepted') rows.push(row)
            candidateDecisions.push(
                this.#routeDecision({
                    row,
                    pair,
                    evaluation,
                    status,
                    reason: obstacle ? 'route-obstacle-risk' : '',
                    obstacle,
                    candidateIndex
                })
            )
        })

        return { rows, candidateDecisions }
    }

    /**
     * Returns whether one rejected direct pair should get route variants.
     * @param {object} evaluation Direct pair evaluation.
     * @returns {boolean}
     */
    static #canRouteAround(evaluation) {
        return (
            evaluation?.status === 'rejected' &&
            ['restricted-centerline', 'obstacle-risk'].includes(
                evaluation.reason
            )
        )
    }

    /**
     * Builds route variants for one direct anchor pair.
     * @param {object} pair Anchor-pair metadata.
     * @param {object | null} sourceObstacle Blocking obstacle, when known.
     * @returns {Array<{ points: object[], routeStyle: string }>}
     */
    static #routeVariants(pair, sourceObstacle) {
        const axis = Geometry.segmentAxis(pair.left.point, pair.right.point)
        if (sourceObstacle && axis === 'x') {
            return [
                this.#horizontalOffsetRoute(pair, sourceObstacle, 'top'),
                this.#horizontalOffsetRoute(pair, sourceObstacle, 'bottom')
            ]
        }
        if (sourceObstacle && axis === 'y') {
            return [
                this.#verticalOffsetRoute(pair, sourceObstacle, 'left'),
                this.#verticalOffsetRoute(pair, sourceObstacle, 'right')
            ]
        }
        return this.#orthogonalCornerRoutes(pair)
    }

    /**
     * Builds one horizontal offset route around an obstacle.
     * @param {object} pair Anchor-pair metadata.
     * @param {object} obstacle Blocking obstacle.
     * @param {string} side Offset side.
     * @returns {{ points: object[], routeStyle: string }}
     */
    static #horizontalOffsetRoute(pair, obstacle, side) {
        const y =
            side === 'top'
                ? obstacle.bounds.minY - ROUTE_CLEARANCE
                : obstacle.bounds.maxY + ROUTE_CLEARANCE
        return {
            points: this.#uniqueConsecutivePoints([
                pair.left.point,
                { x: pair.left.point.x, y },
                { x: pair.right.point.x, y },
                pair.right.point
            ]),
            routeStyle: 'horizontal-offset'
        }
    }

    /**
     * Builds one vertical offset route around an obstacle.
     * @param {object} pair Anchor-pair metadata.
     * @param {object} obstacle Blocking obstacle.
     * @param {string} side Offset side.
     * @returns {{ points: object[], routeStyle: string }}
     */
    static #verticalOffsetRoute(pair, obstacle, side) {
        const x =
            side === 'left'
                ? obstacle.bounds.minX - ROUTE_CLEARANCE
                : obstacle.bounds.maxX + ROUTE_CLEARANCE
        return {
            points: this.#uniqueConsecutivePoints([
                pair.left.point,
                { x, y: pair.left.point.y },
                { x, y: pair.right.point.y },
                pair.right.point
            ]),
            routeStyle: 'vertical-offset'
        }
    }

    /**
     * Builds generic orthogonal corner routes for diagonal anchor pairs.
     * @param {object} pair Anchor-pair metadata.
     * @returns {Array<{ points: object[], routeStyle: string }>}
     */
    static #orthogonalCornerRoutes(pair) {
        return [
            {
                points: this.#uniqueConsecutivePoints([
                    pair.left.point,
                    { x: pair.right.point.x, y: pair.left.point.y },
                    pair.right.point
                ]),
                routeStyle: 'horizontal-first'
            },
            {
                points: this.#uniqueConsecutivePoints([
                    pair.left.point,
                    { x: pair.left.point.x, y: pair.right.point.y },
                    pair.right.point
                ]),
                routeStyle: 'vertical-first'
            }
        ].filter((variant) => variant.points.length > 2)
    }

    /**
     * Finds a component obstacle intersected by a candidate route.
     * @param {object[]} points Route points.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {object | null}
     */
    static #routeObstacle(points, obstacles) {
        const components = this.#componentObstacles(obstacles)
        for (let index = 0; index < points.length - 1; index++) {
            const segmentPoints = [points[index], points[index + 1]]
            const obstacle = components.find((entry) =>
                Geometry.segmentIntersectsBounds(segmentPoints, entry.bounds)
            )
            if (obstacle) return obstacle
        }
        return null
    }

    /**
     * Builds one public route candidate row.
     * @param {object} data Route row data.
     * @returns {object}
     */
    static #routeRow(data) {
        return {
            kind: 'anchor-connection-route-candidate',
            netName: data.net.name,
            anchorIds: [data.pair.left.id, data.pair.right.id],
            candidateId:
                String(data.net.name) +
                ':anchor-route-' +
                String(data.candidateIndex),
            candidateIndex: data.candidateIndex,
            points: data.variant.points,
            distance: this.#routeDistance(data.variant.points),
            debug: {
                sourceKind: 'anchor-connection-route',
                strategy: 'orthogonal-route-variant',
                routeStyle: data.variant.routeStyle,
                directReason: data.evaluation.reason,
                collisionSourceId: data.evaluation.collisionSourceId || '',
                status: data.status
            }
        }
    }

    /**
     * Builds one route candidate decision row.
     * @param {object} data Route decision data.
     * @returns {object}
     */
    static #routeDecision(data) {
        return {
            kind: data.row.kind,
            candidateKind: data.row.kind,
            status: data.status,
            reason: data.reason,
            selected: data.status === 'accepted',
            score: data.row.distance,
            collisionSource:
                data.status === 'accepted'
                    ? 'anchor-route'
                    : 'component-obstacle',
            netName: data.row.netName,
            candidateId: data.row.candidateId,
            candidateIndex: data.candidateIndex,
            anchorIds: [data.pair.left.id, data.pair.right.id],
            debug: {
                sourceKind: 'anchor-connection-route',
                strategy: 'orthogonal-route-variant',
                routeStyle: data.row.debug.routeStyle,
                directReason: data.evaluation.reason,
                collisionSourceId:
                    data.obstacle?.id ||
                    data.evaluation.collisionSourceId ||
                    ''
            }
        }
    }

    /**
     * Computes route Manhattan length.
     * @param {object[]} points Route points.
     * @returns {number}
     */
    static #routeDistance(points) {
        let distance = 0
        for (let index = 0; index < points.length - 1; index++) {
            distance += Geometry.manhattan(points[index], points[index + 1])
        }
        return distance
    }

    /**
     * Builds a public accepted anchor-pair candidate.
     * @param {object} net Net debug row.
     * @param {object} pair Anchor-pair metadata.
     * @param {object} evaluation Pair evaluation.
     * @returns {object}
     */
    static #anchorPairRow(net, pair, evaluation) {
        return {
            kind: 'supplemental-connection-candidate',
            netName: net.name,
            points: pair.points,
            anchorIds: [pair.left.id, pair.right.id],
            distance: pair.distance,
            debug: {
                sourceKind: 'anchor-connection-pair',
                reason: 'minimum-same-net-pair',
                status: evaluation.status
            }
        }
    }

    /**
     * Builds one anchor-pair candidate decision.
     * @param {object} net Net debug row.
     * @param {object} pair Anchor-pair metadata.
     * @param {object} evaluation Pair evaluation.
     * @param {number} candidateIndex Candidate index.
     * @returns {object}
     */
    static #anchorPairDecision(net, pair, evaluation, candidateIndex) {
        return {
            kind: 'supplemental-connection-candidate',
            candidateKind: 'supplemental-connection-candidate',
            status: evaluation.status,
            reason: evaluation.reason,
            selected: evaluation.status === 'accepted',
            score: pair.distance,
            collisionSource: evaluation.collisionSource,
            netName: net.name,
            candidateId:
                String(net.name) +
                ':supplemental-anchor-pair-' +
                String(candidateIndex),
            candidateIndex,
            anchorIds: [pair.left.id, pair.right.id],
            debug: {
                sourceKind: 'anchor-connection-pair',
                strategy: 'anchor-aware-connection-pair',
                distance: pair.distance,
                collisionSourceId: evaluation.collisionSourceId || ''
            }
        }
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

    /**
     * Removes adjacent duplicate route points.
     * @param {object[]} points Source route points.
     * @returns {object[]}
     */
    static #uniqueConsecutivePoints(points) {
        return points.filter(
            (point, index) =>
                index === 0 || !Geometry.samePoint(point, points[index - 1])
        )
    }
}
