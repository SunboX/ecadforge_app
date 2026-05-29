/**
 * Builds browser-font-backed text planes for Altium TrueType silkscreen labels.
 */
export class PcbScene3dTrueTypeTextFactory {
    static #CANVAS_SCALE = 2
    static #DEFAULT_FONT_FAMILY = 'Arial'
    static #DEFAULT_MATERIAL_COLOR = 0xf8f6ef
    static #LINE_HEIGHT_RATIO = 1.16
    static #DEFAULT_TRUETYPE_EM_SCALE = 0.895
    static #MIN_CANVAS_PADDING = 2
    static #TEXTURE_PADDING_RATIO = 0.14
    static #loadedFontKeys = new Set()

    /**
     * Loads embedded Altium font payloads into the browser font set.
     * @param {{ name?: string, style?: string, format?: string, mimeType?: string, payloadBase64?: string, metrics?: { weightClass?: number } }[]} embeddedFonts
     * @returns {Promise<void>}
     */
    static async prepareEmbeddedFonts(embeddedFonts) {
        if (
            typeof globalThis.FontFace !== 'function' ||
            !globalThis.document?.fonts?.add
        ) {
            return
        }

        const pendingLoads = (Array.isArray(embeddedFonts) ? embeddedFonts : [])
            .filter((font) => font?.name && font?.payloadBase64)
            .filter((font) =>
                PcbScene3dTrueTypeTextFactory.#markFontForLoading(font)
            )
            .map((font) =>
                PcbScene3dTrueTypeTextFactory.#loadEmbeddedFont(font)
            )

        await Promise.all(pendingLoads.map((load) => load.catch(() => null)))
    }

    /**
     * Checks whether a normalized text primitive requests TrueType rendering.
     * @param {object} text
     * @returns {boolean}
     */
    static isTrueTypeText(text) {
        const fontTypeName = String(text?.fontTypeName || '').toUpperCase()

        return (
            text?.isTrueType === true ||
            Number(text?.fontType) === 1 ||
            fontTypeName.includes('TRUETYPE')
        )
    }

    /**
     * Builds one group containing texture-backed text meshes.
     * @param {any} THREE
     * @param {object[]} texts
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {{ materialColor?: number, invertedMaterialColor?: number, mirrorY?: boolean }} [options]
     * @returns {any}
     */
    static buildGroup(THREE, texts, z, normalizeBoardPoint, options = {}) {
        const group = new THREE.Group()
        group.name = 'true-type-texts'
        ;(Array.isArray(texts) ? texts : [])
            .filter((text) =>
                PcbScene3dTrueTypeTextFactory.isTrueTypeText(text)
            )
            .map((text) =>
                PcbScene3dTrueTypeTextFactory.#buildTextMesh(
                    THREE,
                    text,
                    z,
                    normalizeBoardPoint,
                    options
                )
            )
            .filter(Boolean)
            .forEach((mesh) => group.add(mesh))

        return group
    }

    /**
     * Builds one texture-backed text mesh.
     * @param {any} THREE
     * @param {object} text
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {{ materialColor?: number, invertedMaterialColor?: number, mirrorY?: boolean }} options
     * @returns {any | null}
     */
    static #buildTextMesh(THREE, text, z, normalizeBoardPoint, options) {
        if (
            !THREE?.CanvasTexture ||
            !THREE?.Mesh ||
            !THREE?.MeshBasicMaterial ||
            !THREE?.PlaneGeometry
        ) {
            return null
        }

        const textureInfo = PcbScene3dTrueTypeTextFactory.#buildTextureInfo(
            THREE,
            text,
            PcbScene3dTrueTypeTextFactory.#resolveTextPaint(text, options)
        )

        if (!textureInfo) {
            return null
        }

        const geometry = PcbScene3dTrueTypeTextFactory.#buildPlaneGeometry(
            THREE,
            textureInfo.width,
            textureInfo.height,
            textureInfo.anchorX,
            textureInfo.anchorY,
            Boolean(text?.mirrored)
        )
        const mesh = new THREE.Mesh(
            geometry,
            PcbScene3dTrueTypeTextFactory.#buildMaterial(THREE, textureInfo)
        )
        const position = PcbScene3dTrueTypeTextFactory.#normalizePoint(
            normalizeBoardPoint,
            Number(text?.x || 0),
            Number(text?.y || 0),
            Boolean(options?.mirrorY)
        )

        mesh.name = 'true-type-text'
        mesh.userData = mesh.userData || {}
        mesh.userData.scene3dViewCompensation = true
        mesh.userData.scene3dViewCompensationAxes = {
            x: false,
            y: true,
            z: false
        }
        mesh.position.set(position.x, position.y, z)
        mesh.rotation.z = (Number(text?.rotation || 0) * Math.PI) / 180

        return mesh
    }

    /**
     * Builds plane geometry anchored at the text insertion point.
     * @param {any} THREE
     * @param {number} width
     * @param {number} height
     * @param {number} anchorX
     * @param {number} anchorY
     * @param {boolean} mirrored
     * @returns {any}
     */
    static #buildPlaneGeometry(
        THREE,
        width,
        height,
        anchorX,
        anchorY,
        mirrored
    ) {
        const geometry = new THREE.PlaneGeometry(width, height)

        geometry.translate?.(width / 2 - anchorX, anchorY - height / 2, 0)
        if (mirrored) {
            geometry.scale?.(-1, 1, 1)
        }

        return geometry
    }

    /**
     * Builds a transparent canvas texture and its board-space dimensions.
     * @param {any} THREE
     * @param {object} text
     * @param {{ color: number, textColor: number, knockout: boolean }} paint
     * @returns {{ texture: any, width: number, height: number, baselineX: number, baselineY: number, anchorX: number, anchorY: number } | null}
     */
    static #buildTextureInfo(THREE, text, paint) {
        const canvas = PcbScene3dTrueTypeTextFactory.#createCanvas()
        const context = canvas?.getContext?.('2d')

        if (!canvas || !context) {
            return null
        }

        const lines = PcbScene3dTrueTypeTextFactory.#textLines(text)
        const fontSize = PcbScene3dTrueTypeTextFactory.#textHeight(text)
        const font = PcbScene3dTrueTypeTextFactory.#buildCanvasFont(
            text,
            fontSize
        )
        const metrics = PcbScene3dTrueTypeTextFactory.#measureLines(
            context,
            lines,
            font,
            fontSize
        )
        const padding = PcbScene3dTrueTypeTextFactory.#resolveTexturePadding(
            text,
            fontSize,
            paint.knockout
        )
        const layout = PcbScene3dTrueTypeTextFactory.#resolveTextureLayout(
            text,
            metrics,
            padding,
            paint.knockout
        )

        PcbScene3dTrueTypeTextFactory.#sizeCanvas(
            canvas,
            layout.width,
            layout.height
        )
        PcbScene3dTrueTypeTextFactory.#drawText(
            canvas,
            lines,
            font,
            paint,
            metrics,
            layout.baselineX,
            layout.baselineY,
            layout.width,
            layout.height
        )

        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true
        if ('colorSpace' in texture && THREE.SRGBColorSpace) {
            texture.colorSpace = THREE.SRGBColorSpace
        }

        return {
            texture,
            width: layout.width,
            height: layout.height,
            baselineX: layout.baselineX,
            baselineY: layout.baselineY,
            anchorX: layout.anchorX,
            anchorY: layout.anchorY
        }
    }

    /**
     * Creates a canvas when the runtime has a browser document.
     * @returns {HTMLCanvasElement | null}
     */
    static #createCanvas() {
        return globalThis.document?.createElement?.('canvas') || null
    }

    /**
     * Splits one text primitive into drawable lines.
     * @param {object} text
     * @returns {string[]}
     */
    static #textLines(text) {
        const value = String(text?.value ?? text?.text ?? '')
        const lines = value.split(/\r?\n/u)

        return lines.length ? lines : ['']
    }

    /**
     * Resolves the requested text height in mil.
     * @param {object} text
     * @returns {number}
     */
    static #textHeight(text) {
        const height = Math.max(
            Number(text?.sizeX) || Number(text?.height) || Number(text?.sizeY),
            1
        )

        return height * PcbScene3dTrueTypeTextFactory.#fontScale(text)
    }

    /**
     * Resolves the imported TrueType scale used for browser outline fonts.
     * @param {object} text
     * @returns {number}
     */
    static #fontScale(text) {
        if (Number.isFinite(Number(text?.trueTypeFontScale))) {
            return Math.max(Number(text.trueTypeFontScale), 0.01)
        }

        if (Number.isFinite(Number(text?.fontMetrics?.emScaleFromPcbHeight))) {
            return Math.max(Number(text.fontMetrics.emScaleFromPcbHeight), 0.01)
        }

        return PcbScene3dTrueTypeTextFactory.#DEFAULT_TRUETYPE_EM_SCALE
    }

    /**
     * Marks a font as loaded or pending so repeated renders do not re-register it.
     * @param {{ name?: string, style?: string, payloadBase64?: string, metrics?: { weightClass?: number } }} font
     * @returns {boolean}
     */
    static #markFontForLoading(font) {
        const key = [
            PcbScene3dTrueTypeTextFactory.#cleanFontFamily(font?.name),
            PcbScene3dTrueTypeTextFactory.#fontStyleForFont(font),
            PcbScene3dTrueTypeTextFactory.#fontWeightForFont(font),
            String(font?.payloadBase64 || '').length
        ].join('\0')

        if (PcbScene3dTrueTypeTextFactory.#loadedFontKeys.has(key)) {
            return false
        }

        PcbScene3dTrueTypeTextFactory.#loadedFontKeys.add(key)
        return true
    }

    /**
     * Loads one embedded font face and registers it with document.fonts.
     * @param {{ name?: string, style?: string, format?: string, mimeType?: string, payloadBase64?: string, metrics?: { weightClass?: number } }} font
     * @returns {Promise<void>}
     */
    static async #loadEmbeddedFont(font) {
        const face = new globalThis.FontFace(
            PcbScene3dTrueTypeTextFactory.#cleanFontFamily(font?.name),
            PcbScene3dTrueTypeTextFactory.#fontFaceSource(font),
            {
                style: PcbScene3dTrueTypeTextFactory.#fontStyleForFont(font),
                weight: String(
                    PcbScene3dTrueTypeTextFactory.#fontWeightForFont(font)
                )
            }
        )
        const loadedFace = await face.load()

        globalThis.document.fonts.add(loadedFace)
    }

    /**
     * Builds the CSS source string for one embedded font payload.
     * @param {{ format?: string, mimeType?: string, payloadBase64?: string }} font
     * @returns {string}
     */
    static #fontFaceSource(font) {
        return (
            'url(data:' +
            PcbScene3dTrueTypeTextFactory.#fontMimeType(font) +
            ';base64,' +
            PcbScene3dTrueTypeTextFactory.#sanitizeBase64(font?.payloadBase64) +
            ") format('" +
            PcbScene3dTrueTypeTextFactory.#fontFormat(font) +
            "')"
        )
    }

    /**
     * Resolves a CSS font-style value from embedded font metadata.
     * @param {{ style?: string }} font
     * @returns {'normal' | 'italic'}
     */
    static #fontStyleForFont(font) {
        return /italic|oblique/iu.test(String(font?.style || ''))
            ? 'italic'
            : 'normal'
    }

    /**
     * Resolves a CSS font-weight value from embedded font metadata.
     * @param {{ style?: string, metrics?: { weightClass?: number } }} font
     * @returns {number}
     */
    static #fontWeightForFont(font) {
        if (Number(font?.metrics?.weightClass) >= 100) {
            return Number(font.metrics.weightClass)
        }

        return /bold/iu.test(String(font?.style || '')) ? 700 : 400
    }

    /**
     * Resolves a browser font MIME type.
     * @param {{ mimeType?: string, format?: string }} font
     * @returns {string}
     */
    static #fontMimeType(font) {
        if (font?.mimeType) {
            return PcbScene3dTrueTypeTextFactory.#escapeCssUrlToken(
                font.mimeType
            )
        }

        return font?.format === 'opentype' ? 'font/otf' : 'font/ttf'
    }

    /**
     * Resolves a CSS font format label.
     * @param {{ format?: string }} font
     * @returns {'opentype' | 'truetype'}
     */
    static #fontFormat(font) {
        return font?.format === 'opentype' ? 'opentype' : 'truetype'
    }

    /**
     * Keeps a base64 font payload constrained to data-URI-safe characters.
     * @param {string | undefined} value
     * @returns {string}
     */
    static #sanitizeBase64(value) {
        return String(value || '').replace(/[^A-Za-z0-9+/=]/gu, '')
    }

    /**
     * Escapes a short CSS URL token.
     * @param {string | undefined} value
     * @returns {string}
     */
    static #escapeCssUrlToken(value) {
        return String(value || '').replace(/[^A-Za-z0-9./+-]/gu, '')
    }

    /**
     * Builds the CSS font string used for canvas rendering.
     * @param {object} text
     * @param {number} fontSize
     * @returns {string}
     */
    static #buildCanvasFont(text, fontSize) {
        const weight =
            text?.isBold || Number(text?.fontWeight) >= 600 ? '700' : '400'
        const style = text?.isItalic ? 'italic' : 'normal'
        const family = PcbScene3dTrueTypeTextFactory.#buildCanvasFontFamily(
            text?.fontFamily || text?.fontName
        )

        return `${style} ${weight} ${fontSize}px ${family}`
    }

    /**
     * Resolves transparent texture padding around one text run.
     * @param {object} text
     * @param {number} fontSize
     * @param {boolean} knockout
     * @returns {number}
     */
    static #resolveTexturePadding(text, fontSize, knockout) {
        const basePadding = Math.max(
            fontSize * PcbScene3dTrueTypeTextFactory.#TEXTURE_PADDING_RATIO,
            PcbScene3dTrueTypeTextFactory.#MIN_CANVAS_PADDING
        )

        if (!knockout) {
            return basePadding
        }

        const marginBorderWidth = Number(text?.marginBorderWidth)

        return Number.isFinite(marginBorderWidth) && marginBorderWidth >= 0
            ? marginBorderWidth
            : basePadding
    }

    /**
     * Builds a CSS family stack for one Altium TrueType font name.
     * @param {unknown} family
     * @returns {string}
     */
    static #buildCanvasFontFamily(family) {
        const cleaned = PcbScene3dTrueTypeTextFactory.#cleanFontFamily(family)
        const quoted = PcbScene3dTrueTypeTextFactory.#quoteFontFamily(cleaned)

        if (PcbScene3dTrueTypeTextFactory.#isMonospaceFamily(cleaned)) {
            return [
                quoted,
                '"Menlo"',
                '"Monaco"',
                '"Liberation Mono"',
                '"Courier New"',
                'monospace'
            ].join(', ')
        }

        if (PcbScene3dTrueTypeTextFactory.#isArialFamily(cleaned)) {
            return [
                quoted,
                '"Helvetica Neue"',
                'Helvetica',
                'Arial',
                'sans-serif'
            ].join(', ')
        }

        return [quoted, 'Arial', 'sans-serif'].join(', ')
    }

    /**
     * Removes Altium fixed-field padding from one font family name.
     * @param {unknown} family
     * @returns {string}
     */
    static #cleanFontFamily(family) {
        const raw = String(
            family || PcbScene3dTrueTypeTextFactory.#DEFAULT_FONT_FAMILY
        )
        const cleaned = raw.split('\0')[0]?.trim() || ''

        return cleaned || PcbScene3dTrueTypeTextFactory.#DEFAULT_FONT_FAMILY
    }

    /**
     * Quotes one CSS font family safely.
     * @param {string} family
     * @returns {string}
     */
    static #quoteFontFamily(family) {
        return `"${family.replace(/["\\]/gu, '\\$&')}"`
    }

    /**
     * Checks whether an imported family is Arial-like.
     * @param {unknown} family
     * @returns {boolean}
     */
    static #isArialFamily(family) {
        return /^arial(?:\b|$)/iu.test(
            PcbScene3dTrueTypeTextFactory.#cleanFontFamily(family)
        )
    }

    /**
     * Checks whether an imported family is a common PCB monospace font.
     * @param {unknown} family
     * @returns {boolean}
     */
    static #isMonospaceFamily(family) {
        return /^(consolas|courier|courier new|menlo|monaco|liberation mono)$/iu.test(
            PcbScene3dTrueTypeTextFactory.#cleanFontFamily(family)
        )
    }

    /**
     * Measures text lines with browser font metrics and stable fallbacks.
     * @param {CanvasRenderingContext2D} context
     * @param {string[]} lines
     * @param {string} font
     * @param {number} fontSize
     * @returns {{ width: number, height: number, ascent: number, descent: number, lineHeight: number }}
     */
    static #measureLines(context, lines, font, fontSize) {
        context.font = font

        const measured = lines.map((line) => context.measureText(line || ' '))
        const ascent = PcbScene3dTrueTypeTextFactory.#resolveMeasuredExtent(
            measured,
            'actualBoundingBoxAscent',
            fontSize * 0.82
        )
        const descent = PcbScene3dTrueTypeTextFactory.#resolveMeasuredExtent(
            measured,
            'actualBoundingBoxDescent',
            fontSize * 0.18
        )
        const glyphHeight = Math.max(ascent + descent, 1)
        const lineHeight = Math.max(
            glyphHeight * PcbScene3dTrueTypeTextFactory.#LINE_HEIGHT_RATIO,
            glyphHeight
        )

        return {
            width: Math.max(...measured.map((metric) => Number(metric.width))),
            height: glyphHeight + lineHeight * (lines.length - 1),
            ascent,
            descent,
            lineHeight
        }
    }

    /** @param {TextMetrics[]} measured @param {'actualBoundingBoxAscent' | 'actualBoundingBoxDescent'} field @param {number} fallback @returns {number} */
    static #resolveMeasuredExtent(measured, field, fallback) {
        const values = measured
            .map((metric) => Number(metric?.[field]))
            .filter((value) => Number.isFinite(value) && value > 0)

        return values.length ? Math.max(...values) : fallback
    }

    /** @param {object} text @param {{ width: number, height: number, ascent: number }} metrics @param {number} padding @param {boolean} knockout @returns {{ width: number, height: number, baselineX: number, baselineY: number, anchorX: number, anchorY: number }} */
    static #resolveTextureLayout(text, metrics, padding, knockout) {
        const authoredRectangle =
            PcbScene3dTrueTypeTextFactory.#resolveAuthoredRectangle(
                text,
                metrics,
                knockout
            )
        const expandsCompactBox =
            authoredRectangle &&
            PcbScene3dTrueTypeTextFactory.#usesCompactImplicitRectangle(
                text,
                authoredRectangle.width
            )
        const authoredPadding = expandsCompactBox ? padding : 0
        const width =
            authoredRectangle?.width + authoredPadding * 2 ||
            Math.max(metrics.width, 1) + padding * 2
        const height =
            authoredRectangle?.height + authoredPadding * 2 ||
            Math.max(metrics.height, 1) + padding * 2

        if (!authoredRectangle) {
            return {
                width,
                height,
                baselineX: padding,
                baselineY: padding + Number(metrics.ascent || 0),
                anchorX: padding,
                anchorY: padding + Number(metrics.ascent || 0)
            }
        }
        const authoredBaselineX =
            PcbScene3dTrueTypeTextFactory.#authoredBaselineX(
                text,
                metrics,
                authoredRectangle.width,
                padding
            )
        const authoredBaselineY =
            PcbScene3dTrueTypeTextFactory.#authoredBaselineY(
                text,
                metrics,
                authoredRectangle.height,
                padding
            )
        const baselineX = authoredPadding + authoredBaselineX
        const baselineY = authoredPadding + authoredBaselineY

        return {
            width,
            height,
            baselineX,
            baselineY,
            anchorX:
                authoredPadding +
                PcbScene3dTrueTypeTextFactory.#authoredAnchorX(
                    text,
                    authoredRectangle.width,
                    authoredBaselineX
                ),
            anchorY: baselineY
        }
    }

    /**
     * Resolves explicit inverted rectangle dimensions from source metadata.
     * @param {object} text
     * @param {{ width: number, height: number }} metrics
     * @param {boolean} knockout
     * @returns {{ width: number, height: number } | null}
     */
    static #resolveAuthoredRectangle(text, metrics, knockout) {
        const width = Number(text?.textboxRectWidth)
        const height = Number(text?.textboxRectHeight)

        if (
            !knockout ||
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width <= 0 ||
            height <= 0
        ) {
            return null
        }

        if (
            PcbScene3dTrueTypeTextFactory.#hasOversizedImplicitRectangle(
                text,
                metrics,
                width,
                height
            )
        ) {
            return null
        }

        return { width, height }
    }

    /**
     * Checks whether an implicit text box is broad default metadata, not a local label box.
     * @param {object} text
     * @param {{ width: number, height: number }} metrics
     * @param {number} width
     * @param {number} height
     * @returns {boolean}
     */
    static #hasOversizedImplicitRectangle(text, metrics, width, height) {
        if (Boolean(text?.useInvertedRectangle)) {
            return false
        }

        const textHeight = PcbScene3dTrueTypeTextFactory.#textHeight(text)
        const naturalWidth = Math.max(
            PcbScene3dTrueTypeTextFactory.#widestLineLength(text) * textHeight,
            Number(metrics?.width || 0),
            textHeight
        )
        const naturalHeight = Math.max(Number(metrics?.height || 0), textHeight)

        return width > naturalWidth * 3 || height > naturalHeight * 3
    }

    /**
     * Resolves the widest source line length for coarse box sanity checks.
     * @param {object} text
     * @returns {number}
     */
    static #widestLineLength(text) {
        return Math.max(
            ...PcbScene3dTrueTypeTextFactory.#textLines(text).map((line) =>
                Math.max(line.length, 1)
            )
        )
    }

    /**
     * Resolves horizontal baseline inside an authored rectangle.
     * @param {object} text
     * @param {{ width: number }} metrics
     * @param {number} width
     * @param {number} padding
     * @returns {number}
     */
    static #authoredBaselineX(text, metrics, width, padding) {
        const column = PcbScene3dTrueTypeTextFactory.#justificationColumn(text)
        const remainingWidth = Math.max(width - Number(metrics.width || 0), 0)

        if (column === 1) {
            return remainingWidth / 2
        }

        if (column === 2) {
            return remainingWidth
        }

        return Math.min(padding, remainingWidth)
    }

    /**
     * Resolves vertical baseline inside an authored rectangle.
     * @param {object} text
     * @param {{ height: number, ascent: number }} metrics
     * @param {number} height
     * @param {number} padding
     * @returns {number}
     */
    static #authoredBaselineY(text, metrics, height, padding) {
        const row = PcbScene3dTrueTypeTextFactory.#justificationRow(text)
        const remainingHeight = Math.max(
            height - Number(metrics.height || 0),
            0
        )

        if (row === 1) {
            return remainingHeight / 2 + Number(metrics.ascent || 0)
        }

        if (row === 2) {
            return remainingHeight + Number(metrics.ascent || 0)
        }

        return Math.min(padding, remainingHeight) + Number(metrics.ascent || 0)
    }

    /** @param {object} text @param {number} width @param {number} fallback @returns {number} */
    static #authoredAnchorX(text, width, fallback) {
        if (
            PcbScene3dTrueTypeTextFactory.#usesCompactImplicitRectangle(
                text,
                width
            )
        ) {
            return 0
        }

        return fallback
    }

    /** @param {object} text @param {number} width @returns {boolean} */
    static #usesCompactImplicitRectangle(text, width) {
        return (
            !Boolean(text?.useInvertedRectangle) &&
            PcbScene3dTrueTypeTextFactory.#justificationColumn(text) !== null &&
            width <= PcbScene3dTrueTypeTextFactory.#textHeight(text) * 2.25
        )
    }

    /** @param {object} text @returns {0 | 1 | 2 | null} */
    static #justificationColumn(text) {
        const justification = Number(text?.textboxRectJustification)

        return Number.isInteger(justification) && justification > 0
            ? Math.max(0, Math.min(2, Math.floor((justification - 1) / 3)))
            : null
    }

    /** @param {object} text @returns {0 | 1 | 2 | null} */
    static #justificationRow(text) {
        const justification = Number(text?.textboxRectJustification)

        return Number.isInteger(justification) && justification > 0
            ? ((justification - 1) % 3)
            : null
    }

    /**
     * Resizes one canvas for high-DPI text rasterization.
     * @param {HTMLCanvasElement} canvas
     * @param {number} width
     * @param {number} height
     * @returns {void}
     */
    static #sizeCanvas(canvas, width, height) {
        const scale = PcbScene3dTrueTypeTextFactory.#CANVAS_SCALE

        canvas.width = Math.ceil(width * scale)
        canvas.height = Math.ceil(height * scale)
    }

    /**
     * Draws text into one transparent canvas texture.
     * @param {HTMLCanvasElement} canvas
     * @param {string[]} lines
     * @param {string} font
     * @param {{ color: number, textColor: number, knockout: boolean }} paint
     * @param {{ ascent: number, lineHeight: number }} metrics
     * @param {number} baselineX
     * @param {number} baselineY
     * @param {number} width
     * @param {number} height
     * @returns {void}
     */
    static #drawText(
        canvas,
        lines,
        font,
        paint,
        metrics,
        baselineX,
        baselineY,
        width,
        height
    ) {
        const context = canvas.getContext('2d')
        const scale = PcbScene3dTrueTypeTextFactory.#CANVAS_SCALE

        context.clearRect(0, 0, canvas.width, canvas.height)
        context.scale?.(scale, scale)
        context.font = font
        context.textAlign = 'left'
        context.textBaseline = 'alphabetic'

        if (paint.knockout) {
            context.fillStyle = PcbScene3dTrueTypeTextFactory.#colorToCss(
                paint.color
            )
            context.fillRect?.(0, 0, width, height)
            context.globalCompositeOperation = 'destination-out'
            context.fillStyle = '#000000'
        } else {
            context.fillStyle = PcbScene3dTrueTypeTextFactory.#colorToCss(
                paint.textColor
            )
        }

        lines.forEach((line, index) => {
            context.fillText(
                line,
                baselineX,
                baselineY + metrics.lineHeight * index
            )
        })
        context.globalCompositeOperation = 'source-over'
    }

    /**
     * Builds a transparent unlit material for one text texture.
     * @param {any} THREE
     * @param {{ texture: any }} textureInfo
     * @returns {any}
     */
    static #buildMaterial(THREE, textureInfo) {
        return new THREE.MeshBasicMaterial({
            map: textureInfo.texture,
            transparent: true,
            opacity: 0.96,
            alphaTest: 0.02,
            depthWrite: false,
            toneMapped: false,
            fog: false,
            side: THREE.DoubleSide
        })
    }

    /**
     * Normalizes one board point and optionally mirrors it for underside use.
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {number} x
     * @param {number} y
     * @param {boolean} mirrorY
     * @returns {{ x: number, y: number }}
     */
    static #normalizePoint(normalizeBoardPoint, x, y, mirrorY) {
        const point = normalizeBoardPoint(x, y)

        return {
            x: point.x,
            y: mirrorY ? -point.y : point.y
        }
    }

    /**
     * Converts a numeric RGB color into CSS hex syntax.
     * @param {number} color
     * @returns {string}
     */
    static #colorToCss(color) {
        return `#${Number(color).toString(16).padStart(6, '0')}`
    }

    /**
     * Resolves a safe RGB material color.
     * @param {unknown} color
     * @returns {number}
     */
    static #resolveMaterialColor(color) {
        const numericColor = Number(color)

        return Number.isInteger(numericColor) &&
            numericColor >= 0 &&
            numericColor <= 0xffffff
            ? numericColor
            : PcbScene3dTrueTypeTextFactory.#DEFAULT_MATERIAL_COLOR
    }

    /**
     * Resolves how one TrueType text primitive should be painted.
     * @param {object} text
     * @param {{ materialColor?: number, invertedMaterialColor?: number }} options
     * @returns {{ color: number, textColor: number, knockout: boolean }}
     */
    static #resolveTextPaint(text, options) {
        const materialColor =
            PcbScene3dTrueTypeTextFactory.#resolveMaterialColor(
                options?.materialColor
            )
        const invertedMaterialColor =
            PcbScene3dTrueTypeTextFactory.#resolveMaterialColor(
                options?.invertedMaterialColor
            )
        const usesInvertedText = Boolean(text?.isInverted)

        return {
            color: materialColor,
            textColor: usesInvertedText
                ? invertedMaterialColor
                : materialColor,
            knockout: usesInvertedText
        }
    }
}
