import { PcbScene3dBoardShapeFactory } from './PcbScene3dBoardShapeFactory.mjs'
import { PcbScene3dCameraRig } from './PcbScene3dCameraRig.mjs'
import { PcbScene3dCopperFactory } from './PcbScene3dCopperFactory.mjs'
import { PcbScene3dExternalModels } from './PcbScene3dExternalModels.mjs'
import { PcbScene3dFallbackVisibility } from './PcbScene3dFallbackVisibility.mjs'
import { PcbScene3dMountRig } from './PcbScene3dMountRig.mjs'
import { PcbScene3dPresetState } from './PcbScene3dPresetState.mjs'
import { PcbScene3dSilkscreenFactory } from './PcbScene3dSilkscreenFactory.mjs'
import { PcbScene3dSelectionStyler } from './PcbScene3dSelectionStyler.mjs'
import { PcbScene3dViaFactory } from './PcbScene3dViaFactory.mjs'

/**
 * Browser-side Three.js runtime for the interactive PCB 3D viewport.
 */
export class PcbScene3dRuntime {
    /** @type {HTMLElement | null} */
    #viewportNode

    /** @type {any} */
    #sceneDescription

    /** @type {{ setDiagnostics?: (messages: string[]) => void, setSelection?: (selection: any | null) => void }} */
    #hooks

    /** @type {{ 'external-models': boolean, 'fallback-bodies': boolean, copper: boolean }} */
    #toggles

    /** @type {Map<string, any>} */
    #groups

    /** @type {Array<{ node: EventTarget, type: string, listener: (event: any) => void }>} */
    #listeners

    /** @type {any} */
    #three

    /** @type {any} */
    #renderer

    /** @type {any} */
    #scene

    /** @type {any} */
    #camera

    /** @type {any} */
    #orbitControlsClass

    /** @type {any} */
    #controls

    /** @type {any} */
    #rootGroup

    /** @type {any} */
    #raycaster

    /** @type {any} */
    #pointer

    /** @type {{ x: number, y: number } | null} */
    #pointerDownPosition

    /** @type {Map<string, Set<any>>} */
    #selectionRoots

    /** @type {Map<string, Set<any>>} */
    #fallbackBodyRoots

    /** @type {Set<string>} */
    #loadedExternalModelDesignators

    /** @type {string} */
    #selectedDesignator

    /** @type {number} */
    #initialRadius

    /** @type {PcbScene3dPresetState} */
    #presetState

    /** @type {boolean} */
    #isDisposed

    /** @type {Promise<void>} */
    #readyPromise

    /** @type {(() => void) | null} */
    #resolveReadyPromise

    /** @type {boolean} */
    #hasSettledReady

    /**
     * @param {HTMLElement} viewportNode
     * @param {any} sceneDescription
     * @param {{ setDiagnostics?: (messages: string[]) => void }} [hooks]
     */
    constructor(viewportNode, sceneDescription, hooks = {}) {
        this.#viewportNode = viewportNode
        this.#sceneDescription = sceneDescription
        this.#hooks = hooks
        this.#toggles = {
            'external-models': true,
            'fallback-bodies': true,
            copper: true
        }
        this.#groups = new Map()
        this.#listeners = []
        this.#three = null
        this.#renderer = null
        this.#scene = null
        this.#camera = null
        this.#orbitControlsClass = null
        this.#controls = null
        this.#rootGroup = null
        this.#raycaster = null
        this.#pointer = null
        this.#pointerDownPosition = null
        this.#selectionRoots = new Map()
        this.#fallbackBodyRoots = new Map()
        this.#loadedExternalModelDesignators = new Set()
        this.#selectedDesignator = ''
        this.#initialRadius =
            PcbScene3dCameraRig.resolveInitialRadius(sceneDescription)
        this.#presetState = new PcbScene3dPresetState()
        this.#isDisposed = false
        this.#hasSettledReady = false
        this.#resolveReadyPromise = null
        this.#readyPromise = new Promise((resolve) => {
            this.#resolveReadyPromise = resolve
        })

        this.#hooks.setDiagnostics?.([
            'Drag to orbit, right-drag to pan, and use the wheel to zoom.'
        ])
        this.#initialize()
    }

    /** @param {string} preset */
    setPreset(preset) {
        const normalizedPreset = this.#presetState.set(preset)
        if (!this.#camera) {
            return
        }

        PcbScene3dCameraRig.applyPreset(
            this.#camera,
            this.#controls,
            normalizedPreset,
            this.#sceneDescription
        )
        this.#render()
    }

    /** @param {string} toggleName @param {boolean} enabled */
    setToggle(toggleName, enabled) {
        if (!(toggleName in this.#toggles)) {
            return
        }

        this.#toggles[toggleName] = enabled
        this.#applyToggleVisibility()
        this.#render()
    }

    /**
     * Resolves when the runtime has completed its initial async
     * initialization and the first interactive frame is visible.
     * @returns {Promise<void>}
     */
    whenReady() {
        return this.#readyPromise
    }

    /** @returns {void} */
    dispose() {
        this.#isDisposed = true
        this.#listeners.forEach(({ node, type, listener }) => {
            node.removeEventListener?.(type, listener)
        })
        this.#listeners = []
        this.#controls?.dispose?.()
        this.#renderer?.dispose?.()
        if (this.#renderer?.domElement?.remove) {
            this.#renderer.domElement.remove()
        }
        this.#viewportNode = null
        this.#sceneDescription = null
        this.#renderer = null
        this.#scene = null
        this.#camera = null
        this.#orbitControlsClass = null
        this.#controls = null
        this.#rootGroup = null
        this.#raycaster = null
        this.#pointer = null
        this.#pointerDownPosition = null
        this.#selectionRoots.clear()
        this.#fallbackBodyRoots.clear()
        this.#loadedExternalModelDesignators.clear()
        this.#selectedDesignator = ''
        this.#groups.clear()
        this.#settleReady()
    }

    /**
     * Initializes the async Three.js scene.
     * @returns {Promise<void>}
     */
    async #initialize() {
        if (
            typeof window === 'undefined' ||
            typeof document === 'undefined' ||
            !this.#viewportNode
        ) {
            this.#settleReady()
            return
        }

        try {
            const { THREE, OrbitControls } =
                await PcbScene3dRuntime.#loadThreeRuntimeModules()
            this.#three = THREE
            this.#orbitControlsClass = OrbitControls
            if (this.#isDisposed || !this.#viewportNode) {
                return
            }

            this.#createRenderer()
            this.#createSceneGraph()
            this.#createControls()
            this.#bindSelectionInteraction()
            this.#applyToggleVisibility()
            this.#render()
            this.#settleReady()
            void this.#loadDeferredDetail()
        } catch (error) {
            this.#hooks.setDiagnostics?.([
                '3D preview could not start: ' +
                    String(error?.message || error || 'Unknown error.')
            ])
            this.#settleReady()
        }
    }

    /**
     * Creates the Three.js renderer, camera, and scene.
     * @returns {void}
     */
    #createRenderer() {
        const THREE = this.#three
        const size = this.#resolveViewportSize()

        this.#renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        })
        this.#renderer.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, 2)
        )
        this.#renderer.setSize(size.width, size.height, false)
        this.#renderer.domElement.className = 'scene-3d__canvas'
        this.#renderer.domElement.style.width = '100%'
        this.#renderer.domElement.style.height = '100%'

        this.#scene = new THREE.Scene()
        this.#camera = new THREE.PerspectiveCamera(
            38,
            size.width / size.height,
            10,
            Math.max(this.#initialRadius * 30, 25000)
        )
        this.#camera.up.set(0, 0, 1)
        this.#viewportNode?.replaceChildren(this.#renderer.domElement)
    }

    /**
     * Creates the initial board shell, fallback bodies, and placeholder detail
     * groups used by the deferred loading stages.
     * @returns {void}
     */
    #createSceneGraph() {
        const THREE = this.#three
        const board = this.#sceneDescription.board

        this.#rootGroup = new THREE.Group()
        this.#scene.add(this.#rootGroup)

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.8)
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.6)
        keyLight.position
            .set(0.8, 0.7, 1.3)
            .multiplyScalar(this.#initialRadius)
        const fillLight = new THREE.DirectionalLight(0xe8f3ff, 0.9)
        fillLight.position
            .set(-0.9, -0.4, 0.8)
            .multiplyScalar(this.#initialRadius * 0.8)
        this.#scene.add(ambientLight, keyLight, fillLight)

        const boardGroup = new THREE.Group()
        boardGroup.add(this.#buildBoardMesh())
        boardGroup.add(this.#buildBoardOutline())
        this.#groups.set('board', boardGroup)
        this.#rootGroup.add(boardGroup)

        const silkscreenGroup = new THREE.Group()
        this.#groups.set('silkscreen', silkscreenGroup)
        this.#rootGroup.add(silkscreenGroup)

        const copperGroup = new THREE.Group()
        this.#groups.set('copper', copperGroup)
        this.#rootGroup.add(copperGroup)

        const fallbackBodiesGroup = new THREE.Group()
        const externalModelsGroup = new THREE.Group()
        this.#sceneDescription.components.forEach((component) => {
            const fallbackBody = this.#buildFallbackBody(component)
            fallbackBodiesGroup.add(fallbackBody)
            PcbScene3dFallbackVisibility.registerFallbackRoot(
                this.#fallbackBodyRoots,
                component?.designator,
                fallbackBody
            )
        })
        this.#groups.set('fallback-bodies', fallbackBodiesGroup)
        this.#groups.set('external-models', externalModelsGroup)
        this.#rootGroup.add(fallbackBodiesGroup)
        this.#rootGroup.add(externalModelsGroup)

        const boardSpan = Math.max(board.widthMil, board.heightMil, 1)
        this.#scene.fog = new THREE.Fog(0xf4f0ea, boardSpan * 2.2, boardSpan * 7)
    }

    /**
     * Loads silkscreen, copper, and external model detail after the initial
     * frame has been rendered so the tab becomes interactive sooner.
     * @returns {Promise<void>}
     */
    async #loadDeferredDetail() {
        try {
            await PcbScene3dRuntime.#yieldToNextFrame()
            if (this.#isDisposed) {
                return
            }

            this.#loadDeferredSilkscreen()
            this.#render()

            await PcbScene3dRuntime.#yieldToNextFrame()
            if (this.#isDisposed) {
                return
            }

            this.#loadDeferredCopper()
            this.#applyToggleVisibility()
            this.#render()

            await PcbScene3dRuntime.#yieldToNextFrame()
            if (this.#isDisposed) {
                return
            }

            await this.#loadExternalModels()
            if (this.#isDisposed) {
                return
            }

            this.#render()
        } catch (error) {
            if (this.#isDisposed) {
                return
            }

            this.#hooks.setDiagnostics?.([
                'Deferred 3D detail could not finish loading: ' +
                    String(error?.message || error || 'Unknown error.')
            ])
        }
    }

    /**
     * Builds and attaches silkscreen detail once after the first frame.
     * @returns {void}
     */
    #loadDeferredSilkscreen() {
        const silkscreenGroup = this.#groups.get('silkscreen')
        if (!silkscreenGroup || silkscreenGroup.children.length) {
            return
        }

        const detailGroup = PcbScene3dSilkscreenFactory.buildGroup(
            this.#three,
            this.#sceneDescription.detail.silkscreen || {},
            this.#sceneDescription.board.thicknessMil / 2 + 1.18,
            -(this.#sceneDescription.board.thicknessMil / 2 + 1.18),
            (x, y) => this.#normalizeBoardPoint(x, y)
        )

        if (detailGroup.children.length) {
            silkscreenGroup.add(detailGroup)
        }
    }

    /**
     * Builds and attaches copper and via detail once after the first frame.
     * @returns {void}
     */
    #loadDeferredCopper() {
        const copperGroup = this.#groups.get('copper')
        if (!copperGroup || copperGroup.children.length) {
            return
        }

        const detailGroup = PcbScene3dCopperFactory.buildGroup(
            this.#three,
            this.#sceneDescription.detail || {},
            this.#sceneDescription.board.thicknessMil / 2 + 0.9,
            -(this.#sceneDescription.board.thicknessMil / 2 + 0.9),
            (x, y) => this.#normalizeBoardPoint(x, y)
        )
        const viaGroup = this.#buildViaMeshes()

        if (detailGroup.children.length) {
            copperGroup.add(detailGroup)
        }
        if (viaGroup.children.length) {
            copperGroup.add(viaGroup)
        }
    }

    /**
     * Builds the extruded board body mesh.
     * @returns {any}
     */
    #buildBoardMesh() {
        const THREE = this.#three
        const board = this.#sceneDescription.board
        const shape = PcbScene3dBoardShapeFactory.buildShape(
            THREE,
            board,
            this.#sceneDescription.detail,
            (x, y) => this.#normalizeBoardPoint(x, y)
        )
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: board.thicknessMil,
            bevelEnabled: false,
            curveSegments: 20
        })

        geometry.translate(0, 0, -board.thicknessMil / 2)
        const material = new THREE.MeshStandardMaterial({
            color: 0x2f6a2c,
            roughness: 0.68,
            metalness: 0.08
        })

        return new THREE.Mesh(geometry, material)
    }

    /**
     * Builds a line outline around the board edge.
     * @returns {any}
     */
    #buildBoardOutline() {
        const THREE = this.#three
        const shape = PcbScene3dBoardShapeFactory.buildShape(
            THREE,
            this.#sceneDescription.board,
            this.#sceneDescription.detail,
            (x, y) => this.#normalizeBoardPoint(x, y)
        )
        const points = shape.getPoints(120)
        const positions = []
        const topZ = this.#sceneDescription.board.thicknessMil / 2 + 0.8

        points.forEach((point) => {
            positions.push(point.x, point.y, topZ)
        })

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
        )

        return new THREE.LineLoop(
            geometry,
            new THREE.LineBasicMaterial({ color: 0xe6ebdd, transparent: true })
        )
    }

    /**
     * Builds simple through-board via meshes.
     * @returns {any}
     */
    #buildViaMeshes() {
        return PcbScene3dViaFactory.buildGroup(
            this.#three,
            this.#sceneDescription.detail.vias || [],
            this.#sceneDescription.board.thicknessMil,
            (x, y) => this.#normalizeBoardPoint(x, y)
        )
    }

    /**
     * Builds one procedural fallback body mesh.
     * @param {{ positionMil: { x: number, y: number, z: number }, rotationDeg: number, mountSide: string, body: { family: string, sizeMil: { width: number, depth: number, height: number } } }} component
     * @returns {any}
     */
    #buildFallbackBody(component) {
        const THREE = this.#three
        const family = component.body.family
        const size = component.body.sizeMil
        const material = new THREE.MeshStandardMaterial({
            color: PcbScene3dRuntime.#resolveBodyColor(family),
            roughness: 0.72,
            metalness: family === 'chip' ? 0.12 : 0.08
        })

        let mesh
        if (family === 'radial-capacitor' || family === 'test-point') {
            mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    size.width / 2,
                    size.width / 2,
                    size.height,
                    28
                ),
                material
            )
        } else {
            mesh = new THREE.Mesh(
                new THREE.BoxGeometry(size.width, size.depth, size.height),
                material
            )
        }

        const mountRig = PcbScene3dMountRig.create(THREE, component)
        const rootGroup = mountRig.rootGroup

        rootGroup.userData.scene3dSelection = {
            designator: String(component?.designator || 'component'),
            sourceType: 'component'
        }
        this.#registerSelectionRoot(component?.designator, rootGroup)
        mountRig.faceGroup.add(mesh)

        return rootGroup
    }

    /**
     * Attempts to load any resolved external 3D models.
     * @returns {Promise<void>}
     */
    async #loadExternalModels() {
        const externalModelsGroup = this.#groups.get('external-models')
        if (!externalModelsGroup) {
            return
        }

        const diagnostics = await PcbScene3dExternalModels.loadIntoScene({
            three: this.#three,
            sceneDescription: this.#sceneDescription,
            externalModelsGroup,
            isDisposed: () => this.#isDisposed,
            onPlacementGroup: (placement, placementGroup) => {
                this.#registerSelectionRoot(
                    placement?.designator,
                    placementGroup
                )
                PcbScene3dFallbackVisibility.markExternalModelLoaded(
                    this.#loadedExternalModelDesignators,
                    placement?.designator
                )
                this.#applyToggleVisibility()
            }
        })

        if (diagnostics.length) {
            this.#hooks.setDiagnostics?.(diagnostics)
        }
    }

    /**
     * Creates and configures orbit/pan/zoom controls using Three's standard
     * OrbitControls implementation in the same z-up world as the PCB scene.
     * @returns {void}
     */
    #createControls() {
        if (!this.#camera || !this.#renderer || !this.#orbitControlsClass) {
            return
        }

        const THREE = this.#three
        const domElement = this.#renderer?.domElement
        if (!domElement) {
            return
        }

        this.#controls = new this.#orbitControlsClass(this.#camera, domElement)
        this.#controls.enableDamping = false
        this.#controls.screenSpacePanning = true
        this.#controls.minDistance = 140
        this.#controls.maxDistance = this.#initialRadius * 8
        this.#controls.target.set(0, 0, 0)
        if (THREE?.MOUSE) {
            this.#controls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN
            }
        }

        PcbScene3dCameraRig.applyPreset(
            this.#camera,
            this.#controls,
            this.#presetState.get(),
            this.#sceneDescription
        )

        this.#bindListener(this.#controls, 'change', () => this.#render())
        this.#bindListener(domElement, 'contextmenu', (event) => {
            event.preventDefault?.()
        })
        this.#bindListener(window, 'resize', () => this.#handleResize())
    }

    /** @returns {void} */
    #bindSelectionInteraction() {
        if (!this.#renderer || !this.#camera || !this.#three) {
            return
        }

        this.#raycaster = new this.#three.Raycaster()
        this.#pointer = new this.#three.Vector2()
        const domElement = this.#renderer.domElement

        this.#bindListener(domElement, 'pointerdown', (event) => {
            if (Number(event?.button) !== 0) {
                return
            }

            this.#pointerDownPosition = {
                x: Number(event?.clientX || 0),
                y: Number(event?.clientY || 0)
            }
        })
        this.#bindListener(domElement, 'pointerup', (event) => {
            if (Number(event?.button) !== 0) {
                return
            }

            if (
                !this.#pointerDownPosition ||
                PcbScene3dRuntime.#resolvePointerTravel(
                    this.#pointerDownPosition,
                    {
                        x: Number(event?.clientX || 0),
                        y: Number(event?.clientY || 0)
                    }
                ) > 4
            ) {
                this.#pointerDownPosition = null
                return
            }

            this.#pointerDownPosition = null
            this.#handleSelectionPointer(event)
        })
    }

    /** @returns {void} */
    #handleResize() {
        if (!this.#renderer || !this.#camera) {
            return
        }

        const size = this.#resolveViewportSize()
        this.#renderer.setSize(size.width, size.height, false)
        this.#camera.aspect = size.width / size.height
        this.#camera.updateProjectionMatrix()
        this.#controls?.update?.()
        this.#render()
    }

    /** @returns {void} */
    #applyToggleVisibility() {
        const copperGroup = this.#groups.get('copper')
        const fallbackBodiesGroup = this.#groups.get('fallback-bodies')
        const externalModelsGroup = this.#groups.get('external-models')

        if (copperGroup) {
            copperGroup.visible = this.#toggles.copper
        }

        if (fallbackBodiesGroup) {
            fallbackBodiesGroup.visible = this.#toggles['fallback-bodies']
        }

        PcbScene3dFallbackVisibility.applyVisibility(
            this.#fallbackBodyRoots,
            this.#loadedExternalModelDesignators,
            this.#toggles
        )

        if (externalModelsGroup) {
            externalModelsGroup.visible = this.#toggles['external-models']
        }
    }

    /** @returns {void} */
    #render() {
        if (!this.#renderer || !this.#scene || !this.#camera) {
            return
        }

        this.#renderer.render(this.#scene, this.#camera)
    }

    /**
     * Settles the runtime-ready promise exactly once.
     * @returns {void}
     */
    #settleReady() {
        if (this.#hasSettledReady) {
            return
        }

        this.#hasSettledReady = true
        this.#resolveReadyPromise?.()
        this.#resolveReadyPromise = null
    }

    /**
     * Yields one turn so the browser can present the initial rendered frame
     * before deferred detail work continues.
     * @returns {Promise<void>}
     */
    static async #yieldToNextFrame() {
        if (
            typeof window !== 'undefined' &&
            typeof window.requestAnimationFrame === 'function'
        ) {
            await new Promise((resolve) => {
                window.requestAnimationFrame(() => resolve())
            })
            return
        }

        await new Promise((resolve) => {
            globalThis.setTimeout(resolve, 0)
        })
    }

    /**
     * Normalizes one board coordinate into the scene's centered board plane.
     * @param {number} x
     * @param {number} y
     * @returns {{ x: number, y: number }}
     */
    #normalizeBoardPoint(x, y) {
        return {
            x: Number(x || 0) - this.#sceneDescription.board.centerX,
            y: Number(y || 0) - this.#sceneDescription.board.centerY
        }
    }

    /**
     * Resolves the viewport size while guarding against zero-sized mounts.
     * @returns {{ width: number, height: number }}
     */
    #resolveViewportSize() {
        const rect = this.#viewportNode?.getBoundingClientRect?.()
        return {
            width: Math.max(Math.round(Number(rect?.width || 960)), 320),
            height: Math.max(Math.round(Number(rect?.height || 560)), 320)
        }
    }

    /**
     * Binds one runtime event listener for cleanup.
     * @param {EventTarget} node
     * @param {string} type
     * @param {(event: any) => void} listener
     * @returns {void}
     */
    #bindListener(node, type, listener) {
        node.addEventListener?.(type, listener, { passive: false })
        this.#listeners.push({ node, type, listener })
    }

    /**
     * Resolves one click selection from the current pointer event.
     * @param {{ clientX?: number, clientY?: number }} event
     * @returns {void}
     */
    #handleSelectionPointer(event) {
        if (
            !this.#raycaster ||
            !this.#pointer ||
            !this.#camera ||
            !this.#renderer
        ) {
            return
        }

        const rect = this.#renderer.domElement?.getBoundingClientRect?.()
        const width = Math.max(Number(rect?.width || 0), 1)
        const height = Math.max(Number(rect?.height || 0), 1)
        const left = Number(rect?.left || 0)
        const top = Number(rect?.top || 0)

        this.#pointer.x = ((Number(event?.clientX || 0) - left) / width) * 2 - 1
        this.#pointer.y =
            -(((Number(event?.clientY || 0) - top) / height) * 2 - 1)
        this.#raycaster.setFromCamera(this.#pointer, this.#camera)

        const selectableRoots = [
            this.#groups.get('external-models'),
            this.#groups.get('fallback-bodies')
        ].filter((group) => group && group.visible !== false)
        const intersections = this.#raycaster.intersectObjects(
            selectableRoots,
            true
        )
        const selection =
            PcbScene3dRuntime.#resolveSelectionFromIntersections(intersections)
        this.#setSelectedDesignator(selection?.designator)
        this.#hooks.setSelection?.(selection)
    }

    /** @param {string} designator @param {any} rootObject */
    #registerSelectionRoot(designator, rootObject) {
        PcbScene3dSelectionStyler.registerSelectionRoot(
            this.#selectionRoots,
            designator,
            rootObject
        )

        if (String(designator || '').trim() === this.#selectedDesignator) {
            PcbScene3dSelectionStyler.applySelection(
                this.#selectionRoots,
                '',
                this.#selectedDesignator,
                PcbScene3dRuntime.#resolveSelectionHighlightColor()
            )
        }
    }

    /** @param {string | undefined} designator */
    #setSelectedDesignator(designator) {
        const normalizedDesignator = String(designator || '').trim()
        if (normalizedDesignator === this.#selectedDesignator) {
            return
        }

        PcbScene3dSelectionStyler.applySelection(
            this.#selectionRoots,
            this.#selectedDesignator,
            normalizedDesignator,
            PcbScene3dRuntime.#resolveSelectionHighlightColor()
        )
        this.#selectedDesignator = normalizedDesignator
        this.#render()
    }

    /**
     * Loads the browser Three.js runtime modules used by the scene.
     * @returns {Promise<{ THREE: any, OrbitControls: any }>}
     */
    static async #loadThreeRuntimeModules() {
        const versionKey = new URL(import.meta.url).searchParams.get('v') || ''
        const suffix = versionKey ? '?v=' + encodeURIComponent(versionKey) : ''
        const [THREE, { OrbitControls }] = await Promise.all([
            import('/vendor/three/build/three.module.js' + suffix),
            import('/vendor/three/examples/jsm/controls/OrbitControls.js' + suffix)
        ])

        return { THREE, OrbitControls }
    }

    /**
     * Resolves the picked selection record from raycast intersections.
     * @param {{ object?: any }[]} intersections
     * @returns {{ designator?: string, sourceType?: string } | null}
     */
    static #resolveSelectionFromIntersections(intersections) {
        for (const intersection of intersections) {
            const selection =
                PcbScene3dRuntime.#resolveSelectionFromObject(
                    intersection?.object
                )
            if (selection) {
                return selection
            }
        }

        return null
    }

    /**
     * Resolves one selection payload by walking up a picked object tree.
     * @param {any} object
     * @returns {{ designator?: string, sourceType?: string } | null}
     */
    static #resolveSelectionFromObject(object) {
        let current = object

        while (current) {
            const selection = current?.userData?.scene3dSelection
            if (selection) {
                return selection
            }

            current = current.parent || null
        }

        return null
    }

    /** @returns {number} */
    static #resolveSelectionHighlightColor() {
        return 0x14c5e6
    }

    /**
     * Resolves the drag travel between two pointer positions.
     * @param {{ x: number, y: number }} start
     * @param {{ x: number, y: number }} end
     * @returns {number}
     */
    static #resolvePointerTravel(start, end) {
        const dx = Number(end?.x || 0) - Number(start?.x || 0)
        const dy = Number(end?.y || 0) - Number(start?.y || 0)
        return Math.hypot(dx, dy)
    }

    /**
     * Resolves a simple body color by package family.
     * @param {string} family
     * @returns {number}
     */
    static #resolveBodyColor(family) {
        if (family === 'radial-capacitor') {
            return 0xa60f10
        }

        if (family === 'connector-block') {
            return 0xd5d6da
        }

        if (family === 'test-point') {
            return 0x0ea5a8
        }

        if (family === 'chip') {
            return 0xf5f5ef
        }

        return 0x232428
    }

    /**
     * Clamps one numeric value.
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static #clamp(value, min, max) {
        return Math.min(Math.max(value, min), max)
    }
}
