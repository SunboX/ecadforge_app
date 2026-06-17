import { LocalFileSelectionCollector } from './LocalFileSelectionCollector.mjs'

/**
 * Binds local file and folder intake controls for AppView.
 */
export class AppViewLocalFileBinder {
    /**
     * Binds local intake inputs.
     * @param {{ fileInput?: HTMLInputElement | null, folderInput?: HTMLInputElement | null, windowRef?: Window | object | null, callback: (files: File[]) => void }} options Binding options.
     * @returns {void}
     */
    static bind(options) {
        AppViewLocalFileBinder.#bindFileInput(options)
        AppViewLocalFileBinder.#bindFolderInput(options)
    }

    /**
     * Binds the normal file picker.
     * @param {{ fileInput?: HTMLInputElement | null, windowRef?: Window | object | null, callback: (files: File[]) => void }} options Binding options.
     * @returns {void}
     */
    static #bindFileInput(options) {
        options.fileInput?.addEventListener('change', async () => {
            if (!options.fileInput?.files?.length) return

            const selectedFiles = [...options.fileInput.files]
            options.fileInput.value = ''
            options.callback(
                await LocalFileSelectionCollector.collectFileInputSelection(
                    selectedFiles,
                    { windowRef: options.windowRef || globalThis }
                )
            )
        })
    }

    /**
     * Binds the directory picker.
     * @param {{ folderInput?: HTMLInputElement | null, windowRef?: Window | object | null, callback: (files: File[]) => void }} options Binding options.
     * @returns {void}
     */
    static #bindFolderInput(options) {
        options.folderInput?.addEventListener('click', async (event) => {
            const windowRef = options.windowRef || globalThis
            if (typeof windowRef?.showDirectoryPicker !== 'function') return

            event.preventDefault()
            const selectedFiles =
                await LocalFileSelectionCollector.collectFolderInputSelection({
                    windowRef
                })
            if (selectedFiles.length) {
                options.callback(selectedFiles)
            }
        })

        options.folderInput?.addEventListener('change', () => {
            if (!options.folderInput?.files?.length) return

            options.callback([...options.folderInput.files])
            options.folderInput.value = ''
        })
    }
}
