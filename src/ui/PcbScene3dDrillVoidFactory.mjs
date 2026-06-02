/**
 * Preserves the former drill-void runtime hook without capping apertures.
 */
export class PcbScene3dDrillVoidFactory {
    /**
     * Builds an empty group so through-hole openings remain visually open.
     * The board extrusion already creates the interior drill walls.
     * @param {any} THREE
     * @returns {any}
     */
    static buildGroup(THREE) {
        const group = new THREE.Group()
        group.name = 'drill-voids'

        return group
    }
}
