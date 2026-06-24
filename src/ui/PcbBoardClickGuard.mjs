import { SvgDragClickGuard } from './SvgDragClickGuard.mjs'

/**
 * Suppresses synthetic board clicks that follow SVG drag panning.
 */
export class PcbBoardClickGuard extends SvgDragClickGuard {}
