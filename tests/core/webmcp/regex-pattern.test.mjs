import assert from 'node:assert/strict'
import test from 'node:test'
import { RegexPattern } from '../../../src/core/webmcp/RegexPattern.mjs'

/**
 * Verifies WebMCP regex inputs are case-insensitive by default.
 */
test('RegexPattern parses case-insensitive patterns', () => {
    const parsed = RegexPattern.parse('vdd')

    assert.equal(parsed.regex.test('VDD_3V3'), true)
    assert.equal(parsed.regex.test('signal_clk'), false)
})

/**
 * Verifies common inline case-insensitive flags are accepted without relying
 * on JavaScript unsupported inline flag syntax.
 */
test('RegexPattern accepts leading inline case-insensitive flags', () => {
    const parsed = RegexPattern.parse('(?i)gnd')

    assert.equal(parsed.regex.test('AGND'), true)
})

/**
 * Verifies invalid regex input returns a tool-style error object.
 */
test('RegexPattern returns errors for invalid patterns', () => {
    const parsed = RegexPattern.parse('[unterminated')

    assert.match(parsed.error, /Invalid regex pattern/)
})

/**
 * Verifies broad patterns that match every candidate can be rejected before a
 * search tool dumps the full loaded design.
 */
test('RegexPattern detects broad matches', () => {
    assert.equal(RegexPattern.rejectsBroadMatch('.*', ['U1', 'R1', 'C1']), true)
    assert.equal(
        RegexPattern.rejectsBroadMatch('^U', ['U1', 'R1', 'C1']),
        false
    )
})
