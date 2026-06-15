const TOP_COPPER_LAYER_ID = 1
const BOTTOM_COPPER_LAYER_ID = 32
const MIN_SEGMENT_LENGTH_MIL = 0.001

/**
 * Splits KiCad 3D copper tracks around drill holes and exposed pad surfaces.
 */
export class KicadScene3dCopperTrackCutoutBuilder {
    /**
     * Returns tracks split around visible cutout geometry.
     * @param {object[] | undefined} tracks Copper tracks.
     * @param {object[] | undefined} pads Scene pad detail.
     * @param {object[] | undefined} vias Scene via detail.
     * @returns {object[]}
     */
    static splitTracks(tracks, pads, vias) {
        const cutouts = KicadScene3dCopperTrackCutoutBuilder.#buildCutouts(
            pads,
            vias
        )

        return (tracks || []).flatMap((track) =>
            KicadScene3dCopperTrackCutoutBuilder.#splitTrack(track, cutouts)
        )
    }

    /**
     * Builds route cutouts from drill apertures and exposed pad copper.
     * @param {object[] | undefined} pads Scene pad detail.
     * @param {object[] | undefined} vias Scene via detail.
     * @returns {{ x: number, y: number, radius: number, layerId: number | null }[]}
     */
    static #buildCutouts(pads, vias) {
        const seen = new Set()
        const cutouts = [
            ...KicadScene3dCopperTrackCutoutBuilder.#drillCutouts(pads, vias),
            ...KicadScene3dCopperTrackCutoutBuilder.#padSurfaceCutouts(pads)
        ]
        const output = []

        for (const cutout of cutouts) {
            const key = KicadScene3dCopperTrackCutoutBuilder.#cutoutKey(cutout)
            if (seen.has(key)) {
                continue
            }

            seen.add(key)
            output.push(cutout)
        }

        return output
    }

    /**
     * Builds physical drill cutouts.
     * @param {object[] | undefined} pads Scene pad detail.
     * @param {object[] | undefined} vias Scene via detail.
     * @returns {{ x: number, y: number, radius: number, layerId: null }[]}
     */
    static #drillCutouts(pads, vias) {
        return [...(pads || []), ...(vias || [])]
            .map((primitive) =>
                KicadScene3dCopperTrackCutoutBuilder.#drillCutout(primitive)
            )
            .filter(Boolean)
    }

    /**
     * Builds one physical drill cutout.
     * @param {object} primitive Pad or via primitive.
     * @returns {{ x: number, y: number, radius: number, layerId: null } | null}
     */
    static #drillCutout(primitive) {
        const x = Number(primitive?.x)
        const y = Number(primitive?.y)
        const diameter = Number(primitive?.holeDiameter || 0)
        const slotLength =
            Number(primitive?.holeSlotLength || 0) > diameter
                ? Number(primitive.holeSlotLength)
                : 0
        const radius = Math.max(diameter, slotLength) / 2

        if (!Number.isFinite(x + y) || radius <= 0) {
            return null
        }

        return { x, y, radius, layerId: null }
    }

    /**
     * Builds cutouts for exposed pad faces so covered traces do not show
     * through pad annuli.
     * @param {object[] | undefined} pads Scene pad detail.
     * @returns {{ x: number, y: number, radius: number, layerId: number }[]}
     */
    static #padSurfaceCutouts(pads) {
        return (pads || [])
            .flatMap((pad) => [
                KicadScene3dCopperTrackCutoutBuilder.#padSurfaceCutout(
                    pad,
                    'top'
                ),
                KicadScene3dCopperTrackCutoutBuilder.#padSurfaceCutout(
                    pad,
                    'bottom'
                )
            ])
            .filter(Boolean)
    }

    /**
     * Builds one exposed pad-face cutout.
     * @param {object} pad Scene pad detail.
     * @param {'top' | 'bottom'} side Pad side.
     * @returns {{ x: number, y: number, radius: number, layerId: number } | null}
     */
    static #padSurfaceCutout(pad, side) {
        if (
            KicadScene3dCopperTrackCutoutBuilder.#maskOpening(pad, side) ===
            false
        ) {
            return null
        }

        const x = Number(pad?.x)
        const y = Number(pad?.y)
        const width = Number(
            side === 'bottom' ? pad?.sizeBottomX : pad?.sizeTopX
        )
        const height = Number(
            side === 'bottom' ? pad?.sizeBottomY : pad?.sizeTopY
        )
        const radius = Math.max(width, height) / 2

        if (!Number.isFinite(x + y) || radius <= 0) {
            return null
        }

        return {
            x,
            y,
            radius,
            layerId:
                side === 'bottom' ? BOTTOM_COPPER_LAYER_ID : TOP_COPPER_LAYER_ID
        }
    }

    /**
     * Resolves explicit solder-mask opening state for one pad side.
     * @param {object} pad Scene pad detail.
     * @param {'top' | 'bottom'} side Pad side.
     * @returns {boolean | undefined}
     */
    static #maskOpening(pad, side) {
        return side === 'bottom'
            ? pad?.hasBottomSolderMaskOpening
            : pad?.hasTopSolderMaskOpening
    }

    /**
     * Splits one track around intersecting cutouts.
     * @param {object} track Copper track.
     * @param {{ x: number, y: number, radius: number, layerId: number | null }[]} cutouts
     * Route cutouts.
     * @returns {object[]}
     */
    static #splitTrack(track, cutouts) {
        const intervals = cutouts
            .map((cutout) =>
                KicadScene3dCopperTrackCutoutBuilder.#trackCutoutInterval(
                    track,
                    cutout
                )
            )
            .filter(Boolean)
            .sort((a, b) => a.start - b.start)

        if (!intervals.length) {
            return [track]
        }

        return KicadScene3dCopperTrackCutoutBuilder.#trackSegments(
            track,
            KicadScene3dCopperTrackCutoutBuilder.#mergeIntervals(intervals)
        )
    }

    /**
     * Resolves the normalized track interval removed by one cutout.
     * @param {object} track Copper track.
     * @param {{ x: number, y: number, radius: number, layerId: number | null }} cutout
     * Route cutout.
     * @returns {{ start: number, end: number } | null}
     */
    static #trackCutoutInterval(track, cutout) {
        if (
            cutout.layerId !== null &&
            Number(track?.layerId) !== Number(cutout.layerId)
        ) {
            return null
        }

        const start = { x: Number(track?.x1 || 0), y: Number(track?.y1 || 0) }
        const end = { x: Number(track?.x2 || 0), y: Number(track?.y2 || 0) }
        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy)
        if (length <= MIN_SEGMENT_LENGTH_MIL) {
            return null
        }

        const projection =
            ((Number(cutout.x) - start.x) * dx +
                (Number(cutout.y) - start.y) * dy) /
            (length * length)
        const projectionPoint = {
            x: start.x + dx * projection,
            y: start.y + dy * projection
        }
        const perpendicularDistance = Math.hypot(
            Number(cutout.x) - projectionPoint.x,
            Number(cutout.y) - projectionPoint.y
        )
        const cutRadius =
            Number(cutout.radius || 0) +
            Math.max(Number(track?.width || 0), 1) / 2

        if (perpendicularDistance > cutRadius) {
            return null
        }

        const halfLength =
            Math.sqrt(
                Math.max(
                    cutRadius * cutRadius -
                        perpendicularDistance * perpendicularDistance,
                    0
                )
            ) / length
        const intervalStart = Math.max(0, projection - halfLength)
        const intervalEnd = Math.min(1, projection + halfLength)

        if (intervalEnd - intervalStart <= MIN_SEGMENT_LENGTH_MIL) {
            return null
        }

        return { start: intervalStart, end: intervalEnd }
    }

    /**
     * Builds retained track segments from merged cut intervals.
     * @param {object} track Copper track.
     * @param {{ start: number, end: number }[]} intervals Merged intervals.
     * @returns {object[]}
     */
    static #trackSegments(track, intervals) {
        const segments = []
        let cursor = 0

        for (const interval of intervals) {
            KicadScene3dCopperTrackCutoutBuilder.#appendTrackSegment(
                segments,
                track,
                cursor,
                interval.start
            )
            cursor = Math.max(cursor, interval.end)
        }

        KicadScene3dCopperTrackCutoutBuilder.#appendTrackSegment(
            segments,
            track,
            cursor,
            1
        )

        return segments
    }

    /**
     * Merges overlapping normalized cut intervals.
     * @param {{ start: number, end: number }[]} intervals Sorted intervals.
     * @returns {{ start: number, end: number }[]}
     */
    static #mergeIntervals(intervals) {
        const merged = []

        for (const interval of intervals) {
            const last = merged.at(-1)
            if (last && interval.start <= last.end) {
                last.end = Math.max(last.end, interval.end)
                continue
            }

            merged.push({ ...interval })
        }

        return merged
    }

    /**
     * Appends one retained track segment when it has non-zero length.
     * @param {object[]} segments Output segments.
     * @param {object} track Source track.
     * @param {number} startT Normalized segment start.
     * @param {number} endT Normalized segment end.
     * @returns {void}
     */
    static #appendTrackSegment(segments, track, startT, endT) {
        if (endT - startT <= MIN_SEGMENT_LENGTH_MIL) {
            return
        }

        segments.push(
            KicadScene3dCopperTrackCutoutBuilder.#interpolateTrack(
                track,
                startT,
                endT
            )
        )
    }

    /**
     * Interpolates one retained track segment.
     * @param {object} track Source track.
     * @param {number} startT Normalized segment start.
     * @param {number} endT Normalized segment end.
     * @returns {object}
     */
    static #interpolateTrack(track, startT, endT) {
        const segment = {
            ...track,
            x1: KicadScene3dCopperTrackCutoutBuilder.#lerp(
                Number(track?.x1 || 0),
                Number(track?.x2 || 0),
                startT
            ),
            y1: KicadScene3dCopperTrackCutoutBuilder.#lerp(
                Number(track?.y1 || 0),
                Number(track?.y2 || 0),
                startT
            ),
            x2: KicadScene3dCopperTrackCutoutBuilder.#lerp(
                Number(track?.x1 || 0),
                Number(track?.x2 || 0),
                endT
            ),
            y2: KicadScene3dCopperTrackCutoutBuilder.#lerp(
                Number(track?.y1 || 0),
                Number(track?.y2 || 0),
                endT
            )
        }

        if (startT > MIN_SEGMENT_LENGTH_MIL) {
            segment.capStartRound = false
            segment.capStartSideWall = false
        }
        if (endT < 1 - MIN_SEGMENT_LENGTH_MIL) {
            segment.capEndRound = false
            segment.capEndSideWall = false
        }

        return segment
    }

    /**
     * Interpolates and rounds one scene-unit coordinate.
     * @param {number} start Start value.
     * @param {number} end End value.
     * @param {number} ratio Interpolation ratio.
     * @returns {number}
     */
    static #lerp(start, end, ratio) {
        return Number((start + (end - start) * ratio).toFixed(6))
    }

    /**
     * Builds a stable cutout dedupe key.
     * @param {{ x: number, y: number, radius: number, layerId: number | null }} cutout
     * Route cutout.
     * @returns {string}
     */
    static #cutoutKey(cutout) {
        return [
            cutout.layerId === null ? '*' : Number(cutout.layerId),
            Number(cutout.x || 0).toFixed(4),
            Number(cutout.y || 0).toFixed(4),
            Number(cutout.radius || 0).toFixed(4)
        ].join(':')
    }
}
