import { SelectedPartKicadModelNodeBuilder } from './SelectedPartKicadModelNodeBuilder.mjs'

/**
 * Builds KiCad S-expression nodes from normalized selected-part data.
 */
export class SelectedPartKicadExportAdapter {
    /** @type {number} */
    static #SCHEMATIC_UNIT_MM = 0.254

    /** @type {number} */
    static #PCB_MIL_TO_MM = 0.0254

    /**
     * Returns a selected-part bundle with KiCad raw nodes when possible.
     * @param {object} selectedPart Selected part bundle.
     * @param {string} partName Export artifact name.
     * @param {object[]} [models] Packaged 3D model assets.
     * @returns {object}
     */
    static adapt(selectedPart, partName, models = []) {
        return {
            ...selectedPart,
            symbol: SelectedPartKicadExportAdapter.#adaptSymbol(
                selectedPart,
                partName
            ),
            footprint: SelectedPartKicadExportAdapter.#adaptFootprint(
                selectedPart,
                partName,
                models
            )
        }
    }

    /**
     * Adds a generated KiCad symbol node when no native raw node exists.
     * @param {object} selectedPart Selected part bundle.
     * @param {string} partName Export artifact name.
     * @returns {object}
     */
    static #adaptSymbol(selectedPart, partName) {
        const symbol = selectedPart?.symbol || {}
        if (SelectedPartKicadExportAdapter.#rawNode(symbol)) {
            return symbol
        }

        return {
            ...symbol,
            rawNode: SelectedPartKicadExportAdapter.#symbolNode(
                selectedPart,
                partName
            )
        }
    }

    /**
     * Adds a generated KiCad footprint node when no native raw node exists.
     * @param {object} selectedPart Selected part bundle.
     * @param {string} partName Export artifact name.
     * @param {object[]} models Packaged 3D model assets.
     * @returns {object}
     */
    static #adaptFootprint(selectedPart, partName, models) {
        const footprint = selectedPart?.footprint || {}
        const rawNode = SelectedPartKicadExportAdapter.#rawNode(footprint)
        if (rawNode) {
            return {
                ...footprint,
                rawNode:
                    SelectedPartKicadModelNodeBuilder.attachToFootprintNode(
                        rawNode,
                        models,
                        footprint.component ||
                            selectedPart?.footprint?.component
                    )
            }
        }

        return {
            ...footprint,
            rawNode: SelectedPartKicadExportAdapter.#footprintNode(
                selectedPart,
                partName,
                models
            )
        }
    }

    /**
     * Builds one KiCad symbol node.
     * @param {object} selectedPart Selected part bundle.
     * @param {string} partName Export artifact name.
     * @returns {Array}
     */
    static #symbolNode(selectedPart, partName) {
        const symbol = selectedPart?.symbol || {}
        const symbolName = SelectedPartKicadExportAdapter.#libraryName(
            symbol.name || partName || selectedPart?.designator || 'Component'
        )

        return [
            'symbol',
            symbolName,
            [
                'property',
                'Reference',
                selectedPart?.designator || 'U',
                ['at', 0, 0, 0]
            ],
            [
                'property',
                'Value',
                symbol.value || symbolName,
                ['at', 0, -2.54, 0]
            ],
            ...SelectedPartKicadExportAdapter.#symbolGraphicNodes(symbol),
            ...SelectedPartKicadExportAdapter.#array(symbol.pins).map(
                (pin, index) =>
                    SelectedPartKicadExportAdapter.#symbolPinNode(
                        pin,
                        index,
                        symbol.origin || {}
                    )
            )
        ]
    }

    /**
     * Builds graphic nodes for a KiCad symbol.
     * @param {object} symbol Selected symbol.
     * @returns {Array[]}
     */
    static #symbolGraphicNodes(symbol) {
        const origin = symbol.origin || {}
        const nodes = [
            ...SelectedPartKicadExportAdapter.#array(symbol.rectangles).map(
                (rectangle) =>
                    SelectedPartKicadExportAdapter.#symbolRectangleNode(
                        rectangle,
                        origin
                    )
            ),
            ...SelectedPartKicadExportAdapter.#array(symbol.lines).map((line) =>
                SelectedPartKicadExportAdapter.#symbolLineNode(line, origin)
            )
        ].filter(Boolean)

        if (nodes.length) return nodes

        return [
            [
                'rectangle',
                ['start', -5.08, -5.08],
                ['end', 5.08, 5.08],
                ['stroke', ['width', 0.15], ['type', 'default']],
                ['fill', ['type', 'background']]
            ]
        ]
    }

    /**
     * Builds one KiCad symbol rectangle.
     * @param {object} rectangle Normalized rectangle.
     * @param {object} origin Component origin.
     * @returns {Array}
     */
    static #symbolRectangleNode(rectangle, origin) {
        const start = SelectedPartKicadExportAdapter.#symbolPoint(
            rectangle.x,
            rectangle.y,
            origin
        )
        const end = SelectedPartKicadExportAdapter.#symbolPoint(
            Number(rectangle.x) + Number(rectangle.width || 0),
            Number(rectangle.y) + Number(rectangle.height || 0),
            origin
        )

        return [
            'rectangle',
            ['start', start.x, start.y],
            ['end', end.x, end.y],
            [
                'stroke',
                [
                    'width',
                    SelectedPartKicadExportAdapter.#schematicLength(
                        rectangle.lineWidth,
                        0.15
                    )
                ],
                ['type', 'default']
            ],
            ['fill', ['type', rectangle.isSolid ? 'background' : 'none']]
        ]
    }

    /**
     * Builds one KiCad symbol line.
     * @param {object} line Normalized line.
     * @param {object} origin Component origin.
     * @returns {Array}
     */
    static #symbolLineNode(line, origin) {
        const start = SelectedPartKicadExportAdapter.#symbolPoint(
            line.x1,
            line.y1,
            origin
        )
        const end = SelectedPartKicadExportAdapter.#symbolPoint(
            line.x2,
            line.y2,
            origin
        )

        return [
            'polyline',
            ['pts', ['xy', start.x, start.y], ['xy', end.x, end.y]],
            [
                'stroke',
                [
                    'width',
                    SelectedPartKicadExportAdapter.#schematicLength(
                        line.width,
                        0.15
                    )
                ],
                ['type', 'default']
            ],
            ['fill', ['type', 'none']]
        ]
    }

    /**
     * Builds one KiCad symbol pin.
     * @param {object} pin Normalized pin.
     * @param {number} index Pin index.
     * @param {object} origin Component origin.
     * @returns {Array}
     */
    static #symbolPinNode(pin, index, origin) {
        const bodyPoint = SelectedPartKicadExportAdapter.#symbolPoint(
            pin.x,
            pin.y,
            origin
        )
        const length = SelectedPartKicadExportAdapter.#schematicLength(
            pin.length,
            2.54
        )
        const at = SelectedPartKicadExportAdapter.#symbolPinAt(
            bodyPoint,
            length,
            pin.orientation
        )

        return [
            'pin',
            'passive',
            'line',
            ['at', at.x, at.y, at.angle],
            ['length', length],
            ['name', String(pin?.name || pin?.designator || index + 1)],
            [
                'number',
                String(
                    pin?.number ||
                        pin?.pinNumber ||
                        pin?.designator ||
                        index + 1
                )
            ]
        ]
    }

    /**
     * Resolves KiCad pin placement from a symbol body edge point.
     * @param {{ x: number, y: number }} bodyPoint Pin body-edge point.
     * @param {number} length Pin length.
     * @param {string} orientation Altium orientation.
     * @returns {{ x: number, y: number, angle: number }}
     */
    static #symbolPinAt(bodyPoint, length, orientation) {
        if (orientation === 'right') {
            return { x: bodyPoint.x + length, y: bodyPoint.y, angle: 180 }
        }
        if (orientation === 'top') {
            return { x: bodyPoint.x, y: bodyPoint.y + length, angle: 270 }
        }
        if (orientation === 'bottom') {
            return { x: bodyPoint.x, y: bodyPoint.y - length, angle: 90 }
        }

        return { x: bodyPoint.x - length, y: bodyPoint.y, angle: 0 }
    }

    /**
     * Builds one KiCad footprint node.
     * @param {object} selectedPart Selected part bundle.
     * @param {string} partName Export artifact name.
     * @param {object[]} models Packaged 3D model assets.
     * @returns {Array}
     */
    static #footprintNode(selectedPart, partName, models) {
        const footprint = selectedPart?.footprint || {}
        const footprintName = SelectedPartKicadExportAdapter.#libraryName(
            partName ||
                footprint.name ||
                selectedPart?.designator ||
                'Component'
        )
        const component = footprint.component || {}

        return [
            'footprint',
            footprintName,
            ['layer', 'F.Cu'],
            [
                'property',
                'Reference',
                selectedPart?.designator || 'REF**',
                ['at', 0, -1.5, 0],
                ['layer', 'F.SilkS']
            ],
            [
                'property',
                'Value',
                footprintName,
                ['at', 0, 1.5, 0],
                ['layer', 'F.Fab']
            ],
            ...SelectedPartKicadExportAdapter.#footprintGraphicNodes(
                footprint,
                component
            ),
            ...SelectedPartKicadExportAdapter.#array(footprint.pads).map(
                (pad, index) =>
                    SelectedPartKicadExportAdapter.#footprintPadNode(
                        pad,
                        index,
                        component
                    )
            ),
            ...SelectedPartKicadModelNodeBuilder.buildMany(models, component)
        ]
    }

    /**
     * Builds footprint graphics from normalized primitives.
     * @param {object} footprint Selected footprint.
     * @param {object} component Component origin.
     * @returns {Array[]}
     */
    static #footprintGraphicNodes(footprint, component) {
        return [
            ...SelectedPartKicadExportAdapter.#array(footprint.tracks).map(
                (track) =>
                    SelectedPartKicadExportAdapter.#footprintLineNode(
                        track,
                        component
                    )
            ),
            ...SelectedPartKicadExportAdapter.#array(footprint.arcs).map(
                (arc) =>
                    SelectedPartKicadExportAdapter.#footprintArcNode(
                        arc,
                        component
                    )
            ),
            ...SelectedPartKicadExportAdapter.#array(footprint.fills).map(
                (fill) =>
                    SelectedPartKicadExportAdapter.#footprintPolygonNode(
                        fill,
                        component
                    )
            ),
            ...SelectedPartKicadExportAdapter.#array(footprint.regions).map(
                (region) =>
                    SelectedPartKicadExportAdapter.#footprintPolygonNode(
                        region,
                        component
                    )
            ),
            ...SelectedPartKicadExportAdapter.#array(
                footprint.shapeBasedRegions
            ).map((region) =>
                SelectedPartKicadExportAdapter.#footprintPolygonNode(
                    region,
                    component
                )
            ),
            ...SelectedPartKicadExportAdapter.#array(footprint.texts)
                .filter((text) => text.visible !== false)
                .map((text) =>
                    SelectedPartKicadExportAdapter.#footprintTextNode(
                        text,
                        component
                    )
                )
        ].filter(Boolean)
    }

    /**
     * Builds one KiCad footprint pad.
     * @param {object} pad Normalized pad.
     * @param {number} index Pad index.
     * @param {object} component Component origin.
     * @returns {Array}
     */
    static #footprintPadNode(pad, index, component) {
        const at = SelectedPartKicadExportAdapter.#footprintPoint(
            pad.x,
            pad.y,
            component
        )
        const width = SelectedPartKicadExportAdapter.#pcbLength(
            SelectedPartKicadExportAdapter.#firstNumber(
                [pad.width, pad.sizeTopX, pad.sizeMidX, pad.sizeBottomX],
                1
            )
        )
        const height = SelectedPartKicadExportAdapter.#pcbLength(
            SelectedPartKicadExportAdapter.#firstNumber(
                [pad.height, pad.sizeTopY, pad.sizeMidY, pad.sizeBottomY],
                1
            )
        )
        const drill = SelectedPartKicadExportAdapter.#pcbLength(
            pad.holeDiameter,
            0
        )

        return [
            'pad',
            String(pad?.number || pad?.designator || pad?.name || index + 1),
            drill > 0 ? 'thru_hole' : 'smd',
            SelectedPartKicadExportAdapter.#padShape(pad, width, height),
            [
                'at',
                at.x,
                at.y,
                SelectedPartKicadExportAdapter.#footprintAngle(
                    pad.rotation,
                    component
                )
            ],
            ['size', width, height],
            ...(drill > 0 ? [['drill', drill]] : []),
            [
                'layers',
                ...SelectedPartKicadExportAdapter.#padLayers(pad, drill > 0)
            ]
        ]
    }

    /**
     * Builds one KiCad footprint line.
     * @param {object} track Normalized track.
     * @param {object} component Component origin.
     * @returns {Array}
     */
    static #footprintLineNode(track, component) {
        const start = SelectedPartKicadExportAdapter.#footprintPoint(
            track.x1,
            track.y1,
            component
        )
        const end = SelectedPartKicadExportAdapter.#footprintPoint(
            track.x2,
            track.y2,
            component
        )

        return [
            'fp_line',
            ['start', start.x, start.y],
            ['end', end.x, end.y],
            [
                'stroke',
                [
                    'width',
                    SelectedPartKicadExportAdapter.#pcbLength(track.width, 0.15)
                ],
                ['type', 'solid']
            ],
            [
                'layer',
                SelectedPartKicadExportAdapter.#footprintLayerName(
                    track,
                    'F.Fab'
                )
            ]
        ]
    }

    /**
     * Builds one KiCad footprint arc or circle.
     * @param {object} arc Normalized arc.
     * @param {object} component Component origin.
     * @returns {Array}
     */
    static #footprintArcNode(arc, component) {
        const startAngle = SelectedPartKicadExportAdapter.#number(
            arc.startAngle,
            0
        )
        const endAngle = SelectedPartKicadExportAdapter.#number(arc.endAngle, 0)
        const radius = SelectedPartKicadExportAdapter.#number(arc.radius, 0)
        const center = SelectedPartKicadExportAdapter.#footprintPoint(
            arc.x,
            arc.y,
            component
        )
        const layer = SelectedPartKicadExportAdapter.#footprintLayerName(
            arc,
            'F.Fab'
        )
        const stroke = [
            'stroke',
            [
                'width',
                SelectedPartKicadExportAdapter.#pcbLength(arc.width, 0.15)
            ],
            ['type', 'solid']
        ]

        if (Math.abs(startAngle - endAngle) < 0.001) {
            const end = SelectedPartKicadExportAdapter.#footprintPoint(
                Number(arc.x) + radius,
                arc.y,
                component
            )
            return [
                'fp_circle',
                ['center', center.x, center.y],
                ['end', end.x, end.y],
                stroke,
                ['layer', layer]
            ]
        }

        const start = SelectedPartKicadExportAdapter.#arcPoint(
            arc,
            startAngle,
            component
        )
        const mid = SelectedPartKicadExportAdapter.#arcPoint(
            arc,
            (startAngle + endAngle) / 2,
            component
        )
        const end = SelectedPartKicadExportAdapter.#arcPoint(
            arc,
            endAngle,
            component
        )

        return [
            'fp_arc',
            ['start', start.x, start.y],
            ['mid', mid.x, mid.y],
            ['end', end.x, end.y],
            stroke,
            ['layer', layer]
        ]
    }

    /**
     * Builds one KiCad footprint polygon.
     * @param {object} primitive Normalized polygon-like primitive.
     * @param {object} component Component origin.
     * @returns {Array | null}
     */
    static #footprintPolygonNode(primitive, component) {
        const points = SelectedPartKicadExportAdapter.#points(primitive)
        if (points.length < 3) return null

        return [
            'fp_poly',
            [
                'pts',
                ...points.map((point) => {
                    const local =
                        SelectedPartKicadExportAdapter.#footprintPoint(
                            point.x,
                            point.y,
                            component
                        )
                    return ['xy', local.x, local.y]
                })
            ],
            [
                'stroke',
                [
                    'width',
                    SelectedPartKicadExportAdapter.#pcbLength(
                        primitive.width || primitive.lineWidth,
                        0.15
                    )
                ],
                ['type', 'solid']
            ],
            ['fill', primitive.isSolid === false ? 'none' : 'solid'],
            [
                'layer',
                SelectedPartKicadExportAdapter.#footprintLayerName(
                    primitive,
                    'F.Fab'
                )
            ]
        ]
    }

    /**
     * Builds one KiCad footprint text.
     * @param {object} text Normalized text.
     * @param {object} component Component origin.
     * @returns {Array}
     */
    static #footprintTextNode(text, component) {
        const at = SelectedPartKicadExportAdapter.#footprintPoint(
            text.x,
            text.y,
            component
        )
        const size = Math.max(
            SelectedPartKicadExportAdapter.#pcbLength(text.height, 1),
            0.5
        )

        return [
            'fp_text',
            'user',
            String(text.text || ''),
            [
                'at',
                at.x,
                at.y,
                SelectedPartKicadExportAdapter.#footprintAngle(
                    text.rotation,
                    component
                )
            ],
            [
                'layer',
                SelectedPartKicadExportAdapter.#footprintLayerName(
                    text,
                    'F.SilkS'
                )
            ],
            [
                'effects',
                [
                    'font',
                    ['size', size, size],
                    ['thickness', Math.max(size * 0.12, 0.1)]
                ]
            ]
        ]
    }

    /**
     * Converts a schematic point to local KiCad symbol coordinates.
     * @param {unknown} x Source x.
     * @param {unknown} y Source y.
     * @param {object} origin Component origin.
     * @returns {{ x: number, y: number }}
     */
    static #symbolPoint(x, y, origin) {
        return {
            x: SelectedPartKicadExportAdapter.#round(
                (SelectedPartKicadExportAdapter.#number(x, 0) -
                    SelectedPartKicadExportAdapter.#number(origin.x, 0)) *
                    SelectedPartKicadExportAdapter.#SCHEMATIC_UNIT_MM
            ),
            y: SelectedPartKicadExportAdapter.#round(
                (SelectedPartKicadExportAdapter.#number(origin.y, 0) -
                    SelectedPartKicadExportAdapter.#number(y, 0)) *
                    SelectedPartKicadExportAdapter.#SCHEMATIC_UNIT_MM
            )
        }
    }

    /**
     * Converts a PCB point to local KiCad footprint coordinates.
     * @param {unknown} x Source x.
     * @param {unknown} y Source y.
     * @param {object} component Component origin.
     * @returns {{ x: number, y: number }}
     */
    static #footprintPoint(x, y, component) {
        const point = {
            x:
                (SelectedPartKicadExportAdapter.#number(x, 0) -
                    SelectedPartKicadExportAdapter.#number(component.x, 0)) *
                SelectedPartKicadExportAdapter.#PCB_MIL_TO_MM,
            y:
                (SelectedPartKicadExportAdapter.#number(component.y, 0) -
                    SelectedPartKicadExportAdapter.#number(y, 0)) *
                SelectedPartKicadExportAdapter.#PCB_MIL_TO_MM
        }
        const rotated = SelectedPartKicadExportAdapter.#rotatePoint(
            point,
            -SelectedPartKicadExportAdapter.#number(component.rotation, 0)
        )

        return {
            x: SelectedPartKicadExportAdapter.#round(rotated.x),
            y: SelectedPartKicadExportAdapter.#round(rotated.y)
        }
    }

    /**
     * Computes one absolute arc point and converts it to local footprint space.
     * @param {object} arc Arc primitive.
     * @param {number} angleDegrees Arc angle.
     * @param {object} component Component origin.
     * @returns {{ x: number, y: number }}
     */
    static #arcPoint(arc, angleDegrees, component) {
        const radians = (angleDegrees * Math.PI) / 180
        const radius = SelectedPartKicadExportAdapter.#number(arc.radius, 0)
        return SelectedPartKicadExportAdapter.#footprintPoint(
            SelectedPartKicadExportAdapter.#number(arc.x, 0) +
                Math.cos(radians) * radius,
            SelectedPartKicadExportAdapter.#number(arc.y, 0) +
                Math.sin(radians) * radius,
            component
        )
    }

    /**
     * Rotates one point around the origin.
     * @param {{ x: number, y: number }} point Point to rotate.
     * @param {number} angleDegrees Rotation angle.
     * @returns {{ x: number, y: number }}
     */
    static #rotatePoint(point, angleDegrees) {
        const radians = (angleDegrees * Math.PI) / 180
        const cos = Math.cos(radians)
        const sin = Math.sin(radians)

        return {
            x: point.x * cos - point.y * sin,
            y: point.x * sin + point.y * cos
        }
    }

    /**
     * Converts a schematic scalar to millimeters.
     * @param {unknown} value Source value.
     * @param {number} fallback Fallback millimeter value.
     * @returns {number}
     */
    static #schematicLength(value, fallback) {
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return fallback
        return SelectedPartKicadExportAdapter.#round(
            parsed * SelectedPartKicadExportAdapter.#SCHEMATIC_UNIT_MM
        )
    }

    /**
     * Converts a PCB mil scalar to millimeters.
     * @param {unknown} value Source value.
     * @param {number} [fallback] Optional fallback millimeter value.
     * @returns {number}
     */
    static #pcbLength(value, fallback = 0) {
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return fallback
        return SelectedPartKicadExportAdapter.#round(
            parsed * SelectedPartKicadExportAdapter.#PCB_MIL_TO_MM
        )
    }

    /**
     * Resolves a KiCad footprint rotation.
     * @param {unknown} angle Source angle.
     * @param {object} component Component origin.
     * @returns {number}
     */
    static #footprintAngle(angle, component) {
        return SelectedPartKicadExportAdapter.#round(
            SelectedPartKicadExportAdapter.#normalizeAngle(
                SelectedPartKicadExportAdapter.#number(angle, 0) -
                    SelectedPartKicadExportAdapter.#number(
                        component.rotation,
                        0
                    )
            )
        )
    }

    /**
     * Resolves one KiCad pad shape.
     * @param {object} pad Normalized pad.
     * @param {number} width Pad width.
     * @param {number} height Pad height.
     * @returns {string}
     */
    static #padShape(pad, width, height) {
        const shape = String(
            pad?.shape || pad?.shapeTopName || pad?.padShapeNames?.top || ''
        ).toLowerCase()

        if (shape.includes('round') || shape.includes('circle')) {
            return Math.abs(width - height) < 0.001 ? 'circle' : 'oval'
        }
        if (shape.includes('oval')) return 'oval'

        return 'rect'
    }

    /**
     * Resolves KiCad pad layer list.
     * @param {object} pad Normalized pad.
     * @param {boolean} isThroughHole Whether the pad has a drill.
     * @returns {string[]}
     */
    static #padLayers(pad, isThroughHole) {
        if (isThroughHole) return ['*.Cu', '*.Mask']

        const layer = SelectedPartKicadExportAdapter.#footprintLayerName(
            pad,
            'F.Cu'
        )
        if (layer.startsWith('B.')) return ['B.Cu', 'B.Paste', 'B.Mask']

        return ['F.Cu', 'F.Paste', 'F.Mask']
    }

    /**
     * Resolves one KiCad footprint layer name.
     * @param {object} primitive Normalized primitive.
     * @param {string} fallback Fallback layer name.
     * @returns {string}
     */
    static #footprintLayerName(primitive, fallback) {
        const layerText = String(
            primitive?.layerName || primitive?.layer || ''
        ).toLowerCase()
        if (layerText.includes('bottomoverlay')) return 'B.SilkS'
        if (layerText.includes('topoverlay')) return 'F.SilkS'
        if (layerText.includes('asm bottom')) return 'B.Fab'
        if (layerText.includes('asm top')) return 'F.Fab'
        if (layerText === 'bottom') return 'B.Cu'
        if (layerText === 'top') return 'F.Cu'

        const layerId = Number(
            primitive?.layerId ??
                primitive?.legacyLayerId ??
                primitive?.layerCode
        )
        if (layerId === 1) return 'F.Cu'
        if (layerId === 32) return 'B.Cu'
        if (layerId === 33) return 'F.SilkS'
        if (layerId === 34) return 'B.SilkS'
        if (layerId === 35) return 'F.Mask'
        if (layerId === 36) return 'B.Mask'
        if (layerId === 37) return 'F.Paste'
        if (layerId === 38) return 'B.Paste'
        if (layerId === 71) return 'F.Fab'
        if (layerId === 72) return 'B.Fab'

        return fallback
    }

    /**
     * Extracts point arrays from polygon-like primitives.
     * @param {object} primitive Primitive candidate.
     * @returns {object[]}
     */
    static #points(primitive) {
        return SelectedPartKicadExportAdapter.#array(
            primitive?.points || primitive?.vertices || primitive?.polygon
        )
    }

    /**
     * Returns a native raw KiCad node from a source object.
     * @param {object} source Source object.
     * @returns {Array | null}
     */
    static #rawNode(source) {
        return (
            (Array.isArray(source?.rawNode) && source.rawNode) ||
            (Array.isArray(source?.rawSymbol) && source.rawSymbol) ||
            (Array.isArray(source?.rawFootprint) && source.rawFootprint) ||
            null
        )
    }

    /**
     * Resolves a KiCad library item name.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #libraryName(value) {
        return String(value || 'Component')
            .trim()
            .replace(/\s+/gu, '_')
            .replace(/[\\/:\u0000-\u001f]/gu, '_')
    }

    /**
     * Returns the first finite number from a candidate list.
     * @param {unknown[]} values Candidate values.
     * @param {number} fallback Fallback value.
     * @returns {number}
     */
    static #firstNumber(values, fallback) {
        for (const value of values) {
            const parsed = Number(value)
            if (Number.isFinite(parsed)) return parsed
        }

        return fallback
    }

    /**
     * Reads a finite number with fallback.
     * @param {unknown} value Candidate value.
     * @param {number} fallback Fallback value.
     * @returns {number}
     */
    static #number(value, fallback) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    /**
     * Normalizes an angle to the KiCad 0-360 range.
     * @param {number} angle Angle in degrees.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        return ((angle % 360) + 360) % 360
    }

    /**
     * Rounds a generated numeric value for compact KiCad source.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #round(value) {
        const rounded = Number(Number(value || 0).toFixed(6))
        return Object.is(rounded, -0) ? 0 : rounded
    }

    /**
     * Normalizes a possible array.
     * @param {unknown} value Candidate value.
     * @returns {object[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }
}
