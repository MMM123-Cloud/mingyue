import { StreamParser } from '../lib/engine/StreamParser'

test('preserves SSE events split at every possible character boundary', () => {
    const source = 'data: {"text":"明月 🌙"}\r\n\r\ndata: {"text":"继续"}\n\ndata: [DONE]\n\n'
    for (let cut = 0; cut <= source.length; cut++) {
        const parser = new StreamParser()
        expect([
            ...parser.push(source.slice(0, cut)),
            ...parser.push(source.slice(cut), true),
        ]).toEqual(['{"text":"明月 🌙"}', '{"text":"继续"}'])
    }
})

test('handles multi-line events, keepalives, NDJSON and final unterminated data', () => {
    const parser = new StreamParser()
    expect(parser.push(': heartbeat\ndata: one\ndata: two\n\n{"a":1}\n{"b":', false)).toEqual([
        'one\ntwo',
        '{"a":1}',
    ])
    expect(parser.push('2}\ndata: final', true)).toEqual(['{"b":2}', 'final'])
})
