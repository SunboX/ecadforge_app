/**
 * Renders the landing-state prompt shown inside the inactive viewer panel.
 */
export class ViewerEmptyStateRenderer {
    /**
     * Renders the empty viewer markup.
     * @returns {string}
     */
    static render() {
        return `
            <section class="viewer-empty">
                <figure class="viewer-empty__mark" aria-hidden="true">
                    <span class="viewer-empty__spark viewer-empty__spark--teal"></span>
                    <span class="viewer-empty__spark viewer-empty__spark--orange"></span>
                    <span class="viewer-empty__spark viewer-empty__spark--blue"></span>
                    <span class="viewer-empty__screen">
                        <svg
                            class="viewer-empty__trace"
                            viewBox="0 0 96 58"
                            aria-hidden="true"
                        >
                            <circle class="viewer-empty__trace-node" cx="18" cy="28" r="3" />
                            <polyline
                                class="viewer-empty__trace-line"
                                points="20 28 37 28 52 17 76 39"
                            />
                            <circle class="viewer-empty__trace-node" cx="76" cy="39" r="3" />
                        </svg>
                    </span>
                    <span class="viewer-empty__plus" aria-hidden="true"></span>
                </figure>
                <h3>Drop a design file here or start with a sample project</h3>
                <p>
                    Supports .SchDoc, .PcbDoc, .PrjPcb, .kicad_pro and
                    .kicad_pcb. Your files stay on your device.
                </p>
                <div class="viewer-empty__actions">
                    <button
                        type="button"
                        class="file-pill file-pill--kicad"
                        data-demo-id="kicad"
                    >
                        Try KiCad sample
                    </button>
                    <button
                        type="button"
                        class="file-pill file-pill--altium"
                        data-demo-id="altium"
                    >
                        Try Altium sample
                    </button>
                    <label
                        class="file-pill file-pill--ghost"
                        for="fileInput"
                        data-local-open
                    >
                        Open local files
                    </label>
                </div>
            </section>
        `
    }
}
