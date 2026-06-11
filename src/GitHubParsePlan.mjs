import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'

/**
 * Builds prioritized parser batches for GitHub project deep links.
 */
export class GitHubParsePlan {
    /**
     * Builds initial and deferred parser entry batches.
     * @param {{ name?: string, buffer?: ArrayBuffer }[]} entries Source entries.
     * @param {string} preferredDocumentPath Requested document path.
     * @returns {{ initialEntries: object[], deferredEntries: object[], prioritized: boolean }}
     */
    static build(entries, preferredDocumentPath) {
        const sourceEntries = Array.isArray(entries) ? entries : []
        const preferredEntry = GitHubParsePlan.#findPreferredEntry(
            sourceEntries,
            preferredDocumentPath
        )
        if (!preferredEntry) {
            return {
                initialEntries: sourceEntries,
                deferredEntries: [],
                prioritized: false
            }
        }

        const projectEntries = sourceEntries.filter((entry) =>
            GitHubParsePlan.#isProjectEntry(entry)
        )
        const initialEntries = GitHubParsePlan.#dedupeEntries([
            ...projectEntries,
            preferredEntry
        ])
        const initialKeys = new Set(
            initialEntries.map((entry) =>
                GitHubParsePlan.#normalizePath(entry?.name)
            )
        )
        const deferredEntries = GitHubParsePlan.#dedupeEntries([
            ...projectEntries,
            ...sourceEntries.filter(
                (entry) =>
                    !initialKeys.has(
                        GitHubParsePlan.#normalizePath(entry?.name)
                    )
            )
        ])

        return {
            initialEntries,
            deferredEntries,
            prioritized: deferredEntries.length > 0
        }
    }

    /**
     * Removes documents that are already present in app state.
     * @param {{ documents?: object[], assets?: object[], diagnostics?: object[], project?: object | null }} parseResult Parser result.
     * @param {{ documentModel?: object }[]} existingDocuments Existing state documents.
     * @returns {{ documents: object[], assets: object[], diagnostics: object[], project: object | null }}
     */
    static filterNewDocuments(parseResult, existingDocuments) {
        const existingPaths = new Set(
            (existingDocuments || [])
                .map((entry) =>
                    GitHubParsePlan.#normalizePath(
                        entry?.documentModel?.fileName
                    )
                )
                .filter(Boolean)
        )

        return {
            documents: (parseResult?.documents || []).filter((document) => {
                const path = GitHubParsePlan.#normalizePath(document?.fileName)
                return !path || !existingPaths.has(path)
            }),
            assets: Array.isArray(parseResult?.assets)
                ? parseResult.assets
                : [],
            diagnostics: Array.isArray(parseResult?.diagnostics)
                ? parseResult.diagnostics
                : [],
            project: parseResult?.project || null
        }
    }

    /**
     * Finds the requested document entry by normalized path.
     * @param {object[]} entries Source entries.
     * @param {string} preferredDocumentPath Requested document path.
     * @returns {object | null}
     */
    static #findPreferredEntry(entries, preferredDocumentPath) {
        const preferredPath = GitHubParsePlan.#normalizePath(
            preferredDocumentPath
        )
        if (!preferredPath) return null

        return (
            entries.find((entry) =>
                GitHubParsePlan.#pathsMatch(
                    GitHubParsePlan.#normalizePath(entry?.name),
                    preferredPath
                )
            ) || null
        )
    }

    /**
     * Returns true when two normalized paths describe the same entry.
     * @param {string} entryPath Source entry path.
     * @param {string} preferredPath Requested path.
     * @returns {boolean}
     */
    static #pathsMatch(entryPath, preferredPath) {
        return (
            entryPath === preferredPath ||
            entryPath.endsWith('/' + preferredPath) ||
            preferredPath.endsWith('/' + entryPath)
        )
    }

    /**
     * Returns true for project manifest entries that provide parser context.
     * @param {object} entry Source entry.
     * @returns {boolean}
     */
    static #isProjectEntry(entry) {
        const name = String(entry?.name || '')
        const nativeRole = EcadFormatRegistry.resolveNativeRole(name)
        return (
            nativeRole?.fileType === 'kicad_pro' ||
            EcadFormatRegistry.resolveCompanionFormat(name) === 'altium-project'
        )
    }

    /**
     * Deduplicates entries by normalized path while preserving order.
     * @param {object[]} entries Source entries.
     * @returns {object[]}
     */
    static #dedupeEntries(entries) {
        const seen = new Set()
        const deduped = []

        for (const entry of entries || []) {
            const path = GitHubParsePlan.#normalizePath(entry?.name)
            if (!path || seen.has(path)) continue
            seen.add(path)
            deduped.push(entry)
        }

        return deduped
    }

    /**
     * Normalizes a project-relative path for comparisons.
     * @param {unknown} value Path-like value.
     * @returns {string}
     */
    static #normalizePath(value) {
        return String(value || '')
            .trim()
            .replaceAll('\\', '/')
            .replace(/\/+/gu, '/')
            .toLowerCase()
    }
}
