import { EcadParserService } from '../core/ecad/EcadParserService.mjs'

globalThis.addEventListener('message', async (event) => {
    const payload = event?.data || {}
    if (payload.type !== 'parse:file' && payload.type !== 'parse:entries') {
        return
    }

    try {
        const result =
            payload.type === 'parse:entries'
                ? await EcadParserService.parseEntries(payload.entries || [])
                : await EcadParserService.parseEntries([
                      {
                          name: String(payload.fileName || 'document'),
                          buffer: payload.buffer
                      }
                  ])

        globalThis.postMessage({
            type: 'parser:success',
            requestId: String(payload.requestId || ''),
            ...result
        })
    } catch (error) {
        globalThis.postMessage({
            type: 'parser:error',
            requestId: String(payload.requestId || ''),
            message:
                error instanceof Error ? error.message : 'Parser worker failed.'
        })
    }
})
