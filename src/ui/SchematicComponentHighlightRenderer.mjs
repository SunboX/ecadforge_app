import { PcbComponentSelectionModel } from '../core/PcbComponentSelectionModel.mjs'
import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'
import { SchematicCoordinateProjector } from './SchematicCoordinateProjector.mjs'
import { SchematicHighlightBoundsPolicy } from './SchematicHighlightBoundsPolicy.mjs'
import { SchematicMarkupTools } from './SchematicMarkupTools.mjs'

const OWNER_ID_FIELDS = [
    'ownerIndex',
    'ownerId',
    'ownerUniqueId',
    'componentOwnerId',
    'componentUniqueId',
    'uniqueId'
]

/**
 * Adds schematic symbol hit targets and selected-symbol overlays.
 */
export class SchematicComponentHighlightRenderer {
    /**
     * Adds schematic symbol hit targets and selected symbol overlays.
     * @param {string} markup Rendered schematic markup.
     * @param {object} documentModel Document model.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {string}
     */
    static inject(markup, documentModel, selectedComponentKey = '') {
        if (EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            return this.#injectCanonical(
                markup,
                documentModel,
                selectedComponentKey
            )
        }

        const schematic = documentModel?.schematic
        const components = Array.isArray(schematic?.components)
            ? schematic.components
            : []
        if (!components.length) return markup

        const isKicad =
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'kicad'
        const targets = components
            .map((component, index) =>
                this.#resolveComponentTarget(
                    schematic,
                    component,
                    index,
                    isKicad
                )
            )
            .filter(Boolean)
        if (!targets.length) return markup

        const selectedKey = String(selectedComponentKey || '').trim()
        let renderedMarkup = this.#injectHighlightStyle(markup)
        targets
            .filter((target) => selectedKey && target.key === selectedKey)
            .forEach((target) => {
                renderedMarkup = this.#injectHighlightMarkup(
                    renderedMarkup,
                    this.#renderHighlight(target.key, target.box),
                    target.anchorBoundsList
                )
            })

        return this.#injectHighlightMarkup(
            renderedMarkup,
            this.#renderHitTargets(targets)
        )
    }

    /**
     * Adds direct-coordinate targets for canonical CircuitJSON components.
     * @param {string} markup Rendered schematic markup.
     * @param {object} documentModel Canonical document.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {string} Highlighted markup.
     */
    static #injectCanonical(markup, documentModel, selectedComponentKey) {
        const targets = this.#canonicalTargets(documentModel)
        if (!targets.length) return markup

        const selectedKey = String(selectedComponentKey || '').trim()
        let renderedMarkup = this.#injectHighlightStyle(markup)
        for (const target of targets) {
            if (!selectedKey || target.key !== selectedKey) continue
            renderedMarkup = this.#injectHighlightMarkup(
                renderedMarkup,
                this.#renderHighlight(target.key, target.box)
            )
        }
        return this.#injectHighlightMarkup(
            renderedMarkup,
            this.#renderHitTargets(targets)
        )
    }

    /**
     * Builds canonical component targets from standard element geometry.
     * @param {object} documentModel Canonical document.
     * @returns {{ key: string, box: { x: number, y: number, width: number, height: number, radius: number } }[]} Component targets.
     */
    static #canonicalTargets(documentModel) {
        const elements =
            EcadFormatRegistry.circuitJsonElementsForDocument(documentModel)
        const sourceNames = new Map(
            elements
                .filter((element) => element?.type === 'source_component')
                .map((element) => [
                    String(element.source_component_id || ''),
                    String(element.name || element.source_component_id || '')
                ])
        )
        return elements
            .filter((element) =>
                ['schematic_component', 'schematic_symbol'].includes(
                    element?.type
                )
            )
            .map((component, index) => {
                const center = component?.center || component?.position
                const size = component?.size || {
                    width: component?.width,
                    height: component?.height
                }
                const x = Number(center?.x)
                const y = Number(center?.y)
                const width = Number(size?.width)
                const height = Number(size?.height)
                const key =
                    sourceNames.get(
                        String(component?.source_component_id || '')
                    ) || String(component?.name || 'Component ' + (index + 1))
                if (
                    !key ||
                    !Number.isFinite(x) ||
                    !Number.isFinite(y) ||
                    !Number.isFinite(width) ||
                    !Number.isFinite(height)
                ) {
                    return null
                }
                return {
                    key,
                    box: this.#padBounds(
                        {
                            minX: x - width / 2,
                            minY: y - height / 2,
                            maxX: x + width / 2,
                            maxY: y + height / 2
                        },
                        true
                    )
                }
            })
            .filter(Boolean)
    }

    /**
     * Resolves a selectable component target.
     * @param {object} schematic Schematic model.
     * @param {any} component Component metadata.
     * @param {number} index Component index.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ key: string, box: { x: number, y: number, width: number, height: number, radius: number }, anchorBoundsList: { minX: number, minY: number, maxX: number, maxY: number }[] } | null}
     */
    static #resolveComponentTarget(schematic, component, index, isKicad) {
        const key = PcbComponentSelectionModel.resolveComponentKey(
            component,
            index
        )
        const ownerId = this.#resolveOwnerId(schematic, component, key)
        const bounds = this.#resolveHighlightBounds(
            schematic,
            component,
            ownerId,
            isKicad
        )
        if (!key || !bounds) return null

        const anchorBoundsList = ownerId
            ? this.#resolveOwnerBodyBounds(
                  schematic,
                  ownerId,
                  SchematicCoordinateProjector.resolveContentHeight(
                      schematic,
                      isKicad
                  ),
                  isKicad
              )
            : []

        return {
            key,
            box: this.#padBounds(bounds, isKicad),
            anchorBoundsList
        }
    }

    /**
     * Resolves the primitive owner id for a selected component.
     * @param {object} schematic Schematic model.
     * @param {any} component Component metadata.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {string}
     */
    static #resolveOwnerId(schematic, component, selectedComponentKey) {
        const componentOwner = this.#firstOwnerId(component)
        if (
            componentOwner &&
            this.#hasOwnerPrimitives(schematic, componentOwner)
        ) {
            return componentOwner
        }

        const designator = String(
            component?.designator ??
                component?.reference ??
                component?.refdes ??
                selectedComponentKey
        ).trim()
        const textOwner = this.#resolveDesignatorOwnerId(
            schematic,
            component,
            designator
        )
        return textOwner || componentOwner || ''
    }

    /**
     * Returns the first owner-like id on a primitive.
     * @param {any} item Primitive or component.
     * @returns {string}
     */
    static #firstOwnerId(item) {
        for (const field of OWNER_ID_FIELDS) {
            const value = item?.[field]
            if (value !== undefined && value !== null && value !== '') {
                return String(value)
            }
        }
        return ''
    }

    /**
     * Returns whether any schematic primitive references an owner id.
     * @param {object} schematic Schematic model.
     * @param {string} ownerId Owner id.
     * @returns {boolean}
     */
    static #hasOwnerPrimitives(schematic, ownerId) {
        return this.#ownerPrimitiveCollections(schematic).some((items) =>
            items.some((item) => this.#matchesOwnerId(item, ownerId))
        )
    }

    /**
     * Resolves an owner id by finding nearby visible designator text.
     * @param {object} schematic Schematic model.
     * @param {any} component Component metadata.
     * @param {string} designator Component designator.
     * @returns {string}
     */
    static #resolveDesignatorOwnerId(schematic, component, designator) {
        const normalizedDesignator = String(designator || '').trim()
        const texts = Array.isArray(schematic?.texts) ? schematic.texts : []
        const candidates = texts
            .map((text) => ({
                ownerId: this.#firstOwnerId(text),
                text,
                value: String(text?.value ?? text?.text ?? '').trim()
            }))
            .filter(
                (entry) =>
                    entry.ownerId &&
                    this.#isDesignatorText(entry.value, normalizedDesignator)
            )
            .sort(
                (left, right) =>
                    this.#distanceFromComponent(left.text, component) -
                    this.#distanceFromComponent(right.text, component)
            )

        return candidates[0]?.ownerId || ''
    }

    /**
     * Returns whether visible text names a component designator or multipart part.
     * @param {string} value Visible text.
     * @param {string} designator Base component designator.
     * @returns {boolean}
     */
    static #isDesignatorText(value, designator) {
        if (!value || !designator) return false
        if (value === designator) return true
        if (!value.startsWith(designator)) return false

        return /^[A-Za-z]+$/.test(value.slice(designator.length))
    }

    /**
     * Returns squared distance from text to component anchor.
     * @param {{ x?: number, y?: number }} text Text primitive.
     * @param {{ x?: number, y?: number }} component Component metadata.
     * @returns {number}
     */
    static #distanceFromComponent(text, component) {
        const dx = Number(text?.x || 0) - Number(component?.x || 0)
        const dy = Number(text?.y || 0) - Number(component?.y || 0)
        return dx * dx + dy * dy
    }

    /**
     * Resolves the selected symbol bounds in rendered group coordinates.
     * @param {object} schematic Schematic model.
     * @param {any} component Component metadata.
     * @param {string} ownerId Owner id.
     * @param {boolean} isKicad Whether the document uses direct coordinates.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveHighlightBounds(schematic, component, ownerId, isKicad) {
        const contentHeight = SchematicCoordinateProjector.resolveContentHeight(
            schematic,
            isKicad
        )
        const primitiveBounds = ownerId
            ? this.#resolveOwnerBounds(
                  schematic,
                  ownerId,
                  contentHeight,
                  isKicad
              )
            : []
        const bodyBounds = ownerId
            ? this.#resolveOwnerBodyBounds(
                  schematic,
                  ownerId,
                  contentHeight,
                  isKicad
              )
            : []
        const primitiveEnvelope = this.#mergeBounds(primitiveBounds)
        const bodyEnvelope = this.#mergeBounds(bodyBounds)
        const pinCount = ownerId ? this.#countOwnerPins(schematic, ownerId) : 0
        const bounds = SchematicHighlightBoundsPolicy.prefersBodyBounds(
            bodyEnvelope,
            primitiveEnvelope,
            pinCount
        )
            ? bodyEnvelope
            : primitiveEnvelope
        return (
            bounds ||
            this.#resolveComponentAnchorBounds(
                component,
                contentHeight,
                isKicad
            )
        )
    }

    /**
     * Resolves bounds for all owner-linked primitives.
     * @param {object} schematic Schematic model.
     * @param {string} ownerId Owner id.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }[]}
     */
    static #resolveOwnerBounds(schematic, ownerId, contentHeight, isKicad) {
        const bounds = this.#ownerPrimitiveEntries(schematic)
            .filter((entry) => this.#matchesOwnerId(entry.item, ownerId))
            .map((entry) => ({
                bounds: this.#resolvePrimitiveBounds(
                    entry.item,
                    contentHeight,
                    isKicad
                ),
                isText: this.#isTextPrimitive(entry.item)
            }))
            .filter((entry) => entry.bounds)
        const geometryBounds = bounds
            .filter((entry) => !entry.isText)
            .map((entry) => entry.bounds)

        return geometryBounds.length
            ? geometryBounds
            : bounds.map((entry) => entry.bounds)
    }

    /**
     * Resolves body primitive bounds used as a backdrop insertion anchor.
     * @param {object} schematic Schematic model.
     * @param {string} ownerId Owner id.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }[]}
     */
    static #resolveOwnerBodyBounds(schematic, ownerId, contentHeight, isKicad) {
        return this.#ownerPrimitiveEntries(schematic)
            .filter(
                (entry) =>
                    this.#isBodyPrimitiveKind(entry.kind) &&
                    this.#matchesOwnerId(entry.item, ownerId)
            )
            .map((entry) =>
                this.#resolvePrimitiveBounds(entry.item, contentHeight, isKicad)
            )
            .filter((bounds) => SchematicMarkupTools.isValidBounds(bounds))
    }

    /**
     * Counts owner-linked pins.
     * @param {object} schematic Schematic model.
     * @param {string} ownerId Owner id.
     * @returns {number}
     */
    static #countOwnerPins(schematic, ownerId) {
        return Array.isArray(schematic?.pins)
            ? schematic.pins.filter((pin) => this.#matchesOwnerId(pin, ownerId))
                  .length
            : 0
    }

    /**
     * Returns owner-linked primitive entries with their collection kind.
     * @param {object} schematic Schematic model.
     * @returns {{ kind: string, item: any }[]}
     */
    static #ownerPrimitiveEntries(schematic) {
        return [
            { kind: 'rectangle', items: schematic?.rectangles },
            { kind: 'polygon', items: schematic?.polygons },
            { kind: 'ellipse', items: schematic?.ellipses },
            { kind: 'arc', items: schematic?.arcs },
            { kind: 'bezier', items: schematic?.beziers },
            { kind: 'line', items: schematic?.lines },
            { kind: 'pin', items: schematic?.pins },
            { kind: 'text', items: schematic?.texts }
        ].flatMap((collection) =>
            Array.isArray(collection.items)
                ? collection.items.map((item) => ({
                      kind: collection.kind,
                      item
                  }))
                : []
        )
    }

    /**
     * Returns whether a primitive kind is likely to describe symbol body area.
     * @param {string} kind Primitive collection kind.
     * @returns {boolean}
     */
    static #isBodyPrimitiveKind(kind) {
        return ['rectangle', 'polygon', 'ellipse', 'arc', 'bezier'].includes(
            kind
        )
    }

    /**
     * Returns primitive collections that can contribute to symbol bounds.
     * @param {object} schematic Schematic model.
     * @returns {any[][]}
     */
    static #ownerPrimitiveCollections(schematic) {
        return this.#ownerPrimitiveEntries(schematic)
            .reduce((collections, entry) => {
                const latest = collections.at(-1)
                if (latest?.kind === entry.kind) {
                    latest.items.push(entry.item)
                    return collections
                }
                collections.push({ kind: entry.kind, items: [entry.item] })
                return collections
            }, [])
            .map((collection) => collection.items)
    }

    /**
     * Returns whether one primitive belongs to the given owner id.
     * @param {any} item Primitive metadata.
     * @param {string} ownerId Owner id.
     * @returns {boolean}
     */
    static #matchesOwnerId(item, ownerId) {
        return OWNER_ID_FIELDS.some(
            (field) => String(item?.[field] ?? '') === String(ownerId)
        )
    }

    /**
     * Returns whether one primitive is rendered as text.
     * @param {any} item Primitive metadata.
     * @returns {boolean}
     */
    static #isTextPrimitive(item) {
        return Boolean(item?.text || item?.value)
    }

    /**
     * Resolves one primitive bounds object.
     * @param {any} primitive Primitive metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolvePrimitiveBounds(primitive, contentHeight, isKicad) {
        if (Array.isArray(primitive?.points)) {
            return this.#pointsBounds(primitive.points, contentHeight, isKicad)
        }
        if (
            Number.isFinite(Number(primitive?.x)) &&
            Number.isFinite(Number(primitive?.width)) &&
            Number.isFinite(Number(primitive?.height))
        ) {
            return this.#rectangleBounds(primitive, contentHeight, isKicad)
        }
        if (
            Number.isFinite(Number(primitive?.x1)) &&
            Number.isFinite(Number(primitive?.x2))
        ) {
            return this.#lineBounds(primitive, contentHeight, isKicad)
        }
        if (
            primitive?.orientation &&
            Number.isFinite(Number(primitive?.length))
        ) {
            return this.#pinBounds(primitive, contentHeight, isKicad)
        }
        if (
            Number.isFinite(Number(primitive?.radius)) ||
            Number.isFinite(Number(primitive?.radiusX))
        ) {
            return this.#ellipseLikeBounds(primitive, contentHeight, isKicad)
        }
        if (primitive?.text || primitive?.value) {
            return this.#textBounds(primitive, contentHeight, isKicad)
        }
        return null
    }

    /**
     * Resolves rectangle bounds.
     * @param {{ x: number, y: number, width: number, height: number }} item Primitive metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #rectangleBounds(item, contentHeight, isKicad) {
        return this.#pointsBounds(
            [
                { x: item.x, y: item.y },
                { x: Number(item.x) + Number(item.width), y: item.y },
                {
                    x: Number(item.x) + Number(item.width),
                    y: Number(item.y) + Number(item.height)
                },
                { x: item.x, y: Number(item.y) + Number(item.height) }
            ],
            contentHeight,
            isKicad
        )
    }

    /**
     * Resolves line bounds.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} item Primitive metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #lineBounds(item, contentHeight, isKicad) {
        return this.#pointsBounds(
            [
                { x: item.x1, y: item.y1 },
                { x: item.x2, y: item.y2 }
            ],
            contentHeight,
            isKicad
        )
    }

    /**
     * Resolves pin endpoint bounds.
     * @param {{ x: number, y: number, length: number, orientation: string }} pin Pin metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #pinBounds(pin, contentHeight, isKicad) {
        const length = Math.max(Number(pin.length || 0), 0)
        const outer = { x: Number(pin.x || 0), y: Number(pin.y || 0) }
        const body = { ...outer }
        if (pin.orientation === 'left') outer.x -= length
        if (pin.orientation === 'right') outer.x += length
        if (pin.orientation === 'top') outer.y -= length
        if (pin.orientation === 'bottom') outer.y += length
        return this.#pointsBounds([body, outer], contentHeight, isKicad)
    }

    /**
     * Resolves circle, ellipse, or arc bounds.
     * @param {{ x: number, y: number, radius?: number, radiusX?: number, radiusY?: number }} item Primitive metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #ellipseLikeBounds(item, contentHeight, isKicad) {
        const radiusX = Math.max(Number(item.radiusX ?? item.radius ?? 0), 0)
        const radiusY = Math.max(
            Number(item.radiusY ?? item.radius ?? radiusX),
            0
        )
        return this.#pointsBounds(
            [
                { x: Number(item.x) - radiusX, y: Number(item.y) - radiusY },
                { x: Number(item.x) + radiusX, y: Number(item.y) + radiusY }
            ],
            contentHeight,
            isKicad
        )
    }

    /**
     * Resolves approximate rendered text bounds.
     * @param {{ x: number, y: number, text?: string, value?: string, fontSize?: number, font?: { size?: number, height?: number }, anchor?: string }} text Text primitive.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #textBounds(text, contentHeight, isKicad) {
        const value = String(text?.value ?? text?.text ?? '')
        const fontSize = Math.max(
            Number(text?.fontSize ?? text?.font?.height ?? text?.font?.size) ||
                (isKicad ? 1.27 : 10),
            isKicad ? 0.8 : 6
        )
        const width = Math.max(value.length * fontSize * 0.62, fontSize)
        const height = fontSize * 1.35
        const x = Number(text.x || 0)
        const y = SchematicCoordinateProjector.projectY(
            Number(text.y || 0),
            contentHeight,
            isKicad
        )
        const anchor = String(text.anchor || '').toLowerCase()
        const minX =
            anchor === 'middle'
                ? x - width / 2
                : anchor === 'end'
                  ? x - width
                  : x

        return {
            minX,
            minY: y - height,
            maxX: minX + width,
            maxY: y + height * 0.25
        }
    }

    /**
     * Resolves bounds from point metadata.
     * @param {{ x: number, y: number }[]} points Source coordinate points.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #pointsBounds(points, contentHeight, isKicad) {
        const renderedPoints = points
            .map((point) => ({
                x: Number(point?.x),
                y: SchematicCoordinateProjector.projectY(
                    Number(point?.y),
                    contentHeight,
                    isKicad
                )
            }))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
        if (!renderedPoints.length) return null

        return {
            minX: Math.min(...renderedPoints.map((point) => point.x)),
            minY: Math.min(...renderedPoints.map((point) => point.y)),
            maxX: Math.max(...renderedPoints.map((point) => point.x)),
            maxY: Math.max(...renderedPoints.map((point) => point.y))
        }
    }

    /**
     * Resolves a fallback box around a component anchor.
     * @param {{ x?: number, y?: number }} component Component metadata.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveComponentAnchorBounds(component, contentHeight, isKicad) {
        if (
            !Number.isFinite(Number(component?.x)) ||
            !Number.isFinite(Number(component?.y))
        ) {
            return null
        }

        const size = isKicad ? 8 : 36
        const x = Number(component.x)
        const y = SchematicCoordinateProjector.projectY(
            Number(component.y),
            contentHeight,
            isKicad
        )
        return {
            minX: x - size / 2,
            minY: y - size / 2,
            maxX: x + size / 2,
            maxY: y + size / 2
        }
    }

    /**
     * Merges bounds into one envelope.
     * @param {({ minX: number, minY: number, maxX: number, maxY: number } | null)[]} boundsList Bounds list.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #mergeBounds(boundsList) {
        const validBounds = boundsList.filter((bounds) =>
            SchematicMarkupTools.isValidBounds(bounds)
        )
        if (!validBounds.length) return null

        return {
            minX: Math.min(...validBounds.map((bounds) => bounds.minX)),
            minY: Math.min(...validBounds.map((bounds) => bounds.minY)),
            maxX: Math.max(...validBounds.map((bounds) => bounds.maxX)),
            maxY: Math.max(...validBounds.map((bounds) => bounds.maxY))
        }
    }

    /**
     * Adds readable padding and a minimum size to highlight bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Raw bounds.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {{ x: number, y: number, width: number, height: number, radius: number }}
     */
    static #padBounds(bounds, isKicad) {
        const minSize = isKicad ? 4 : 14
        const minPadding = isKicad ? 1.6 : 6
        const width = Math.max(bounds.maxX - bounds.minX, minSize)
        const height = Math.max(bounds.maxY - bounds.minY, minSize)
        const centerX = (bounds.minX + bounds.maxX) / 2
        const centerY = (bounds.minY + bounds.maxY) / 2
        const paddedWidth = width + Math.max(width * 0.12, minPadding) * 2
        const paddedHeight = height + Math.max(height * 0.12, minPadding) * 2

        return {
            x: centerX - paddedWidth / 2,
            y: centerY - paddedHeight / 2,
            width: paddedWidth,
            height: paddedHeight,
            radius: isKicad ? 1.2 : 5
        }
    }

    /**
     * Renders invisible symbol click targets.
     * @param {{ key: string, box: { x: number, y: number, width: number, height: number, radius: number } }[]} targets Component targets.
     * @returns {string}
     */
    static #renderHitTargets(targets) {
        return (
            '<g class="schematic-symbol-hit-targets">' +
            targets
                .map(
                    (target) =>
                        '<g class="schematic-symbol-hit-target" data-schematic-component-key="' +
                        SchematicMarkupTools.escapeHtml(target.key) +
                        '"><rect class="schematic-symbol-hit-target__area" x="' +
                        SchematicMarkupTools.formatNumber(target.box.x) +
                        '" y="' +
                        SchematicMarkupTools.formatNumber(target.box.y) +
                        '" width="' +
                        SchematicMarkupTools.formatNumber(target.box.width) +
                        '" height="' +
                        SchematicMarkupTools.formatNumber(target.box.height) +
                        '" rx="' +
                        SchematicMarkupTools.formatNumber(target.box.radius) +
                        '"/></g>'
                )
                .join('') +
            '</g>'
        )
    }

    /**
     * Renders the SVG selection marker.
     * @param {string} key Selected component key.
     * @param {{ x: number, y: number, width: number, height: number, radius: number }} box Highlight box.
     * @returns {string}
     */
    static #renderHighlight(key, box) {
        return (
            '<g class="schematic-symbol-highlight" data-schematic-component-key="' +
            SchematicMarkupTools.escapeHtml(key) +
            '"><rect class="schematic-symbol-highlight__fill" x="' +
            SchematicMarkupTools.formatNumber(box.x) +
            '" y="' +
            SchematicMarkupTools.formatNumber(box.y) +
            '" width="' +
            SchematicMarkupTools.formatNumber(box.width) +
            '" height="' +
            SchematicMarkupTools.formatNumber(box.height) +
            '" rx="' +
            SchematicMarkupTools.formatNumber(box.radius) +
            '"/><rect class="schematic-symbol-highlight__outline" x="' +
            SchematicMarkupTools.formatNumber(box.x) +
            '" y="' +
            SchematicMarkupTools.formatNumber(box.y) +
            '" width="' +
            SchematicMarkupTools.formatNumber(box.width) +
            '" height="' +
            SchematicMarkupTools.formatNumber(box.height) +
            '" rx="' +
            SchematicMarkupTools.formatNumber(box.radius) +
            '"/></g>'
        )
    }

    /**
     * Injects SVG-local highlight CSS.
     * @param {string} markup Rendered markup.
     * @returns {string}
     */
    static #injectHighlightStyle(markup) {
        const rules =
            '.schematic-svg .schematic-symbol-highlight {' +
            'pointer-events: visiblePainted;cursor: pointer;}' +
            '.schematic-svg .schematic-symbol-highlight__fill {' +
            'fill: rgba(27, 191, 227, 0.4);' +
            'stroke: rgba(27, 191, 227, 0.45);' +
            'stroke-width: 0.8;' +
            'vector-effect: non-scaling-stroke;' +
            'filter: drop-shadow(0 0 1.4px rgba(27, 191, 227, 0.68)) drop-shadow(0 0 3px rgba(27, 191, 227, 0.32));}' +
            '.schematic-svg .schematic-symbol-highlight__outline {' +
            'fill: none;stroke: rgba(255, 255, 255, 0.72);' +
            'stroke-width: 0.6;vector-effect: non-scaling-stroke;}' +
            '.schematic-svg .schematic-symbol-hit-target {' +
            'pointer-events: all;cursor: pointer;}' +
            '.schematic-svg .schematic-symbol-hit-target__area {' +
            'fill: transparent;stroke: transparent;pointer-events: all;}'

        return String(markup).replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="schematic-component-highlight-style">' +
                SchematicMarkupTools.escapeHtml(rules) +
                '</style>'
        )
    }

    /**
     * Injects highlight markup into the main schematic coordinate group.
     * @param {string} markup Rendered markup.
     * @param {string} highlight Highlight SVG markup.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }[]} [anchorBoundsList] Body bounds anchors.
     * @returns {string}
     */
    static #injectHighlightMarkup(markup, highlight, anchorBoundsList = []) {
        const renderedMarkup = String(markup)
        for (const anchorBounds of anchorBoundsList) {
            const anchorEndIndex = SchematicMarkupTools.findRectEndIndex(
                renderedMarkup,
                anchorBounds
            )
            if (anchorEndIndex !== null) {
                return (
                    renderedMarkup.slice(0, anchorEndIndex) +
                    highlight +
                    renderedMarkup.slice(anchorEndIndex)
                )
            }
        }

        const groupEndIndex =
            SchematicMarkupTools.findGroupEndIndex(
                renderedMarkup,
                'schematic-scene'
            ) ??
            SchematicMarkupTools.findGroupEndIndex(
                renderedMarkup,
                'schematic-content'
            )
        if (groupEndIndex !== null) {
            return (
                renderedMarkup.slice(0, groupEndIndex) +
                highlight +
                renderedMarkup.slice(groupEndIndex)
            )
        }
        return renderedMarkup.replace(/(<\/svg>)/, highlight + '$1')
    }
}
