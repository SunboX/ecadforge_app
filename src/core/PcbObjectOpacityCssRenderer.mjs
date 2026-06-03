import { PcbObjectVisibilityModel } from './PcbObjectVisibilityModel.mjs'

const PCB_OBJECT_VISIBILITY_SELECTORS = {
    tracks: ['.pcb-track', '.pcb-segment', '.pcb-arc'],
    vias: ['.pcb-via', '.pcb-via__pad'],
    pads: ['.pcb-pad', '.pcb-pad__ring', '.pcb-smd-pad'],
    holes: [
        '.pcb-via__hole',
        '.pcb-pad__hole',
        '.pcb-pad__hole--slot',
        '.pcb-via-drill',
        '.pcb-pad-drill'
    ],
    zones: ['.pcb-zone', '.pcb-polygon', '.pcb-fill', '.pcb-region'],
    'footprint-text': [
        '.pcb-text',
        '.pcb-texts',
        '.pcb-reference',
        '.pcb-value',
        '.pcb-footprint-text'
    ],
    grid: ['.pcb-grid', '.schematic-grid', '.grid'],
    page: [
        '.pcb-board',
        '.board-outline',
        '.board-outline--stroke',
        '.sheet-backdrop'
    ]
}

/**
 * Renders SVG-local CSS for PCB object opacity categories.
 */
export class PcbObjectOpacityCssRenderer {
    /**
     * Renders SVG-local CSS rules for object opacity categories.
     * @param {string[]} hiddenObjectKeys Hidden object category keys.
     * @param {{ [objectKey: string]: number }} objectOpacities Object opacity map.
     * @returns {string}
     */
    static render(hiddenObjectKeys = [], objectOpacities = {}) {
        return PcbObjectVisibilityModel.resolveOpacityEntries(
            hiddenObjectKeys,
            objectOpacities
        )
            .flatMap(
                (entry) =>
                    PCB_OBJECT_VISIBILITY_SELECTORS[entry.key]?.map(
                        (selector) => ({
                            opacity: entry.opacity,
                            selector: '.pcb-svg ' + selector
                        })
                    ) || []
            )
            .map(
                (rule) =>
                    rule.selector +
                    ' { opacity: ' +
                    rule.opacity +
                    ' !important; }'
            )
            .join('')
    }
}
