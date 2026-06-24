import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicNetDiagnosticOverlayRenderer } from '../../src/ui/SchematicNetDiagnosticOverlayRenderer.mjs'

const baseMarkup =
    '<svg class="schematic-svg"><g class="schematic-content"></g></svg>'

/**
 * Builds a schematic document with one anchor-only net.
 * @returns {object}
 */
function createDiagnosticDocument() {
    return {
        sourceFormat: 'kicad',
        kind: 'schematic',
        schematic: {
            sheet: { width: 40, height: 30 },
            nets: [
                {
                    name: 'SENSE_A',
                    pins: [
                        { refdes: 'U1', pin: '1', x: 2, y: 4 },
                        { refdes: 'U2', pin: '2', x: 12, y: 4 }
                    ]
                }
            ]
        }
    }
}

test('SchematicNetDiagnosticOverlayRenderer leaves markup unchanged by default', () => {
    const html = SchematicNetDiagnosticOverlayRenderer.inject(
        baseMarkup,
        createDiagnosticDocument()
    )

    assert.equal(html, baseMarkup)
})

test('SchematicNetDiagnosticOverlayRenderer injects fallback geometry when enabled', () => {
    const html = SchematicNetDiagnosticOverlayRenderer.inject(
        baseMarkup,
        createDiagnosticDocument(),
        { enabled: true }
    )

    assert.match(html, /class="schematic-net-diagnostic-style"/)
    assert.match(html, /class="schematic-net-diagnostic-overlay"/)
    assert.match(html, /data-schematic-net-name="SENSE_A"/)
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="fallback-connection"/
    )
    assert.match(html, /d="M2 4 L12 4"/)
})

test('SchematicNetDiagnosticOverlayRenderer renders expanded diagnostic geometry', () => {
    const html = SchematicNetDiagnosticOverlayRenderer.inject(
        baseMarkup,
        createDiagnosticDocument(),
        {
            enabled: true,
            diagnostics: {
                fallbackSegments: [],
                overlapSegments: [],
                obstacleSegments: [
                    {
                        kind: 'fallback-obstacle-crossing',
                        netName: 'PWR_A',
                        points: [
                            { x: 0, y: 0 },
                            { x: 10, y: 0 }
                        ]
                    }
                ],
                jogSuggestionSegments: [
                    {
                        kind: 'cross-net-overlap-jog-candidate',
                        netName: 'SENSE_A',
                        points: [
                            { x: 1, y: 1 },
                            { x: 1, y: 3 },
                            { x: 5, y: 3 },
                            { x: 5, y: 1 }
                        ]
                    }
                ],
                traceLabelDetourSegments: [
                    {
                        kind: 'net-label-trace-detour-candidate',
                        netName: 'RETURN_A',
                        points: [
                            { x: 2, y: 2 },
                            { x: 4, y: 2 },
                            { x: 4, y: 6 },
                            { x: 2, y: 6 }
                        ]
                    }
                ],
                pathCleanupSegments: [
                    {
                        kind: 'net-path-cleanup-candidate',
                        netName: 'BUS_A',
                        points: [
                            { x: 6, y: 1 },
                            { x: 9, y: 1 },
                            { x: 9, y: 4 }
                        ]
                    }
                ],
                guidelineSegments: [
                    {
                        kind: 'schematic-routing-guideline',
                        netName: '',
                        points: [
                            { x: 0, y: 8 },
                            { x: 12, y: 8 }
                        ]
                    }
                ],
                restrictedCenterlineSegments: [
                    {
                        kind: 'schematic-routing-restricted-centerline-crossing',
                        netName: 'PWR_A',
                        points: [
                            { x: 3, y: 0 },
                            { x: 7, y: 0 }
                        ]
                    }
                ],
                guidelineSnappedElbowSegments: [
                    {
                        kind: 'guideline-snapped-elbow-candidate',
                        netName: 'BUS_A',
                        points: [
                            { x: 0, y: 0 },
                            { x: 5, y: 0 },
                            { x: 5, y: 8 },
                            { x: 10, y: 8 }
                        ]
                    }
                ],
                supplementalConnectionSegments: [
                    {
                        kind: 'supplemental-connection-candidate',
                        netName: 'SENSE_A',
                        points: [
                            { x: 4, y: 0 },
                            { x: 20, y: 0 }
                        ]
                    }
                ],
                orientationConnectorSegments: [
                    {
                        kind: 'label-orientation-connector-candidate',
                        netName: 'SENSE_A',
                        points: [
                            { x: 4, y: 0 },
                            { x: 4, y: -0.5 }
                        ]
                    }
                ],
                symbolPinSnapSegments: [
                    {
                        kind: 'symbol-pin-snap-candidate',
                        netName: 'FIT_A',
                        points: [
                            { x: 3, y: 0 },
                            { x: 2, y: 0 }
                        ]
                    }
                ],
                anchorMarkers: [
                    {
                        kind: 'unconnected-anchor',
                        netName: 'SENSE_A',
                        point: { x: 3, y: 5 }
                    }
                ],
                collisionBounds: [
                    {
                        kind: 'net-label-net-label-overlap',
                        netName: 'SENSE_A',
                        bounds: { minX: 4, minY: 6, maxX: 8, maxY: 10 }
                    }
                ],
                labelCandidateBounds: [
                    {
                        kind: 'net-label-candidate',
                        netName: 'SENSE_A',
                        bounds: { minX: 10, minY: 6, maxX: 14, maxY: 10 }
                    }
                ],
                traceAnchoredLabelCandidateBounds: [
                    {
                        kind: 'trace-anchored-net-label-candidate',
                        netName: 'SENSE_A',
                        bounds: { minX: 15, minY: 6, maxX: 19, maxY: 10 }
                    }
                ],
                orientationLabelCandidateBounds: [
                    {
                        kind: 'label-orientation-candidate',
                        netName: 'SENSE_A',
                        bounds: { minX: 20, minY: 6, maxX: 24, maxY: 10 }
                    }
                ],
                powerLabelCornerCandidateBounds: [
                    {
                        kind: 'power-label-corner-candidate',
                        netName: 'VCC',
                        bounds: { minX: 25, minY: 6, maxX: 29, maxY: 10 }
                    }
                ],
                traceAnchoredLabelRejectedCandidateBounds: [
                    {
                        kind: 'trace-anchored-net-label-rejected-candidate',
                        netName: 'SENSE_A',
                        bounds: { minX: 30, minY: 6, maxX: 34, maxY: 10 }
                    }
                ],
                symbolBodyFitCandidateBounds: [
                    {
                        kind: 'symbol-body-fit-candidate',
                        netName: '',
                        bounds: { minX: 35, minY: 6, maxX: 39, maxY: 10 }
                    }
                ]
            }
        }
    )

    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="fallback-obstacle-crossing"/
    )
    assert.match(html, /class="schematic-net-diagnostic-overlay__anchor"/)
    assert.match(html, /class="schematic-net-diagnostic-overlay__bounds/)
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="net-label-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="cross-net-overlap-jog-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="net-label-trace-detour-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="net-path-cleanup-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="schematic-routing-guideline"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="schematic-routing-restricted-centerline-crossing"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="guideline-snapped-elbow-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="supplemental-connection-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="label-orientation-connector-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="symbol-pin-snap-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="trace-anchored-net-label-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="label-orientation-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="power-label-corner-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="trace-anchored-net-label-rejected-candidate"/
    )
    assert.match(
        html,
        /data-schematic-net-diagnostic-kind="symbol-body-fit-candidate"/
    )
    assert.match(html, /d="M1 1 L1 3 L5 3 L5 1"/)
    assert.match(html, /d="M2 2 L4 2 L4 6 L2 6"/)
    assert.match(html, /d="M6 1 L9 1 L9 4"/)
    assert.match(html, /d="M0 8 L12 8"/)
    assert.match(html, /d="M3 0 L7 0"/)
    assert.match(html, /d="M0 0 L5 0 L5 8 L10 8"/)
    assert.match(html, /d="M4 0 L20 0"/)
    assert.match(html, /d="M4 0 L4 -0\.5"/)
    assert.match(html, /d="M3 0 L2 0"/)
    assert.match(html, /cx="3" cy="5"/)
    assert.match(html, /x="4" y="6" width="4" height="4"/)
    assert.match(html, /x="10" y="6" width="4" height="4"/)
    assert.match(html, /x="15" y="6" width="4" height="4"/)
    assert.match(html, /x="20" y="6" width="4" height="4"/)
    assert.match(html, /x="25" y="6" width="4" height="4"/)
    assert.match(html, /x="30" y="6" width="4" height="4"/)
    assert.match(html, /x="35" y="6" width="4" height="4"/)
})
