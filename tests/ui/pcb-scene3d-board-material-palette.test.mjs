import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBoardMaterialPalette } from '../../src/ui/PcbScene3dBoardMaterialPalette.mjs'

test('PcbScene3dBoardMaterialPalette keeps authored surface color without board assembly', () => {
    assert.equal(
        PcbScene3dBoardMaterialPalette.resolveSurfaceColor(
            { surfaceColor: 0x17396b },
            { hasBoardAssemblyModel: false }
        ),
        0x17396b
    )
})

test('PcbScene3dBoardMaterialPalette uses procedural mask color with board assembly', () => {
    assert.equal(
        PcbScene3dBoardMaterialPalette.resolveSurfaceColor(
            { surfaceColor: 0x17396b },
            { hasBoardAssemblyModel: true }
        ),
        0x2a5f27
    )
})

test('PcbScene3dBoardMaterialPalette falls back to procedural mask color', () => {
    assert.equal(
        PcbScene3dBoardMaterialPalette.resolveSurfaceColor(
            {},
            { hasBoardAssemblyModel: false }
        ),
        0x2a5f27
    )
})

test('PcbScene3dBoardMaterialPalette shows generated face with board assembly', () => {
    assert.equal(
        PcbScene3dBoardMaterialPalette.isGeneratedSurfaceVisible({
            hasBoardAssemblyModel: true
        }),
        true
    )
})

test('PcbScene3dBoardMaterialPalette shows generated face without board assembly', () => {
    assert.equal(
        PcbScene3dBoardMaterialPalette.isGeneratedSurfaceVisible(),
        true
    )
})

test('PcbScene3dBoardMaterialPalette shows generated body with board assembly', () => {
    assert.equal(
        PcbScene3dBoardMaterialPalette.isGeneratedBodyVisible({
            hasBoardAssemblyModel: true
        }),
        true
    )
})

test('PcbScene3dBoardMaterialPalette shows generated body without board assembly', () => {
    assert.equal(
        PcbScene3dBoardMaterialPalette.isGeneratedBodyVisible(),
        true
    )
})
