import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from 'altium-toolkit/extensions'

test('altium-toolkit positions schematic electrical pin numbers near markers', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Electrical pin labels' },
        schematic: {
            sheet: {
                width: 220,
                height: 140,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [],
            components: [],
            pins: [
                {
                    x: 110,
                    y: 80,
                    length: 20,
                    name: 'A',
                    designator: '1',
                    orientation: 'left',
                    electrical: 1,
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                },
                {
                    x: 150,
                    y: 80,
                    length: 20,
                    name: 'B',
                    designator: '2',
                    orientation: 'right',
                    electrical: 1,
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<text class="schematic-pin-number" x="94" y="59"[^>]*text-anchor="start"[^>]*>1<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="166" y="59"[^>]*text-anchor="end"[^>]*>2<\/text>/
    )
})

test('altium-toolkit keeps nonnumeric matching pin names inside owner bodies', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Owner body labels' },
        schematic: {
            sheet: {
                width: 180,
                height: 120,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            rectangles: [
                {
                    x: 70,
                    y: 30,
                    width: 70,
                    height: 70,
                    color: '#804000',
                    fill: '#ffeeaa',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1,
                    ownerIndex: '510'
                }
            ],
            texts: [],
            components: [],
            pins: [
                {
                    x: 70,
                    y: 50,
                    length: 15,
                    name: 'PAD',
                    designator: 'PAD',
                    orientation: 'left',
                    electrical: 4,
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number',
                    ownerIndex: '510'
                }
            ],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<text class="schematic-pin-number" x="68" y="69"[^>]*text-anchor="end"[^>]*>PAD<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="77" y="73"[^>]*text-anchor="start"[^>]*>PAD<\/text>/
    )
})

test('altium-toolkit renders checkbox no-ERC markers as checkboxes', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Checkbox no-ERC' },
        schematic: {
            sheet: { width: 100, height: 100 },
            lines: [],
            texts: [],
            components: [],
            ports: [],
            crosses: [
                {
                    x: 50,
                    y: 40,
                    size: 6,
                    color: '#ff0000',
                    symbolName: 'checkbox'
                }
            ]
        }
    })

    assert.match(
        markup,
        /<g class="schematic-cross schematic-cross--checkbox">/
    )
    assert.match(
        markup,
        /<rect x="49" y="47" width="6" height="6" fill="none" stroke="var\(--schematic-alert-color\)" \/>/
    )
    assert.match(
        markup,
        /<polyline points="50\.20,50 52,51\.80 54\.80,48\.20" fill="none" stroke="var\(--schematic-alert-color\)" \/>/
    )
})

test('altium-toolkit keeps connector route labels clear of generated annotations', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Connector label clearance' },
        schematic: {
            sheet: {
                width: 260,
                height: 150,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false
                    }
                }
            },
            lines: [
                {
                    x1: 20,
                    y1: 110,
                    x2: 100,
                    y2: 110,
                    color: '#000080',
                    width: 1
                }
            ],
            rectangles: [
                {
                    x: 100,
                    y: 40,
                    width: 60,
                    height: 90,
                    color: '#804000',
                    fill: '#ffeeaa',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1,
                    ownerIndex: '520'
                }
            ],
            texts: [
                {
                    x: 42,
                    y: 110,
                    text: 'FPGA_GPIO0',
                    color: '#800000',
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    anchor: 'start'
                }
            ],
            components: [],
            pins: [
                {
                    x: 100,
                    y: 110,
                    length: 20,
                    name: '1',
                    designator: '1',
                    orientation: 'left',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '520'
                },
                {
                    x: 160,
                    y: 110,
                    length: 20,
                    name: '2',
                    designator: '2',
                    orientation: 'right',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '520'
                },
                {
                    x: 100,
                    y: 70,
                    length: 20,
                    name: '3',
                    designator: '3',
                    orientation: 'left',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '520'
                },
                {
                    x: 160,
                    y: 70,
                    length: 20,
                    name: '4',
                    designator: '4',
                    orientation: 'right',
                    color: '#000000',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only',
                    ownerIndex: '520'
                }
            ],
            ports: [],
            crosses: [],
            directives: [
                {
                    x: 70,
                    y: 82,
                    color: '#ff0000',
                    name: 'FPGA_GPIO',
                    orientation: 1
                }
            ]
        }
    })

    assert.match(
        markup,
        /<text class="schematic-directive-label" x="70" y="47"[^>]*>FPGA_GPIO<\/text>/
    )
    assert.match(
        markup,
        /<text class="schematic-pin-name" x="110" y="43"[^>]*>1<\/text>/
    )
    assert.doesNotMatch(
        markup,
        /<text class="schematic-pin-number"[^>]*>1<\/text>/
    )
})
