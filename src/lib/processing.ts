import type { Analysis, Diagnostic } from './document'
import type { ProcessRequest, ProcessResult } from './process'

type Pending = { request: ProcessRequest; resolve: (result: ProcessResult) => void }
type WorkerFactory = () => Worker

export function createProcessor(factory: WorkerFactory = () => new Worker(new URL('./process.worker.ts', import.meta.url), { type: 'module' })): {
  run(request: ProcessRequest): Promise<ProcessResult>; cancel(): void; dispose(): void
} {
  let worker: Worker | undefined
  let pending: Pending[] = []
  let disposed = false
  const fallback = (request: ProcessRequest, message: string): ProcessResult => ({ analysis: {
    revision: request.revision, bytes: new TextEncoder().encode(request.source).length, valid: false, depth: 0, nodes: 0,
    diagnostics: [{ kind: 'syntax', message, offset: 0, line: 1, column: 1 } satisfies Diagnostic]
  } as Analysis })
  const terminate = (message: string) => {
    if (worker) { worker.onmessage = null; worker.onerror = null }
    worker?.terminate(); worker = undefined
    for (const item of pending.splice(0)) item.resolve(fallback(item.request, message))
  }
  const ensure = () => {
    if (worker) return worker
    worker = factory()
    worker.onmessage = event => {
      const revision = (event.data as ProcessResult).analysis.revision
      const index = pending.findIndex(item => item.request.revision === revision)
      const item = index < 0 ? undefined : pending.splice(index, 1)[0]
      if (item) item.resolve(event.data as ProcessResult)
    }
    worker.onerror = event => terminate(`JSON worker failed: ${event.message || 'unknown error'}`)
    return worker
  }
  return {
    run(request) {
      if (disposed) return Promise.resolve(fallback(request, 'JSON processor has been disposed'))
      return new Promise(resolve => {
        const item: Pending = { request, resolve }
        pending.push(item)
        try { ensure().postMessage(request) } catch (error) { terminate(`Unable to start JSON worker: ${String(error)}`) }
      })
    },
    cancel() { terminate('JSON processing cancelled') },
    dispose() { disposed = true; terminate('JSON processing cancelled') }
  }
}
