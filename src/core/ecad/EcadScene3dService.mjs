import {
    PcbScene3dBuilder as AltiumScene3dBuilder,
    PcbScene3dModelRegistry as AltiumScene3dModelRegistry,
    PcbScene3dScenePreparator as AltiumScene3dScenePreparator
} from 'altium-toolkit/scene3d'
import {
    PcbScene3dBuilder as KicadScene3dBuilder,
    PcbScene3dModelRegistry as KicadScene3dModelRegistry,
    PcbScene3dScenePreparator as KicadScene3dScenePreparator
} from 'kicad-toolkit/scene3d'
import { KicadArcGeometry } from 'kicad-toolkit/parser'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Chooses format-specific 3D scene builders.
 */
export class EcadScene3dService {
    /**
     * Builds a scene description.
     * @param {object} documentModel Document model.
     * @param {object} [options] Scene options.
     * @returns {object}
     */
    static build(documentModel, options = {}) {
        return EcadScene3dService.#isKiCad(documentModel)
            ? EcadScene3dService.#augmentKicadSceneDescription(
                  KicadScene3dBuilder.build(documentModel, options),
                  documentModel
              )
            : AltiumScene3dBuilder.build(documentModel, options)
    }

    /**
     * Prepares a scene description asynchronously.
     * @param {object} documentModel Document model.
     * @param {object} [options] Scene options.
     * @returns {Promise<object>}
     */
    static async prepare(documentModel, options = {}) {
        if (EcadScene3dService.#isKiCad(documentModel)) {
            return EcadScene3dService.#augmentKicadSceneDescription(
                await KicadScene3dScenePreparator.prepare(
                    documentModel,
                    options
                ),
                documentModel
            )
        }

        return AltiumScene3dScenePreparator.prepare(documentModel, options)
    }

    /**
     * Creates the model registry expected by the chosen scene builder.
     * @param {object} documentModel Document model.
     * @param {object[]} sessionAssets Session assets.
     * @returns {object}
     */
    static createModelRegistry(documentModel, sessionAssets) {
        if (EcadScene3dService.#isKiCad(documentModel)) {
            return KicadScene3dModelRegistry.create(sessionAssets || [])
        }

        return AltiumScene3dModelRegistry.create(
            sessionAssets || [],
            Array.isArray(documentModel?.pcb?.embeddedModels)
                ? documentModel.pcb.embeddedModels
                : []
        )
    }

    /**
     * Adds app-level KiCad scene details that are present in the parsed model
     * but not emitted by the upstream scene builder yet.
     * @param {object} sceneDescription Base scene description.
     * @param {object} documentModel Source document model.
     * @returns {object}
     */
    static #augmentKicadSceneDescription(sceneDescription, documentModel) {
        const sourceComponents =
            EcadScene3dService.#buildSourceComponentIndex(documentModel)
        const components = Array.isArray(sceneDescription?.components)
            ? sceneDescription.components.map((component) =>
                  EcadScene3dService.#augmentKicadSceneComponent(
                      component,
                      sourceComponents
                  )
              )
            : []
        const existingPlacements = Array.isArray(
            sceneDescription?.externalPlacements
        )
            ? sceneDescription.externalPlacements
            : []
        const existingDesignators = new Set(
            existingPlacements.map((placement) =>
                String(placement?.designator || '').trim()
            )
        )
        const externalPlacements = [
            ...existingPlacements,
            ...components
                .filter(
                    (component) =>
                        component?.externalModel &&
                        component?.modelTransform &&
                        !existingDesignators.has(
                            String(component?.designator || '').trim()
                        )
                )
                .map((component) =>
                    EcadScene3dService.#buildKicadExternalPlacement(component)
                )
        ]

        return {
            ...sceneDescription,
            components,
            externalPlacements,
            detail: {
                ...(sceneDescription?.detail || {}),
                copperTexts: EcadScene3dService.#mergeCopperTexts(
                    sceneDescription?.detail?.copperTexts,
                    EcadScene3dService.#buildKicadCopperTextDetail(
                        documentModel
                    )
                ),
                silkscreen: EcadScene3dService.#mergeSilkscreenDetail(
                    sceneDescription?.detail?.silkscreen,
                    EcadScene3dService.#buildKicadSilkscreenDetail(
                        documentModel
                    )
                )
            }
        }
    }

    /**
     * Builds a designator-keyed lookup for source PCB components.
     * @param {object} documentModel Source document model.
     * @returns {Map<string, object>}
     */
    static #buildSourceComponentIndex(documentModel) {
        const components = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []
        const index = new Map()

        components.forEach((component) => {
            const designator = String(component?.designator || '').trim()
            if (designator) {
                index.set(designator, component)
            }
        })

        return index
    }

    /**
     * Carries source model metadata onto one built scene component.
     * @param {object} component Scene component.
     * @param {Map<string, object>} sourceComponents Source component lookup.
     * @returns {object}
     */
    static #augmentKicadSceneComponent(component, sourceComponents) {
        const sourceComponent = sourceComponents.get(
            String(component?.designator || '').trim()
        )
        if (!sourceComponent?.modelTransform && !sourceComponent?.modelName) {
            return component
        }

        return {
            ...component,
            modelName: sourceComponent.modelName || component.modelName || '',
            modelPath: sourceComponent.modelPath || component.modelPath || '',
            modelTransform:
                sourceComponent.modelTransform ||
                component.modelTransform ||
                null
        }
    }

    /**
     * Builds the explicit placement shape used by the external-model runtime.
     * @param {object} component Scene component.
     * @returns {object}
     */
    static #buildKicadExternalPlacement(component) {
        return {
            designator: String(component?.designator || ''),
            mountSide: String(component?.mountSide || 'top'),
            rotationDeg: Number(component?.rotationDeg || 0),
            positionMil: {
                x: Number(component?.positionMil?.x || 0),
                y: Number(component?.positionMil?.y || 0),
                z: Number(component?.positionMil?.z || 0)
            },
            bodyPositionMil: { x: 0, y: 0 },
            bodyRotationDeg: 0,
            modelTransform: {
                rotationDeg: {
                    x: Number(component?.modelTransform?.rotationDeg?.x || 0),
                    y: Number(component?.modelTransform?.rotationDeg?.y || 0),
                    z: Number(component?.modelTransform?.rotationDeg?.z || 0)
                },
                dzMil: Number(component?.modelTransform?.dzMil || 0)
            },
            externalModel: component.externalModel
        }
    }

    /**
     * Uses builder-provided silkscreen when available, otherwise merges the
     * app-derived fallback for older KiCad toolkit versions.
     * @param {object | undefined} baseSilkscreen Base silkscreen detail.
     * @param {object} nextSilkscreen Derived silkscreen detail.
     * @returns {{ top: { fills: object[], tracks: object[], arcs: object[] }, bottom: { fills: object[], tracks: object[], arcs: object[] } }}
     */
    static #mergeSilkscreenDetail(baseSilkscreen, nextSilkscreen) {
        if (EcadScene3dService.#hasSilkscreenDetail(baseSilkscreen)) {
            return {
                top: EcadScene3dService.#normalizeSilkscreenSide(
                    baseSilkscreen?.top
                ),
                bottom: EcadScene3dService.#normalizeSilkscreenSide(
                    baseSilkscreen?.bottom
                )
            }
        }

        return {
            top: EcadScene3dService.#mergeSilkscreenSide(
                baseSilkscreen?.top,
                nextSilkscreen.top
            ),
            bottom: EcadScene3dService.#mergeSilkscreenSide(
                baseSilkscreen?.bottom,
                nextSilkscreen.bottom
            )
        }
    }

    /**
     * Checks whether a silkscreen detail object already carries primitives.
     * @param {object | undefined} silkscreen Base silkscreen detail.
     * @returns {boolean}
     */
    static #hasSilkscreenDetail(silkscreen) {
        return ['top', 'bottom'].some((sideName) => {
            const side = silkscreen?.[sideName]
            return (
                (side?.fills || []).length > 0 ||
                (side?.tracks || []).length > 0 ||
                (side?.arcs || []).length > 0
            )
        })
    }

    /**
     * Normalizes one silkscreen side into the expected primitive buckets.
     * @param {object | undefined} side Silkscreen side detail.
     * @returns {{ fills: object[], tracks: object[], arcs: object[] }}
     */
    static #normalizeSilkscreenSide(side) {
        return {
            fills: [...(side?.fills || [])],
            tracks: [...(side?.tracks || [])],
            arcs: [...(side?.arcs || [])]
        }
    }

    /**
     * Merges one side of silkscreen detail.
     * @param {object | undefined} baseSide Base side detail.
     * @param {object | undefined} nextSide Derived side detail.
     * @returns {{ fills: object[], tracks: object[], arcs: object[] }}
     */
    static #mergeSilkscreenSide(baseSide, nextSide) {
        return {
            fills: [...(baseSide?.fills || []), ...(nextSide?.fills || [])],
            tracks: [...(baseSide?.tracks || []), ...(nextSide?.tracks || [])],
            arcs: [...(baseSide?.arcs || []), ...(nextSide?.arcs || [])]
        }
    }

    /**
     * Merges upstream copper texts with app-derived KiCad copper texts.
     * @param {object[] | undefined} baseTexts Base copper texts.
     * @param {object[]} nextTexts Derived copper texts.
     * @returns {object[]}
     */
    static #mergeCopperTexts(baseTexts, nextTexts) {
        return [...(baseTexts || []), ...(nextTexts || [])]
    }

    /**
     * Builds 3D copper text detail from KiCad board text primitives.
     * @param {object} documentModel Source document model.
     * @returns {object[]}
     */
    static #buildKicadCopperTextDetail(documentModel) {
        const source = EcadScene3dService.#resolveKicadTextSource(documentModel)

        return source.texts
            .map((text) =>
                EcadScene3dService.#buildKicadCopperText(text, source.units)
            )
            .filter(Boolean)
    }

    /**
     * Resolves the highest-fidelity KiCad text source and its coordinate unit.
     * @param {object} documentModel Source document model.
     * @returns {{ texts: object[], units: 'mm' | 'mil' }}
     */
    static #resolveKicadTextSource(documentModel) {
        const rawTexts = documentModel?.pcb?.kicadBoard?.texts
        if (Array.isArray(rawTexts) && rawTexts.length) {
            return { texts: rawTexts, units: 'mm' }
        }

        return {
            texts: Array.isArray(documentModel?.pcb?.texts)
                ? documentModel.pcb.texts
                : [],
            units: 'mil'
        }
    }

    /**
     * Builds one normalized copper text primitive.
     * @param {object} text Source text primitive.
     * @param {'mm' | 'mil'} units Source coordinate units.
     * @returns {object | null}
     */
    static #buildKicadCopperText(text, units) {
        const layerInfo = EcadScene3dService.#resolveCopperTextLayer(text)
        if (!layerInfo || text?.visible === false) {
            return null
        }

        return {
            x: EcadScene3dService.#toTextMil(text?.x, units),
            y: EcadScene3dService.#toTextMil(text?.y, units),
            value: String(text?.value ?? text?.text ?? ''),
            layer: layerInfo.layer,
            side: layerInfo.side,
            layerId: layerInfo.layerId,
            rotation: Number(text?.rotation || 0),
            mirrored: Boolean(text?.mirrored),
            hAlign: String(text?.hAlign || 'center'),
            vAlign: String(text?.vAlign || 'center'),
            sizeX: EcadScene3dService.#toTextMetricMil(
                text?.sizeX,
                text?.sizeY,
                1,
                units
            ),
            sizeY: EcadScene3dService.#toTextMetricMil(
                text?.sizeY,
                text?.sizeX,
                1,
                units
            ),
            thickness: EcadScene3dService.#toTextMetricMil(
                text?.thickness,
                undefined,
                0.12,
                units
            )
        }
    }

    /**
     * Resolves a KiCad copper text layer.
     * @param {object} text Source text primitive.
     * @returns {{ layer: string, side: 'front' | 'back', layerId: number } | null}
     */
    static #resolveCopperTextLayer(text) {
        const layer = String(text?.layer || '').toUpperCase()

        if (layer === 'F.CU') {
            return { layer: 'F.Cu', side: 'front', layerId: 1 }
        }

        if (layer === 'B.CU') {
            return { layer: 'B.Cu', side: 'back', layerId: 32 }
        }

        return null
    }

    /**
     * Converts a coordinate value to mils according to source units.
     * @param {number | string | undefined} value Source value.
     * @param {'mm' | 'mil'} units Source units.
     * @returns {number}
     */
    static #toTextMil(value, units) {
        return units === 'mm'
            ? EcadScene3dService.#toMil(value)
            : Number(value || 0)
    }

    /**
     * Converts a text metric to mils with fallback handling.
     * @param {number | string | undefined} primary Primary source value.
     * @param {number | string | undefined} secondary Secondary source value.
     * @param {number} fallbackMm Fallback in millimeters.
     * @param {'mm' | 'mil'} units Source units.
     * @returns {number}
     */
    static #toTextMetricMil(primary, secondary, fallbackMm, units) {
        const value = Number(primary ?? secondary)
        if (Number.isFinite(value) && value > 0) {
            return units === 'mm' ? EcadScene3dService.#toMil(value) : value
        }

        return EcadScene3dService.#toMil(fallbackMm)
    }

    /**
     * Builds 3D silkscreen detail from KiCad drawing primitives.
     * @param {object} documentModel Source document model.
     * @returns {{ top: { fills: object[], tracks: object[], arcs: object[] }, bottom: { fills: object[], tracks: object[], arcs: object[] } }}
     */
    static #buildKicadSilkscreenDetail(documentModel) {
        const silkscreen = EcadScene3dService.#emptySilkscreenDetail()
        const drawings = Array.isArray(documentModel?.pcb?.kicadBoard?.drawings)
            ? documentModel.pcb.kicadBoard.drawings
            : []

        drawings.forEach((drawing) => {
            const sideName = EcadScene3dService.#resolveSilkscreenSide(drawing)
            if (!sideName) {
                return
            }

            EcadScene3dService.#buildKicadSilkscreenTracks(drawing).forEach(
                (track) => {
                    silkscreen[sideName].tracks.push(track)
                }
            )

            const arc = EcadScene3dService.#buildKicadSilkscreenArc(drawing)
            if (arc) {
                silkscreen[sideName].arcs.push(arc)
            }

            const fill = EcadScene3dService.#buildKicadSilkscreenFill(drawing)
            if (fill) {
                silkscreen[sideName].fills.push(fill)
            }
        })

        return silkscreen
    }

    /**
     * Builds an empty silkscreen detail container.
     * @returns {{ top: { fills: object[], tracks: object[], arcs: object[] }, bottom: { fills: object[], tracks: object[], arcs: object[] } }}
     */
    static #emptySilkscreenDetail() {
        return {
            top: { fills: [], tracks: [], arcs: [] },
            bottom: { fills: [], tracks: [], arcs: [] }
        }
    }

    /**
     * Resolves a KiCad drawing to the app's top/bottom side names.
     * @param {object} drawing Drawing primitive.
     * @returns {'top' | 'bottom' | ''}
     */
    static #resolveSilkscreenSide(drawing) {
        const layer = String(drawing?.layer || '').toUpperCase()

        if (layer === 'F.SILKS') {
            return 'top'
        }

        if (layer === 'B.SILKS') {
            return 'bottom'
        }

        return ''
    }

    /**
     * Builds stroke-style silkscreen tracks from one drawing.
     * @param {object} drawing Drawing primitive.
     * @returns {object[]}
     */
    static #buildKicadSilkscreenTracks(drawing) {
        const type = String(drawing?.type || '').toLowerCase()

        if (
            (type === 'line' || type === 'segment') &&
            drawing.start &&
            drawing.end
        ) {
            return [
                EcadScene3dService.#buildSilkscreenTrack(
                    drawing.start,
                    drawing.end,
                    drawing
                )
            ]
        }

        if (type === 'rect' && drawing.start && drawing.end && !drawing.fill) {
            const bounds = EcadScene3dService.#drawingBounds([
                drawing.start,
                drawing.end
            ])
            if (!bounds) {
                return []
            }

            return [
                EcadScene3dService.#buildSilkscreenTrack(
                    { x: bounds.minX, y: bounds.minY },
                    { x: bounds.maxX, y: bounds.minY },
                    drawing
                ),
                EcadScene3dService.#buildSilkscreenTrack(
                    { x: bounds.maxX, y: bounds.minY },
                    { x: bounds.maxX, y: bounds.maxY },
                    drawing
                ),
                EcadScene3dService.#buildSilkscreenTrack(
                    { x: bounds.maxX, y: bounds.maxY },
                    { x: bounds.minX, y: bounds.maxY },
                    drawing
                ),
                EcadScene3dService.#buildSilkscreenTrack(
                    { x: bounds.minX, y: bounds.maxY },
                    { x: bounds.minX, y: bounds.minY },
                    drawing
                )
            ]
        }

        if (
            type === 'polygon' &&
            Array.isArray(drawing.points) &&
            !drawing.fill
        ) {
            return EcadScene3dService.#buildPolygonSilkscreenTracks(drawing)
        }

        return []
    }

    /**
     * Builds closed polygon edge tracks.
     * @param {object} drawing Polygon drawing.
     * @returns {object[]}
     */
    static #buildPolygonSilkscreenTracks(drawing) {
        const points = drawing.points || []
        if (points.length < 2) {
            return []
        }

        return points.map((point, index) =>
            EcadScene3dService.#buildSilkscreenTrack(
                point,
                points[(index + 1) % points.length],
                drawing
            )
        )
    }

    /**
     * Builds one track primitive in mils.
     * @param {{ x?: number, y?: number }} start Start point in mm.
     * @param {{ x?: number, y?: number }} end End point in mm.
     * @param {object} drawing Source drawing.
     * @returns {{ x1: number, y1: number, x2: number, y2: number, width: number }}
     */
    static #buildSilkscreenTrack(start, end, drawing) {
        return {
            x1: EcadScene3dService.#toMil(start?.x),
            y1: EcadScene3dService.#toMil(start?.y),
            x2: EcadScene3dService.#toMil(end?.x),
            y2: EcadScene3dService.#toMil(end?.y),
            width: EcadScene3dService.#toMil(
                drawing?.strokeWidth ?? drawing?.width ?? 0.15
            )
        }
    }

    /**
     * Builds one arc primitive in mils.
     * @param {object} drawing Drawing primitive.
     * @returns {object | null}
     */
    static #buildKicadSilkscreenArc(drawing) {
        const type = String(drawing?.type || '').toLowerCase()
        if (type === 'circle' && drawing.center && drawing.radius) {
            return {
                x: EcadScene3dService.#toMil(drawing.center.x),
                y: EcadScene3dService.#toMil(drawing.center.y),
                radius: EcadScene3dService.#toMil(drawing.radius),
                startAngle: 0,
                endAngle: 360,
                width: EcadScene3dService.#toMil(
                    drawing?.strokeWidth ?? drawing?.width ?? 0.15
                )
            }
        }

        if (type !== 'arc' || !drawing.start || !drawing.mid || !drawing.end) {
            return null
        }

        const arc = KicadArcGeometry.fromThreePoints(
            drawing.start,
            drawing.mid,
            drawing.end
        )
        if (!arc) {
            return null
        }

        return {
            x: EcadScene3dService.#toMil(arc.center.x),
            y: EcadScene3dService.#toMil(arc.center.y),
            radius: EcadScene3dService.#toMil(arc.radius),
            startAngle: arc.startAngle,
            endAngle: arc.endAngle,
            width: EcadScene3dService.#toMil(
                drawing?.strokeWidth ?? drawing?.width ?? 0.15
            )
        }
    }

    /**
     * Builds one rectangular fill primitive in mils.
     * @param {object} drawing Drawing primitive.
     * @returns {object | null}
     */
    static #buildKicadSilkscreenFill(drawing) {
        if (!drawing?.fill) {
            return null
        }

        if (
            String(drawing?.type || '').toLowerCase() === 'polygon' &&
            Array.isArray(drawing.points) &&
            drawing.points.length >= 3
        ) {
            return {
                points: drawing.points.map((point) =>
                    EcadScene3dService.#toMilPoint(point)
                )
            }
        }

        const bounds = EcadScene3dService.#drawingBounds(
            EcadScene3dService.#drawingPoints(drawing)
        )
        if (!bounds) {
            return null
        }

        return {
            x1: EcadScene3dService.#toMil(bounds.minX),
            y1: EcadScene3dService.#toMil(bounds.minY),
            x2: EcadScene3dService.#toMil(bounds.maxX),
            y2: EcadScene3dService.#toMil(bounds.maxY)
        }
    }

    /**
     * Converts one point from millimeters to mils.
     * @param {{ x?: number, y?: number }} point Point in millimeters.
     * @returns {{ x: number, y: number }}
     */
    static #toMilPoint(point) {
        return {
            x: EcadScene3dService.#toMil(point?.x),
            y: EcadScene3dService.#toMil(point?.y)
        }
    }

    /**
     * Extracts boundary points from one drawing.
     * @param {object} drawing Drawing primitive.
     * @returns {{ x?: number, y?: number }[]}
     */
    static #drawingPoints(drawing) {
        if (Array.isArray(drawing?.points)) {
            return drawing.points
        }

        if (drawing?.start && drawing?.end) {
            return [drawing.start, drawing.end]
        }

        if (drawing?.center && drawing?.radius) {
            const radius = Number(drawing.radius || 0)
            return [
                {
                    x: Number(drawing.center.x || 0) - radius,
                    y: Number(drawing.center.y || 0) - radius
                },
                {
                    x: Number(drawing.center.x || 0) + radius,
                    y: Number(drawing.center.y || 0) + radius
                }
            ]
        }

        return []
    }

    /**
     * Calculates drawing bounds in millimeters.
     * @param {{ x?: number, y?: number }[]} points Drawing points.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #drawingBounds(points) {
        const normalizedPoints = (points || [])
            .map((point) => ({
                x: Number(point?.x),
                y: Number(point?.y)
            }))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )

        if (!normalizedPoints.length) {
            return null
        }

        return {
            minX: Math.min(...normalizedPoints.map((point) => point.x)),
            minY: Math.min(...normalizedPoints.map((point) => point.y)),
            maxX: Math.max(...normalizedPoints.map((point) => point.x)),
            maxY: Math.max(...normalizedPoints.map((point) => point.y))
        }
    }

    /**
     * Converts millimeters to mils.
     * @param {number | string | undefined} value Millimeter value.
     * @returns {number}
     */
    static #toMil(value) {
        return (Number(value || 0) * 1000) / 25.4
    }

    /**
     * Returns true for KiCad document models.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static #isKiCad(documentModel) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'kicad'
        )
    }
}
