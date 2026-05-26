/**
 * Registry for bundled demo projects that are safe to ship with the app.
 */
export class DemoProjectRegistry {
    /**
     * Returns every bundled demo descriptor.
     * @returns {{ id: string, title: string, formatFamily: string, license: string, sourceUrl: string, licenseUrl: string, files: { name: string, path: string }[] }[]}
     */
    static list() {
        return DemoProjectRegistry.#demos.map((demo) =>
            DemoProjectRegistry.#cloneDemo(demo)
        )
    }

    /**
     * Resolves a bundled demo by id.
     * @param {string} id Demo id.
     * @returns {{ id: string, title: string, formatFamily: string, license: string, sourceUrl: string, licenseUrl: string, files: { name: string, path: string }[] } | null}
     */
    static get(id) {
        const normalizedId = String(id || '').toLowerCase()
        const demo = DemoProjectRegistry.#demos.find(
            (entry) => entry.id === normalizedId
        )

        return demo ? DemoProjectRegistry.#cloneDemo(demo) : null
    }

    /**
     * Returns an immutable clone so callers cannot mutate registry data.
     * @param {{ id: string, title: string, formatFamily: string, license: string, sourceUrl: string, licenseUrl: string, files: { name: string, path: string }[] }} demo Demo descriptor.
     * @returns {{ id: string, title: string, formatFamily: string, license: string, sourceUrl: string, licenseUrl: string, files: { name: string, path: string }[] }}
     */
    static #cloneDemo(demo) {
        return {
            ...demo,
            files: demo.files.map((file) => ({ ...file }))
        }
    }

    /** @type {{ id: string, title: string, formatFamily: string, license: string, sourceUrl: string, licenseUrl: string, files: { name: string, path: string }[] }[]} */
    static #demos = [
        {
            id: 'altium',
            title: 'Sample Altium project',
            formatFamily: 'altium',
            license: 'MIT',
            sourceUrl: 'https://github.com/nodemcu/nodemcu-devkit',
            licenseUrl:
                'https://raw.githubusercontent.com/nodemcu/nodemcu-devkit/master/LICENSE',
            files: [
                {
                    name: 'NODEMCU_ESP12.SchDoc',
                    path: '/demo/altium/NODEMCU_ESP12.SchDoc'
                },
                {
                    name: 'NODEMCU_ESP12.PcbDoc',
                    path: '/demo/altium/NODEMCU_ESP12.PcbDoc'
                }
            ]
        },
        {
            id: 'kicad',
            title: 'Sample KiCad project',
            formatFamily: 'kicad',
            license: 'BSD-3-Clause',
            sourceUrl:
                'https://github.com/tommy-gilligan/RP2040-minimal-design',
            licenseUrl:
                'https://raw.githubusercontent.com/tommy-gilligan/RP2040-minimal-design/main/LICENSE.txt',
            files: [
                {
                    name: 'RP2040_minimal.kicad_pro',
                    path: '/demo/kicad/RP2040_minimal.kicad_pro'
                },
                {
                    name: 'RP2040_minimal.kicad_sch',
                    path: '/demo/kicad/RP2040_minimal.kicad_sch'
                },
                {
                    name: 'RP2040_minimal.kicad_pcb',
                    path: '/demo/kicad/RP2040_minimal.kicad_pcb'
                }
            ]
        }
    ]
}
