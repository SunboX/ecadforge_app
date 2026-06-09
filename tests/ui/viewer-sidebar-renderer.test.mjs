import assert from 'node:assert/strict'
import test from 'node:test'
import { ViewerSidebarRenderer } from '../../src/ui/ViewerSidebarRenderer.mjs'

/**
 * Builds a compact PCB model for sidebar rendering tests.
 * @returns {object}
 */
function createBoardDocument() {
    return {
        fileName: 'demo-board.PcbDoc',
        kind: 'pcb',
        diagnostics: [{ severity: 'warning', message: 'Neutral warning' }],
        summary: {
            title: 'Demo board',
            componentCount: 2,
            layerCount: 3,
            outlineSegmentCount: 6,
            lineSegmentCount: 449,
            trackCount: 4,
            viaCount: 5,
            boardWidthMil: 1000,
            boardHeightMil: 500
        },
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            layers: [
                { name: 'Top Layer', layerId: 1, color: '#d14d2a' },
                { name: 'Bottom Layer', layerId: 32 },
                { name: 'Top Overlay', layerId: 33 },
                { name: 'F.Cu' },
                { name: 'B.Cu' },
                { name: 'F.SilkS' }
            ],
            components: [
                {
                    designator: 'U1',
                    pattern: 'QFN',
                    value: 'MCU',
                    layer: 'TOP'
                },
                {
                    designator: 'R1',
                    pattern: '0603',
                    value: '10k',
                    layer: 'BOTTOM'
                }
            ],
            tracks: [{}, {}, {}, {}],
            vias: [{}, {}, {}, {}, {}],
            pads: [{}, {}, {}],
            fills: [{}],
            nets: [{ name: 'VBUS' }, { name: 'GND' }]
        },
        bom: [{ quantity: 1 }, { quantity: 1 }]
    }
}

/**
 * Builds a compact schematic model for sidebar rendering tests.
 * @returns {object}
 */
function createSchematicDocument() {
    return {
        fileName: 'demo-sheet.SchDoc',
        kind: 'schematic',
        diagnostics: [],
        summary: {
            title: 'Demo sheet',
            componentCount: 1,
            lineSegmentCount: 7,
            textCount: 2
        },
        schematic: {
            sheet: { size: 'A4', width: 297, height: 210 },
            components: [
                {
                    designator: 'U2',
                    value: 'Logic',
                    libReference: 'Device:Logic'
                }
            ],
            pins: [{}, {}],
            ports: [{}],
            nets: [{ name: 'RESET' }]
        },
        bom: []
    }
}

/**
 * Builds a render snapshot for the sidebar renderer.
 * @param {object} documentModel
 * @param {string} activeSidebarTab
 * @returns {object}
 */
function createSnapshot(documentModel, activeSidebarTab) {
    return {
        activeSidebarTab,
        activeDocumentId: 'doc-1',
        documents: [{ id: 'doc-1', documentModel }],
        sessionAssets: [],
        documentModel
    }
}

/**
 * Verifies every app-owned sidebar tab is rendered.
 */
test('ViewerSidebarRenderer renders the complete sidebar tab set', () => {
    const html = ViewerSidebarRenderer.render(
        createSnapshot(createBoardDocument(), 'project')
    )

    ;[
        'project',
        'layers',
        'objects',
        'components',
        'nets',
        'properties',
        'info',
        'preferences',
        'help'
    ].forEach((tabName) => {
        assert.match(html, new RegExp('data-sidebar-tab="' + tabName + '"'))
    })
    assert.match(html, /data-sidebar-tab="project"[^>]*aria-selected="true"/)
})

/**
 * Verifies the sidebar renders collapse and restore controls.
 */
test('ViewerSidebarRenderer renders sidebar collapse controls', () => {
    const html = ViewerSidebarRenderer.render(
        createSnapshot(createBoardDocument(), 'layers')
    )
    const collapsedHtml = ViewerSidebarRenderer.renderCollapsedToggle()
    const tabs = [
        'project',
        'layers',
        'objects',
        'components',
        'nets',
        'properties',
        'info',
        'preferences',
        'help'
    ]

    assert.match(html, /data-sidebar-collapse/)
    assert.match(html, /aria-label="Hide sidebar"/)
    assert.match(html, /viewer-sidebar__hide-icon/)
    assert.match(collapsedHtml, /data-sidebar-expand/)
    assert.match(collapsedHtml, /aria-label="Show sidebar"/)
    assert.match(collapsedHtml, /viewer-sidebar__hide-icon/)

    for (const tab of tabs) {
        const tabHtml = ViewerSidebarRenderer.render(
            createSnapshot(createBoardDocument(), tab)
        )

        assert.match(
            tabHtml,
            /<header class="viewer-sidebar__panel-header">[\s\S]*<button class="viewer-sidebar__collapse"/
        )
    }
})

/**
 * Verifies the info panel renders the active document overview.
 */
test('ViewerSidebarRenderer renders the board overview in the info panel', () => {
    const html = ViewerSidebarRenderer.render(
        createSnapshot(createBoardDocument(), 'info')
    )

    assert.match(html, /viewer-sidebar__overview/)
    assert.match(html, /<h3>Board overview<\/h3>/)
    assert.doesNotMatch(html, /⌃/)
    assert.match(html, /viewer-sidebar__preview-card/)
    assert.match(html, /viewer-sidebar__preview-viewport/)
    assert.match(html, /viewer-sidebar__overview-grid/)
    assert.match(html, /data-overview-key="title"/)
    assert.match(html, /data-overview-key="active-file"/)
    assert.match(html, /data-overview-key="diagnostics"/)
    assert.match(html, /data-overview-key="placements"/)
    assert.match(html, /data-overview-key="layers"/)
    assert.match(html, /data-overview-key="outline"/)
    assert.match(html, /data-overview-key="line-segments"/)
    assert.match(html, /data-overview-key="footprint"/)
    assert.match(html, /data-overview-key="bom-groups"/)
    assert.match(html, /Demo board/)
    assert.match(html, /demo-board\.PcbDoc/)
    assert.match(html, /1 records/)
    assert.match(html, /2 components/)
    assert.match(html, /3/)
    assert.match(html, /6/)
    assert.match(html, /449/)
    assert.match(html, /Footprint/)
    assert.match(html, /BOM groups/)
    assert.match(html, /1000 x 500 mil/)
    assert.match(html, /data-overview-key="bom-groups"[\s\S]*<strong>2<\/strong>/)
})

/**
 * Verifies schematic line-segment metadata is preserved in the info overview.
 */
test('ViewerSidebarRenderer renders schematic line segments in the info overview', () => {
    const html = ViewerSidebarRenderer.render(
        createSnapshot(createSchematicDocument(), 'info')
    )

    assert.match(html, /<h3>Sheet overview<\/h3>/)
    assert.doesNotMatch(html, /⌃/)
    assert.match(html, /data-overview-key="line-segments"/)
    assert.match(html, /Line segments/)
    assert.match(html, /7/)
})

/**
 * Verifies board layer metadata is rendered as inspectable rows.
 */
test('ViewerSidebarRenderer renders board layers with swatches', () => {
    const html = ViewerSidebarRenderer.render(
        createSnapshot(createBoardDocument(), 'layers')
    )

    assert.match(html, /<h3>Layers<\/h3>/)
    assert.match(html, /Top Layer/)
    assert.match(html, /Bottom Layer/)
    assert.match(html, /Top Overlay/)
    assert.match(
        html,
        /data-pcb-layer-key="Top Layer"(?:(?!<\/button>)[\s\S])*style="--sidebar-swatch: rgba\(199, 82, 45, 0\.92\)"/
    )
    assert.match(
        html,
        /data-pcb-layer-key="Bottom Layer"(?:(?!<\/button>)[\s\S])*style="--sidebar-swatch: rgba\(15, 116, 108, 0\.56\)"/
    )
    assert.match(
        html,
        /data-pcb-layer-key="Top Overlay"(?:(?!<\/button>)[\s\S])*style="--sidebar-swatch: rgba\(66, 93, 112, 0\.72\)"/
    )
    assert.match(
        html,
        /data-pcb-layer-key="F\.Cu"(?:(?!<\/button>)[\s\S])*style="--sidebar-swatch: rgba\(199, 82, 45, 0\.92\)"/
    )
    assert.match(
        html,
        /data-pcb-layer-key="B\.Cu"(?:(?!<\/button>)[\s\S])*style="--sidebar-swatch: rgba\(15, 116, 108, 0\.56\)"/
    )
    assert.match(
        html,
        /data-pcb-layer-key="F\.SilkS"(?:(?!<\/button>)[\s\S])*style="--sidebar-swatch: rgba\(66, 93, 112, 0\.72\)"/
    )
    assert.doesNotMatch(html, />ID \d+</)
})

/**
 * Verifies empty formal layer stacks fall back to decoded primitive layers.
 */
test('ViewerSidebarRenderer renders primitive layers when stack layers are absent', () => {
    const documentModel = createBoardDocument()
    documentModel.pcb.layers = []
    documentModel.pcb.primitiveLayers = [
        { name: 'Top Layer', layerId: 1 },
        { name: 'Mid-Layer 1', layerId: 2 },
        { name: 'Top Overlay', layerId: 33 }
    ]

    const html = ViewerSidebarRenderer.render(
        createSnapshot(documentModel, 'layers')
    )

    assert.match(html, /data-pcb-layer-key="Top Layer"/)
    assert.match(html, /data-pcb-layer-key="Mid-Layer 1"/)
    assert.match(html, /data-pcb-layer-key="Top Overlay"/)
    assert.doesNotMatch(html, /No PCB layer metadata was recovered/)
})

/**
 * Verifies board layer rows render as visibility controls with preset actions.
 */
test('ViewerSidebarRenderer renders layer visibility controls', () => {
    const html = ViewerSidebarRenderer.render({
        ...createSnapshot(createBoardDocument(), 'layers'),
        hiddenPcbLayers: {
            'doc-1': ['Bottom Layer']
        }
    })

    assert.match(html, /data-pcb-layer-key="Top Layer"/)
    assert.match(html, /data-pcb-layer-key="Bottom Layer"/)
    assert.match(
        html,
        /data-pcb-layer-key="Top Layer"[^>]*data-pcb-layer-visible="true"/
    )
    assert.match(
        html,
        /data-pcb-layer-key="Bottom Layer"[^>]*data-pcb-layer-visible="false"/
    )
    assert.match(html, /aria-pressed="false"/)
    assert.match(html, /viewer-sidebar__visibility-icon/)
    assert.match(html, /data-pcb-layer-preset="all"/)
    assert.match(html, /data-pcb-layer-preset="front"/)
    assert.match(html, /data-pcb-layer-preset="copper"/)
})

/**
 * Verifies board object rows render as opacity slider controls.
 */
test('ViewerSidebarRenderer renders PCB object opacity controls', () => {
    const html = ViewerSidebarRenderer.render({
        ...createSnapshot(createBoardDocument(), 'objects'),
        pcbObjectOpacities: {
            'doc-1': {
                tracks: 35,
                page: 0
            }
        }
    })

    assert.match(html, /<h3>Objects<\/h3>/)
    ;['tracks', 'vias', 'pads', 'holes', 'zones', 'grid', 'page'].forEach(
        (objectKey) => {
            assert.match(
                html,
                new RegExp('data-pcb-object-opacity-key="' + objectKey + '"')
            )
        }
    )
    assert.match(html, /data-pcb-object-opacity-key="tracks"[^>]*value="35"/)
    assert.match(html, /data-pcb-object-opacity-key="vias"[^>]*value="100"/)
    assert.match(html, /data-pcb-object-opacity-key="page"[^>]*value="0"/)
    assert.match(html, /type="range"/)
    assert.match(html, /Through holes/)
    assert.doesNotMatch(html, /viewer-sidebar__object-toggle/)
    assert.doesNotMatch(html, /data-pcb-object-visible/)
})

/**
 * Verifies the shared components tab adapts its panel label to each document.
 */
test('ViewerSidebarRenderer renders grouped footprint selection rows', () => {
    const boardHtml = ViewerSidebarRenderer.render({
        ...createSnapshot(createBoardDocument(), 'components'),
        selectedPcbComponents: {
            'doc-1': 'R1'
        }
    })

    assert.match(boardHtml, /<h3>Footprints<\/h3>/)
    assert.match(boardHtml, /data-component-filter/)
    assert.match(boardHtml, /<h4>Front<\/h4>[\s\S]+data-pcb-component-key="U1"/)
    assert.match(boardHtml, /<h4>Back<\/h4>[\s\S]+data-pcb-component-key="R1"/)
    assert.match(
        boardHtml,
        /data-pcb-component-key="R1"[^>]*aria-pressed="true"/
    )
    assert.match(boardHtml, /viewer-sidebar__component-ref">U1/)
    assert.match(boardHtml, /viewer-sidebar__component-detail">MCU/)
    assert.match(boardHtml, /viewer-sidebar__component-detail">10k/)
})

/**
 * Verifies the shared components tab adapts its panel label to schematics.
 */
test('ViewerSidebarRenderer adapts the components panel label', () => {
    const schematicHtml = ViewerSidebarRenderer.render(
        createSnapshot(createSchematicDocument(), 'components')
    )

    assert.match(schematicHtml, /<h3>Symbols<\/h3>/)
    assert.match(schematicHtml, /U2/)
    assert.match(schematicHtml, /Device:Logic/)
})

/**
 * Verifies open documents are filtered to files compatible with the active
 * top-level view.
 */
test('ViewerSidebarRenderer filters project documents by active view', () => {
    const boardDocument = createBoardDocument()
    const schematicDocument = createSchematicDocument()
    const documents = [
        { id: 'doc-1', documentModel: schematicDocument },
        { id: 'doc-2', documentModel: boardDocument }
    ]
    const schematicHtml = ViewerSidebarRenderer.render({
        activeSidebarTab: 'project',
        activeView: 'schematic',
        activeDocumentId: 'doc-1',
        documents,
        documentModel: schematicDocument
    })
    const pcbHtml = ViewerSidebarRenderer.render({
        activeSidebarTab: 'project',
        activeView: 'pcb',
        activeDocumentId: 'doc-2',
        documents,
        documentModel: boardDocument
    })
    const sceneHtml = ViewerSidebarRenderer.render({
        activeSidebarTab: 'project',
        activeView: '3d',
        activeDocumentId: 'doc-2',
        documents,
        documentModel: boardDocument
    })

    assert.match(schematicHtml, /demo-sheet\.SchDoc/)
    assert.doesNotMatch(schematicHtml, /demo-board\.PcbDoc/)
    assert.match(pcbHtml, /demo-board\.PcbDoc/)
    assert.doesNotMatch(pcbHtml, /demo-sheet\.SchDoc/)
    assert.match(sceneHtml, /demo-board\.PcbDoc/)
    assert.doesNotMatch(sceneHtml, /demo-sheet\.SchDoc/)
})

/**
 * Verifies project and info panels separate documents from overview metadata.
 */
test('ViewerSidebarRenderer renders project and info panels', () => {
    const boardDocument = createBoardDocument()
    const schematicDocument = createSchematicDocument()
    const projectHtml = ViewerSidebarRenderer.render({
        activeSidebarTab: 'project',
        activeDocumentId: 'doc-2',
        documents: [
            { id: 'doc-1', documentModel: schematicDocument },
            { id: 'doc-2', documentModel: boardDocument }
        ],
        sessionAssets: [{ name: 'fake-model.step' }],
        documentModel: boardDocument
    })
    const infoHtml = ViewerSidebarRenderer.render(
        createSnapshot(boardDocument, 'info')
    )
    const documentsIndex = projectHtml.indexOf('Open documents')
    const firstDocumentIndex = projectHtml.indexOf('data-document-id="doc-1"')
    const assetIndex = projectHtml.indexOf('fake-model.step')

    assert.ok(documentsIndex >= 0)
    assert.ok(firstDocumentIndex > documentsIndex)
    assert.ok(assetIndex > firstDocumentIndex)
    assert.match(projectHtml, /viewer-sidebar__list--documents/)
    assert.match(projectHtml, /data-document-id="doc-1"/)
    assert.match(projectHtml, /data-document-id="doc-2"/)
    assert.match(projectHtml, /fake-model\.step/)
    assert.doesNotMatch(projectHtml, /viewer-sidebar__overview/)
    assert.match(infoHtml, /Board overview/)
    assert.match(infoHtml, /viewer-sidebar__overview-grid/)
    assert.match(infoHtml, /Footprint/)
    assert.match(infoHtml, /2 components/)
    assert.match(infoHtml, /BOM groups/)
    assert.match(infoHtml, /1000 x 500 mil/)
})
