import assert from 'node:assert/strict'
import test from 'node:test'

import { Parser as CircuitJsonParser } from 'circuitjson-toolkit/parser'

import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Builds a canonical Altium-sourced document with a retained native extension.
 * @returns {object}
 */
function canonicalAltiumDocument() {
    const model = [
        {
            type: 'schematic_sheet_symbol',
            schematic_sheet_symbol_id: 'sheet_symbol_a',
            name: 'Child A',
            source_file_name: 'child-a.SchDoc',
            center: { x: 10, y: 10 },
            width: 8,
            height: 6,
            stroke_width: 0.2,
            color: '#123456',
            fill_color: '#ddeeff',
            is_filled: true,
            render_order: 1
        },
        {
            type: 'schematic_sheet_symbol',
            schematic_sheet_symbol_id: 'sheet_symbol_b',
            name: 'Child B',
            source_file_name: 'child-b.SchDoc',
            center: { x: 24, y: 10 },
            width: 8,
            height: 6,
            stroke_width: 0.2,
            color: '#123456',
            fill_color: '#ddeeff',
            is_filled: true,
            render_order: 2
        },
        {
            type: 'schematic_image',
            schematic_image_id: 'image_logo',
            asset_id: 'asset_logo',
            center: { x: 17, y: 22 },
            size: { width: 6, height: 4 },
            preserve_aspect_ratio: true,
            render_order: 3,
            source_name: 'logo.png',
            source_path: 'art/logo.png'
        },
        {
            type: 'schematic_text',
            schematic_text_id: 'root_text',
            text: 'ROOT_GRAPHIC',
            position: { x: 17, y: 30 },
            anchor: 'center'
        }
    ]
    const parsed = CircuitJsonParser.parse(
        {
            fileName: 'canonical-graphics.circuitjson',
            data: JSON.stringify(model),
            assets: [
                {
                    id: 'asset_logo',
                    kind: 'schematic-image',
                    name: 'logo.png',
                    mediaType: 'image/png',
                    data: Uint8Array.from([1, 2, 3])
                }
            ]
        },
        { decodeAssets: 'full' }
    )
    return {
        ...parsed,
        source: { ...parsed.source, format: 'altium' },
        extensions: {
            altium: {
                native: {
                    kind: 'schematic',
                    fileType: 'SchDoc',
                    fileName: 'canonical-graphics.SchDoc',
                    summary: { title: 'Legacy fallback' },
                    schematic: {
                        sheet: { width: 40, height: 40 },
                        lines: [],
                        texts: [
                            {
                                x: 5,
                                y: 5,
                                text: 'LEGACY_ONLY',
                                color: '#000000'
                            }
                        ],
                        components: []
                    }
                }
            }
        }
    }
}

test('EcadRendererService prefers retained Altium schematic fidelity over canonical fallback graphics', () => {
    const markup = EcadRendererService.renderSchematic(
        canonicalAltiumDocument()
    )

    assert.match(markup, /LEGACY_ONLY/u)
    assert.doesNotMatch(markup, /data-source-file-name="child-a\.SchDoc"/u)
    assert.doesNotMatch(markup, /ROOT_GRAPHIC/u)
    assert.doesNotMatch(markup, /href="data:image\/png;base64,AQID"/u)
})
