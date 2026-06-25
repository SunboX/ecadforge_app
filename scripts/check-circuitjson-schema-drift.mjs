#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { CircuitJsonElementValidator } from 'circuitjson-toolkit'

const DEFAULT_SNAPSHOT_PATH = 'spec/circuitjson-schema-snapshot.json'

/**
 * Checks the active element metadata against a saved snapshot.
 */
export class CircuitJsonSchemaDriftChecker {
    /**
     * Loads and compares a snapshot file.
     * @param {string} snapshotPath Snapshot file path.
     * @returns {Promise<object>}
     */
    static async checkFile(snapshotPath = DEFAULT_SNAPSHOT_PATH) {
        const snapshot =
            await CircuitJsonSchemaDriftChecker.#readSnapshot(snapshotPath)
        return CircuitJsonSchemaDriftChecker.compare(snapshot)
    }

    /**
     * Compares a snapshot object to the active validator metadata.
     * @param {object | string[]} snapshot Snapshot metadata.
     * @returns {object}
     */
    static compare(snapshot) {
        return CircuitJsonElementValidator.compareSchemaSnapshot(
            CircuitJsonSchemaDriftChecker.#normalizeSnapshot(snapshot)
        )
    }

    /**
     * Formats comparison output for terminal use.
     * @param {object} comparison Comparison result.
     * @returns {string}
     */
    static format(comparison) {
        if (comparison.matches) {
            return 'CircuitJSON schema snapshot is current.'
        }

        return [
            'CircuitJSON schema snapshot drift detected.',
            CircuitJsonSchemaDriftChecker.#formatList(
                'Missing element types',
                comparison.missingElementTypes
            ),
            CircuitJsonSchemaDriftChecker.#formatList(
                'Unexpected element types',
                comparison.unexpectedElementTypes
            ),
            CircuitJsonSchemaDriftChecker.#formatList(
                'Missing id-field exceptions',
                comparison.missingIdFieldExceptions
            ),
            CircuitJsonSchemaDriftChecker.#formatList(
                'Unexpected id-field exceptions',
                comparison.unexpectedIdFieldExceptions
            ),
            CircuitJsonSchemaDriftChecker.#formatVariants(
                'Missing variants',
                comparison.missingVariants
            ),
            CircuitJsonSchemaDriftChecker.#formatVariants(
                'Unexpected variants',
                comparison.unexpectedVariants
            )
        ]
            .filter(Boolean)
            .join('\n')
    }

    /**
     * Reads a snapshot file.
     * @param {string} snapshotPath Snapshot file path.
     * @returns {Promise<object>}
     */
    static async #readSnapshot(snapshotPath) {
        const raw = await readFile(resolve(snapshotPath), 'utf8')
        return JSON.parse(raw)
    }

    /**
     * Normalizes supported snapshot shapes.
     * @param {object | string[]} snapshot Snapshot metadata.
     * @returns {{ elementTypes: string[], idFieldExceptions: string[], variantSets: Record<string, string[]> }}
     */
    static #normalizeSnapshot(snapshot) {
        if (Array.isArray(snapshot)) {
            return {
                elementTypes: snapshot.map(String),
                idFieldExceptions: [],
                variantSets: {}
            }
        }

        return {
            elementTypes: Array.isArray(snapshot?.elementTypes)
                ? snapshot.elementTypes.map(String)
                : [],
            idFieldExceptions: Array.isArray(snapshot?.idFieldExceptions)
                ? snapshot.idFieldExceptions.map(String)
                : [],
            variantSets:
                snapshot?.variantSets &&
                typeof snapshot.variantSets === 'object' &&
                !Array.isArray(snapshot.variantSets)
                    ? Object.fromEntries(
                          Object.entries(snapshot.variantSets).map(
                              ([key, values]) => [
                                  key,
                                  Array.isArray(values)
                                      ? values.map(String)
                                      : []
                              ]
                          )
                      )
                    : {}
        }
    }

    /**
     * Formats a non-empty comparison list.
     * @param {string} label List label.
     * @param {string[]} values Values.
     * @returns {string}
     */
    static #formatList(label, values) {
        return Array.isArray(values) && values.length
            ? label + ': ' + values.join(', ')
            : ''
    }

    /**
     * Formats variant drift rows.
     * @param {string} label List label.
     * @param {{ set?: string, value?: string }[]} values Variant values.
     * @returns {string}
     */
    static #formatVariants(label, values) {
        return Array.isArray(values) && values.length
            ? label +
                  ': ' +
                  values
                      .map(
                          (variant) =>
                              String(variant.set || '') +
                              '=' +
                              String(variant.value || '')
                      )
                      .join(', ')
            : ''
    }
}

/**
 * Runs the command-line checker.
 * @param {string[]} argv CLI arguments.
 * @param {{ stdout?: { write: (text: string) => void }, stderr?: { write: (text: string) => void } }} [io] IO handles.
 * @returns {Promise<number>}
 */
export async function run(argv, io = {}) {
    const snapshotPath =
        CircuitJsonSchemaDriftCheckerPathArgs.snapshotPath(argv)
    const stdout = io.stdout || process.stdout
    const stderr = io.stderr || process.stderr

    try {
        const comparison =
            await CircuitJsonSchemaDriftChecker.checkFile(snapshotPath)
        stdout.write(CircuitJsonSchemaDriftChecker.format(comparison) + '\n')
        return comparison.matches ? 0 : 1
    } catch (error) {
        stderr.write(String(error?.message || error) + '\n')
        return 1
    }
}

/**
 * Parses command-line path arguments for the schema drift checker.
 */
class CircuitJsonSchemaDriftCheckerPathArgs {
    /**
     * Resolves the snapshot path argument.
     * @param {string[]} argv CLI arguments.
     * @returns {string}
     */
    static snapshotPath(argv) {
        const args = Array.isArray(argv) ? argv : []
        const explicitIndex = args.findIndex(
            (arg) => arg === '--snapshot' || arg === '--schema'
        )
        if (explicitIndex >= 0 && args[explicitIndex + 1]) {
            return args[explicitIndex + 1]
        }

        return args.find((arg) => !arg.startsWith('-')) || DEFAULT_SNAPSHOT_PATH
    }
}

const entryPointUrl = process.argv[1]
    ? pathToFileURL(resolve(process.argv[1])).href
    : ''

if (import.meta.url === entryPointUrl) {
    process.exitCode = await run(process.argv.slice(2))
}
