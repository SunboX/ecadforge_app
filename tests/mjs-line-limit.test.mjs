import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const LINE_LIMIT = 1000

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
 * Verifies all source modules stay below the max line limit.
 */
test('all source .mjs files stay below line limit', async () => {
    const sourceFiles = await collectMjsFiles('src')
    const oversized = []

    for (const sourceFile of sourceFiles) {
        const source = await readFile(sourceFile, 'utf8')
        const lineCount = source.split('\n').length
        if (lineCount >= LINE_LIMIT) {
            oversized.push(sourceFile + ' (' + lineCount + ' lines)')
        }
    }

    assert.deepEqual(
        oversized,
        [],
        'Found source modules at or above ' +
            LINE_LIMIT +
            ' lines:\n' +
            oversized.join('\n')
    )
})
