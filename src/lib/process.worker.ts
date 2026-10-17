import { processSource, type ProcessRequest } from './process'

self.onmessage = (event: MessageEvent<ProcessRequest>) => {
  try { self.postMessage(processSource(event.data)) }
  catch (error) {
    const { revision, source } = event.data
    self.postMessage({ analysis: { revision, bytes: new TextEncoder().encode(source).length, valid: false,
      diagnostics: [{ kind: 'syntax', message: error instanceof Error ? error.message : 'Processing failed', offset: 0, line: 1, column: 1 }], depth: 0, nodes: 0 } })
  }
}
