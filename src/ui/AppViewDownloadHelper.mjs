/**
 * Handles browser download creation for app-generated binary artifacts.
 */
export class AppViewDownloadHelper {
    /**
     * Downloads bytes through a temporary browser anchor.
     * @param {Document} documentRef Browser document.
     * @param {string} fileName Download file name.
     * @param {Uint8Array} bytes Download bytes.
     * @param {string} [contentType] MIME content type.
     * @returns {void}
     */
    static downloadBytes(
        documentRef,
        fileName,
        bytes,
        contentType = 'application/octet-stream'
    ) {
        if (typeof Blob !== 'function' || typeof URL === 'undefined') return

        const url = URL.createObjectURL(
            new Blob([bytes], { type: contentType })
        )
        const anchor = documentRef.createElement('a')
        anchor.href = url
        anchor.download = fileName || 'download.bin'
        anchor.style.display = 'none'

        try {
            documentRef.body?.appendChild(anchor)
            anchor.click()
        } finally {
            anchor.remove()
            URL.revokeObjectURL(url)
        }
    }
}
