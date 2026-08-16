import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const TARGET_DEPENDENCIES = {
    'altium-toolkit': '^1.4.3',
    'circuitjson-toolkit': '^1.4.2',
    'gerber-toolkit': '^0.4.4',
    'kicad-toolkit': '^1.3.4',
    'pcb-scene3d-viewer': '^1.3.2'
}

/**
 * Builds a source-neutral KiCad fixture covering legacy values and transformed
 * footprint artwork at the app/package boundary.
 * @returns {string} Minimal KiCad PCB source.
 */
function canonicalKicadBoardFixture() {
    return `(kicad_pcb
        (version 20241229)
        (layers
            (0 "F.Cu" signal)
            (31 "B.Cu" signal)
        )
        (footprint "Fixture:Passive"
            (layer "F.Cu")
            (at 10 10 45)
            (fp_text reference "C1"
                (at 0 -1 0)
                (layer "F.SilkS")
                (effects (font (size 1 1) (thickness 0.15)))
            )
            (fp_text value "22n"
                (at 0 1 0)
                (layer "F.Fab")
                (effects (font (size 1 1) (thickness 0.15)))
            )
            (pad "1" smd rect
                (at -0.5 0 0)
                (size 0.8 1)
                (layers "F.Cu" "F.Mask" "F.Paste")
            )
            (pad "2" smd rect
                (at 0.5 0 0)
                (size 0.8 1)
                (layers "F.Cu" "F.Mask" "F.Paste")
            )
            (fp_rect
                (start -1 -0.75)
                (end 1 0.75)
                (stroke (width 0.05) (type solid))
                (fill none)
                (layer "F.CrtYd")
            )
            (fp_arc
                (start -1 0)
                (mid 0 1)
                (end 1 0)
                (stroke (width 0.1) (type solid))
                (layer "F.Fab")
            )
        )
        (gr_text "BOARD NOTE"
            (at 5 5 0)
            (layer "Dwgs.User")
            (effects (font (size 1 1) (thickness 0.15)))
        )
    )`
}

/**
 * Verifies one KiCad document exposes the canonical semantics consumed by the
 * app and viewer without compatibility processing.
 * @param {object} document Common toolkit document.
 * @param {{ isModel(model: object[]): boolean }} CircuitJsonDocument Shared model validator.
 * @returns {void}
 */
function assertCanonicalKicadDocument(document, CircuitJsonDocument) {
    const component = document.model.find(
        (element) =>
            element.type === 'source_component' && element.name === 'C1'
    )
    const pcbComponent = document.model.find(
        (element) => element.type === 'pcb_component'
    )
    const silkscreenText = document.model.find(
        (element) =>
            element.type === 'pcb_silkscreen_text' && element.text === 'C1'
    )
    const fabricationArc = document.model.find(
        (element) =>
            element.type === 'pcb_fabrication_note_path' &&
            element.shape === 'arc'
    )
    const boardNote = document.model.find(
        (element) =>
            element.type === 'pcb_note_text' && element.text === 'BOARD NOTE'
    )
    const courtyard = document.model.find(
        (element) => element.type === 'pcb_courtyard_polygon'
    )
    const polygonHasRotatedEdge = courtyard.points.some((point, index) => {
        const next = courtyard.points[(index + 1) % courtyard.points.length]
        return (
            Math.abs(next.x - point.x) > 1e-6 &&
            Math.abs(next.y - point.y) > 1e-6
        )
    })

    assert.equal(CircuitJsonDocument.isModel(document.model), true)
    assert.equal(component.ftype, 'simple_capacitor')
    assert.equal(component.display_value, '22n')
    assert.equal(component.capacitance, '22n')
    assert.equal(silkscreenText.pcb_component_id, pcbComponent.pcb_component_id)
    assert.equal(silkscreenText.layer, 'top')
    assert.equal(fabricationArc.pcb_component_id, pcbComponent.pcb_component_id)
    assert.equal(fabricationArc.layer, 'top')
    assert.equal(fabricationArc.route.length > 3, true)
    assert.equal(boardNote.layer, 'top')
    assert.equal(Object.hasOwn(boardNote, 'pcb_component_id'), false)
    assert.equal(courtyard.pcb_component_id, pcbComponent.pcb_component_id)
    assert.equal(courtyard.layer, 'top')
    assert.equal(polygonHasRotatedEdge, true)
    assert.equal(
        document.model.some(
            (element) =>
                element.type === 'pcb_text' || element.type === 'pcb_courtyard'
        ),
        false
    )
}
const COMMON_TOOLKIT_SUBPATHS = [
    'capabilities',
    'extensions',
    'interaction',
    'manufacturing',
    'parser',
    'project',
    'query',
    'renderers',
    'scene3d',
    'simulation',
    'testing'
]
const ROOT_EXPORTS = [
    'BomTableRenderer',
    'CircuitJsonDocument',
    'CircuitJsonDocumentContext',
    'CircuitJsonIndexer',
    'CircuitJsonUnits',
    'ManufacturingService',
    'Parser',
    'PcbInteractionIndex',
    'PcbScene3dBuilder',
    'PcbScene3dPreparator',
    'PcbSvgRenderer',
    'ProjectLoader',
    'QueryService',
    'SchematicSvgRenderer',
    'SelfAdjustingComputation',
    'SimulationService',
    'ToolkitCapabilities',
    'ToolkitError'
]
const COMMON_SUBPATH_EXPORTS = {
    capabilities: ['ToolkitCapabilities'],
    interaction: ['PcbInteractionIndex'],
    manufacturing: ['ManufacturingService'],
    parser: ['Parser', 'ToolkitError'],
    project: ['ProjectLoader'],
    query: ['QueryService'],
    renderers: ['BomTableRenderer', 'PcbSvgRenderer', 'SchematicSvgRenderer'],
    scene3d: ['PcbScene3dBuilder', 'PcbScene3dPreparator'],
    simulation: ['SimulationService']
}
const DEPRECATED_SPECIFIERS = [
    /(?:altium|gerber|kicad)-toolkit\/netlist-query/u
]

/**
 * Collects JavaScript modules below one directory URL.
 * @param {URL} directory Directory URL.
 * @returns {Promise<URL[]>} Module URLs.
 */
async function moduleUrls(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const url = new URL(
                entry.name + (entry.isDirectory() ? '/' : ''),
                directory
            )
            if (entry.isDirectory()) return await moduleUrls(url)
            return entry.isFile() && entry.name.endsWith('.mjs') ? [url] : []
        })
    )
    return nested.flat()
}

/**
 * Extracts ESM specifiers without treating package names in maps or regular
 * expressions as imports.
 * @param {string} source JavaScript module source.
 * @returns {string[]} Imported module specifiers.
 */
function importSpecifiers(source) {
    const pattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/gu
    return Array.from(source.matchAll(pattern), (match) => match[1])
}

test('app pins the converged toolkit release family', async () => {
    const pkg = JSON.parse(
        await readFile(new URL('package.json', root), 'utf8')
    )
    assert.equal(pkg.version, '1.13.17')
    for (const [name, version] of Object.entries(TARGET_DEPENDENCIES)) {
        assert.equal(pkg.dependencies[name], version, name)
    }
    assert.equal(pkg.dependencies.earcut, '3.0.2')
})

test('app source imports retained native APIs only from extensions', async () => {
    for (const url of await moduleUrls(new URL('src/', root))) {
        const source = await readFile(url, 'utf8')
        const specifiers = importSpecifiers(source)
        for (const pattern of DEPRECATED_SPECIFIERS) {
            assert.equal(
                specifiers.some((specifier) => pattern.test(specifier)),
                false,
                url.pathname
            )
        }
        assert.equal(
            /import\s*\{\s*CircuitJsonParser\s*\}\s*from\s*'circuitjson-toolkit'/u.test(
                source
            ),
            false,
            url.pathname
        )
        assert.equal(
            /import\s*\{\s*SpiceSimulationService\s*\}\s*from\s*'circuitjson-toolkit'/u.test(
                source
            ),
            false,
            url.pathname
        )
    }
})

test('app does not rewrite Altium native renderer models', async () => {
    const rendererSource = await readFile(
        new URL('../src/core/ecad/EcadRendererService.mjs', import.meta.url),
        'utf8'
    )

    assert.doesNotMatch(rendererSource, /altiumSchematicRenderDocument/u)
    assert.doesNotMatch(
        rendererSource,
        /schematicDesignatorVisible\s*===\s*false/u
    )
})

test('parser facade consumes only the converged common parser and project APIs', async () => {
    const source = await readFile(
        new URL('src/core/ecad/EcadParserService.mjs', root),
        'utf8'
    )
    const specifiers = importSpecifiers(source)

    for (const name of Object.keys(TARGET_DEPENDENCIES).filter((name) =>
        name.endsWith('-toolkit')
    )) {
        assert.equal(specifiers.includes(name + '/parser'), true, name)
    }
    for (const name of Object.keys(TARGET_DEPENDENCIES).filter((name) =>
        name.endsWith('-toolkit')
    )) {
        assert.equal(specifiers.includes(name + '/project'), true, name)
    }
    assert.equal(
        specifiers.some((specifier) => specifier.endsWith('/extensions')),
        false
    )
    assert.match(source, /\.parse\(\{ fileName, data: buffer \}, options\)/u)
    assert.match(source, /\.loadAsync\(/u)
    assert.match(source, /\.supports\(/u)
    assert.doesNotMatch(
        source,
        /#(?:altium|circuitJson|gerber|kicad)(?:Parser|ProjectLoader)\.(?:parseArrayBuffer|parseBytes|loadEntries|canLoadEntries)\(/u
    )
})

test('browser import map exposes the complete converged toolkit layout', async () => {
    const html = await readFile(new URL('src/index.html', root), 'utf8')
    assert.doesNotMatch(html, /(?:altium|gerber|kicad)-toolkit\/netlist-query/u)
    for (const name of Object.keys(TARGET_DEPENDENCIES).filter((name) =>
        name.endsWith('-toolkit')
    )) {
        for (const subpath of COMMON_TOOLKIT_SUBPATHS) {
            assert.match(
                html,
                new RegExp(
                    '"' +
                        name +
                        '/' +
                        subpath +
                        '"\\s*:\\s*"/node_modules/' +
                        name +
                        '/src/' +
                        subpath +
                        '\\.mjs"',
                    'u'
                ),
                name + '/' + subpath
            )
        }
    }
})

test('installed toolkits expose identical common API identities and extensions', async () => {
    const toolkitNames = Object.keys(TARGET_DEPENDENCIES).filter((name) =>
        name.endsWith('-toolkit')
    )
    const sharedExtensions = Object.keys(
        await import('circuitjson-toolkit/extensions')
    ).sort()
    const sharedTesting = Object.keys(
        await import('circuitjson-toolkit/testing')
    ).sort()

    for (const name of toolkitNames) {
        const rootApi = await import(name)
        assert.deepEqual(Object.keys(rootApi).sort(), ROOT_EXPORTS, name)

        for (const subpath of Object.keys(COMMON_SUBPATH_EXPORTS)) {
            const subpathApi = await import(name + '/' + subpath)
            const canonicalSubpathApi = await import(
                'circuitjson-toolkit/' + subpath
            )
            assert.deepEqual(
                Object.keys(subpathApi).sort(),
                Object.keys(canonicalSubpathApi).sort(),
                name + '/' + subpath
            )
            for (const exportName of Object.keys(canonicalSubpathApi)) {
                assert.equal(
                    subpathApi[exportName],
                    Object.hasOwn(rootApi, exportName)
                        ? rootApi[exportName]
                        : canonicalSubpathApi[exportName],
                    name + '/' + subpath + ':' + exportName
                )
            }
        }

        assert.deepEqual(
            Object.keys(await import(name + '/testing')).sort(),
            sharedTesting,
            name + '/testing'
        )
        const extensionApi = await import(name + '/extensions')
        for (const exportName of sharedExtensions) {
            assert.equal(
                Object.hasOwn(extensionApi, exportName),
                true,
                name + '/extensions:' + exportName
            )
        }
    }
})

test('installed KiCad parser and project loader emit canonical CircuitJSON directly', async () => {
    const { CircuitJsonDocument, Parser, ProjectLoader } =
        await import('kicad-toolkit')
    const data = new TextEncoder().encode(canonicalKicadBoardFixture())
    const document = Parser.parse({ fileName: 'fixture.kicad_pcb', data })
    const project = ProjectLoader.load([{ name: 'fixture.kicad_pcb', data }])
    assert.equal(project.schema, 'ecad-toolkit.project.v1')
    assert.equal(project.documents.length, 1)
    assertCanonicalKicadDocument(document, CircuitJsonDocument)
    assertCanonicalKicadDocument(project.documents[0], CircuitJsonDocument)
    assert.deepEqual(project.documents[0].model, document.model)
})

test('Gerber rotated plated slots flow through canonical CircuitJSON into the viewer', async () => {
    const { ProjectLoader } = await import('gerber-toolkit/project')
    const { PcbScene3dCircuitJsonAdapter, PcbScene3dDrillPathFactory } =
        await import('pcb-scene3d-viewer/scene3d')
    const cases = [
        { x: '030000', y: '010000', rotation: 0, length: 2.6 },
        {
            x: '030000',
            y: '030000',
            rotation: 45,
            length: Math.hypot(2, 2) + 0.6
        },
        { x: '010000', y: '030000', rotation: 90, length: 2.6 }
    ]

    for (const candidate of cases) {
        const drill = [
            'M48',
            'METRIC,TZ',
            'T01C0.600',
            '%',
            'T01',
            'X010000Y010000',
            `G85X${candidate.x}Y${candidate.y}`,
            'M30'
        ].join('\n')
        const project = ProjectLoader.load([
            {
                name: `neutral-${candidate.rotation}-PTH.drl`,
                data: drill
            }
        ])
        const scene = PcbScene3dCircuitJsonAdapter.build(project.documents[0])
        const slot = scene.detail.pads.find((pad) => pad.holeSlotLength > 0)
        const resolvedDrill = PcbScene3dDrillPathFactory.resolveBoardDrillSpecs(
            scene.detail
        ).find((candidateDrill) => candidateDrill.slotLength > 0)

        assert.ok(slot)
        assert.equal(slot.shapeTop, 2)
        assert.ok(
            Math.abs(slot.sizeTopX - (candidate.length * 1000) / 25.4) < 1e-4
        )
        assert.ok(Math.abs(slot.sizeTopY - (0.6 * 1000) / 25.4) < 1e-4)
        assert.ok(Math.abs(slot.holeSlotLength - slot.sizeTopX) < 1e-4)
        assert.equal(slot.rotation, candidate.rotation)
        assert.equal(slot.holeRotation, candidate.rotation)
        assert.ok(resolvedDrill)
        assert.equal(resolvedDrill.rotationDeg, candidate.rotation)
    }
})

test('Gerber disjoint boards remain separate viewer and export substrates', async () => {
    const THREE = await import('three')
    const { ProjectLoader } = await import('gerber-toolkit/project')
    const {
        PcbAssemblyGeometryBuilder,
        PcbScene3dCircuitJsonAdapter,
        PcbScene3dRuntimeBoardMeshes
    } = await import('pcb-scene3d-viewer/scene3d')
    const profile = [
        '%FSLAX24Y24*%',
        '%MOMM*%',
        '%TF.FileFunction,Profile,NP*%',
        '%ADD10C,0.100*%',
        'D10*',
        'X000000Y000000D02*',
        'X100000Y000000D01*',
        'X100000Y100000D01*',
        'X000000Y100000D01*',
        'X000000Y000000D01*',
        'X200000Y000000D02*',
        'X300000Y000000D01*',
        'X300000Y100000D01*',
        'X200000Y100000D01*',
        'X200000Y000000D01*',
        'M02*'
    ].join('\n')
    const project = ProjectLoader.load([
        { name: 'neutral-disjoint-profile.gko', data: profile }
    ])
    const document = project.documents[0]
    const scene = PcbScene3dCircuitJsonAdapter.build(document)
    const normalize = (x, y) => ({
        x: Number(x) - scene.board.centerX,
        y: Number(y) - scene.board.centerY
    })
    const runtimeBoards = PcbScene3dRuntimeBoardMeshes.buildBoardMesh(
        THREE,
        scene,
        normalize
    )
    const exported = await PcbAssemblyGeometryBuilder.build(scene, {
        includeModels: false
    })

    assert.equal(
        document.model.filter((element) => element.type === 'pcb_board').length,
        2
    )
    assert.equal(scene.board.contours.length, 2)
    assert.equal(runtimeBoards.isGroup, true)
    assert.equal(runtimeBoards.children.length, 2)
    assert.deepEqual(
        exported.meshes
            .filter((mesh) => /^board-/u.test(mesh.name))
            .map((mesh) => mesh.name),
        ['board-1', 'board-2']
    )
})
