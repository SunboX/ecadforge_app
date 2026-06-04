/**
 * Viewport sizing helpers for the 3D runtime.
 */
export class PcbScene3dViewportResize {
    /**
     * Observes element-level viewport size changes.
     * @param {typeof globalThis} globalRef Runtime global object.
     * @param {HTMLElement | null} viewportNode Viewport mount node.
     * @param {() => void} onResize Resize callback.
     * @returns {{ disconnect?: () => void } | null}
     */
    static observe(globalRef, viewportNode, onResize) {
        const ResizeObserverCtor = globalRef?.ResizeObserver
        if (typeof ResizeObserverCtor !== 'function' || !viewportNode) {
            return null
        }

        const observer = new ResizeObserverCtor(() => onResize())
        observer.observe(viewportNode)
        return observer
    }

    /**
     * Resolves the viewport size while guarding against zero-sized mounts.
     * @param {HTMLElement | null} viewportNode Viewport mount node.
     * @returns {{ width: number, height: number }}
     */
    static resolveSize(viewportNode) {
        const rect = viewportNode?.getBoundingClientRect?.()
        return {
            width: Math.max(Math.round(Number(rect?.width || 960)), 320),
            height: Math.max(Math.round(Number(rect?.height || 560)), 320)
        }
    }
}
