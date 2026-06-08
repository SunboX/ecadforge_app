/**
 * Resolves per-view scene scale transforms for PCB 3D presets.
 */
export class PcbScene3dViewScale {
    /**
     * Resolves the scene-scale transform for one named preset.
     * @param {string} preset Preset name.
     * @param {{ coordinateSystem?: string } | null} [sceneDescription] Scene coordinate metadata.
     * @returns {{ x: number, y: number, z: number }}
     */
    static resolve(preset, sceneDescription = null) {
        const normalizedPreset = String(preset || 'isometric').toLowerCase()

        if (sceneDescription?.coordinateSystem === 'kicad-3d-y-up') {
            return { x: 1, y: 1, z: 1 }
        }

        return normalizedPreset === 'top'
            ? { x: 1, y: -1, z: 1 }
            : normalizedPreset === 'bottom'
              ? { x: -1, y: 1, z: 1 }
              : { x: 1, y: -1, z: 1 }
    }
}
