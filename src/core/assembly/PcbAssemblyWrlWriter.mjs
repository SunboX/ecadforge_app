import { PcbAssemblyExportCoordinateFrame } from './PcbAssemblyExportCoordinateFrame.mjs'
import { PcbAssemblyMeshUtils } from './PcbAssemblyMeshUtils.mjs'

/**
 * Writes PCB assembly meshes as VRML 2.0 WRL.
 */
export class PcbAssemblyWrlWriter {
    /**
     * Writes meshes to WRL text.
     * @param {{ name?: string, meshes?: object[] }} assembly Assembly data.
     * @returns {string}
     */
    static write(assembly = {}) {
        const meshes = Array.isArray(assembly?.meshes) ? assembly.meshes : []

        return (
            '#VRML V2.0 utf8\n' +
            'WorldInfo { title "' +
            PcbAssemblyWrlWriter.#escapeString(assembly?.name || 'assembly') +
            '" }\n' +
            'Group {\n  children [\n' +
            meshes.map((mesh) => PcbAssemblyWrlWriter.#shape(mesh)).join('') +
            '  ]\n}\n'
        )
    }

    /**
     * Writes one mesh shape.
     * @param {{ name?: string, vertices?: number[][], faces?: number[][], color?: number[] }} mesh Mesh data.
     * @returns {string}
     */
    static #shape(mesh) {
        const vertices = Array.isArray(mesh?.vertices) ? mesh.vertices : []
        const faces = Array.isArray(mesh?.faces) ? mesh.faces : []
        if (!vertices.length || !faces.length) {
            return ''
        }

        return (
            '    DEF ' +
            PcbAssemblyWrlWriter.#safeVrmlName(mesh?.name || 'mesh') +
            ' Shape {\n' +
            '      appearance Appearance { material Material { diffuseColor ' +
            PcbAssemblyWrlWriter.#color(mesh?.color) +
            ' } }\n' +
            '      geometry IndexedFaceSet {\n' +
            '        solid TRUE\n' +
            '        coord Coordinate { point [\n' +
            vertices
                .map(
                    (vertex) =>
                        '          ' + PcbAssemblyWrlWriter.#point(vertex)
                )
                .join('') +
            '        ] }\n' +
            '        coordIndex [\n' +
            faces
                .map(
                    (face) =>
                        '          ' +
                        PcbAssemblyWrlWriter.#faceIndices(face) +
                        ' -1,\n'
                )
                .join('') +
            '        ]\n' +
            '      }\n' +
            '    }\n'
        )
    }

    /**
     * Formats one exported coordinate point.
     * @param {number[]} vertex Internal mesh vertex in mils.
     * @returns {string}
     */
    static #point(vertex) {
        return (
            PcbAssemblyExportCoordinateFrame.vertexMilToMm(vertex)
                .map((value) => PcbAssemblyWrlWriter.#formatNumber(value))
                .join(' ') + ',\n'
        )
    }

    /**
     * Formats one face index list.
     * @param {number[]} face Face indices.
     * @returns {string}
     */
    static #faceIndices(face) {
        return (Array.isArray(face) ? face : [])
            .map((index) => String(Number(index || 0)))
            .join(' ')
    }

    /**
     * Formats one RGB color.
     * @param {number[] | undefined} color RGB color.
     * @returns {string}
     */
    static #color(color) {
        const normalized = Array.isArray(color) ? color : [0.55, 0.56, 0.58]
        return [0, 1, 2]
            .map((index) =>
                PcbAssemblyWrlWriter.#formatNumber(
                    Math.max(Math.min(Number(normalized[index] || 0), 1), 0)
                )
            )
            .join(' ')
    }

    /**
     * Formats a compact numeric literal.
     * @param {number} value Numeric value.
     * @returns {string}
     */
    static #formatNumber(value) {
        const number = Number(value || 0)
        return Math.abs(number) < 0.0000001
            ? '0'
            : Number(number.toFixed(6)).toString()
    }

    /**
     * Escapes a WRL string.
     * @param {string} value Source value.
     * @returns {string}
     */
    static #escapeString(value) {
        return String(value || '').replaceAll('"', '\\"')
    }

    /**
     * Builds a valid VRML DEF token.
     * @param {string} value Source value.
     * @returns {string}
     */
    static #safeVrmlName(value) {
        const safe = PcbAssemblyMeshUtils.safeName(value).replace(
            /[^A-Za-z0-9_]+/gu,
            '_'
        )
        return /^[A-Za-z_]/u.test(safe) ? safe : '_' + safe
    }
}
