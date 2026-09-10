import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dBuilder } from 'altium-toolkit/extensions'
import {
    PcbScene3dCopperFactory,
    PcbScene3dCopperDetailFilter
} from 'pcb-scene3d-viewer/scene3d'

/** Builds an entirely synthetic circular region on either board face. */
function circleRegion(layerId, kind) {
    return {
        layerId,
        kind,
        points: [0, 270, 180, 90].map((startAngle, index, angles) => ({
            x: 200 + 60 * Math.cos((startAngle * Math.PI) / 180),
            y: 200 + 60 * Math.sin((startAngle * Math.PI) / 180),
            isArc: true,
            centerX: 200,
            centerY: 200,
            radius: 60,
            startAngle,
            endAngle: angles[(index + 1) % angles.length]
        })),
        holes: []
    }
}

/** Builds an app-style Altium scene with a drilled circular copper region. */
function buildCopper(layerId, kind) {
    const scene = PcbScene3dBuilder.build({
        sourceFormat: 'altium',
        kind: 'pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 400,
                heightMil: 400,
                segments: []
            },
            shapeBasedRegions: [circleRegion(layerId, kind)],
            pads: [
                {
                    x: 200,
                    y: 200,
                    holeDiameter: 40,
                    sizeTopX: 0,
                    sizeTopY: 0,
                    sizeBottomX: 0,
                    sizeBottomY: 0,
                    isPlated: false
                }
            ],
            components: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: [],
            polygons: []
        }
    })
    const topZ = scene.board.thicknessMil / 2 + 0.05
    return PcbScene3dCopperFactory.buildMaskCoveredGroup(
        THREE,
        PcbScene3dCopperDetailFilter.resolveCoveredByMask(scene),
        topZ,
        -topZ,
        (x, y) => ({ x: x - scene.board.centerX, y: y - scene.board.centerY }),
        { drillDetail: scene.detail }
    )
}

/** Resolves covered fill meshes from a finished copper group. */
function fillMeshes(group) {
    const meshes = []
    group.traverse((node) => {
        if (node.name === 'mask-covered-copper-fills') meshes.push(node)
    })
    return meshes
}

for (const layerId of [1, 32]) {
    test(`Altium layer ${layerId} polygon cutouts never generate copper around a drill`, () => {
        assert.equal(fillMeshes(buildCopper(layerId, 1)).length, 0)
    })

    test(`Altium layer ${layerId} curved copper remains a complete annulus after drilling`, () => {
        const [mesh] = fillMeshes(buildCopper(layerId, 0))
        assert.ok(mesh)
        const positions = mesh.geometry.getAttribute('position')
        let area = 0
        for (let index = 0; index < positions.count; index += 3) {
            const ax = positions.getX(index),
                ay = positions.getY(index)
            const bx = positions.getX(index + 1),
                by = positions.getY(index + 1)
            const cx = positions.getX(index + 2),
                cy = positions.getY(index + 2)
            area += Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2
        }
        const expected = Math.PI * (60 ** 2 - 20 ** 2)
        assert.ok(
            Math.abs(area - expected) / expected < 0.005,
            `annular area ${area} differs from ${expected}`
        )
        // Raycasts around every quadrant catch missing sectors independently of total area.
        mesh.material.side = THREE.DoubleSide
        mesh.updateMatrixWorld(true)
        for (let angle = 3; angle < 360; angle += 15) {
            const rad = (angle * Math.PI) / 180
            const ray = new THREE.Raycaster(
                new THREE.Vector3(40 * Math.cos(rad), 40 * Math.sin(rad), 100),
                new THREE.Vector3(0, 0, -1)
            )
            assert.ok(
                ray.intersectObject(mesh, false).length > 0,
                `missing copper at ${angle} degrees`
            )
        }
        const drillRay = new THREE.Raycaster(
            new THREE.Vector3(0, 0, 100),
            new THREE.Vector3(0, 0, -1)
        )
        assert.equal(drillRay.intersectObject(mesh, false).length, 0)
    })
}
