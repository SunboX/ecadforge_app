import { readFile } from 'node:fs/promises'
import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'

/**
 * Loads repo-owned fake Altium fixtures for parser-backed tests.
 */
export class AltiumFixtureLoader {
    /**
     * Returns the fake power-sheet file name.
     * @returns {string}
     */
    static get powerSheetFileName() {
        return 'AtlasControl-A1.01.01A.SchDoc'
    }

    /**
     * Returns the fake wireless-sheet file name.
     * @returns {string}
     */
    static get wirelessSheetFileName() {
        return 'AtlasControl-A1.01.01E.SchDoc'
    }

    /**
     * Returns the fake MIDI-sheet file name.
     * @returns {string}
     */
    static get midiSheetFileName() {
        return 'AtlasControl-A1.01.01F.SchDoc'
    }

    /**
     * Returns the fake PCB file name.
     * @returns {string}
     */
    static get pcbFileName() {
        return 'AtlasControl-A1.01.08.PcbDoc'
    }

    /**
     * Returns the fake power-sheet fixture URL.
     * @returns {URL}
     */
    static get powerSheetUrl() {
        return new URL('./altium/' + this.powerSheetFileName, import.meta.url)
    }

    /**
     * Returns the fake wireless-sheet fixture URL.
     * @returns {URL}
     */
    static get wirelessSheetUrl() {
        return new URL('./altium/' + this.wirelessSheetFileName, import.meta.url)
    }

    /**
     * Returns the fake MIDI-sheet fixture URL.
     * @returns {URL}
     */
    static get midiSheetUrl() {
        return new URL('./altium/' + this.midiSheetFileName, import.meta.url)
    }

    /**
     * Returns the fake PCB fixture URL.
     * @returns {URL}
     */
    static get pcbUrl() {
        return new URL('./altium/' + this.pcbFileName, import.meta.url)
    }

    /**
     * Loads one fixture file into an exact ArrayBuffer slice.
     * @param {URL} fixtureUrl
     * @returns {Promise<ArrayBuffer>}
     */
    static async loadArrayBuffer(fixtureUrl) {
        const buffer = await readFile(fixtureUrl)
        return buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
        )
    }

    /**
     * Parses the fake power-sheet fixture.
     * @returns {Promise<ReturnType<typeof AltiumParser.parseArrayBuffer>>}
     */
    static async parsePowerSheet() {
        return AltiumFixtureLoader.#parseFixture(
            this.powerSheetFileName,
            this.powerSheetUrl
        )
    }

    /**
     * Parses the fake wireless-sheet fixture.
     * @returns {Promise<ReturnType<typeof AltiumParser.parseArrayBuffer>>}
     */
    static async parseWirelessSheet() {
        return AltiumFixtureLoader.#parseFixture(
            this.wirelessSheetFileName,
            this.wirelessSheetUrl
        )
    }

    /**
     * Parses the fake MIDI-sheet fixture.
     * @returns {Promise<ReturnType<typeof AltiumParser.parseArrayBuffer>>}
     */
    static async parseMidiSheet() {
        return AltiumFixtureLoader.#parseFixture(
            this.midiSheetFileName,
            this.midiSheetUrl
        )
    }

    /**
     * Parses the fake PCB fixture.
     * @returns {Promise<ReturnType<typeof AltiumParser.parseArrayBuffer>>}
     */
    static async parsePcb() {
        return AltiumFixtureLoader.#parseFixture(this.pcbFileName, this.pcbUrl)
    }

    /**
     * Parses one fake Altium fixture file.
     * @param {string} fileName
     * @param {URL} fixtureUrl
     * @returns {Promise<ReturnType<typeof AltiumParser.parseArrayBuffer>>}
     */
    static async #parseFixture(fileName, fixtureUrl) {
        return AltiumParser.parseArrayBuffer(
            fileName,
            await AltiumFixtureLoader.loadArrayBuffer(fixtureUrl)
        )
    }
}
