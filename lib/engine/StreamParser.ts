/** Incremental SSE/NDJSON parser. Network chunks are not event boundaries. */
export class StreamParser {
    private pending = ''
    private eventData: string[] = []

    push(chunk: string, final = false): string[] {
        this.pending += chunk
        const output: string[] = []
        const emit = () => {
            if (this.eventData.length === 0) return
            const data = this.eventData.join('\n')
            this.eventData = []
            if (data !== '[DONE]') output.push(data)
        }
        const line = (value: string) => {
            if (value === '') return emit()
            if (value.startsWith(':')) return
            if (value.startsWith('data:')) {
                this.eventData.push(value.slice(5).replace(/^ /, ''))
            } else if (value.startsWith('{')) {
                try {
                    JSON.parse(value)
                    output.push(value)
                } catch {
                    /* Ignore malformed NDJSON records. */
                }
            }
        }
        let match: RegExpExecArray | null
        while ((match = /\r\n|\r|\n/.exec(this.pending))) {
            if (!final && match[0] === '\r' && match.index === this.pending.length - 1) break
            line(this.pending.slice(0, match.index))
            this.pending = this.pending.slice(match.index + match[0].length)
        }
        if (final) {
            if (this.pending) line(this.pending)
            this.pending = ''
            emit()
        }
        return output
    }
}
