import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const OUTPUT_URL = new URL(
    '../src/og/ecadforge-viewer-pcb.png',
    import.meta.url
)
const OUTPUT_PATH = fileURLToPath(OUTPUT_URL)
const PREVIEW_WIDTH = 1200
const PREVIEW_HEIGHT = 630

/**
 * Draws the ECAD Forge Open Graph preview image.
 */
class SocialPreviewGenerator {
    /**
     * Generates the preview PNG.
     * @returns {Promise<void>}
     */
    static async run() {
        const canvas = new RasterCanvas(PREVIEW_WIDTH, PREVIEW_HEIGHT, 2)

        SocialPreviewGenerator.#drawBackground(canvas)
        SocialPreviewGenerator.#drawPreviewFrame(canvas)
        SocialPreviewGenerator.#drawBoard(canvas)
        SocialPreviewGenerator.#drawInfoCards(canvas)
        SocialPreviewGenerator.#drawActionBars(canvas)

        const png = PngEncoder.encode(
            PREVIEW_WIDTH,
            PREVIEW_HEIGHT,
            canvas.toRgba()
        )

        await mkdir(dirname(OUTPUT_PATH), { recursive: true })
        await new Promise((resolve, reject) => {
            const stream = createWriteStream(OUTPUT_PATH)
            stream.on('finish', resolve)
            stream.on('error', reject)
            stream.end(png)
        })
    }

    /**
     * Draws the soft page background behind the card.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @returns {void}
     */
    static #drawBackground(canvas) {
        canvas.fill('#f4efe6')
        canvas.fillRect(0, 558, PREVIEW_WIDTH, 72, '#eaf7fb')
        canvas.line(1088, 0, 1200, 0, 4, '#0b8581')
    }

    /**
     * Draws the white preview card used by messaging apps.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @returns {void}
     */
    static #drawPreviewFrame(canvas) {
        canvas.fillRect(72, 72, 1056, 486, '#fbfaf7')
        canvas.fillRect(118, 110, 506, 408, '#f8f5ef')
    }

    /**
     * Draws the PCB-oriented main preview area.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @returns {void}
     */
    static #drawBoard(canvas) {
        const board = { x: 132, y: 112, width: 430, height: 392 }

        canvas.fillRoundedRect(
            board.x - 3,
            board.y - 3,
            board.width + 6,
            board.height + 6,
            40,
            '#0b8581'
        )
        canvas.fillRoundedRect(
            board.x,
            board.y,
            board.width,
            board.height,
            38,
            '#c9c7b8'
        )
        canvas.fillRoundedRect(240, 182, 184, 250, 8, '#cfe3dd', 0.8)
        canvas.fillRoundedRect(202, 352, 312, 74, 8, '#dee4d5', 0.9)

        SocialPreviewGenerator.#drawHeaders(canvas)
        SocialPreviewGenerator.#drawTraces(canvas)
        SocialPreviewGenerator.#drawComponents(canvas)
        SocialPreviewGenerator.#drawMounts(canvas)
        SocialPreviewGenerator.#drawVias(canvas)
    }

    /**
     * Draws the two side connector headers.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @returns {void}
     */
    static #drawHeaders(canvas) {
        for (let row = 0; row < 11; row += 1) {
            const y = 148 + row * 31
            SocialPreviewGenerator.#drawPad(canvas, 166, y)
            SocialPreviewGenerator.#drawPad(canvas, 204, y)
            SocialPreviewGenerator.#drawPad(canvas, 492, y)
            SocialPreviewGenerator.#drawPad(canvas, 530, y)
        }
    }

    /**
     * Draws one through-hole pad.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @param {number} x Pad center x.
     * @param {number} y Pad center y.
     * @returns {void}
     */
    static #drawPad(canvas, x, y) {
        canvas.fillRoundedRect(x - 17, y - 17, 34, 34, 3, '#f3eadb')
        canvas.fillRoundedRect(x - 11, y - 11, 22, 22, 2, '#c98b64')
        canvas.fillCircle(x, y, 8, '#087d77')
    }

    /**
     * Draws copper traces from the central package to headers and components.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @returns {void}
     */
    static #drawTraces(canvas) {
        const copper = '#d75d37'
        const copperAlt = '#e0794d'
        const signal = '#0b8581'
        const leftTargets = [174, 202, 232, 262, 292, 322, 352, 382, 412]
        const rightTargets = [172, 206, 238, 270, 300, 330, 360, 390, 420]

        for (let index = 0; index < leftTargets.length; index += 1) {
            const y = leftTargets[index]
            canvas.polyline(
                [
                    [330 - index * 2, 292 + index * 8],
                    [286 - index * 8, 296 + index * 10],
                    [248, y],
                    [204, y]
                ],
                4,
                index % 3 === 0 ? signal : copper
            )
        }

        for (let index = 0; index < rightTargets.length; index += 1) {
            const y = rightTargets[index]
            canvas.polyline(
                [
                    [392 + index * 2, 302 + index * 7],
                    [426 + index * 6, 306 + index * 9],
                    [462, y],
                    [492, y]
                ],
                4,
                index % 4 === 0 ? signal : copperAlt
            )
        }

        for (let index = 0; index < 10; index += 1) {
            const x = 340 + index * 7
            canvas.line(x, 260, x, 168 + (index % 2) * 18, 5, copper)
        }

        canvas.polyline(
            [
                [372, 260],
                [372, 228],
                [392, 208],
                [392, 158]
            ],
            10,
            copper
        )
        canvas.polyline(
            [
                [360, 260],
                [360, 224],
                [342, 202],
                [342, 158]
            ],
            10,
            copper
        )
        canvas.polyline(
            [
                [360, 352],
                [360, 422],
                [306, 454],
                [244, 454]
            ],
            5,
            copper
        )
        canvas.polyline(
            [
                [382, 352],
                [406, 406],
                [476, 430],
                [520, 456]
            ],
            5,
            copper
        )
    }

    /**
     * Draws simplified component bodies and package pads.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @returns {void}
     */
    static #drawComponents(canvas) {
        canvas.fillRoundedRect(318, 270, 92, 94, 7, '#e5efe8')
        canvas.fillRoundedRect(338, 292, 52, 52, 4, '#cf936f')
        for (let row = 0; row < 4; row += 1) {
            for (let column = 0; column < 4; column += 1) {
                canvas.fillCircle(
                    348 + column * 10,
                    302 + row * 10,
                    2.4,
                    '#0b8581'
                )
            }
        }
        SocialPreviewGenerator.#drawPackagePins(canvas, 312, 272, 104, 100)

        canvas.fillRoundedRect(252, 206, 106, 86, 6, '#dce7e0')
        canvas.strokeRect(268, 224, 74, 50, '#6f7d82', 2)
        SocialPreviewGenerator.#drawSmallPads(canvas, 250, 220, 4, 'left')
        SocialPreviewGenerator.#drawSmallPads(canvas, 358, 220, 4, 'right')

        canvas.fillRoundedRect(416, 150, 96, 92, 6, '#dce7e0')
        canvas.fillRoundedRect(432, 176, 58, 38, 3, '#f4eadb')
        SocialPreviewGenerator.#drawSmallPads(canvas, 426, 172, 3, 'left')
        SocialPreviewGenerator.#drawSmallPads(canvas, 502, 172, 3, 'right')

        canvas.fillRoundedRect(308, 122, 120, 34, 2, '#dbe7df')
        canvas.fillRect(326, 126, 24, 26, '#cd8f68')
        canvas.fillRect(362, 126, 24, 26, '#cd8f68')
        canvas.fillRect(398, 126, 24, 26, '#cd8f68')
        canvas.fillCircle(316, 139, 8, '#087d77')
        canvas.fillCircle(428, 139, 8, '#087d77')

        SocialPreviewGenerator.#drawPassive(canvas, 250, 194, 'vertical')
        SocialPreviewGenerator.#drawPassive(canvas, 258, 302, 'horizontal')
        SocialPreviewGenerator.#drawPassive(canvas, 286, 430, 'horizontal')
        SocialPreviewGenerator.#drawPassive(canvas, 456, 266, 'vertical')
        SocialPreviewGenerator.#drawPassive(canvas, 468, 354, 'horizontal')
        SocialPreviewGenerator.#drawPassive(canvas, 506, 236, 'horizontal')
    }

    /**
     * Draws one small passive component.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @param {number} x Component x.
     * @param {number} y Component y.
     * @param {'horizontal' | 'vertical'} direction Component orientation.
     * @returns {void}
     */
    static #drawPassive(canvas, x, y, direction) {
        if (direction === 'vertical') {
            canvas.fillRoundedRect(x - 9, y - 18, 18, 38, 4, '#f0ece0')
            canvas.fillRoundedRect(x - 8, y - 15, 16, 12, 3, '#d19a76')
            canvas.fillRoundedRect(x - 8, y + 6, 16, 12, 3, '#d19a76')
            return
        }

        canvas.fillRoundedRect(x - 20, y - 9, 42, 18, 4, '#f0ece0')
        canvas.fillRoundedRect(x - 17, y - 8, 13, 16, 3, '#d19a76')
        canvas.fillRoundedRect(x + 7, y - 8, 13, 16, 3, '#d19a76')
    }

    /**
     * Draws small package edge pads.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @param {number} x Pad column x.
     * @param {number} y First pad y.
     * @param {number} count Pad count.
     * @param {'left' | 'right'} side Pad side.
     * @returns {void}
     */
    static #drawSmallPads(canvas, x, y, count, side) {
        const padX = side === 'left' ? x : x - 12
        for (let index = 0; index < count; index += 1) {
            canvas.fillRoundedRect(padX, y + index * 15, 20, 7, 3, '#d19a76')
        }
    }

    /**
     * Draws the package's perimeter pads.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @param {number} x Package x.
     * @param {number} y Package y.
     * @param {number} width Package width.
     * @param {number} height Package height.
     * @returns {void}
     */
    static #drawPackagePins(canvas, x, y, width, height) {
        for (let index = 0; index < 8; index += 1) {
            canvas.fillRoundedRect(
                x + 12 + index * 11,
                y - 5,
                7,
                13,
                3,
                '#d19a76'
            )
            canvas.fillRoundedRect(
                x + 12 + index * 11,
                y + height - 8,
                7,
                13,
                3,
                '#d19a76'
            )
        }

        for (let index = 0; index < 6; index += 1) {
            canvas.fillRoundedRect(
                x - 5,
                y + 18 + index * 11,
                13,
                7,
                3,
                '#d19a76'
            )
            canvas.fillRoundedRect(
                x + width - 8,
                y + 18 + index * 11,
                13,
                7,
                3,
                '#d19a76'
            )
        }
    }

    /**
     * Draws board mounting holes.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @returns {void}
     */
    static #drawMounts(canvas) {
        const mounts = [
            [204, 150],
            [496, 150],
            [204, 464],
            [496, 464]
        ]

        for (const [x, y] of mounts) {
            canvas.fillCircle(x, y, 26, '#f6f4ee')
            canvas.fillCircle(x, y, 19, '#087d77')
        }
    }

    /**
     * Draws small white via rings over copper runs.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @returns {void}
     */
    static #drawVias(canvas) {
        const vias = [
            [296, 246],
            [316, 336],
            [332, 430],
            [350, 236],
            [366, 382],
            [394, 366],
            [416, 416],
            [458, 194],
            [486, 286],
            [504, 356],
            [270, 276],
            [292, 394]
        ]

        for (const [x, y] of vias) {
            canvas.fillCircle(x, y, 10, '#f5f6f0')
            canvas.fillCircle(x, y, 3.6, '#b5cfc8')
        }
    }

    /**
     * Draws the simplified information cards kept from the old preview.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @returns {void}
     */
    static #drawInfoCards(canvas) {
        canvas.fillRect(642, 96, 392, 184, '#eef8f5')
        canvas.fillRect(682, 138, 180, 24, '#bd5a26')
        canvas.fillRect(682, 180, 292, 16, '#64757d')
        canvas.fillRect(682, 212, 250, 16, '#64757d')

        canvas.fillRect(642, 312, 392, 168, '#fff5ed')
        canvas.fillRect(682, 352, 272, 18, '#147f78')
        canvas.fillRect(682, 392, 318, 16, '#64757d')
        canvas.fillRect(682, 424, 212, 16, '#64757d')
    }

    /**
     * Draws the simplified bottom action bars.
     * @param {RasterCanvas} canvas Drawing canvas.
     * @returns {void}
     */
    static #drawActionBars(canvas) {
        canvas.fillRect(92, 534, 152, 14, '#bd5a26')
        canvas.fillRect(306, 534, 178, 14, '#147f78')
    }
}

/**
 * Minimal RGBA raster canvas with shape helpers.
 */
class RasterCanvas {
    #height
    #pixelHeight
    #pixelWidth
    #pixels
    #scale
    #width

    /**
     * Creates a logical canvas backed by a supersampled pixel buffer.
     * @param {number} width Logical width.
     * @param {number} height Logical height.
     * @param {number} scale Supersampling scale.
     */
    constructor(width, height, scale) {
        this.#width = width
        this.#height = height
        this.#scale = scale
        this.#pixelWidth = width * scale
        this.#pixelHeight = height * scale
        this.#pixels = new Uint8ClampedArray(
            this.#pixelWidth * this.#pixelHeight * 4
        )
    }

    /**
     * Fills the whole canvas.
     * @param {string} color Fill color.
     * @returns {void}
     */
    fill(color) {
        const rgba = ColorParser.parse(color)

        for (let index = 0; index < this.#pixels.length; index += 4) {
            this.#pixels[index] = rgba[0]
            this.#pixels[index + 1] = rgba[1]
            this.#pixels[index + 2] = rgba[2]
            this.#pixels[index + 3] = 255
        }
    }

    /**
     * Fills an axis-aligned rectangle.
     * @param {number} x Rectangle x.
     * @param {number} y Rectangle y.
     * @param {number} width Rectangle width.
     * @param {number} height Rectangle height.
     * @param {string} color Fill color.
     * @param {number} [alpha] Fill alpha.
     * @returns {void}
     */
    fillRect(x, y, width, height, color, alpha = 1) {
        const rgba = ColorParser.parse(color)
        const bounds = this.#scaledBounds(x, y, width, height)

        for (let py = bounds.top; py < bounds.bottom; py += 1) {
            for (let px = bounds.left; px < bounds.right; px += 1) {
                this.#blendPixel(px, py, rgba, alpha)
            }
        }
    }

    /**
     * Fills a rounded rectangle.
     * @param {number} x Rectangle x.
     * @param {number} y Rectangle y.
     * @param {number} width Rectangle width.
     * @param {number} height Rectangle height.
     * @param {number} radius Corner radius.
     * @param {string} color Fill color.
     * @param {number} [alpha] Fill alpha.
     * @returns {void}
     */
    fillRoundedRect(x, y, width, height, radius, color, alpha = 1) {
        const rgba = ColorParser.parse(color)
        const bounds = this.#scaledBounds(x, y, width, height)

        for (let py = bounds.top; py < bounds.bottom; py += 1) {
            const logicalY = (py + 0.5) / this.#scale
            for (let px = bounds.left; px < bounds.right; px += 1) {
                const logicalX = (px + 0.5) / this.#scale

                if (
                    RasterCanvas.#isInsideRoundedRect(
                        logicalX,
                        logicalY,
                        x,
                        y,
                        width,
                        height,
                        radius
                    )
                ) {
                    this.#blendPixel(px, py, rgba, alpha)
                }
            }
        }
    }

    /**
     * Draws a stroked rectangle.
     * @param {number} x Rectangle x.
     * @param {number} y Rectangle y.
     * @param {number} width Rectangle width.
     * @param {number} height Rectangle height.
     * @param {string} color Stroke color.
     * @param {number} strokeWidth Stroke width.
     * @returns {void}
     */
    strokeRect(x, y, width, height, color, strokeWidth) {
        this.fillRect(x, y, width, strokeWidth, color)
        this.fillRect(x, y + height - strokeWidth, width, strokeWidth, color)
        this.fillRect(x, y, strokeWidth, height, color)
        this.fillRect(x + width - strokeWidth, y, strokeWidth, height, color)
    }

    /**
     * Draws a thick line segment.
     * @param {number} x1 Start x.
     * @param {number} y1 Start y.
     * @param {number} x2 End x.
     * @param {number} y2 End y.
     * @param {number} width Stroke width.
     * @param {string} color Stroke color.
     * @param {number} [alpha] Stroke alpha.
     * @returns {void}
     */
    line(x1, y1, x2, y2, width, color, alpha = 1) {
        const rgba = ColorParser.parse(color)
        const radius = width / 2
        const left = Math.floor((Math.min(x1, x2) - radius) * this.#scale)
        const right = Math.ceil((Math.max(x1, x2) + radius) * this.#scale)
        const top = Math.floor((Math.min(y1, y2) - radius) * this.#scale)
        const bottom = Math.ceil((Math.max(y1, y2) + radius) * this.#scale)
        const clipped = this.#clipScaledBounds(left, top, right, bottom)

        for (let py = clipped.top; py < clipped.bottom; py += 1) {
            const logicalY = (py + 0.5) / this.#scale
            for (let px = clipped.left; px < clipped.right; px += 1) {
                const logicalX = (px + 0.5) / this.#scale
                const distance = RasterCanvas.#distanceToSegment(
                    logicalX,
                    logicalY,
                    x1,
                    y1,
                    x2,
                    y2
                )

                if (distance <= radius) {
                    this.#blendPixel(px, py, rgba, alpha)
                }
            }
        }
    }

    /**
     * Draws connected line segments.
     * @param {Array<[number, number]>} points Polyline points.
     * @param {number} width Stroke width.
     * @param {string} color Stroke color.
     * @param {number} [alpha] Stroke alpha.
     * @returns {void}
     */
    polyline(points, width, color, alpha = 1) {
        for (let index = 0; index < points.length - 1; index += 1) {
            const [x1, y1] = points[index]
            const [x2, y2] = points[index + 1]
            this.line(x1, y1, x2, y2, width, color, alpha)
        }
    }

    /**
     * Fills a circle.
     * @param {number} x Circle center x.
     * @param {number} y Circle center y.
     * @param {number} radius Circle radius.
     * @param {string} color Fill color.
     * @param {number} [alpha] Fill alpha.
     * @returns {void}
     */
    fillCircle(x, y, radius, color, alpha = 1) {
        const rgba = ColorParser.parse(color)
        const left = Math.floor((x - radius) * this.#scale)
        const right = Math.ceil((x + radius) * this.#scale)
        const top = Math.floor((y - radius) * this.#scale)
        const bottom = Math.ceil((y + radius) * this.#scale)
        const clipped = this.#clipScaledBounds(left, top, right, bottom)

        for (let py = clipped.top; py < clipped.bottom; py += 1) {
            const logicalY = (py + 0.5) / this.#scale
            for (let px = clipped.left; px < clipped.right; px += 1) {
                const logicalX = (px + 0.5) / this.#scale
                const distance = Math.hypot(logicalX - x, logicalY - y)

                if (distance <= radius) {
                    this.#blendPixel(px, py, rgba, alpha)
                }
            }
        }
    }

    /**
     * Returns a downsampled RGBA buffer.
     * @returns {Uint8Array}
     */
    toRgba() {
        const output = new Uint8Array(this.#width * this.#height * 4)
        let outputIndex = 0

        for (let y = 0; y < this.#height; y += 1) {
            for (let x = 0; x < this.#width; x += 1) {
                const color = this.#samplePixel(x, y)
                output[outputIndex] = color[0]
                output[outputIndex + 1] = color[1]
                output[outputIndex + 2] = color[2]
                output[outputIndex + 3] = color[3]
                outputIndex += 4
            }
        }

        return output
    }

    /**
     * Samples one logical pixel by averaging supersampled pixels.
     * @param {number} x Logical x.
     * @param {number} y Logical y.
     * @returns {[number, number, number, number]}
     */
    #samplePixel(x, y) {
        const sums = [0, 0, 0, 0]
        const count = this.#scale * this.#scale

        for (let yy = 0; yy < this.#scale; yy += 1) {
            for (let xx = 0; xx < this.#scale; xx += 1) {
                const sourceX = x * this.#scale + xx
                const sourceY = y * this.#scale + yy
                const index = (sourceY * this.#pixelWidth + sourceX) * 4
                sums[0] += this.#pixels[index]
                sums[1] += this.#pixels[index + 1]
                sums[2] += this.#pixels[index + 2]
                sums[3] += this.#pixels[index + 3]
            }
        }

        return [
            Math.round(sums[0] / count),
            Math.round(sums[1] / count),
            Math.round(sums[2] / count),
            Math.round(sums[3] / count)
        ]
    }

    /**
     * Converts logical bounds to clipped scaled pixel bounds.
     * @param {number} x Logical x.
     * @param {number} y Logical y.
     * @param {number} width Logical width.
     * @param {number} height Logical height.
     * @returns {{ left: number, top: number, right: number, bottom: number }}
     */
    #scaledBounds(x, y, width, height) {
        return this.#clipScaledBounds(
            Math.floor(x * this.#scale),
            Math.floor(y * this.#scale),
            Math.ceil((x + width) * this.#scale),
            Math.ceil((y + height) * this.#scale)
        )
    }

    /**
     * Clips scaled bounds to the pixel buffer.
     * @param {number} left Left pixel.
     * @param {number} top Top pixel.
     * @param {number} right Right pixel.
     * @param {number} bottom Bottom pixel.
     * @returns {{ left: number, top: number, right: number, bottom: number }}
     */
    #clipScaledBounds(left, top, right, bottom) {
        return {
            left: Math.max(0, left),
            top: Math.max(0, top),
            right: Math.min(this.#pixelWidth, right),
            bottom: Math.min(this.#pixelHeight, bottom)
        }
    }

    /**
     * Alpha-blends one scaled pixel.
     * @param {number} x Pixel x.
     * @param {number} y Pixel y.
     * @param {[number, number, number, number]} rgba Source color.
     * @param {number} alpha Source alpha.
     * @returns {void}
     */
    #blendPixel(x, y, rgba, alpha) {
        const index = (y * this.#pixelWidth + x) * 4
        const sourceAlpha = (rgba[3] / 255) * alpha
        const inverseAlpha = 1 - sourceAlpha

        this.#pixels[index] = Math.round(
            rgba[0] * sourceAlpha + this.#pixels[index] * inverseAlpha
        )
        this.#pixels[index + 1] = Math.round(
            rgba[1] * sourceAlpha + this.#pixels[index + 1] * inverseAlpha
        )
        this.#pixels[index + 2] = Math.round(
            rgba[2] * sourceAlpha + this.#pixels[index + 2] * inverseAlpha
        )
        this.#pixels[index + 3] = Math.round(
            255 * sourceAlpha + this.#pixels[index + 3] * inverseAlpha
        )
    }

    /**
     * Checks whether a point is inside a rounded rectangle.
     * @param {number} px Point x.
     * @param {number} py Point y.
     * @param {number} x Rectangle x.
     * @param {number} y Rectangle y.
     * @param {number} width Rectangle width.
     * @param {number} height Rectangle height.
     * @param {number} radius Corner radius.
     * @returns {boolean}
     */
    static #isInsideRoundedRect(px, py, x, y, width, height, radius) {
        const innerX = Math.max(x + radius, Math.min(px, x + width - radius))
        const innerY = Math.max(y + radius, Math.min(py, y + height - radius))

        return Math.hypot(px - innerX, py - innerY) <= radius
    }

    /**
     * Computes the distance from a point to a segment.
     * @param {number} px Point x.
     * @param {number} py Point y.
     * @param {number} x1 Segment start x.
     * @param {number} y1 Segment start y.
     * @param {number} x2 Segment end x.
     * @param {number} y2 Segment end y.
     * @returns {number}
     */
    static #distanceToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1
        const dy = y2 - y1
        const lengthSquared = dx * dx + dy * dy

        if (lengthSquared === 0) {
            return Math.hypot(px - x1, py - y1)
        }

        const t = Math.max(
            0,
            Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared)
        )
        const projectionX = x1 + t * dx
        const projectionY = y1 + t * dy

        return Math.hypot(px - projectionX, py - projectionY)
    }
}

/**
 * Parses hexadecimal colors for the raster canvas.
 */
class ColorParser {
    /**
     * Parses a six-digit hexadecimal color.
     * @param {string} color Color string.
     * @returns {[number, number, number, number]}
     */
    static parse(color) {
        const value = color.startsWith('#') ? color.slice(1) : color

        return [
            Number.parseInt(value.slice(0, 2), 16),
            Number.parseInt(value.slice(2, 4), 16),
            Number.parseInt(value.slice(4, 6), 16),
            255
        ]
    }
}

/**
 * Encodes RGBA pixels as a PNG buffer.
 */
class PngEncoder {
    /**
     * Encodes RGBA pixels as a PNG image.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {Uint8Array} rgba RGBA pixel buffer.
     * @returns {Buffer}
     */
    static encode(width, height, rgba) {
        const scanlines = PngEncoder.#buildScanlines(width, height, rgba)
        const idat = deflateSync(scanlines)

        return Buffer.concat([
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
            PngEncoder.#chunk('IHDR', PngEncoder.#ihdr(width, height)),
            PngEncoder.#chunk('IDAT', idat),
            PngEncoder.#chunk('IEND', Buffer.alloc(0))
        ])
    }

    /**
     * Builds unfiltered PNG scanlines.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @param {Uint8Array} rgba RGBA pixel buffer.
     * @returns {Buffer}
     */
    static #buildScanlines(width, height, rgba) {
        const stride = width * 4
        const output = Buffer.alloc((stride + 1) * height)

        for (let y = 0; y < height; y += 1) {
            const sourceStart = y * stride
            const targetStart = y * (stride + 1)
            output[targetStart] = 0
            Buffer.from(
                rgba.buffer,
                rgba.byteOffset + sourceStart,
                stride
            ).copy(output, targetStart + 1)
        }

        return output
    }

    /**
     * Builds the IHDR payload.
     * @param {number} width Image width.
     * @param {number} height Image height.
     * @returns {Buffer}
     */
    static #ihdr(width, height) {
        const buffer = Buffer.alloc(13)

        buffer.writeUInt32BE(width, 0)
        buffer.writeUInt32BE(height, 4)
        buffer[8] = 8
        buffer[9] = 6
        buffer[10] = 0
        buffer[11] = 0
        buffer[12] = 0

        return buffer
    }

    /**
     * Builds a PNG chunk.
     * @param {string} type Chunk type.
     * @param {Buffer} data Chunk payload.
     * @returns {Buffer}
     */
    static #chunk(type, data) {
        const typeBuffer = Buffer.from(type)
        const length = Buffer.alloc(4)
        const crc = Buffer.alloc(4)

        length.writeUInt32BE(data.length, 0)
        crc.writeUInt32BE(
            PngEncoder.#crc32(Buffer.concat([typeBuffer, data])),
            0
        )

        return Buffer.concat([length, typeBuffer, data, crc])
    }

    /**
     * Calculates a PNG CRC32.
     * @param {Buffer} data Chunk type and payload.
     * @returns {number}
     */
    static #crc32(data) {
        let crc = 0xffffffff

        for (const byte of data) {
            crc = PngEncoder.#crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
        }

        return (crc ^ 0xffffffff) >>> 0
    }

    /**
     * Builds the CRC table.
     * @returns {number[]}
     */
    static #buildCrcTable() {
        const table = []

        for (let n = 0; n < 256; n += 1) {
            let value = n

            for (let k = 0; k < 8; k += 1) {
                value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
            }

            table.push(value >>> 0)
        }

        return table
    }

    static #crcTable = PngEncoder.#buildCrcTable()
}

await SocialPreviewGenerator.run()
