import { PcbAssemblyExportCoordinateFrame } from './PcbAssemblyExportCoordinateFrame.mjs'
import { PcbAssemblyMeshUtils } from './PcbAssemblyMeshUtils.mjs'
import { PcbAssemblyPolygonTriangulator } from './PcbAssemblyPolygonTriangulator.mjs'

const TESSELLATED_MESH_THRESHOLD = 512
const TESSELLATED_FACE_THRESHOLD = 5000
const TESSELLATED_VERTEX_THRESHOLD = 20000

/**
 * Writes PCB assembly meshes as an ISO 10303 STEP file.
 */
export class PcbAssemblyStepWriter {
    /**
     * Writes meshes to STEP text.
     * @param {{ name?: string, meshes?: object[] }} assembly Assembly data.
     * @returns {string}
     */
    static write(assembly = {}) {
        const writer = new PcbAssemblyStepWriter(assembly?.name || 'assembly')
        return writer.#write(PcbAssemblyStepWriter.#array(assembly.meshes))
    }

    /** @type {string} */
    #name

    /** @type {string[]} */
    #entities

    /** @type {number} */
    #nextId

    /**
     * @param {string} name Assembly name.
     */
    constructor(name) {
        this.#name = String(name || 'assembly')
        this.#entities = []
        this.#nextId = 1
    }

    /**
     * Writes the full STEP file.
     * @param {object[]} meshes Assembly meshes.
     * @returns {string}
     */
    #write(meshes) {
        const tessellated = PcbAssemblyStepWriter.#shouldUseTessellated(meshes)
        const contextIds = this.#writeContext(tessellated)
        const representationId = tessellated
            ? this.#writeTessellatedRepresentation(meshes, contextIds)
            : this.#writeBrepRepresentation(meshes, contextIds)
        const shapeId = this.#add(
            "PRODUCT_DEFINITION_SHAPE('','',#" +
                contextIds.productDefinitionId +
                ')'
        )
        this.#add(
            'SHAPE_DEFINITION_REPRESENTATION(#' +
                shapeId +
                ',#' +
                representationId +
                ')'
        )

        return (
            PcbAssemblyStepWriter.#header(this.#name, tessellated) +
            this.#entities.map((entity) => entity + ';').join('\n') +
            '\nENDSEC;\nEND-ISO-10303-21;\n'
        )
    }

    /**
     * Writes an advanced B-rep shape representation.
     * @param {object[]} meshes Assembly meshes.
     * @param {{ axisId: number, representationContextId: number }} contextIds STEP context ids.
     * @returns {number}
     */
    #writeBrepRepresentation(meshes, contextIds) {
        const solidIds = meshes
            .map((mesh) => this.#writeMesh(mesh))
            .filter((id) => id > 0)
        const representationType = solidIds.length
            ? 'ADVANCED_BREP_SHAPE_REPRESENTATION'
            : 'SHAPE_REPRESENTATION'
        const representationId = this.#add(
            representationType +
                "('" +
                PcbAssemblyStepWriter.#escape(this.#name) +
                "',(" +
                PcbAssemblyStepWriter.#referenceList([
                    contextIds.axisId,
                    ...solidIds
                ]) +
                '),#' +
                contextIds.representationContextId +
                ')'
        )

        return representationId
    }

    /**
     * Writes an AP242 tessellated shape representation for dense meshes.
     * @param {object[]} meshes Assembly meshes.
     * @param {{ axisId: number, representationContextId: number }} contextIds STEP context ids.
     * @returns {number}
     */
    #writeTessellatedRepresentation(meshes, contextIds) {
        const surfaceIds = meshes
            .map((mesh) => this.#writeTessellatedSurfaceSet(mesh))
            .filter((id) => id > 0)
        const representationType = surfaceIds.length
            ? 'TESSELLATED_SHAPE_REPRESENTATION'
            : 'SHAPE_REPRESENTATION'

        return this.#add(
            representationType +
                "('" +
                PcbAssemblyStepWriter.#escape(this.#name) +
                "',(" +
                PcbAssemblyStepWriter.#referenceList([
                    contextIds.axisId,
                    ...surfaceIds
                ]) +
                '),#' +
                contextIds.representationContextId +
                ')'
        )
    }

    /**
     * Writes product and geometric context entities.
     * @param {boolean} tessellated Whether AP242 tessellated context should be emitted.
     * @returns {{ axisId: number, representationContextId: number, productDefinitionId: number }}
     */
    #writeContext(tessellated) {
        const appContext = tessellated
            ? 'managed model based 3d engineering'
            : 'automotive_design'
        const protocol = tessellated
            ? 'ap242_managed_model_based_3d_engineering'
            : 'automotive_design'
        const protocolYear = tessellated ? '2014' : '2000'
        const appContextId = this.#add(
            "APPLICATION_CONTEXT('" + appContext + "')"
        )
        this.#add(
            "APPLICATION_PROTOCOL_DEFINITION('international standard','" +
                protocol +
                "'," +
                protocolYear +
                ',#' +
                appContextId +
                ')'
        )
        const productContextId = this.#add(
            "PRODUCT_CONTEXT('',#" + appContextId + ",'mechanical')"
        )
        const productId = this.#add(
            "PRODUCT('" +
                PcbAssemblyStepWriter.#escape(this.#name) +
                "','" +
                PcbAssemblyStepWriter.#escape(this.#name) +
                "','',(#" +
                productContextId +
                '))'
        )
        const formationId = this.#add(
            "PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE('','',#" +
                productId +
                ',.NOT_KNOWN.)'
        )
        const definitionContextId = this.#add(
            "PRODUCT_DEFINITION_CONTEXT('part definition',#" +
                appContextId +
                ",'design')"
        )
        const productDefinitionId = this.#add(
            "PRODUCT_DEFINITION('design','',#" +
                formationId +
                ',#' +
                definitionContextId +
                ')'
        )
        const originId = this.#point([0, 0, 0])
        const zDirectionId = this.#direction([0, 0, 1])
        const xDirectionId = this.#direction([1, 0, 0])
        const axisId = this.#add(
            "AXIS2_PLACEMENT_3D('',#" +
                originId +
                ',#' +
                zDirectionId +
                ',#' +
                xDirectionId +
                ')'
        )
        const lengthUnitId = this.#add(
            '(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))'
        )
        const angleUnitId = this.#add(
            '(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.))'
        )
        const solidAngleUnitId = this.#add(
            '(NAMED_UNIT(*) SOLID_ANGLE_UNIT() SI_UNIT($,.STERADIAN.))'
        )
        const uncertaintyId = this.#add(
            'UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-06),#' +
                lengthUnitId +
                ",'distance_accuracy_value','')"
        )
        const representationContextId = this.#add(
            'GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#' +
                uncertaintyId +
                ')) GLOBAL_UNIT_ASSIGNED_CONTEXT((#' +
                lengthUnitId +
                ',#' +
                angleUnitId +
                ',#' +
                solidAngleUnitId +
                ")) REPRESENTATION_CONTEXT('','')"
        )

        return { axisId, representationContextId, productDefinitionId }
    }

    /**
     * Writes one mesh as a surface-backed manifold solid B-rep.
     * @param {{ name?: string, vertices?: number[][], faces?: number[][] }} mesh Mesh data.
     * @returns {number}
     */
    #writeMesh(mesh) {
        const vertices = PcbAssemblyStepWriter.#array(mesh?.vertices)
        const faces = PcbAssemblyStepWriter.#array(mesh?.faces)
        const context = this.#createMeshContext(vertices)
        const faceIds = faces
            .map((face) => this.#writeAdvancedFace(face, context))
            .filter((id) => id > 0)

        if (!faceIds.length) {
            return 0
        }

        const shellId = this.#add(
            "CLOSED_SHELL('',(" +
                PcbAssemblyStepWriter.#referenceList(faceIds) +
                '))'
        )
        const solidId = this.#add(
            "MANIFOLD_SOLID_BREP('" +
                PcbAssemblyStepWriter.#escape(
                    PcbAssemblyMeshUtils.safeName(mesh?.name || 'mesh')
                ) +
                "',#" +
                shellId +
                ')'
        )
        this.#writePresentationStyle(solidId, mesh?.color)
        return solidId
    }

    /**
     * Writes one mesh as an AP242 triangulated surface set.
     * @param {{ name?: string, vertices?: number[][], faces?: number[][] }} mesh Mesh data.
     * @returns {number}
     */
    #writeTessellatedSurfaceSet(mesh) {
        const tessellation = PcbAssemblyStepWriter.#tessellateMesh(mesh)

        if (!tessellation.triangles.length) {
            return 0
        }

        const coordinatesId = this.#add(
            "COORDINATES_LIST(''," +
                tessellation.vertices.length +
                ',(' +
                PcbAssemblyStepWriter.#coordinateList(tessellation.vertices) +
                '))'
        )

        const surfaceSetId = this.#add(
            "TRIANGULATED_SURFACE_SET('" +
                PcbAssemblyStepWriter.#escape(
                    PcbAssemblyMeshUtils.safeName(mesh?.name || 'mesh')
                ) +
                "',#" +
                coordinatesId +
                ',' +
                tessellation.vertices.length +
                ',(),(),(' +
                PcbAssemblyStepWriter.#triangleList(tessellation.triangles) +
                '))'
        )
        this.#writePresentationStyle(surfaceSetId, mesh?.color)
        return surfaceSetId
    }

    /**
     * Writes a STEP presentation style for one shape item.
     * @param {number} itemId Styled representation item id.
     * @param {number[] | undefined} color RGB color.
     * @returns {void}
     */
    #writePresentationStyle(itemId, color) {
        const rgb = PcbAssemblyStepWriter.#colorComponents(color)
        const colorId = this.#add(
            "COLOUR_RGB(''," +
                rgb.map((value) => PcbAssemblyStepWriter.#formatNumber(value)) +
                ')'
        )
        const fillColorId = this.#add(
            "FILL_AREA_STYLE_COLOUR('',#" + colorId + ')'
        )
        const fillStyleId = this.#add(
            "FILL_AREA_STYLE('',(#" + fillColorId + '))'
        )
        const surfaceFillId = this.#add(
            'SURFACE_STYLE_FILL_AREA(#' + fillStyleId + ')'
        )
        const sideStyleId = this.#add(
            "SURFACE_SIDE_STYLE('',(#" + surfaceFillId + '))'
        )
        const surfaceStyleId = this.#add(
            'SURFACE_STYLE_USAGE(.BOTH.,#' + sideStyleId + ')'
        )
        const assignmentId = this.#add(
            'PRESENTATION_STYLE_ASSIGNMENT((#' + surfaceStyleId + '))'
        )
        this.#add("STYLED_ITEM('',(#" + assignmentId + '),#' + itemId + ')')
    }

    /**
     * Creates per-mesh STEP topology caches.
     * @param {number[][]} vertices Mesh vertices in mils.
     * @returns {{ vertices: number[][], vertexRefs: Map<string, { key: string, pointId: number, vertexId: number, scaled: number[] }>, edges: Map<string, { id: number, startKey: string, endKey: string }> }}
     */
    #createMeshContext(vertices) {
        return {
            vertices,
            vertexRefs: new Map(),
            edges: new Map()
        }
    }

    /**
     * Writes one polygon face as an advanced planar face.
     * @param {number[]} face Face vertex indices.
     * @param {{ vertices: number[][], vertexRefs: Map<string, { key: string, pointId: number, vertexId: number, scaled: number[] }>, edges: Map<string, { id: number, startKey: string, endKey: string }> }} context Mesh write context.
     * @returns {number}
     */
    #writeAdvancedFace(face, context) {
        const indexes = PcbAssemblyStepWriter.#normalizeFaceIndexes(
            face,
            context.vertices
        )

        if (indexes.length < 3) {
            return 0
        }

        const frame = PcbAssemblyStepWriter.#faceFrame(
            indexes,
            context.vertices
        )

        if (!frame) {
            return 0
        }

        const orientedEdgeIds = []
        for (let index = 0; index < indexes.length; index += 1) {
            const startIndex = indexes[index]
            const endIndex = indexes[(index + 1) % indexes.length]
            const edge = this.#edge(context, startIndex, endIndex)

            if (!edge) {
                return 0
            }

            orientedEdgeIds.push(
                this.#add(
                    "ORIENTED_EDGE('',*,*,#" +
                        edge.id +
                        ',' +
                        PcbAssemblyStepWriter.#stepBoolean(edge.forward) +
                        ')'
                )
            )
        }

        const loopId = this.#add(
            "EDGE_LOOP('',(" +
                PcbAssemblyStepWriter.#referenceList(orientedEdgeIds) +
                '))'
        )
        const boundId = this.#add("FACE_OUTER_BOUND('',#" + loopId + ',.T.)')
        const normalDirectionId = this.#direction(frame.normal)
        const xDirectionId = this.#direction(frame.xDirection)
        const axisId = this.#add(
            "AXIS2_PLACEMENT_3D('',#" +
                this.#vertexRef(context, indexes[0]).pointId +
                ',#' +
                normalDirectionId +
                ',#' +
                xDirectionId +
                ')'
        )
        const planeId = this.#add("PLANE('',#" + axisId + ')')
        return this.#add(
            "ADVANCED_FACE('',(#" + boundId + '),#' + planeId + ',.T.)'
        )
    }

    /**
     * Writes or reuses one vertex reference.
     * @param {{ vertices: number[][], vertexRefs: Map<string, { key: string, pointId: number, vertexId: number, scaled: number[] }> }} context Mesh write context.
     * @param {number} index Mesh vertex index.
     * @returns {{ key: string, pointId: number, vertexId: number, scaled: number[] }}
     */
    #vertexRef(context, index) {
        const vertex = context.vertices[index]
        const key = PcbAssemblyStepWriter.#vertexKey(vertex)
        const existing = context.vertexRefs.get(key)

        if (existing) {
            return existing
        }

        const scaled = PcbAssemblyStepWriter.#scaledVertex(vertex)
        const pointId = this.#point(vertex)
        const vertexId = this.#add("VERTEX_POINT('',#" + pointId + ')')
        const ref = { key, pointId, vertexId, scaled }
        context.vertexRefs.set(key, ref)
        return ref
    }

    /**
     * Writes or reuses one straight edge curve.
     * @param {{ vertices: number[][], vertexRefs: Map<string, { key: string, pointId: number, vertexId: number, scaled: number[] }>, edges: Map<string, { id: number, startKey: string, endKey: string }> }} context Mesh write context.
     * @param {number} startIndex Start vertex index.
     * @param {number} endIndex End vertex index.
     * @returns {{ id: number, forward: boolean } | null}
     */
    #edge(context, startIndex, endIndex) {
        const start = this.#vertexRef(context, startIndex)
        const end = this.#vertexRef(context, endIndex)

        if (start.key === end.key) {
            return null
        }

        const key =
            start.key < end.key
                ? start.key + '|' + end.key
                : end.key + '|' + start.key
        const existing = context.edges.get(key)

        if (existing) {
            return {
                id: existing.id,
                forward:
                    existing.startKey === start.key &&
                    existing.endKey === end.key
            }
        }

        const lineId = this.#line(start.pointId, start.scaled, end.scaled)
        const edgeId = this.#add(
            "EDGE_CURVE('',#" +
                start.vertexId +
                ',#' +
                end.vertexId +
                ',#' +
                lineId +
                ',.T.)'
        )
        context.edges.set(key, {
            id: edgeId,
            startKey: start.key,
            endKey: end.key
        })

        return { id: edgeId, forward: true }
    }

    /**
     * Writes one unbounded line curve for an edge.
     * @param {number} startPointId STEP point id at the start of the line.
     * @param {number[]} start Start point in millimetres.
     * @param {number[]} end End point in millimetres.
     * @returns {number}
     */
    #line(startPointId, start, end) {
        const delta = PcbAssemblyStepWriter.#subtract(end, start)
        const length = PcbAssemblyStepWriter.#distance(delta)
        const direction = PcbAssemblyStepWriter.#normalize(delta)
        const directionId = this.#direction(direction)
        const vectorId = this.#add(
            "VECTOR('',#" +
                directionId +
                ',' +
                PcbAssemblyStepWriter.#formatNumber(length) +
                ')'
        )

        return this.#add("LINE('',#" + startPointId + ',#' + vectorId + ')')
    }

    /**
     * Writes one Cartesian point.
     * @param {number[]} vertex Coordinates in mils.
     * @returns {number}
     */
    #point(vertex) {
        const scaled = PcbAssemblyStepWriter.#scaledVertex(vertex)

        return this.#add(
            "CARTESIAN_POINT('',(" +
                scaled
                    .map((value) => PcbAssemblyStepWriter.#formatNumber(value))
                    .join(',') +
                '))'
        )
    }

    /**
     * Writes one direction.
     * @param {number[]} direction Direction components.
     * @returns {number}
     */
    #direction(direction) {
        return this.#add(
            "DIRECTION('',(" +
                [
                    PcbAssemblyStepWriter.#formatNumber(direction[0] || 0),
                    PcbAssemblyStepWriter.#formatNumber(direction[1] || 0),
                    PcbAssemblyStepWriter.#formatNumber(direction[2] || 0)
                ].join(',') +
                '))'
        )
    }

    /**
     * Removes invalid, duplicate, and closing indices from one face.
     * @param {unknown} face Face index list.
     * @param {number[][]} vertices Mesh vertices.
     * @returns {number[]}
     */
    static #normalizeFaceIndexes(face, vertices) {
        const indexes = []

        for (const candidate of PcbAssemblyStepWriter.#array(face)) {
            const index = Number(candidate)
            const lastIndex = indexes[indexes.length - 1]

            if (
                Number.isInteger(index) &&
                index >= 0 &&
                index < vertices.length &&
                index !== lastIndex &&
                PcbAssemblyStepWriter.#isFiniteVertex(vertices[index])
            ) {
                indexes.push(index)
            }
        }

        if (indexes.length > 2 && indexes[0] === indexes[indexes.length - 1]) {
            indexes.pop()
        }

        return indexes.length >= 3 ? indexes : []
    }

    /**
     * Converts mesh polygon faces into compact one-based triangle indexes.
     * @param {{ vertices?: number[][], faces?: number[][] }} mesh Mesh data.
     * @returns {{ vertices: number[][], triangles: number[][] }}
     */
    static #tessellateMesh(mesh) {
        const sourceVertices = PcbAssemblyStepWriter.#array(mesh?.vertices)
        const coordinateIndexes = new Map()
        const vertices = []
        const triangles = []
        const resolveIndex = (sourceIndex) => {
            const existing = coordinateIndexes.get(sourceIndex)

            if (existing) {
                return existing
            }

            const coordinateIndex = vertices.length + 1
            coordinateIndexes.set(sourceIndex, coordinateIndex)
            vertices.push(sourceVertices[sourceIndex])
            return coordinateIndex
        }

        for (const face of PcbAssemblyStepWriter.#array(mesh?.faces)) {
            const indexes = PcbAssemblyStepWriter.#normalizeFaceIndexes(
                face,
                sourceVertices
            )

            for (const triangleIndexes of PcbAssemblyPolygonTriangulator.triangulateFace(
                indexes,
                sourceVertices
            )) {
                const triangle = triangleIndexes.map(
                    (index) => sourceVertices[index]
                )

                if (!PcbAssemblyStepWriter.#triangleHasArea(triangle)) {
                    continue
                }

                triangles.push(triangleIndexes.map(resolveIndex))
            }
        }

        return { vertices, triangles }
    }

    /**
     * Returns true when one triangle has non-zero area.
     * @param {number[][]} triangle Triangle vertices in mils.
     * @returns {boolean}
     */
    static #triangleHasArea(triangle) {
        const points = triangle.map((vertex) =>
            PcbAssemblyStepWriter.#scaledVertex(vertex)
        )
        const firstEdge = PcbAssemblyStepWriter.#subtract(points[1], points[0])
        const secondEdge = PcbAssemblyStepWriter.#subtract(points[2], points[0])
        return (
            PcbAssemblyStepWriter.#distance(
                PcbAssemblyStepWriter.#cross(firstEdge, secondEdge)
            ) > 0.0000001
        )
    }

    /**
     * Resolves the planar frame for one face.
     * @param {number[]} indexes Face vertex indices.
     * @param {number[][]} vertices Mesh vertices in mils.
     * @returns {{ normal: number[], xDirection: number[] } | null}
     */
    static #faceFrame(indexes, vertices) {
        const points = indexes.map((index) =>
            PcbAssemblyStepWriter.#scaledVertex(vertices[index])
        )
        const anchor = points[0]

        for (let first = 1; first < points.length - 1; first += 1) {
            const firstEdge = PcbAssemblyStepWriter.#subtract(
                points[first],
                anchor
            )

            if (PcbAssemblyStepWriter.#distance(firstEdge) <= 0.0000001) {
                continue
            }

            for (let second = first + 1; second < points.length; second += 1) {
                const secondEdge = PcbAssemblyStepWriter.#subtract(
                    points[second],
                    anchor
                )
                const normal = PcbAssemblyStepWriter.#normalize(
                    PcbAssemblyStepWriter.#cross(firstEdge, secondEdge)
                )

                if (PcbAssemblyStepWriter.#distance(normal) > 0) {
                    return {
                        normal,
                        xDirection: PcbAssemblyStepWriter.#normalize(firstEdge)
                    }
                }
            }
        }

        return null
    }

    /**
     * Scales one mesh vertex from mils to millimetres.
     * @param {number[]} vertex Vertex coordinates in mils.
     * @returns {number[]}
     */
    static #scaledVertex(vertex) {
        return PcbAssemblyExportCoordinateFrame.vertexMilToMm(vertex)
    }

    /**
     * Builds a stable coordinate key for one vertex.
     * @param {number[]} vertex Vertex coordinates in mils.
     * @returns {string}
     */
    static #vertexKey(vertex) {
        return PcbAssemblyStepWriter.#scaledVertex(vertex)
            .map((value) => PcbAssemblyStepWriter.#formatNumber(value))
            .join(',')
    }

    /**
     * Formats AP242 coordinates for a tessellated surface set.
     * @param {number[][]} vertices Mesh vertices in mils.
     * @returns {string}
     */
    static #coordinateList(vertices) {
        return vertices
            .map(
                (vertex) =>
                    '(' +
                    PcbAssemblyStepWriter.#scaledVertex(vertex)
                        .map((value) =>
                            PcbAssemblyStepWriter.#formatNumber(value)
                        )
                        .join(',') +
                    ')'
            )
            .join(',')
    }

    /**
     * Formats AP242 triangle coordinate indexes.
     * @param {number[][]} triangles One-based triangle coordinate indexes.
     * @returns {string}
     */
    static #triangleList(triangles) {
        return triangles
            .map(
                (triangle) =>
                    '(' +
                    triangle
                        .map((index) => String(Number(index || 0)))
                        .join(',') +
                    ')'
            )
            .join(',')
    }

    /**
     * Returns clamped RGB components for one mesh color.
     * @param {number[] | undefined} color Mesh RGB color.
     * @returns {number[]}
     */
    static #colorComponents(color) {
        const normalized = Array.isArray(color) ? color : [0.55, 0.56, 0.58]
        return [0, 1, 2].map((index) =>
            Math.max(Math.min(Number(normalized[index] || 0), 1), 0)
        )
    }

    /**
     * Tests whether a vertex has finite coordinates.
     * @param {unknown} vertex Candidate vertex.
     * @returns {boolean}
     */
    static #isFiniteVertex(vertex) {
        return (
            Array.isArray(vertex) &&
            vertex.length >= 3 &&
            Number.isFinite(Number(vertex[0])) &&
            Number.isFinite(Number(vertex[1])) &&
            Number.isFinite(Number(vertex[2]))
        )
    }

    /**
     * Subtracts two 3D vectors.
     * @param {number[]} left Left vector.
     * @param {number[]} right Right vector.
     * @returns {number[]}
     */
    static #subtract(left, right) {
        return [
            Number(left?.[0] || 0) - Number(right?.[0] || 0),
            Number(left?.[1] || 0) - Number(right?.[1] || 0),
            Number(left?.[2] || 0) - Number(right?.[2] || 0)
        ]
    }

    /**
     * Computes one 3D cross product.
     * @param {number[]} left Left vector.
     * @param {number[]} right Right vector.
     * @returns {number[]}
     */
    static #cross(left, right) {
        return [
            left[1] * right[2] - left[2] * right[1],
            left[2] * right[0] - left[0] * right[2],
            left[0] * right[1] - left[1] * right[0]
        ]
    }

    /**
     * Computes the length of one 3D vector.
     * @param {number[]} vector Vector components.
     * @returns {number}
     */
    static #distance(vector) {
        return Math.sqrt(
            Number(vector?.[0] || 0) ** 2 +
                Number(vector?.[1] || 0) ** 2 +
                Number(vector?.[2] || 0) ** 2
        )
    }

    /**
     * Normalizes one 3D vector.
     * @param {number[]} vector Vector components.
     * @returns {number[]}
     */
    static #normalize(vector) {
        const length = PcbAssemblyStepWriter.#distance(vector)

        if (length <= 0.0000001) {
            return [0, 0, 0]
        }

        return [
            Number(vector[0] || 0) / length,
            Number(vector[1] || 0) / length,
            Number(vector[2] || 0) / length
        ]
    }

    /**
     * Formats a STEP boolean literal.
     * @param {boolean} value Boolean value.
     * @returns {string}
     */
    static #stepBoolean(value) {
        return value ? '.T.' : '.F.'
    }

    /**
     * Returns true when dense geometry should use compact AP242 tessellation.
     * @param {object[]} meshes Assembly meshes.
     * @returns {boolean}
     */
    static #shouldUseTessellated(meshes) {
        let faceCount = 0
        let vertexCount = 0

        for (const mesh of PcbAssemblyStepWriter.#array(meshes)) {
            faceCount += PcbAssemblyStepWriter.#array(mesh?.faces).length
            vertexCount += PcbAssemblyStepWriter.#array(mesh?.vertices).length
        }

        return (
            meshes.length > TESSELLATED_MESH_THRESHOLD ||
            faceCount > TESSELLATED_FACE_THRESHOLD ||
            vertexCount > TESSELLATED_VERTEX_THRESHOLD
        )
    }

    /**
     * Adds one STEP entity and returns its numeric id.
     * @param {string} body Entity body.
     * @returns {number}
     */
    #add(body) {
        const id = this.#nextId
        this.#nextId += 1
        this.#entities.push('#' + id + '=' + body)
        return id
    }

    /**
     * Builds the STEP header.
     * @param {string} name Assembly name.
     * @param {boolean} tessellated Whether AP242 tessellated schema should be used.
     * @returns {string}
     */
    static #header(name, tessellated) {
        const schema = tessellated
            ? 'AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'
            : 'AUTOMOTIVE_DESIGN_CC2'

        return (
            'ISO-10303-21;\nHEADER;\n' +
            "FILE_DESCRIPTION(('ECAD Forge PCB assembly export'),'2;1');\n" +
            "FILE_NAME('" +
            PcbAssemblyStepWriter.#escape(name) +
            ".step','',('ECAD Forge'),('ECAD Forge'),'ECAD Forge','ECAD Forge','');\n" +
            "FILE_SCHEMA(('" +
            schema +
            "'));\n" +
            'ENDSEC;\nDATA;\n'
        )
    }

    /**
     * Formats a STEP numeric literal.
     * @param {number} value Numeric value.
     * @returns {string}
     */
    static #formatNumber(value) {
        const number = Number(value || 0)
        return Math.abs(number) < 0.0000001
            ? '0.'
            : Number(number.toFixed(6)).toString()
    }

    /**
     * Escapes STEP string content.
     * @param {string} value Source value.
     * @returns {string}
     */
    static #escape(value) {
        return String(value || '').replaceAll("'", "''")
    }

    /**
     * Formats STEP entity ids as a reference list.
     * @param {unknown} value Candidate id list.
     * @returns {string}
     */
    static #referenceList(value) {
        const references = PcbAssemblyStepWriter.#array(value)
            .map((id) => Number(id || 0))
            .filter((id) => Number.isFinite(id) && id > 0)
            .map((id) => '#' + id)

        if (references.length <= 12) {
            return references.join(',')
        }

        return (
            '\n' +
            references
                .map(
                    (reference, index) =>
                        '  ' +
                        reference +
                        (index === references.length - 1 ? '' : ',')
                )
                .join('\n') +
            '\n'
        )
    }

    /**
     * Normalizes a value to an array.
     * @param {unknown} value Candidate value.
     * @returns {any[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }
}
