import { GitSourceUrlResolver } from './GitSourceUrlResolver.mjs'

/**
 * Resolves hosted Git repository metadata before root-folder discovery.
 */
export class GitProjectRootSourceLoader {
    /**
     * Resolves repository metadata into a concrete root-folder source.
     * @param {object} source Hosted Git source descriptor.
     * @param {(url: string) => Promise<Response>} fetcher Fetch dependency.
     * @returns {Promise<object>} Concrete folder source.
     */
    static async resolve(source, fetcher) {
        if (!source?.metadataApiUrl) return source

        const providerLabel = GitSourceUrlResolver.getProviderLabel(source)
        if (typeof fetcher !== 'function') {
            throw new Error(
                providerLabel + ' URL loading is not available here.'
            )
        }

        let response
        try {
            response = await fetcher(source.metadataApiUrl)
        } catch (_error) {
            throw new Error(
                'Could not fetch the ' +
                    providerLabel +
                    ' project metadata. The request may be blocked by the network or browser CORS policy.'
            )
        }

        if (!response?.ok) {
            throw new Error(
                providerLabel +
                    ' returned HTTP ' +
                    String(response?.status || 0) +
                    ' for the requested project.'
            )
        }

        let payload
        try {
            payload = await response.json()
        } catch (_error) {
            throw new Error(
                'Could not read the ' + providerLabel + ' project metadata.'
            )
        }

        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new Error(
                'The ' +
                    providerLabel +
                    ' project metadata response is invalid.'
            )
        }

        return GitSourceUrlResolver.resolveProjectRootSource(
            source,
            payload.default_branch
        )
    }
}
