import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { StructuredDataSync } from './sync-structured-data.mjs'

const generatedStructuredDataFiles = [
    'src/index.html',
    'src/altium-pcbdoc-viewer.html',
    'src/altium-schdoc-viewer.html',
    'src/kicad-viewer-online.html',
    'src/kicad-project-viewer.html',
    'src/ecad-viewer-no-upload.html',
    'src/altium-kicad-browser-viewer.html',
    'src/pcb-3d-viewer-browser.html',
    'src/bom-viewer-kicad-altium.html'
]

/**
 * Checks whether generated structured-data HTML is committed and current.
 */
export class StructuredDataDriftChecker {
    /**
     * Runs the sync step and reports generated file drift.
     * @param {{ sync?: () => Promise<void>, diffChangedFiles?: () => Promise<string> }} [options]
     * @returns {Promise<{ clean: boolean, changedFiles: string[], message: string }>}
     */
    static async check(options = {}) {
        const sync = options.sync || (() => StructuredDataSync.run())
        const beforeSnapshot =
            options.diffChangedFiles === undefined
                ? await StructuredDataDriftChecker.#snapshotGeneratedFiles()
                : null

        await sync()

        const changedFiles =
            options.diffChangedFiles === undefined
                ? await StructuredDataDriftChecker.#findChangedFiles(
                      beforeSnapshot
                  )
                : StructuredDataDriftChecker.#parseChangedFiles(
                      await options.diffChangedFiles()
                  )

        return {
            clean: changedFiles.length === 0,
            changedFiles,
            message: StructuredDataDriftChecker.#formatMessage(changedFiles)
        }
    }

    /**
     * Captures content hashes for all generated structured-data files.
     * @returns {Promise<Map<string, string>>}
     */
    static async #snapshotGeneratedFiles() {
        const snapshot = new Map()

        for (const filePath of generatedStructuredDataFiles) {
            snapshot.set(
                filePath,
                await StructuredDataDriftChecker.#hashFile(filePath)
            )
        }

        return snapshot
    }

    /**
     * Finds files whose contents changed after the sync step.
     * @param {Map<string, string> | null} beforeSnapshot
     * @returns {Promise<string[]>}
     */
    static async #findChangedFiles(beforeSnapshot) {
        const changedFiles = []

        for (const filePath of generatedStructuredDataFiles) {
            const previousHash = beforeSnapshot?.get(filePath)
            const currentHash =
                await StructuredDataDriftChecker.#hashFile(filePath)

            if (previousHash !== currentHash) {
                changedFiles.push(filePath)
            }
        }

        return changedFiles
    }

    /**
     * Hashes one generated file.
     * @param {string} filePath
     * @returns {Promise<string>}
     */
    static async #hashFile(filePath) {
        const contents = await readFile(filePath)

        return createHash('sha256').update(contents).digest('hex')
    }

    /**
     * Parses git diff file output into clean path rows.
     * @param {string} output
     * @returns {string[]}
     */
    static #parseChangedFiles(output) {
        return String(output || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
    }

    /**
     * Formats the human-facing checker result.
     * @param {string[]} changedFiles
     * @returns {string}
     */
    static #formatMessage(changedFiles) {
        if (changedFiles.length === 0) {
            return 'Structured data is in sync.'
        }

        return (
            'Structured data is out of sync. Run `npm run sync:structured-data` and commit these generated files:\n' +
            changedFiles.map((filePath) => '- ' + filePath).join('\n')
        )
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    const result = await StructuredDataDriftChecker.check()

    if (!result.clean) {
        console.error(result.message)
        process.exitCode = 1
    } else {
        console.log(result.message)
    }
}
