/**
 * Centralizes pointer and touch interaction defaults for the 3D PCB viewport.
 */
export class PcbScene3dInteractionHints {
    /**
     * Applies explicit OrbitControls input mappings for desktop and touch.
     * @param {{ mouseButtons?: any, touches?: any }} controls
     * @param {{ MOUSE?: any, TOUCH?: any }} THREE
     * @returns {void}
     */
    static configureControls(controls, THREE) {
        if (!controls) {
            return
        }

        if (THREE?.MOUSE) {
            controls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN
            }
        }

        if (THREE?.TOUCH) {
            controls.touches = {
                ONE: THREE.TOUCH.ROTATE,
                TWO: THREE.TOUCH.DOLLY_PAN
            }
        }
    }

    /**
     * Resolves the default interaction copy for the current pointer type.
     * @param {{ matchMedia?: (query: string) => { matches?: boolean } }} [environment]
     * @returns {string}
     */
    static resolveDefaultMessage(environment = globalThis.window) {
        if (environment?.matchMedia?.('(pointer: coarse)')?.matches) {
            return 'Drag with one finger to orbit, pinch to zoom, and drag with two fingers to pan.'
        }

        return 'Drag to orbit, right-drag to pan, and use the wheel to zoom.'
    }
}
