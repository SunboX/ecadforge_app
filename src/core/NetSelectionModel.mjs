import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/renderers'

/**
 * Resolves schematic and PCB net selection state shared by sidebar and views.
 */
export class NetSelectionModel {
    /**
     * Returns a stable net key for state and DOM events.
     * @param {any} net Net metadata or net name.
     * @param {number} index Net index.
     * @returns {string}
     */
    static resolveNetKey(net, index = 0) {
        if (typeof net === 'string') {
            return String(net || '').trim()
        }

        return String(
            net?.name ??
                net?.netName ??
                net?.net ??
                net?.label ??
                net?.net_name ??
                'Net ' + (index + 1)
        ).trim()
    }

    /**
     * Resolves the selected net key for one document.
     * @param {{ [documentId: string]: string }} selectedNets Selection map.
     * @param {string} documentId Active document id.
     * @returns {string}
     */
    static resolveSelectedKey(selectedNets, documentId) {
        return String(selectedNets?.[documentId] || '').trim()
    }

    /**
     * Applies one net selection to a selection map.
     * @param {{ [documentId: string]: string }} selectedNets Current map.
     * @param {string} documentId Target document id.
     * @param {string} netName Target net name.
     * @returns {{ [documentId: string]: string }}
     */
    static withSelection(selectedNets, documentId, netName) {
        const normalizedDocumentId = String(documentId || '').trim()
        const normalizedNetName = String(netName || '').trim()
        const next = NetSelectionModel.cloneMap(selectedNets)
        if (!normalizedDocumentId) {
            return next
        }

        if (normalizedNetName) {
            next[normalizedDocumentId] = normalizedNetName
            return next
        }

        delete next[normalizedDocumentId]
        return next
    }

    /**
     * Applies one net selection across compatible open documents.
     * @param {{ [documentId: string]: string }} selectedNets Current map.
     * @param {{ id: string, documentModel: any }[]} documents Open documents.
     * @param {string} documentId Target document id.
     * @param {string} netName Target net name.
     * @param {string} [clearKey] Previously selected key for deselection.
     * @returns {{ [documentId: string]: string }}
     */
    static withSessionSelection(
        selectedNets,
        documents,
        documentId,
        netName,
        clearKey = ''
    ) {
        const targetDocumentId = String(documentId || '').trim()
        const normalizedNetName = String(netName || '').trim()
        const normalizedClearKey = String(clearKey || '').trim()
        const next = NetSelectionModel.cloneMap(selectedNets)

        if (!normalizedNetName) {
            Object.keys(next).forEach((entryDocumentId) => {
                if (
                    entryDocumentId === targetDocumentId ||
                    NetSelectionModel.isSameNetKey(
                        next[entryDocumentId],
                        normalizedClearKey
                    )
                ) {
                    delete next[entryDocumentId]
                }
            })
            return next
        }

        for (const entry of documents || []) {
            const entryDocumentId = String(entry?.id || '').trim()
            if (!entryDocumentId) {
                continue
            }

            const compatibleNetName = NetSelectionModel.resolveDocumentNetKey(
                entry?.documentModel,
                normalizedNetName
            )
            if (entryDocumentId === targetDocumentId) {
                next[entryDocumentId] = compatibleNetName || normalizedNetName
                continue
            }

            if (compatibleNetName) {
                next[entryDocumentId] = compatibleNetName
                continue
            }

            delete next[entryDocumentId]
        }

        return next
    }

    /**
     * Returns true when two net keys identify the same logical net.
     * @param {string} left First net key.
     * @param {string} right Second net key.
     * @returns {boolean}
     */
    static isSameNetKey(left, right) {
        const leftKey = NetSelectionModel.#comparisonKey(left)
        const rightKey = NetSelectionModel.#comparisonKey(right)
        return Boolean(leftKey && rightKey && leftKey === rightKey)
    }

    /**
     * Clones a selected-net map.
     * @param {{ [documentId: string]: string }} selectedNets Selection map.
     * @returns {{ [documentId: string]: string }}
     */
    static cloneMap(selectedNets) {
        return Object.fromEntries(
            Object.entries(selectedNets || {})
                .map(([documentId, netName]) => [
                    String(documentId || '').trim(),
                    String(netName || '').trim()
                ])
                .filter(([documentId, netName]) =>
                    Boolean(documentId && netName)
                )
        )
    }

    /**
     * Returns net names present in known document model locations.
     * @param {any} documentModel Document model.
     * @returns {string[]}
     */
    static resolveDocumentNetNames(documentModel) {
        return [
            ...new Set(
                [
                    ...NetSelectionModel.#explicitNetNames(documentModel),
                    ...NetSelectionModel.#primitiveNetNames(documentModel),
                    ...NetSelectionModel.#interactionPrimitiveNetNames(
                        documentModel
                    )
                ].filter(Boolean)
            )
        ]
    }

    /**
     * Returns true when a document contains the selected net key.
     * @param {any} documentModel Document model.
     * @param {string} netName Net key.
     * @returns {boolean}
     */
    static documentHasNetKey(documentModel, netName) {
        return Boolean(
            NetSelectionModel.resolveDocumentNetKey(documentModel, netName)
        )
    }

    /**
     * Resolves the document-local net key that matches a requested net name.
     * @param {any} documentModel Document model.
     * @param {string} netName Requested net key.
     * @returns {string}
     */
    static resolveDocumentNetKey(documentModel, netName) {
        const normalized = String(netName || '').trim()
        if (!normalized) return ''

        return (
            NetSelectionModel.resolveDocumentNetNames(documentModel).find(
                (candidate) =>
                    NetSelectionModel.isSameNetKey(candidate, normalized)
            ) || ''
        )
    }

    /**
     * Returns declared net names from schematic and PCB net arrays.
     * @param {any} documentModel Document model.
     * @returns {string[]}
     */
    static #explicitNetNames(documentModel) {
        return [
            ...(Array.isArray(documentModel?.nets) ? documentModel.nets : []),
            ...(Array.isArray(documentModel?.schematic?.nets)
                ? documentModel.schematic.nets
                : []),
            ...(Array.isArray(documentModel?.pcb?.nets)
                ? documentModel.pcb.nets
                : [])
        ].map((net, index) => NetSelectionModel.resolveNetKey(net, index))
    }

    /**
     * Returns net names from routed PCB primitive metadata.
     * @param {any} documentModel Document model.
     * @returns {string[]}
     */
    static #primitiveNetNames(documentModel) {
        const pcb = documentModel?.pcb || {}
        const collections = [
            pcb.tracks,
            pcb.arcs,
            pcb.vias,
            pcb.pads,
            pcb.fills,
            pcb.regions,
            pcb.polygons,
            pcb.zones
        ]

        return collections
            .flatMap((items) => (Array.isArray(items) ? items : []))
            .map((item) => NetSelectionModel.#primitiveNetName(item))
            .filter(Boolean)
    }

    /**
     * Returns net names from the shared PCB primitive model.
     * @param {any} documentModel Document model.
     * @returns {string[]}
     */
    static #interactionPrimitiveNetNames(documentModel) {
        try {
            return PcbInteractionPrimitiveModel.build(documentModel).nets.map(
                (net, index) => NetSelectionModel.resolveNetKey(net, index)
            )
        } catch (_error) {
            return []
        }
    }

    /**
     * Returns one primitive's net name.
     * @param {any} primitive PCB primitive.
     * @returns {string}
     */
    static #primitiveNetName(primitive) {
        return String(
            primitive?.netName ??
                primitive?.net ??
                primitive?.name ??
                primitive?.label ??
                primitive?.net_name ??
                ''
        ).trim()
    }

    /**
     * Normalizes net names for cross-document comparison.
     * @param {string} netName Net name.
     * @returns {string}
     */
    static #comparisonKey(netName) {
        return String(netName || '')
            .trim()
            .replace(/^\/+/, '')
            .toLowerCase()
    }
}
