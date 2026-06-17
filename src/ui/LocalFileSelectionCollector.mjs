import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'

/**
 * Collects local file-input selections plus optional browser directory assets.
 */
export class LocalFileSelectionCollector {
    /**
     * Expands a normal file-picker selection with one optional KiCad companion
     * directory when the browser exposes the File System Access API.
     * @param {File[]} files Files selected from the native file picker.
     * @param {{ windowRef?: Window | { showDirectoryPicker?: (options?: object) => Promise<any> } | null }} [options] Browser integration options.
     * @returns {Promise<File[]>}
     */
    static async collectFileInputSelection(files, options = {}) {
        const selectedFiles = LocalFileSelectionCollector.#array(files)
        if (
            !LocalFileSelectionCollector.#shouldRequestCompanionDirectory(
                selectedFiles
            )
        ) {
            return selectedFiles
        }

        const windowRef = options.windowRef || globalThis
        if (typeof windowRef?.showDirectoryPicker !== 'function') {
            return selectedFiles
        }

        try {
            const directoryHandle = await windowRef.showDirectoryPicker({
                id: 'kicad-companion-assets',
                mode: 'read'
            })
            const companionFiles =
                await LocalFileSelectionCollector.#collectCompanionFiles(
                    directoryHandle
                )

            return LocalFileSelectionCollector.#dedupeFiles([
                ...selectedFiles,
                ...companionFiles
            ])
        } catch {
            return selectedFiles
        }
    }

    /**
     * Collects supported ECAD files from a browser-selected directory handle.
     * @param {{ windowRef?: Window | { showDirectoryPicker?: (options?: object) => Promise<any> } | null }} [options] Browser integration options.
     * @returns {Promise<File[]>}
     */
    static async collectFolderInputSelection(options = {}) {
        const windowRef = options.windowRef || globalThis
        if (typeof windowRef?.showDirectoryPicker !== 'function') {
            return []
        }

        try {
            const directoryHandle = await windowRef.showDirectoryPicker({
                id: 'local-project-folder',
                mode: 'read'
            })
            return LocalFileSelectionCollector.#collectDirectoryFiles(
                directoryHandle,
                [],
                LocalFileSelectionCollector.#isSupportedFolderFile
            )
        } catch {
            return []
        }
    }

    /**
     * Returns true when selected files are KiCad documents that may reference
     * local symbol, footprint, or 3D model folders.
     * @param {File[]} files Selected files.
     * @returns {boolean}
     */
    static #shouldRequestCompanionDirectory(files) {
        return files.some((file) => {
            const role = EcadFormatRegistry.resolveNativeRole(file?.name)
            return role?.sourceFormat === 'kicad'
        })
    }

    /**
     * Recursively collects supported companion files from a directory handle.
     * @param {any} directoryHandle Browser directory handle.
     * @param {string[]} [pathParts] Path parts relative to the chosen folder.
     * @returns {Promise<File[]>}
     */
    static async #collectCompanionFiles(directoryHandle, pathParts = []) {
        return LocalFileSelectionCollector.#collectDirectoryFiles(
            directoryHandle,
            pathParts,
            EcadFormatRegistry.isCompanionAsset
        )
    }

    /**
     * Recursively collects files from a directory handle.
     * @param {any} directoryHandle Browser directory handle.
     * @param {string[]} pathParts Path parts relative to the chosen folder.
     * @param {(fileName: string) => boolean} shouldIncludeFile File predicate.
     * @returns {Promise<File[]>}
     */
    static async #collectDirectoryFiles(
        directoryHandle,
        pathParts,
        shouldIncludeFile
    ) {
        const files = []

        for await (const [
            entryName,
            entryHandle
        ] of LocalFileSelectionCollector.#entries(directoryHandle)) {
            if (entryHandle?.kind === 'directory') {
                files.push(
                    ...(await LocalFileSelectionCollector.#collectDirectoryFiles(
                        entryHandle,
                        [...pathParts, entryName],
                        shouldIncludeFile
                    ))
                )
                continue
            }

            if (entryHandle?.kind !== 'file') continue

            const file = await entryHandle.getFile()
            if (!shouldIncludeFile(file?.name)) continue

            files.push(
                LocalFileSelectionCollector.#withRelativePath(
                    file,
                    LocalFileSelectionCollector.#joinPath([
                        ...pathParts,
                        file.name
                    ])
                )
            )
        }

        return files
    }

    /**
     * Returns true when a directory file is useful local ECAD input.
     * @param {string} fileName File name.
     * @returns {boolean}
     */
    static #isSupportedFolderFile(fileName) {
        return (
            EcadFormatRegistry.isNativeDocument(fileName) ||
            EcadFormatRegistry.isCompanionAsset(fileName)
        )
    }

    /**
     * Reads directory entries from modern and older Chromium-compatible handles.
     * @param {any} directoryHandle Browser directory handle.
     * @returns {AsyncGenerator<[string, any]>}
     */
    static async *#entries(directoryHandle) {
        if (typeof directoryHandle?.entries === 'function') {
            yield* directoryHandle.entries()
            return
        }

        if (typeof directoryHandle?.values === 'function') {
            for await (const entryHandle of directoryHandle.values()) {
                yield [String(entryHandle?.name || ''), entryHandle]
            }
        }
    }

    /**
     * Wraps a File with a path relative to the user-selected companion folder.
     * @param {File} file Browser file.
     * @param {string} relativePath Path relative to the chosen directory.
     * @returns {File}
     */
    static #withRelativePath(file, relativePath) {
        return {
            name: String(file?.name || relativePath.split('/').pop() || ''),
            webkitRelativePath: relativePath,
            size: Number(file?.size || 0),
            type: String(file?.type || ''),
            lastModified: Number(file?.lastModified || 0),
            arrayBuffer: () => file.arrayBuffer(),
            stream:
                typeof file?.stream === 'function'
                    ? () => file.stream()
                    : undefined,
            text:
                typeof file?.text === 'function'
                    ? () => file.text()
                    : undefined,
            slice:
                typeof file?.slice === 'function'
                    ? (...args) => file.slice(...args)
                    : undefined,
            sourceFile: file
        }
    }

    /**
     * Deduplicates files by browser relative path or file name.
     * @param {File[]} files Files to dedupe.
     * @returns {File[]}
     */
    static #dedupeFiles(files) {
        const deduped = new Map()

        for (const file of files) {
            const key = String(
                file?.webkitRelativePath || file?.name || ''
            ).toLowerCase()
            if (key) {
                deduped.set(key, file)
            }
        }

        return [...deduped.values()]
    }

    /**
     * Joins untrusted path parts into a browser-style relative path.
     * @param {string[]} pathParts Path parts.
     * @returns {string}
     */
    static #joinPath(pathParts) {
        return pathParts
            .flatMap((part) =>
                String(part || '')
                    .replaceAll('\\', '/')
                    .split('/')
            )
            .filter(Boolean)
            .join('/')
    }

    /**
     * Normalizes an optional file array.
     * @param {File[] | null | undefined} files Files.
     * @returns {File[]}
     */
    static #array(files) {
        return Array.isArray(files) ? files : []
    }
}
