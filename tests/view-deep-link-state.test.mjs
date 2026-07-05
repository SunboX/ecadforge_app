import assert from 'node:assert/strict'
import test from 'node:test'
import { ViewDeepLinkState } from '../src/ViewDeepLinkState.mjs'

test('ViewDeepLinkState writes and resolves sidebar panel query state', () => {
    const writtenUrl = new URL(
        ViewDeepLinkState.build(
            'https://ecadforge.app/?reload=1.8.127',
            'pcb',
            {
                documentPath: 'Boards/main.PcbDoc',
                panelName: 'layers'
            }
        )
    )

    assert.equal(writtenUrl.searchParams.get('view'), 'pcb')
    assert.equal(writtenUrl.searchParams.get('document'), 'Boards/main.PcbDoc')
    assert.equal(writtenUrl.searchParams.get('panel'), 'layers')
    assert.equal(
        ViewDeepLinkState.resolvePanel(writtenUrl.href),
        'layers'
    )
})

test('ViewDeepLinkState drops unsupported sidebar panel query values', () => {
    const writtenUrl = new URL(
        ViewDeepLinkState.build(
            'https://ecadforge.app/?view=pcb&panel=layers',
            'pcb',
            {
                panelName: 'unknown'
            }
        )
    )

    assert.equal(writtenUrl.searchParams.has('panel'), false)
    assert.equal(
        ViewDeepLinkState.resolvePanel(
            'https://ecadforge.app/?view=pcb&panel=unknown'
        ),
        ''
    )
})
