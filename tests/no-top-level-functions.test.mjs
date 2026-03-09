import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

/**
 * Recursively collects .mjs files.
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function collectMjsFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    const files = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = path.join(directory, entry.name)
            if (entry.isDirectory()) {
                return collectMjsFiles(fullPath)
            }
            return entry.isFile() && entry.name.endsWith('.mjs')
                ? [fullPath]
                : []
        })
    )
    return files.flat()
}

/**
 * Verifies source modules keep helpers inside classes instead of top-level
 * function declarations.
 */
test('source .mjs files avoid top-level function declarations', async () => {
    const sourceFiles = await collectMjsFiles('src')
    const offenders = []

    for (const sourceFile of sourceFiles) {
        const source = await readFile(sourceFile, 'utf8')
        const matches = [
            ...source.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm)
        ].map((match) => match[1])

        if (matches.length) {
            offenders.push(sourceFile + ': ' + matches.join(', '))
        }
    }

    assert.deepEqual(
        offenders,
        [],
        'Found top-level function declarations:\n' + offenders.join('\n')
    )
})
