import { describe, expect, it } from 'vitest'
import { processSource } from './process'

const request = (source: string, operation: 'analyze' | 'format' | 'minify' = 'analyze') => ({ revision: 7, source, operation })

describe('processSource', () => {
  it('formats without changing numeric or string token spelling and minifies reversibly', () => {
    const source = String.raw`{"n":1.2300,"s":"\u0061"}`
    const formatted = processSource(request(source, 'format')).source
    expect(formatted).toBe('{\n  "n": 1.2300,\n  "s": "\\u0061"\n}')
    expect(processSource(request(formatted!, 'minify')).source).toBe(source)
  })
  it('analyzes strict JSON roots and reports bytes/depth/nodes', () => {
    const result = processSource(request('null'))
    expect(result.analysis).toMatchObject({ revision: 7, bytes: 4, valid: true, depth: 0, nodes: 1 })
    expect(processSource(request('"é"')).analysis.bytes).toBe(4)
  })
  it('rejects deeply nested input at preflight without entering recursive parsing', () => {
    const source = `${'['.repeat(10_000)}0${']'.repeat(10_000)}`
    expect(() => processSource(request(source))).not.toThrow()
    expect(processSource(request(source)).analysis).toMatchObject({
      valid: false,
      diagnostics: [{ kind: 'syntax', message: 'JSON exceeds safe processing limits' }]
    })
  })
  it.each(['', '{"a":}', '{"a":1,}', '//x\n{}', 'NaN', 'Infinity'])('rejects invalid strict JSON %j', source => {
    expect(processSource(request(source)).analysis).toMatchObject({ valid: false, diagnostics: [{ kind: 'syntax', line: expect.any(Number), column: expect.any(Number) }] })
    expect(processSource(request(source, 'format')).source).toBeUndefined()
  })
  it('reports decoded duplicate keys and rejects editor-unsafe duplicate trees', () => {
    const source = String.raw`{"a":1,"\u0061":2}`
    const result = processSource(request(source))
    expect(result.analysis).toMatchObject({ valid: false, diagnostics: [{ kind: 'duplicate' }] })
    expect(processSource(request(source, 'format')).source).toBeUndefined()
  })
  it('rejects __proto__ duplicate keys as a safe tree while retaining syntax validity', () => {
    const result = processSource(request('{"__proto__":1,"__proto__":2}'))
    expect(result.analysis).toMatchObject({ valid: false, diagnostics: [{ kind: 'duplicate' }] })
  })
  it('preserves huge numbers, exponent, negative zero, nested/string punctuation, unicode and numeric-looking keys', () => {
    const source = String.raw`{"01":9007199254740993123,"e":1e+09,"z":-0,"s":"{\"x\"}\\n","é":true}`
    const formatted = processSource(request(source, 'format')).source!
    for (const token of ['9007199254740993123', '1e+09', '-0', String.raw`"{\"x\"}\\n"`, '"é"']) expect(formatted).toContain(token)
  })
})
