import assert from 'node:assert/strict'
import test from 'node:test'
import { ViewerSidebarRenderer } from '../../src/ui/ViewerSidebarRenderer.mjs'

/**
 * Builds a compact PCB model with components and nets.
 * @returns {object}
 */
function createBoardDocument() {
    return {
        fileName: 'inspector-board.PcbDoc',
        kind: 'pcb',
        diagnostics: [],
        summary: { title: 'Inspector board', componentCount: 2 },
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            layers: [{ name: 'Top Layer' }],
            components: [
                { designator: 'U1', pattern: 'QFN', layer: 'TOP' },
                { designator: 'R1', pattern: '0603', layer: 'TOP' }
            ],
            nets: [{ name: 'VBUS' }, { name: 'GND' }]
        },
        bom: []
    }
}

/**
 * Builds one sidebar snapshot with interaction preview data.
 * @param {string} activeSidebarTab Sidebar tab.
 * @returns {object}
 */
function createSnapshot(activeSidebarTab) {
    const documentModel = createBoardDocument()
    return {
        activeSidebarTab,
        activeDocumentId: 'doc-1',
        documents: [{ id: 'doc-1', documentModel }],
        selectedPcbComponents: {},
        selectedNets: {},
        sessionAssets: [],
        documentModel,
        pcbInteractionPreview: {
            documentId: 'doc-1',
            source: 'hover',
            point: { x: 1.25, y: 2.5 },
            selectedCandidate: {
                kind: 'pad',
                role: 'pad',
                componentKey: 'U1',
                netName: 'VBUS',
                layer: 'top',
                groups: [
                    {
                        id: 'pcb_group_regulator',
                        name: 'Regulator',
                        componentCount: 1,
                        memberCount: 2,
                        anchorAlignment: 'top_left',
                        positionMode: 'relative_to_group_anchor',
                        autorouterTraceClearance: 0.2
                    }
                ]
            },
            candidates: [
                {
                    kind: 'pad',
                    role: 'pad',
                    componentKey: 'U1',
                    netName: 'VBUS',
                    layer: 'top',
                    groups: [
                        {
                            id: 'pcb_group_regulator',
                            name: 'Regulator',
                            componentCount: 1,
                            memberCount: 2,
                            anchorAlignment: 'top_left',
                            positionMode: 'relative_to_group_anchor',
                            autorouterTraceClearance: 0.2
                        }
                    ]
                },
                {
                    kind: 'track',
                    role: 'track',
                    componentKey: '',
                    netName: 'VBUS',
                    layer: 'top'
                }
            ]
        }
    }
}

/**
 * Verifies PCB interaction previews render a compact candidate inspector.
 */
test('ViewerSidebarRenderer renders PCB interaction inspector candidates', () => {
    const html = ViewerSidebarRenderer.render(createSnapshot('components'))

    assert.match(html, /data-pcb-interaction-inspector="true"/)
    assert.match(html, /PCB interaction/)
    assert.match(html, /data-pcb-interaction-source="hover"/)
    assert.match(html, /data-pcb-interaction-candidate="0"/)
    assert.match(html, /data-pcb-interaction-candidate="1"/)
    assert.match(html, /U1/)
    assert.match(html, /VBUS/)
    assert.match(html, /1\.25, 2\.50/)
    assert.match(html, /data-pcb-interaction-group-id="pcb_group_regulator"/)
    assert.match(html, /Regulator/)
    assert.match(html, /1 component/)
    assert.match(html, /2 members/)
    assert.match(html, /top_left/)
    assert.match(html, /relative_to_group_anchor/)
    assert.match(html, /0\.2 mm/)
})

/**
 * Verifies PCB interaction previews mark matching sidebar rows.
 */
test('ViewerSidebarRenderer marks previewed PCB component and net rows', () => {
    const componentHtml = ViewerSidebarRenderer.render(
        createSnapshot('components')
    )
    const netHtml = ViewerSidebarRenderer.render(createSnapshot('nets'))

    assert.match(
        componentHtml,
        /viewer-sidebar__component-row-shell is-preview[\s\S]*data-pcb-component-key="U1"/
    )
    assert.match(
        netHtml,
        /viewer-sidebar__component-row-shell is-preview[\s\S]*data-pcb-net-key="VBUS"/
    )
})
