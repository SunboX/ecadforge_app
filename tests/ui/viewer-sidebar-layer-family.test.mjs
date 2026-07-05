import assert from 'node:assert/strict'
import test from 'node:test'
import { ViewerSidebarRenderer } from '../../src/ui/ViewerSidebarRenderer.mjs'

/**
 * Builds a compact PCB model with Altium-style fabrication layer families.
 * @returns {object}
 */
function createLayerFamilyBoardDocument() {
    return {
        fileName: 'layer-family-fake.PcbDoc',
        kind: 'pcb',
        diagnostics: [],
        summary: {
            title: 'Layer family fake',
            layerCount: 11
        },
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            layers: [
                { name: 'Top Paste', layerId: 0x01030008 },
                { name: 'Top Overlay', layerId: 0x01030006 },
                { name: 'Top Solder', layerId: 0x0103000a },
                { name: 'Top Layer', layerId: 0x01000001 },
                { name: 'Dielectric 1', layerId: 0x01040001 },
                { name: 'inner 1', layerId: 0x01000002 },
                { name: 'inner 2', layerId: 0x01000003 },
                { name: 'Bottom Layer', layerId: 0x0100ffff },
                { name: 'Bottom Solder', layerId: 0x0103000b },
                { name: 'Bottom Overlay', layerId: 0x01030007 },
                { name: 'Bottom Paste', layerId: 0x01030009 }
            ],
            primitiveLayers: [
                { name: 'Mid-Layer 3', layerId: 4 },
                { name: 'Mechanical 1', layerId: 57 },
                { name: 'Top Assembly', layerId: 58 },
                { name: 'Bottom Assembly', layerId: 59 },
                { name: 'Mechanical 4', layerId: 60 },
                { name: 'Multi-Layer', layerId: 74 },
                { name: 'Drill Guide', layerId: 55 },
                { name: 'Keep-Out Layer', layerId: 56 },
                { name: 'Drill Drawing', layerId: 73 }
            ],
            components: [],
            tracks: [],
            vias: [],
            pads: []
        },
        bom: []
    }
}

/**
 * Builds a viewer snapshot for one document.
 * @param {object} documentModel Document model.
 * @returns {object}
 */
function createLayerSnapshot(documentModel) {
    return {
        activeSidebarTab: 'layers',
        activeDocumentId: 'doc-1',
        documents: [{ id: 'doc-1', documentModel }],
        sessionAssets: [],
        documentModel
    }
}

/**
 * Translates selected test keys and falls back to the key for app defaults.
 * @param {string} key Translation key.
 * @returns {string}
 */
function translateLayerAction(key) {
    return (
        {
            'sidebar.layerOnly': 'Nur',
            'sidebar.layerOnlyGroupTitle':
                'Nur Layergruppe anzeigen: {group}',
            'sidebar.layerOnlyTitle': 'Nur Layer anzeigen: {layer}',
            'sidebar.layerToggleGroupTitle':
                'Layergruppen-Sichtbarkeit umschalten: {group}',
            'sidebar.layerToggleTitle':
                'Layer-Sichtbarkeit umschalten: {layer}'
        }[key] || key
    )
}

/**
 * Asserts each marker appears after the previous marker.
 * @param {string} html Rendered sidebar markup.
 * @param {string[]} markers Ordered marker strings.
 * @returns {void}
 */
function assertMarkupOrder(html, markers) {
    let lastIndex = -1

    for (const marker of markers) {
        const index = html.indexOf(marker)
        assert.ok(index > lastIndex, marker + ' should appear in order')
        lastIndex = index
    }
}

/**
 * Verifies PCB layers are grouped by fabrication family like native PCB layer
 * panels instead of by board side.
 */
test('ViewerSidebarRenderer groups PCB layers by fabrication family', () => {
    const html = ViewerSidebarRenderer.render(
        createLayerSnapshot(createLayerFamilyBoardDocument())
    )

    assert.doesNotMatch(html, /data-pcb-layer-key="Dielectric 1"/)
    assert.doesNotMatch(html, /data-pcb-layer-key="Mid-Layer 3"/)
    assert.doesNotMatch(html, /data-pcb-layer-key="Mechanical 4"/)
    assertMarkupOrder(html, [
        'data-layer-group="copper"',
        'data-pcb-layer-key="Top Layer"',
        'data-pcb-layer-key="inner 1"',
        'data-pcb-layer-key="inner 2"',
        'data-pcb-layer-key="Bottom Layer"',
        'data-layer-group="solder-mask"',
        'data-pcb-layer-key="Top Solder"',
        'data-pcb-layer-key="Bottom Solder"',
        'data-layer-group="paste-mask"',
        'data-pcb-layer-key="Top Paste"',
        'data-pcb-layer-key="Bottom Paste"',
        'data-layer-group="silkscreen"',
        'data-pcb-layer-key="Top Overlay"',
        'data-pcb-layer-key="Bottom Overlay"',
        'data-layer-group="mechanical"',
        'data-pcb-layer-key="Mechanical 1"',
        'data-pcb-layer-key="Top Assembly"',
        'data-pcb-layer-key="Bottom Assembly"',
        'data-layer-group="other"',
        'data-pcb-layer-key="Multi-Layer"',
        'data-pcb-layer-key="Drill Guide"',
        'data-pcb-layer-key="Keep-Out Layer"',
        'data-pcb-layer-key="Drill Drawing"'
    ])
})

/**
 * Verifies layer groups mirror native PCB panels with collapsible headers and
 * group-level visibility actions.
 */
test('ViewerSidebarRenderer renders collapsible layer groups with group actions', () => {
    const html = ViewerSidebarRenderer.render(
        createLayerSnapshot(createLayerFamilyBoardDocument())
    )

    assert.match(
        html,
        /<details class="viewer-sidebar__component-group viewer-sidebar__layer-group" data-layer-group="copper" open>/
    )
    assert.match(
        html,
        /<summary class="viewer-sidebar__layer-group-summary">[\s\S]*viewer-sidebar__layer-group-disclosure[\s\S]*<h4>Copper<\/h4>/
    )
    assert.match(
        html,
        /data-pcb-layer-action="only"[^>]*data-pcb-layer-keys="\[&quot;Top Layer&quot;,&quot;inner 1&quot;,&quot;inner 2&quot;,&quot;Bottom Layer&quot;\]"[^>]*>Only<\/button>/
    )
    assert.match(
        html,
        /viewer-sidebar__layer-group-visibility[^>]*data-pcb-layer-action="toggle"[^>]*data-pcb-layer-visible="true"/
    )
})

/**
 * Verifies each layer row has a separate "only" command before the eye toggle.
 */
test('ViewerSidebarRenderer renders layer row only buttons next to visibility controls', () => {
    const html = ViewerSidebarRenderer.render(
        createLayerSnapshot(createLayerFamilyBoardDocument())
    )

    assert.match(
        html,
        /<button class="viewer-sidebar__row viewer-sidebar__row--layer"[^>]*data-pcb-layer-action="toggle"[^>]*data-pcb-layer-key="Top Layer"[\s\S]*?<strong>Top Layer<\/strong><\/button><button class="viewer-sidebar__layer-only"[^>]*data-pcb-layer-action="only"[^>]*data-pcb-layer-keys="\[&quot;Top Layer&quot;\]"[^>]*>Only<\/button><button class="viewer-sidebar__layer-visibility viewer-sidebar__component-copy"[^>]*data-pcb-layer-action="toggle"[^>]*data-pcb-layer-key="Top Layer"/
    )
})

/**
 * Verifies layer "only" buttons and accessible labels use translated copy.
 */
test('ViewerSidebarRenderer translates PCB layer only actions', () => {
    const html = ViewerSidebarRenderer.render(
        createLayerSnapshot(createLayerFamilyBoardDocument()),
        translateLayerAction
    )

    assert.match(
        html,
        /data-layer-group="copper"[\s\S]*aria-label="Nur Layergruppe anzeigen: Copper"[\s\S]*>Nur<\/button>/
    )
    assert.match(
        html,
        /data-pcb-layer-key="Top Layer"[\s\S]*aria-label="Nur Layer anzeigen: Top Layer"[\s\S]*>Nur<\/button>/
    )
    assert.doesNotMatch(html, />Only<\/button>/)
})
