/**
 * Builds a stable transform hierarchy for one PCB-mounted 3D object.
 */
export class PcbScene3dMountRig {
    /**
     * Creates one transform rig that keeps the XY anchor fixed while flipping
     * bottom-side content around the board face.
     * @param {any} THREE
     * @param {{ mountSide?: string, rotationDeg?: number, positionMil?: { x?: number, y?: number, z?: number } }} placement
     * @returns {{ rootGroup: any, orientationGroup: any, sideGroup: any, faceGroup: any }}
     */
    static create(THREE, placement) {
        const rootGroup = new THREE.Group()
        const orientationGroup = new THREE.Group()
        const sideGroup = new THREE.Group()
        const faceGroup = new THREE.Group()
        const positionMil = placement?.positionMil || {}

        rootGroup.position.set(
            Number(positionMil.x || 0),
            Number(positionMil.y || 0),
            0
        )
        orientationGroup.rotation.z =
            (Number(placement?.rotationDeg || 0) * Math.PI) / 180
        if (PcbScene3dMountRig.#isBottomSide(placement?.mountSide)) {
            sideGroup.rotation.y = Math.PI
            sideGroup.rotation.z = Math.PI
        }

        faceGroup.position.z = Math.abs(Number(positionMil.z || 0))

        sideGroup.add(faceGroup)
        orientationGroup.add(sideGroup)
        rootGroup.add(orientationGroup)

        return {
            rootGroup,
            orientationGroup,
            sideGroup,
            faceGroup
        }
    }

    /**
     * Returns true when one placement belongs on the underside of the board.
     * @param {string | undefined} mountSide
     * @returns {boolean}
     */
    static #isBottomSide(mountSide) {
        return String(mountSide || 'top').toLowerCase() === 'bottom'
    }
}
