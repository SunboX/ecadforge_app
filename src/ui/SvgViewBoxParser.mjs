/**
 * Parses SVG viewBox strings into numeric geometry records.
 */
export class SvgViewBoxParser {
    /**
     * Parses an SVG viewBox string.
     * @param {unknown} value Raw viewBox value.
     * @returns {{ minX: number, minY: number, width: number, height: number } | null}
     */
    static parse(value) {
        const parts = String(value || '')
            .trim()
            .split(/[\s,]+/)
            .map(Number)
        if (
            parts.length !== 4 ||
            parts.some((part) => !Number.isFinite(part))
        ) {
            return null
        }

        return {
            minX: parts[0],
            minY: parts[1],
            width: parts[2],
            height: parts[3]
        }
    }
}
