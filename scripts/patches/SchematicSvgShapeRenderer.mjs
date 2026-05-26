// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { KicadArcGeometry } from '../core/kicad/KicadArcGeometry.mjs'

/**
 * Renders non-text KiCad schematic SVG shapes that share primitive styling.
 */
export class SchematicSvgShapeRenderer {
    /**
     * Renders the faint KiCad-style sheet dot grid.
     * @param {object} sheet Sheet metadata.
     * @param {number} width Sheet width in display units.
     * @param {number} height Sheet height in display units.
     * @param {{ displayScale: number, frameColor: string }} options Render options.
     * @returns {string}
     */
    static renderGrid(sheet, width, height, options) {
        const sourceStep = Number(sheet.visibleGrid || sheet.snapGrid || 0)
        if (!Number.isFinite(sourceStep) || sourceStep <= 0) return ''

        const step = sourceStep * options.displayScale
        const id =
            `schematic-grid-${formatNumber(width)}-${formatNumber(height)}-${formatNumber(step)}`.replaceAll(
                '.',
                '_'
            )

        return [
            '<defs>',
            `<pattern id="${escapeAttribute(id)}" width="${formatNumber(step)}" height="${formatNumber(step)}" patternUnits="userSpaceOnUse">`,
            `<circle cx="${formatNumber(step / 2)}" cy="${formatNumber(step / 2)}" r="0.7" fill="${options.frameColor}" opacity="0.22"/>`,
            '</pattern>',
            '</defs>',
            `<rect class="schematic-grid" x="0" y="0" width="${formatNumber(width)}" height="${formatNumber(height)}" fill="url(#${escapeAttribute(id)})"/>`
        ].join('')
    }

    /**
     * Renders schematic polygons.
     * @param {object[]} polygons Polygons.
     * @param {object} theme Color resolver callbacks.
     * @returns {string}
     */
    static renderPolygons(polygons, theme) {
        return polygons
            .map((polygon) => {
                const points = polygon.points || []
                if (points.length === 0) return ''
                return `<path class="schematic-polygon" d="${pathFromPoints(points)} Z" fill="${theme.resolveFillColor(polygon)}" stroke="${theme.resolveInkColor(polygon)}" stroke-width="${formatNumber(polygon.lineWidth || 0.15)}" stroke-linejoin="round"/>`
            })
            .join('')
    }

    /**
     * Renders schematic ellipses and circles.
     * @param {object[]} ellipses Ellipses.
     * @param {object} theme Color resolver callbacks.
     * @returns {string}
     */
    static renderEllipses(ellipses, theme) {
        return ellipses
            .map(
                (ellipse) =>
                    `<ellipse class="schematic-ellipse" cx="${formatNumber(ellipse.x)}" cy="${formatNumber(ellipse.y)}" rx="${formatNumber(ellipse.radiusX || 0)}" ry="${formatNumber(ellipse.radiusY || ellipse.radiusX || 0)}" fill="${theme.resolveFillColor(ellipse)}" stroke="${theme.resolveInkColor(ellipse)}" stroke-width="${formatNumber(ellipse.lineWidth || 0.15)}"/>`
            )
            .join('')
    }

    /**
     * Renders schematic circular arcs.
     * @param {object[]} arcs Arcs.
     * @param {object} theme Color resolver callbacks.
     * @returns {string}
     */
    static renderArcs(arcs, theme) {
        return arcs
            .map(
                (arc) =>
                    `<path class="schematic-arc" d="${arcPath(arc)}" fill="none" stroke="${theme.resolveInkColor(arc)}" stroke-width="${formatNumber(arc.width || arc.lineWidth || 0.15)}" stroke-linecap="round"/>`
            )
            .join('')
    }

    /**
     * Renders schematic Bezier curves.
     * @param {object[]} beziers Beziers.
     * @param {object} theme Color resolver callbacks.
     * @returns {string}
     */
    static renderBeziers(beziers, theme) {
        return beziers
            .map(
                (bezier) =>
                    `<path class="schematic-bezier" d="${bezierPath(bezier)}" fill="none" stroke="${theme.resolveInkColor(bezier)}" stroke-width="${formatNumber(bezier.width || bezier.lineWidth || 0.15)}" stroke-linecap="round"/>`
            )
            .join('')
    }
}

/**
 * Renders a KiCad three-point arc path.
 * @param {object} arc Arc primitive.
 * @returns {string}
 */
function arcPath(arc) {
    const start = arc.start || { x: 0, y: 0 }
    const mid = arc.mid || start
    const end = arc.end || start
    const geometry = KicadArcGeometry.fromThreePoints(start, mid, end)
    if (!geometry) {
        return `M ${formatNumber(start.x)} ${formatNumber(start.y)} Q ${formatNumber(mid.x)} ${formatNumber(mid.y)} ${formatNumber(end.x)} ${formatNumber(end.y)}`
    }

    return [
        `M ${formatNumber(start.x)} ${formatNumber(start.y)}`,
        'A',
        formatNumber(geometry.radius),
        formatNumber(geometry.radius),
        '0',
        geometry.largeArc ? '1' : '0',
        geometry.sweep ? '1' : '0',
        formatNumber(end.x),
        formatNumber(end.y)
    ].join(' ')
}

/**
 * Renders a KiCad Bezier path.
 * @param {object} bezier Bezier primitive.
 * @returns {string}
 */
function bezierPath(bezier) {
    const points = bezier.points || []
    if (points.length === 0) return ''
    if (points.length < 4) return pathFromPoints(points)

    const [first, ...rest] = points
    const commands = [`M ${formatNumber(first.x)} ${formatNumber(first.y)}`]
    for (let index = 0; index < rest.length; index += 3) {
        const controlA = rest[index]
        const controlB = rest[index + 1]
        const end = rest[index + 2]
        if (!controlA || !controlB || !end) break
        commands.push(
            `C ${formatNumber(controlA.x)} ${formatNumber(controlA.y)} ${formatNumber(controlB.x)} ${formatNumber(controlB.y)} ${formatNumber(end.x)} ${formatNumber(end.y)}`
        )
    }
    return commands.join(' ')
}

/**
 * Converts points to an SVG path.
 * @param {{ x: number, y: number }[]} points Points.
 * @returns {string}
 */
function pathFromPoints(points) {
    if (!points.length) return ''
    const [first, ...rest] = points
    const commands = [`M ${formatNumber(first.x)} ${formatNumber(first.y)}`]
    rest.forEach((point) => {
        commands.push(`L ${formatNumber(point.x)} ${formatNumber(point.y)}`)
    })
    return commands.join(' ')
}

/**
 * Formats a number.
 * @param {number} value Number.
 * @returns {string}
 */
function formatNumber(value) {
    return Number(value || 0)
        .toFixed(3)
        .replace(/\.?0+$/, '')
}

/**
 * Escapes attribute content.
 * @param {unknown} value Raw value.
 * @returns {string}
 */
function escapeAttribute(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}
