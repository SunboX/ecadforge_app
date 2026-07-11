import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbGerberRenderSelectionModel } from '../../src/ui/PcbGerberRenderSelectionModel.mjs'
import { ViewerSidebarGerberRenderer } from '../../src/ui/ViewerSidebarGerberRenderer.mjs'

test('Gerber source-file controls use the selected canonical native extension', () => {
    const documentModel = {
        schema: 'ecad-toolkit.document.v1',
        model: [],
        source: { format: 'gerber', fileName: 'fabrication-package' },
        extensions: {
            gerber: {
                native: {
                    pcb: {
                        fabrication: {
                            layers: [
                                {
                                    id: 'top-copper',
                                    fileName: 'board.GTL',
                                    role: 'top-copper'
                                }
                            ]
                        }
                    }
                }
            }
        }
    }

    assert.equal(
        PcbGerberRenderSelectionModel.isGerberDocument(documentModel),
        true
    )
    assert.deepEqual(
        PcbGerberRenderSelectionModel.resolveLayerIds(documentModel, []),
        ['top-copper']
    )
    const html = ViewerSidebarGerberRenderer.renderFileRows(
        { id: 'doc-1', documentModel },
        'doc-1',
        { activeView: 'pcb', gerberRenderSelections: {} }
    )
    assert.match(html, /board\.GTL/)
    assert.match(html, /data-gerber-layer-id="top-copper"/)
})
