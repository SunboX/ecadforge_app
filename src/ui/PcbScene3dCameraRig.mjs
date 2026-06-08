/**
 * Resolves camera presets and basic rig state for the PCB 3D scene.
 */
export class PcbScene3dCameraRig {
    /**
     * Resolves the initial camera radius from the board size.
     * @param {{ board?: { widthMil?: number, heightMil?: number }, sourceFormat?: string }} sceneDescription
     * @returns {number}
     */
    static resolveInitialRadius(sceneDescription) {
        const width = Number(sceneDescription?.board?.widthMil || 0)
        const height = Number(sceneDescription?.board?.heightMil || 0)
        return Math.max(width, height, 800) * 1.9
    }

    /**
     * Resolves one named camera preset into a z-up camera pose.
     * @param {string} preset
     * @param {{ board?: { widthMil?: number, heightMil?: number }, sourceFormat?: string }} sceneDescription
     * @param {{ radius?: number, target?: { x?: number, y?: number, z?: number } }} [options]
     * @returns {{ radius: number, target: { x: number, y: number, z: number }, up: { x: number, y: number, z: number }, position: { x: number, y: number, z: number } }}
     */
    static resolvePreset(preset, sceneDescription, options = {}) {
        const normalizedPreset = String(preset || 'isometric').toLowerCase()
        const radius =
            Number(options.radius) ||
            PcbScene3dCameraRig.resolveInitialRadius(sceneDescription)
        const target = {
            x: Number(options.target?.x || 0),
            y: Number(options.target?.y || 0),
            z: Number(options.target?.z || 0)
        }

        if (normalizedPreset === 'top') {
            return {
                radius,
                target,
                up: { x: 0, y: 1, z: 0 },
                position: {
                    x: target.x,
                    y: target.y,
                    z: target.z + radius
                }
            }
        }

        if (normalizedPreset === 'bottom') {
            return {
                radius,
                target,
                up: { x: 0, y: -1, z: 0 },
                position: {
                    x: target.x,
                    y: target.y,
                    z: target.z - radius
                }
            }
        }

        const theta = -Math.PI / 4
        const phi = Math.PI / 3.3

        return {
            radius,
            target,
            up: { x: 0, y: 0, z: 1 },
            position: PcbScene3dCameraRig.#resolvePosition(
                theta,
                phi,
                radius,
                target
            )
        }
    }

    /**
     * Applies one preset to a Three camera and optional OrbitControls instance.
     * @param {{ position?: { set?: (x: number, y: number, z: number) => void }, up?: { set?: (x: number, y: number, z: number) => void }, lookAt?: (x: number, y: number, z: number) => void, updateProjectionMatrix?: () => void }} camera
     * @param {{ target?: { x?: number, y?: number, z?: number, set?: (x: number, y: number, z: number) => void }, update?: () => void }} [controls]
     * @param {string} preset
     * @param {{ board?: { widthMil?: number, heightMil?: number }, sourceFormat?: string }} sceneDescription
     * @returns {{ radius: number, target: { x: number, y: number, z: number }, up: { x: number, y: number, z: number }, position: { x: number, y: number, z: number } }}
     */
    static applyPreset(camera, controls, preset, sceneDescription) {
        const normalizedPreset = String(preset || 'isometric').toLowerCase()
        const resetsView =
            normalizedPreset === 'isometric' || normalizedPreset === 'reset'
        const pose = PcbScene3dCameraRig.resolvePreset(
            normalizedPreset,
            sceneDescription,
            {
                radius: resetsView
                    ? PcbScene3dCameraRig.resolveInitialRadius(sceneDescription)
                    : PcbScene3dCameraRig.#resolveCurrentRadius(
                          camera,
                          controls
                      ),
                target: resetsView
                    ? { x: 0, y: 0, z: 0 }
                    : PcbScene3dCameraRig.#resolveCurrentTarget(controls)
            }
        )

        camera?.up?.set?.(pose.up.x, pose.up.y, pose.up.z)
        controls?.target?.set?.(pose.target.x, pose.target.y, pose.target.z)
        camera?.position?.set?.(
            pose.position.x,
            pose.position.y,
            pose.position.z
        )
        camera?.lookAt?.(pose.target.x, pose.target.y, pose.target.z)
        controls?.update?.()
        camera?.updateProjectionMatrix?.()

        return pose
    }

    /**
     * Resolves one camera position from spherical coordinates in a z-up world.
     * @param {number} theta
     * @param {number} phi
     * @param {number} radius
     * @param {{ x: number, y: number, z: number }} target
     * @returns {{ x: number, y: number, z: number }}
     */
    static #resolvePosition(theta, phi, radius, target) {
        const sinPhi = Math.sin(phi)

        return {
            x: target.x + radius * sinPhi * Math.cos(theta),
            y: target.y + radius * sinPhi * Math.sin(theta),
            z: target.z + radius * Math.cos(phi)
        }
    }

    /**
     * Resolves the current camera radius from the camera-target distance.
     * @param {{ position?: { x?: number, y?: number, z?: number } }} [camera]
     * @param {{ target?: { x?: number, y?: number, z?: number } }} [controls]
     * @returns {number}
     */
    static #resolveCurrentRadius(camera, controls) {
        const position = camera?.position || {}
        const target = controls?.target || {}

        return Math.max(
            Math.hypot(
                Number(position.x || 0) - Number(target.x || 0),
                Number(position.y || 0) - Number(target.y || 0),
                Number(position.z || 0) - Number(target.z || 0)
            ),
            1
        )
    }

    /**
     * Resolves the current controls target into a plain object.
     * @param {{ target?: { x?: number, y?: number, z?: number } }} [controls]
     * @returns {{ x: number, y: number, z: number }}
     */
    static #resolveCurrentTarget(controls) {
        return {
            x: Number(controls?.target?.x || 0),
            y: Number(controls?.target?.y || 0),
            z: Number(controls?.target?.z || 0)
        }
    }
}
