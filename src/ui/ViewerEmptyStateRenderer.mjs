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
                        <svg
                            class="icon icon--sample-kicad"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <g
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M3.75 7.5a2 2 0 0 1 2-2h4.55l1.9 2.05h6.05a2 2 0 0 1 2 2v8.75a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2V7.5Z" />
                                <rect x="7.35" y="10.2" width="9.3" height="6.35" rx="1.25" />
                                <path d="M9.3 12.2h2.55" />
                                <path d="M13.95 12.2h1.1" />
                                <circle cx="12.8" cy="12.2" r="0.8" />
                                <path d="M9.3 14.55h2.05l1.15-1.15h2.55" />
                                <circle cx="15.05" cy="13.4" r="0.65" />
                            </g>
                        </svg>
                        Try KiCad sample
                    </button>
                    <button
                        type="button"
                        class="file-pill file-pill--altium"
                        data-demo-id="altium"
                    >
                        <svg
                            class="icon icon--sample-altium"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <g
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M7.25 3.75h6.25l4.75 4.85v11.15a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2Z" />
                                <path d="M13.35 3.95v4.8h4.65" />
                                <path d="M8.7 11.8h3.25" />
                                <path d="M14.4 11.8h1.95" />
                                <circle cx="13.15" cy="11.8" r="1.1" />
                                <path d="M9.15 16.25h3.05l1.65-2.1h2.55" />
                                <circle cx="8.35" cy="16.25" r="0.75" />
                                <circle cx="17.2" cy="14.15" r="0.75" />
                            </g>
                        </svg>
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
