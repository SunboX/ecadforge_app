import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const TINY_SEGMENT_LENGTH = 0.1
const EXCESSIVE_TURN_COUNT = 4

/**
 * Detects suspicious authored net path shapes without changing source geometry.
 */
export class SchematicNetPathShapeDiagnostics {
    /**
     * Analyzes one authored point list for shape-quality issues.
     * @param {object} context Net and segment context.
     * @param {string} context.netName Net name.
     * @param {number} context.netIndex Net index.
     * @param {number} context.segmentIndex Segment row index.
     * @param {Array<{ x: number, y: number }>} context.points Segment points.
     * @returns {object[]} Diagnostic issues.
     */
    static analyzePath(context) {
        const issues = []
        issues.push(...this.#partIssues(context))
        issues.push(...this.#backtrackIssues(context))

        const turnIssue = this.#turnIssue(context)
        if (turnIssue) issues.push(turnIssue)

        return issues
    }

    /**
     * Reports zero-length and tiny path parts.
     * @param {object} context Path context.
     * @returns {object[]} Diagnostic issues.
     */
    static #partIssues(context) {
        const issues = []
        for (
            let partIndex = 0;
            partIndex < context.points.length - 1;
            partIndex++
        ) {
            const start = context.points[partIndex]
            const end = context.points[partIndex + 1]
            if (Geometry.samePoint(start, end)) {
                issues.push(
                    this.#issue(context, 'zero-length-part', {
                        partIndex,
                        points: [start, end]
                    })
                )
                continue
            }

            if (Geometry.manhattan(start, end) < TINY_SEGMENT_LENGTH) {
                issues.push(
                    this.#issue(context, 'tiny-segment-part', {
                        partIndex,
                        points: [start, end]
                    })
                )
            }
        }
        return issues
    }

    /**
     * Reports immediate A-B-A backtracks.
     * @param {object} context Path context.
     * @returns {object[]} Diagnostic issues.
     */
    static #backtrackIssues(context) {
        const issues = []
        for (
            let pointIndex = 2;
            pointIndex < context.points.length;
            pointIndex++
        ) {
            if (
                !Geometry.samePoint(
                    context.points[pointIndex],
                    context.points[pointIndex - 2]
                )
            ) {
                continue
            }

            issues.push(
                this.#issue(context, 'immediate-backtrack', {
                    pointIndex,
                    points: [
                        context.points[pointIndex - 2],
                        context.points[pointIndex - 1],
                        context.points[pointIndex]
                    ]
                })
            )
        }
        return issues.slice(0, 1)
    }

    /**
     * Reports authored paths with too many orthogonal turns.
     * @param {object} context Path context.
     * @returns {object | null}
     */
    static #turnIssue(context) {
        const axes = this.#orthogonalAxes(context.points)
        const turnCount = axes.reduce(
            (count, axis, index) =>
                index > 0 && axis !== axes[index - 1] ? count + 1 : count,
            0
        )
        if (turnCount <= EXCESSIVE_TURN_COUNT) return null

        return this.#issue(context, 'excessive-turns', {
            turnCount,
            threshold: EXCESSIVE_TURN_COUNT
        })
    }

    /**
     * Resolves orthogonal axes for non-zero path parts.
     * @param {Array<{ x: number, y: number }>} points Segment points.
     * @returns {string[]}
     */
    static #orthogonalAxes(points) {
        const axes = []
        for (let partIndex = 0; partIndex < points.length - 1; partIndex++) {
            const start = points[partIndex]
            const end = points[partIndex + 1]
            if (Geometry.samePoint(start, end)) continue

            const axis = Geometry.segmentAxis(start, end)
            if (axis) axes.push(axis)
        }
        return axes
    }

    /**
     * Builds one path-shape issue.
     * @param {object} context Path context.
     * @param {string} shapeKind Shape issue kind.
     * @param {object} debug Extra debug metadata.
     * @returns {object}
     */
    static #issue(context, shapeKind, debug) {
        return {
            type: 'suspicious-net-path-shape',
            severity: 'info',
            netName: context.netName,
            netIndex: context.netIndex,
            segmentIndex: context.segmentIndex,
            shapeKind,
            debug
        }
    }
}
