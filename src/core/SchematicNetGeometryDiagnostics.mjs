import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'
import { SchematicAnchorPreflightDiagnostics } from './SchematicAnchorPreflightDiagnostics.mjs'
import { SchematicNetDiagnosticPostProcessor } from './SchematicNetDiagnosticPostProcessor.mjs'
import { SchematicNetDiagnosticStageSummaries } from './SchematicNetDiagnosticStageSummaries.mjs'
import { SchematicNetDiagnosticsSummary } from './SchematicNetDiagnosticsSummary.mjs'
import { SchematicNetPathShapeDiagnostics } from './SchematicNetPathShapeDiagnostics.mjs'

/**
 * Analyzes normalized schematic net geometry for debug overlays and diagnostics.
 */
export class SchematicNetGeometryDiagnostics {
    /**
     * Analyzes schematic net segments, anchors, and cross-net overlaps.
     * @param {object} schematic Normalized schematic model.
     * @returns {{ summary: object, issues: object[], fallbackSegments: object[], overlapSegments: object[] }}
     */
    static analyze(schematic) {
        const nets = Array.isArray(schematic?.nets) ? schematic.nets : []
        const obstacles = this.#obstaclesForSchematic(schematic)
        const issues = []
        const fallbackSegments = []
        const orthogonalSegments = []
        const anchorMarkers = []
        const collisionBounds = []
        const obstacleSegments = []
        const netDebug = []
        const labels = []

        nets.forEach((net, netIndex) => {
            const netName = this.#netName(net, netIndex)
            const collected = this.#collectNetSegments(net, netIndex, netName)
            const anchors = this.#anchorsForNet(net, netName)
            const netLabels = this.#labelsForNet(net, netIndex, netName)
            issues.push(...collected.issues)
            orthogonalSegments.push(...collected.orthogonalSegments)
            labels.push(...netLabels)
            netDebug.push({
                name: netName,
                anchors,
                labels: netLabels,
                segments: collected.orthogonalSegments
            })
            anchorMarkers.push(
                ...this.#netConnectivityIssues(
                    netName,
                    netIndex,
                    collected.orthogonalSegments,
                    anchors,
                    issues
                )
            )
            issues.push(
                ...SchematicAnchorPreflightDiagnostics.analyze({
                    netName,
                    netIndex,
                    anchors,
                    obstacles,
                    sheet: schematic?.sheet
                })
            )

            if (!collected.authoredSegmentCount && !collected.segmentRowCount) {
                issues.push({
                    type: 'missing-authored-net-geometry',
                    severity: anchors.length > 1 ? 'info' : 'warning',
                    netName,
                    netIndex,
                    anchorCount: anchors.length,
                    debug: { anchors }
                })
                fallbackSegments.push(
                    ...this.#fallbackSegmentsForAnchors(netName, anchors)
                )
            }
        })

        const overlapSegments = this.#crossNetOverlaps(
            orthogonalSegments,
            issues
        )
        obstacleSegments.push(
            ...this.#fallbackObstacleCrossings(
                fallbackSegments,
                obstacles,
                issues
            )
        )
        collisionBounds.push(
            ...this.#labelCollisions(
                labels,
                orthogonalSegments,
                obstacles,
                issues
            )
        )
        const postProcessed = SchematicNetDiagnosticPostProcessor.analyze({
            labels,
            orthogonalSegments,
            fallbackSegments,
            obstacles,
            collisionBounds,
            overlapSegments,
            netDebug,
            sheet: schematic?.sheet
        })
        issues.push(...postProcessed.issues)
        const resultRows = {
            netCount: nets.length,
            fallbackSegments,
            overlapSegments,
            obstacleSegments,
            anchorMarkers,
            collisionBounds,
            ...postProcessed,
            issues
        }

        return {
            summary: SchematicNetDiagnosticsSummary.build(resultRows),
            issues,
            fallbackSegments,
            overlapSegments,
            obstacleSegments,
            anchorMarkers,
            collisionBounds,
            labelCandidateBounds: postProcessed.labelCandidateBounds,
            traceAnchoredLabelCandidateBounds:
                postProcessed.traceAnchoredLabelCandidateBounds,
            traceAnchoredLabelRejectedCandidateBounds:
                postProcessed.traceAnchoredLabelRejectedCandidateBounds,
            orientationLabelCandidateBounds:
                postProcessed.orientationLabelCandidateBounds,
            orientationConnectorSegments:
                postProcessed.orientationConnectorSegments,
            powerLabelCornerCandidateBounds:
                postProcessed.powerLabelCornerCandidateBounds,
            labelObstacleGroups: postProcessed.labelObstacleGroups,
            jogSuggestionSegments: postProcessed.jogSuggestionSegments,
            traceLabelDetourSegments: postProcessed.traceLabelDetourSegments,
            pathCleanupSegments: postProcessed.pathCleanupSegments,
            guidelineSegments: postProcessed.guidelineSegments,
            guidelineSnappedElbowSegments:
                postProcessed.guidelineSnappedElbowSegments,
            restrictedCenterlineSegments:
                postProcessed.restrictedCenterlineSegments,
            supplementalConnectionSegments:
                postProcessed.supplementalConnectionSegments,
            symbolBodyFitCandidateBounds:
                postProcessed.symbolBodyFitCandidateBounds,
            symbolPinSnapSegments: postProcessed.symbolPinSnapSegments,
            candidateRejections: postProcessed.candidateRejections,
            debug: {
                nets: netDebug,
                obstacles,
                indexes: postProcessed.indexes,
                candidateBudgets: postProcessed.candidateBudgets,
                stages: SchematicNetDiagnosticStageSummaries.build({
                    netCount: nets.length,
                    netDebug,
                    obstacles,
                    labels,
                    orthogonalSegments,
                    fallbackSegments,
                    overlapSegments,
                    obstacleSegments,
                    anchorMarkers,
                    collisionBounds,
                    ...postProcessed,
                    issues
                })
            }
        }
    }

    /**
     * Exports a compact repro model for one diagnostic issue.
     * @param {object} schematic Normalized schematic model.
     * @param {object} issue Diagnostic issue.
     * @returns {{ version: number, issue: object, nets: object[], obstacles: object[], diagnostics: object }}
     */
    static exportIssueRepro(schematic, issue) {
        const netNames = new Set(
            [issue?.netName, issue?.otherNetName]
                .map((name) => String(name || '').trim())
                .filter(Boolean)
        )
        const sourceNets = Array.isArray(schematic?.nets) ? schematic.nets : []
        const nets = sourceNets
            .filter((net, index) => netNames.has(this.#netName(net, index)))
            .map((net, index) => {
                const name = this.#netName(net, index)
                return {
                    name,
                    segments: this.#netSegmentRows(net),
                    anchors: this.#anchorsForNet(net, name),
                    labels: this.#labelsForNet(net, index, name)
                }
            })
        const reproSchematic = {
            ...schematic,
            nets: sourceNets.filter((net, index) =>
                netNames.has(this.#netName(net, index))
            )
        }

        return {
            version: 1,
            issue: JSON.parse(JSON.stringify(issue || {})),
            nets,
            obstacles: this.#obstaclesForSchematic(schematic),
            diagnostics: this.analyze(reproSchematic)
        }
    }

    /**
     * Returns a stable display name for a net.
     * @param {object} net Net metadata.
     * @param {number} netIndex Net index.
     * @returns {string}
     */
    static #netName(net, netIndex) {
        const name = String(
            net?.name || net?.label || net?.netName || ''
        ).trim()
        return name || 'Net' + String(netIndex + 1)
    }

    /**
     * Collects valid orthogonal line segments from one net.
     * @param {object} net Net metadata.
     * @param {number} netIndex Net index.
     * @param {string} netName Net name.
     * @returns {{ authoredSegmentCount: number, segmentRowCount: number, orthogonalSegments: object[], issues: object[] }}
     */
    static #collectNetSegments(net, netIndex, netName) {
        const issues = []
        const orthogonalSegments = []
        let authoredSegmentCount = 0

        const segmentRows = this.#netSegmentRows(net)
        segmentRows.forEach((segment, segmentIndex) => {
            const forms = Geometry.validSegmentForms(segment)
            if (!forms.length) {
                issues.push({
                    type: 'invalid-net-segment',
                    severity: 'warning',
                    netName,
                    netIndex,
                    segmentIndex
                })
                return
            }

            authoredSegmentCount += 1
            if (forms.length > 1 && !Geometry.pointListsMatch(forms)) {
                issues.push({
                    type: 'ambiguous-net-segment',
                    severity: 'warning',
                    netName,
                    netIndex,
                    segmentIndex
                })
            }

            const points = forms[0]
            issues.push(
                ...SchematicNetPathShapeDiagnostics.analyzePath({
                    netName,
                    netIndex,
                    segmentIndex,
                    points
                })
            )
            for (
                let partIndex = 0;
                partIndex < points.length - 1;
                partIndex++
            ) {
                const start = points[partIndex]
                const end = points[partIndex + 1]
                if (Geometry.samePoint(start, end)) continue

                const axis = Geometry.segmentAxis(start, end)
                if (!axis) {
                    issues.push({
                        type: 'non-orthogonal-net-segment',
                        severity: 'info',
                        netName,
                        netIndex,
                        segmentIndex,
                        partIndex
                    })
                    continue
                }

                orthogonalSegments.push({
                    key: this.#segmentKey(netName, segmentIndex, partIndex),
                    netName,
                    netIndex,
                    segmentIndex,
                    partIndex,
                    points: [start, end],
                    axis
                })
            }
        })

        return {
            authoredSegmentCount,
            segmentRowCount: segmentRows.length,
            orthogonalSegments,
            issues
        }
    }

    /**
     * Returns all segment-like rows from one net.
     * @param {object} net Net metadata.
     * @returns {object[]}
     */
    static #netSegmentRows(net) {
        return [
            ...(Array.isArray(net?.segments) ? net.segments : []),
            ...(Array.isArray(net?.wires) ? net.wires : []),
            ...(Array.isArray(net?.lines) ? net.lines : [])
        ]
    }

    /**
     * Builds a stable segment key.
     * @param {string} netName Net name.
     * @param {number} segmentIndex Segment row index.
     * @param {number} partIndex Segment part index.
     * @returns {string}
     */
    static #segmentKey(netName, segmentIndex, partIndex) {
        return netName + ':' + String(segmentIndex) + ':' + String(partIndex)
    }

    /**
     * Resolves coordinate-bearing anchors from one net.
     * @param {object} net Net metadata.
     * @param {string} netName Net name.
     * @returns {Array<{ id: string, point: { x: number, y: number } }>}
     */
    static #anchorsForNet(net, netName) {
        return [
            ...this.#anchorsFromRows(netName, 'pin', net?.pins),
            ...this.#anchorsFromRows(netName, 'port', net?.ports),
            ...this.#anchorsFromRows(netName, 'label', net?.labels),
            ...this.#anchorsFromRows(netName, 'power', net?.powerPorts),
            ...this.#anchorsFromRows(netName, 'sheetEntry', net?.sheetEntries)
        ].sort((a, b) => a.id.localeCompare(b.id))
    }

    /**
     * Resolves anchors from one optional row collection.
     * @param {string} netName Net name.
     * @param {string} kind Anchor kind.
     * @param {any[]} rows Candidate rows.
     * @returns {Array<{ id: string, point: { x: number, y: number } }>}
     */
    static #anchorsFromRows(netName, kind, rows) {
        if (!Array.isArray(rows)) return []
        return rows
            .map((row, index) => ({
                id: this.#anchorId(netName, kind, row, index),
                kind,
                source: row,
                point: this.#anchorPoint(row)
            }))
            .filter((anchor) => anchor.point)
    }

    /**
     * Builds a stable anchor id.
     * @param {string} netName Net name.
     * @param {string} kind Anchor kind.
     * @param {object} row Anchor row.
     * @param {number} index Anchor index.
     * @returns {string}
     */
    static #anchorId(netName, kind, row, index) {
        const parts = [
            netName,
            kind,
            row?.refdes,
            row?.component,
            row?.designator,
            row?.pin,
            row?.name,
            row?.text,
            String(index)
        ].filter((part) => String(part || '').trim())
        return parts.join(':')
    }

    /**
     * Resolves one anchor point.
     * @param {object} row Anchor row.
     * @returns {{ x: number, y: number } | null}
     */
    static #anchorPoint(row) {
        return (
            Geometry.pointFromObject(row) ||
            Geometry.pointFromObject(row?.point) ||
            Geometry.pointFromObject(row?.location) ||
            Geometry.pointFromObject(row?.anchorPoint)
        )
    }

    /**
     * Builds fallback connection segments from anchor points.
     * @param {string} netName Net name.
     * @param {Array<{ id: string, point: { x: number, y: number } }>} anchors Anchors.
     * @returns {object[]}
     */
    static #fallbackSegmentsForAnchors(netName, anchors) {
        return this.#minimumSpanningAnchorPairs(anchors).map(([a, b]) => ({
            kind: 'fallback-connection',
            netName,
            points: [a.point, b.point],
            anchorIds: [a.id, b.id]
        }))
    }

    /**
     * Computes a deterministic Manhattan minimum spanning tree over anchors.
     * @param {Array<{ id: string, point: { x: number, y: number } }>} anchors Anchors.
     * @returns {Array<Array<{ id: string, point: { x: number, y: number } }>>}
     */
    static #minimumSpanningAnchorPairs(anchors) {
        if (anchors.length <= 1) return []

        const inTree = new Array(anchors.length).fill(false)
        const bestDistance = new Array(anchors.length).fill(
            Number.POSITIVE_INFINITY
        )
        const parent = new Array(anchors.length).fill(-1)
        bestDistance[0] = 0

        const pairs = []
        for (let iteration = 0; iteration < anchors.length; iteration++) {
            const nextIndex = this.#nextTreeAnchor(
                anchors,
                inTree,
                bestDistance
            )
            if (nextIndex === -1) break

            inTree[nextIndex] = true
            if (parent[nextIndex] !== -1) {
                pairs.push([anchors[parent[nextIndex]], anchors[nextIndex]])
            }

            for (let index = 0; index < anchors.length; index++) {
                if (inTree[index]) continue
                const distance = Geometry.manhattan(
                    anchors[nextIndex].point,
                    anchors[index].point
                )
                const previousParent = parent[index]
                const previousParentId =
                    previousParent === -1 ? '' : anchors[previousParent].id
                if (
                    distance < bestDistance[index] ||
                    (distance === bestDistance[index] &&
                        (!previousParentId ||
                            anchors[nextIndex].id < previousParentId))
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
     * Reports disconnected segment islands and unconnected anchors for one net.
     * @param {string} netName Net name.
     * @param {number} netIndex Net index.
     * @param {object[]} segments Orthogonal segments.
     * @param {object[]} anchors Coordinate-bearing anchors.
     * @param {object[]} issues Mutable issue collection.
     * @returns {object[]}
     */
    static #netConnectivityIssues(
        netName,
        netIndex,
        segments,
        anchors,
        issues
    ) {
        if (!segments.length) return []

        const parent = new Map()
        const find = (key) => {
            if (!parent.has(key)) parent.set(key, key)
            const current = parent.get(key)
            if (current === key) return key
            const root = find(current)
            parent.set(key, root)
            return root
        }
        const union = (a, b) => parent.set(find(a), find(b))

        for (const segment of segments) {
            const [start, end] = segment.points
            union(Geometry.pointKey(start), Geometry.pointKey(end))
        }

        const islandsByRoot = new Map()
        for (const segment of segments) {
            const root = find(Geometry.pointKey(segment.points[0]))
            if (!islandsByRoot.has(root)) islandsByRoot.set(root, [])
            islandsByRoot.get(root).push(segment)
        }

        const islands = [...islandsByRoot.values()].map((items, index) => ({
            id: netName + ':island-' + String(index + 1),
            segmentKeys: items.map((segment) => segment.key),
            bounds: Geometry.boundsForPoints(
                items.flatMap((segment) => segment.points)
            )
        }))
        if (islands.length > 1) {
            issues.push({
                type: 'disconnected-net-islands',
                severity: 'warning',
                netName,
                netIndex,
                islandCount: islands.length,
                debug: { islands }
            })
        }

        const markers = []
        for (const anchor of anchors) {
            const segment = segments.find((entry) =>
                Geometry.pointOnSegment(anchor.point, entry)
            )
            if (segment) continue
            const marker = {
                kind: 'unconnected-anchor',
                netName,
                point: anchor.point,
                anchorId: anchor.id,
                anchorKind: anchor.kind
            }
            markers.push(marker)
            issues.push({
                type: 'unconnected-net-anchor',
                severity: 'warning',
                netName,
                netIndex,
                anchorId: anchor.id,
                anchorKind: anchor.kind,
                debug: { anchor }
            })
        }

        return markers
    }

    /**
     * Resolves labels with approximate rectangular bounds.
     * @param {object} net Net metadata.
     * @param {number} netIndex Net index.
     * @param {string} netName Net name.
     * @returns {object[]}
     */
    static #labelsForNet(net, netIndex, netName) {
        if (!Array.isArray(net?.labels)) return []
        return net.labels
            .map((label, labelIndex) => {
                const bounds = this.#labelBounds(label)
                if (!bounds) return null
                return {
                    id: netName + ':label:' + String(labelIndex),
                    netName,
                    netIndex,
                    labelIndex,
                    text: String(label?.text || label?.name || netName),
                    bounds,
                    center: {
                        x: bounds.minX + bounds.width / 2,
                        y: bounds.minY + bounds.height / 2
                    },
                    source: label
                }
            })
            .filter(Boolean)
    }

    /**
     * Resolves a label bounding box.
     * @param {object} label Label row.
     * @returns {object | null}
     */
    static #labelBounds(label) {
        const explicit = Geometry.boundsFromObject(label?.bounds)
        if (explicit) return explicit

        const center =
            Geometry.pointFromObject(label?.center) || this.#anchorPoint(label)
        if (!center) return null

        const text = String(label?.text || label?.name || label?.value || '')
        const fontSize = Math.max(Geometry.number(label?.fontSize, 1), 0.1)
        const width = Math.max(
            Geometry.number(
                label?.width ?? label?.textWidth ?? label?.labelWidth,
                Math.max(text.length, 1) * fontSize * 0.6
            ),
            0.1
        )
        const height = Math.max(
            Geometry.number(label?.height ?? label?.textHeight, fontSize),
            0.1
        )
        return Geometry.centerBounds(center, width, height)
    }

    /**
     * Resolves obstacle bounds from schematic bodies and sheet symbols.
     * @param {object} schematic Schematic model.
     * @returns {object[]}
     */
    static #obstaclesForSchematic(schematic) {
        return [
            ...this.#centerObstacles('component', schematic?.components),
            ...this.#topLeftObstacles('sheet-symbol', schematic?.sheetSymbols),
            ...this.#topLeftObstacles('rectangle', schematic?.rectangles)
        ]
    }

    /**
     * Resolves center-based obstacles.
     * @param {string} kind Obstacle kind.
     * @param {object[]} rows Candidate rows.
     * @returns {object[]}
     */
    static #centerObstacles(kind, rows) {
        if (!Array.isArray(rows)) return []
        return rows
            .map((row, index) => {
                const center =
                    Geometry.pointFromObject(row?.center) ||
                    Geometry.pointFromObject(row)
                const width = Geometry.number(row?.width, NaN)
                const height = Geometry.number(row?.height, NaN)
                if (
                    !center ||
                    !Number.isFinite(width) ||
                    !Number.isFinite(height)
                )
                    return null
                const name =
                    row?.designator ||
                    row?.name ||
                    row?.uniqueId ||
                    String(index)
                return {
                    id: kind + ':' + String(name),
                    kind,
                    bounds: Geometry.centerBounds(center, width, height),
                    source: row
                }
            })
            .filter(Boolean)
    }

    /**
     * Resolves top-left-based obstacles.
     * @param {string} kind Obstacle kind.
     * @param {object[]} rows Candidate rows.
     * @returns {object[]}
     */
    static #topLeftObstacles(kind, rows) {
        if (!Array.isArray(rows)) return []
        return rows
            .map((row, index) => {
                const x = Geometry.number(row?.x, NaN)
                const y = Geometry.number(row?.y, NaN)
                const width = Geometry.number(row?.width, NaN)
                const height = Geometry.number(row?.height, NaN)
                if (
                    !Number.isFinite(x) ||
                    !Number.isFinite(y) ||
                    !Number.isFinite(width) ||
                    !Number.isFinite(height)
                ) {
                    return null
                }
                const name =
                    row?.designator ||
                    row?.name ||
                    row?.uniqueId ||
                    row?.ownerIndex ||
                    String(index)
                return {
                    id: kind + ':' + String(name),
                    kind,
                    bounds: Geometry.bounds(x, y, x + width, y + height),
                    source: row
                }
            })
            .filter(Boolean)
    }

    /**
     * Reports fallback segments that cross schematic obstacles.
     * @param {object[]} fallbackSegments Fallback segments.
     * @param {object[]} obstacles Obstacle bounds.
     * @param {object[]} issues Mutable issue collection.
     * @returns {object[]}
     */
    static #fallbackObstacleCrossings(fallbackSegments, obstacles, issues) {
        const obstacleSegments = []
        for (const segment of fallbackSegments) {
            for (const obstacle of obstacles) {
                if (
                    !Geometry.segmentIntersectsBounds(
                        segment.points,
                        obstacle.bounds
                    )
                )
                    continue
                const marker = {
                    kind: 'fallback-obstacle-crossing',
                    netName: segment.netName,
                    points: segment.points,
                    obstacleId: obstacle.id
                }
                obstacleSegments.push(marker)
                issues.push({
                    type: 'fallback-segment-crosses-obstacle',
                    severity: 'warning',
                    netName: segment.netName,
                    obstacleId: obstacle.id,
                    debug: {
                        fallbackSegment: segment,
                        obstacle
                    }
                })
            }
        }
        return obstacleSegments
    }

    /**
     * Reports label/trace, label/label, and label/body collisions.
     * @param {object[]} labels Label bounds.
     * @param {object[]} segments Orthogonal segments.
     * @param {object[]} obstacles Obstacle bounds.
     * @param {object[]} issues Mutable issue collection.
     * @returns {object[]}
     */
    static #labelCollisions(labels, segments, obstacles, issues) {
        const collisions = []
        this.#labelTraceCollisions(labels, segments, issues, collisions)
        this.#labelLabelCollisions(labels, issues, collisions)
        this.#labelObstacleCollisions(labels, obstacles, issues, collisions)
        return collisions
    }

    /**
     * Reports label collisions with unrelated trace segments.
     * @param {object[]} labels Label bounds.
     * @param {object[]} segments Orthogonal segments.
     * @param {object[]} issues Mutable issue collection.
     * @param {object[]} collisions Mutable collision bounds.
     * @returns {void}
     */
    static #labelTraceCollisions(labels, segments, issues, collisions) {
        for (const label of labels) {
            for (const segment of segments) {
                if (segment.netName === label.netName) continue
                if (
                    !Geometry.segmentIntersectsBounds(
                        segment.points,
                        label.bounds
                    )
                )
                    continue
                const bounds = Geometry.intersectionBounds(
                    label.bounds,
                    Geometry.boundsForPoints(segment.points)
                )
                const collision = {
                    kind: 'net-label-trace-overlap',
                    netName: label.netName,
                    otherNetName: segment.netName,
                    labelId: label.id,
                    bounds: bounds || label.bounds
                }
                collisions.push(collision)
                issues.push({
                    type: 'net-label-trace-overlap',
                    severity: 'warning',
                    netName: label.netName,
                    otherNetName: segment.netName,
                    debug: { label, segment, bounds: collision.bounds }
                })
            }
        }
    }

    /**
     * Reports label-label collisions.
     * @param {object[]} labels Label bounds.
     * @param {object[]} issues Mutable issue collection.
     * @param {object[]} collisions Mutable collision bounds.
     * @returns {void}
     */
    static #labelLabelCollisions(labels, issues, collisions) {
        for (let leftIndex = 0; leftIndex < labels.length; leftIndex++) {
            for (
                let rightIndex = leftIndex + 1;
                rightIndex < labels.length;
                rightIndex++
            ) {
                const left = labels[leftIndex]
                const right = labels[rightIndex]
                if (left.netName === right.netName) continue
                if (!Geometry.boundsOverlap(left.bounds, right.bounds)) continue
                const bounds = Geometry.intersectionBounds(
                    left.bounds,
                    right.bounds
                )
                collisions.push({
                    kind: 'net-label-net-label-overlap',
                    netName: left.netName,
                    otherNetName: right.netName,
                    labelId: left.id,
                    otherLabelId: right.id,
                    bounds
                })
                issues.push({
                    type: 'net-label-net-label-overlap',
                    severity: 'warning',
                    netName: left.netName,
                    otherNetName: right.netName,
                    debug: { labels: [left, right], bounds }
                })
            }
        }
    }

    /**
     * Reports label collisions with body obstacles.
     * @param {object[]} labels Label bounds.
     * @param {object[]} obstacles Obstacle bounds.
     * @param {object[]} issues Mutable issue collection.
     * @param {object[]} collisions Mutable collision bounds.
     * @returns {void}
     */
    static #labelObstacleCollisions(labels, obstacles, issues, collisions) {
        for (const label of labels) {
            for (const obstacle of obstacles) {
                if (
                    !Geometry.boundsTouchOrOverlap(
                        label.bounds,
                        obstacle.bounds
                    )
                )
                    continue
                const bounds =
                    Geometry.intersectionBounds(
                        label.bounds,
                        obstacle.bounds
                    ) || label.bounds
                collisions.push({
                    kind: 'net-label-symbol-overlap',
                    netName: label.netName,
                    obstacleId: obstacle.id,
                    labelId: label.id,
                    bounds
                })
                issues.push({
                    type: 'net-label-symbol-overlap',
                    severity: 'warning',
                    netName: label.netName,
                    obstacleId: obstacle.id,
                    debug: { label, obstacle, bounds }
                })
            }
        }
    }

    /**
     * Finds cross-net overlaps across orthogonal segments.
     * @param {object[]} segments Orthogonal segments.
     * @param {object[]} issues Mutable issue collection.
     * @returns {object[]}
     */
    static #crossNetOverlaps(segments, issues) {
        const overlapSegments = []
        for (let aIndex = 0; aIndex < segments.length; aIndex++) {
            for (let bIndex = aIndex + 1; bIndex < segments.length; bIndex++) {
                const a = segments[aIndex]
                const b = segments[bIndex]
                if (a.netName === b.netName) continue
                const overlap = Geometry.segmentOverlap(a, b)
                if (!overlap) continue

                overlapSegments.push({
                    kind: 'cross-net-overlap',
                    netNames: [a.netName, b.netName],
                    points: overlap.points,
                    axis: overlap.axis
                })
                issues.push({
                    type: 'cross-net-segment-overlap',
                    severity: 'warning',
                    netName: a.netName,
                    otherNetName: b.netName,
                    netIndex: a.netIndex,
                    otherNetIndex: b.netIndex,
                    segmentIndex: a.segmentIndex,
                    otherSegmentIndex: b.segmentIndex,
                    axis: overlap.axis
                })
            }
        }
        return overlapSegments
    }
}
