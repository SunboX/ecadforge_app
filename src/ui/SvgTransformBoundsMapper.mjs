/**
 * Maps rectangular SVG bounds through supported affine transform attributes.
 */
export class SvgTransformBoundsMapper {
    /**
     * Applies a supported SVG transform attribute to marker bounds.
     * @param {{ x: number, y: number, width: number, height: number, rx: number }} bounds Marker bounds.
     * @param {string | undefined} transformValue SVG transform attribute value.
     * @returns {{ x: number, y: number, width: number, height: number, rx: number }}
     */
    static map(bounds, transformValue) {
        const matrix = SvgTransformBoundsMapper.#parseTransform(transformValue)
        if (!matrix) return bounds

        let transformed = null
        for (const point of [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.y + bounds.height }
        ]) {
            transformed = SvgTransformBoundsMapper.#includePoint(
                transformed,
                matrix.a * point.x + matrix.c * point.y + matrix.e,
                matrix.b * point.x + matrix.d * point.y + matrix.f
            )
        }

        return {
            x: transformed.minX,
            y: transformed.minY,
            width: transformed.maxX - transformed.minX,
            height: transformed.maxY - transformed.minY,
            rx: bounds.rx
        }
    }

    /**
     * Parses supported SVG transform functions into one affine matrix.
     * @param {string | undefined} value Transform attribute value.
     * @returns {{ a: number, b: number, c: number, d: number, e: number, f: number } | null}
     */
    static #parseTransform(value) {
        const text = String(value || '').trim()
        if (!text) return null

        let matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
        let found = false
        for (const match of text.matchAll(/([a-zA-Z]+)\(([^)]*)\)/g)) {
            const next = SvgTransformBoundsMapper.#functionMatrix(
                match[1],
                match[2]
            )
            if (!next) return null
            matrix = SvgTransformBoundsMapper.#multiply(matrix, next)
            found = true
        }

        return found ? matrix : null
    }

    /**
     * Builds one affine matrix for a supported SVG transform function.
     * @param {string} name Transform function name.
     * @param {string} args Transform function arguments.
     * @returns {{ a: number, b: number, c: number, d: number, e: number, f: number } | null}
     */
    static #functionMatrix(name, args) {
        const values = SvgTransformBoundsMapper.#numbers(args)
        const normalizedName = String(name || '').toLowerCase()
        if (normalizedName === 'matrix' && values.length >= 6) {
            return {
                a: values[0],
                b: values[1],
                c: values[2],
                d: values[3],
                e: values[4],
                f: values[5]
            }
        }
        if (normalizedName === 'translate' && values.length >= 1) {
            return {
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: values[0],
                f: values[1] || 0
            }
        }
        if (normalizedName === 'scale' && values.length >= 1) {
            return {
                a: values[0],
                b: 0,
                c: 0,
                d: values.length >= 2 ? values[1] : values[0],
                e: 0,
                f: 0
            }
        }

        return null
    }

    /**
     * Parses numeric SVG transform arguments.
     * @param {string} args Transform function argument text.
     * @returns {number[]}
     */
    static #numbers(args) {
        return (
            String(args || '').match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || []
        ).map(Number)
    }

    /**
     * Multiplies two affine SVG matrices.
     * @param {{ a: number, b: number, c: number, d: number, e: number, f: number }} left Left matrix.
     * @param {{ a: number, b: number, c: number, d: number, e: number, f: number }} right Right matrix.
     * @returns {{ a: number, b: number, c: number, d: number, e: number, f: number }}
     */
    static #multiply(left, right) {
        return {
            a: left.a * right.a + left.c * right.b,
            b: left.b * right.a + left.d * right.b,
            c: left.a * right.c + left.c * right.d,
            d: left.b * right.c + left.d * right.d,
            e: left.a * right.e + left.c * right.f + left.e,
            f: left.b * right.e + left.d * right.f + left.f
        }
    }

    /**
     * Includes one point in bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Current bounds.
     * @param {number} x Point x.
     * @param {number} y Point y.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #includePoint(bounds, x, y) {
        if (!bounds) return { minX: x, minY: y, maxX: x, maxY: y }

        return {
            minX: Math.min(bounds.minX, x),
            minY: Math.min(bounds.minY, y),
            maxX: Math.max(bounds.maxX, x),
            maxY: Math.max(bounds.maxY, y)
        }
    }
}
