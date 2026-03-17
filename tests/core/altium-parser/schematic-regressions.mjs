import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies the reduced lyra resistor designator keeps its left-side owner
 * anchor instead of flipping across the body.
 */
test('parseAltiumArrayBuffer keeps the lyra left-side resistor designator aligned', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
    const anchors = documentModel.schematic.texts
        .filter(
            (text) => text.text === 'R11' && text.ownerIndex === '1461'
        )
        .map((text) => ({
            text: text.text,
            anchor: text.anchor
        }))
        .sort((left, right) => left.text.localeCompare(right.text))

    assert.deepEqual(anchors, [{ text: 'R11', anchor: 'end' }])
})

/**
 * Verifies gate designators on the aether sheet sit just above the symbol
 * body instead of touching its outline.
 */
test('parseAltiumArrayBuffer pads aether gate designators above the body', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
    const designators = documentModel.schematic.texts
        .filter((text) => ['K29', 'K31'].includes(text.text))
        .map((text) => ({
            text: text.text,
            y: text.y,
            anchor: text.anchor
        }))
        .sort((left, right) => left.text.localeCompare(right.text))

    assert.deepEqual(designators, [
        { text: 'K29', y: 224, anchor: 'start' },
        { text: 'K31', y: 234, anchor: 'start' }
    ])
})

/**
 * Verifies bottom-side connector designators on the aether sheet keep their
 * original left-to-right anchor instead of being pulled left under the body.
 */
test('parseAltiumArrayBuffer keeps aether bottom connector designators left-to-right', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
    const designator = documentModel.schematic.texts.find(
        (text) => text.text === 'P5'
    )

    assert.deepEqual(
        {
            text: designator?.text,
            x: designator?.x,
            y: designator?.y,
            anchor: designator?.anchor
        },
        {
            text: 'P5',
            x: 974,
            y: 244,
            anchor: 'start'
        }
    )
})

/**
 * Verifies only wire labels on open left runs flip away from nearby
 * designators, while labels attached to component pins stay left-to-right.
 */
test('parseAltiumArrayBuffer keeps component-connected wire labels readable on the aether sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
    const anchors = documentModel.schematic.texts
        .filter(
            (text) =>
                (text.text === 'VEIL_RST' &&
                    text.x === 245 &&
                    text.y === 545) ||
                (text.text === 'WYRN_SEND' && text.x === 630 && text.y === 475) ||
                (text.text === 'WYRN_ECHO' && text.x === 630 && text.y === 445) ||
                (text.text === 'WYRN_INIT' &&
                    text.x === 630 &&
                    text.y === 435) ||
                (text.text === 'NOVA_SEND' && text.x === 760 && text.y === 535)
        )
        .map((text) => ({
            text: text.text,
            x: text.x,
            anchor: text.anchor
        }))
        .sort(
            (left, right) =>
                left.x - right.x || left.text.localeCompare(right.text)
        )

    assert.deepEqual(anchors, [
        { text: 'VEIL_RST', x: 245, anchor: 'end' },
        { text: 'WYRN_ECHO', x: 630, anchor: 'start' },
        { text: 'WYRN_INIT', x: 630, anchor: 'start' },
        { text: 'WYRN_SEND', x: 630, anchor: 'start' },
        { text: 'NOVA_SEND', x: 760, anchor: 'start' }
    ])
})

/**
 * Verifies the aether sheet keeps the Q12 diode body polygon as drawable
 * line segments so the symbol triangle is visible.
 */
test('parseAltiumArrayBuffer preserves the aether-sheet Q12 diode triangle', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()

    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.ownerIndex === '167' &&
                line.x1 === 217 &&
                line.y1 === 238 &&
                line.x2 === 233 &&
                line.y2 === 238 &&
                line.color === '#0000ff'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.ownerIndex === '167' &&
                line.x1 === 233 &&
                line.y1 === 238 &&
                line.x2 === 225 &&
                line.y2 === 254 &&
                line.color === '#0000ff'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.ownerIndex === '167' &&
                line.x1 === 225 &&
                line.y1 === 254 &&
                line.x2 === 217 &&
                line.y2 === 238 &&
                line.color === '#0000ff'
        ),
        true
    )
})

/**
 * Verifies the boot-strap region keeps its centered note text, preserves
 * the visible same-row wire labels, and normalizes the mixed-direction
 * off-sheet port stack.
 */
test(
    'parseAltiumArrayBuffer normalizes the bastion-sheet dawn-sigil note and off-sheet ports',
    async () => {
        const documentModel = await AltiumFixtureLoader.parseBastionSheet()
        const bootNote = documentModel.schematic.texts.find(
            (text) => text.text === 'Needed for Dawn Sigil!'
        )
        const dashedFrameBounds = documentModel.schematic.lines
            .filter((line) => Number(line.lineStyle || 0) === 1)
            .reduce(
                (bounds, line) => ({
                    minX: Math.min(bounds.minX, line.x1, line.x2),
                    minY: Math.min(bounds.minY, line.y1, line.y2),
                    maxX: Math.max(bounds.maxX, line.x1, line.x2),
                    maxY: Math.max(bounds.maxY, line.y1, line.y2)
                }),
                {
                    minX: Number.POSITIVE_INFINITY,
                    minY: Number.POSITIVE_INFINITY,
                    maxX: Number.NEGATIVE_INFINITY,
                    maxY: Number.NEGATIVE_INFINITY
                }
            )
        const portStack = documentModel.schematic.ports
            .filter(
                (port) =>
                    ['AURA_IRQ', 'AURA_CS', 'GLYPH_CS'].includes(port.name) &&
                    port.x === 280
            )
            .sort((left, right) => left.y - right.y)
        const wireSidePortTexts = documentModel.schematic.texts.filter(
            (text) =>
                text.recordType === '25' &&
                ['AURA_IRQ', 'AURA_CS', 'GLYPH_CS'].includes(text.text) &&
                text.x === 340
        ).sort((left, right) => left.y - right.y)

        assert.deepEqual(
            {
                text: bootNote?.text,
                x: bootNote?.x,
                y: bootNote?.y,
                anchor: bootNote?.anchor
            },
            {
                text: 'Needed for Dawn Sigil!',
                x: 349,
                y: 576,
                anchor: 'middle'
            }
        )
        assert.deepEqual(dashedFrameBounds, {
            minX: 289,
            minY: 524,
            maxX: 409,
            maxY: 590
        })
        assert.deepEqual(
            portStack.map((port) => ({
                name: port.name,
                x: port.x,
                y: port.y,
                direction: port.direction
            })),
            [
                { name: 'AURA_IRQ', x: 280, y: 470, direction: 'right' },
                { name: 'AURA_CS', x: 280, y: 480, direction: 'right' },
                { name: 'GLYPH_CS', x: 280, y: 490, direction: 'left' }
            ]
        )
        assert.deepEqual(
            wireSidePortTexts.map((text) => ({
                text: text.text,
                x: text.x,
                y: text.y,
                anchor: text.anchor
            })),
            [
                { text: 'AURA_IRQ', x: 340, y: 470, anchor: 'start' },
                { text: 'AURA_CS', x: 340, y: 480, anchor: 'start' },
                { text: 'GLYPH_CS', x: 340, y: 490, anchor: 'start' }
            ]
        )
    }
)
