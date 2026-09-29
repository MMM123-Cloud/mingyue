import { fetch } from 'expo/fetch'

import { Logger } from '@lib/state/Logger'
import { StreamParser } from './StreamParser'
type SSEValues = {
    endpoint: string
    method: 'POST' | 'GET'
    body: string
    headers: any
}

export class SSEFetch {
    private abortController: AbortController = new AbortController()
    private decoder = new TextDecoder()
    private parser = new StreamParser()
    private onEvent = (data: string) => {}
    private onError = () => {}
    private onClose = () => {}
    private closeStream = () => {}
    private cancelled = false
    public abort() {
        try {
            this.cancelled = true
            this.abortController.abort()
        } catch {
        } finally {
            this.closeStream()
            this.closeStream = () => {
                this.cancelled = true
            }
        }
    }

    public async start(values: SSEValues) {
        this.abortController = new AbortController()
        const body = values.method === 'POST' ? { body: values.body } : {}
        this.cancelled = false
        this.decoder = new TextDecoder()
        this.parser = new StreamParser()
        try {
            const res = await fetch(values.endpoint, {
                signal: this.abortController.signal,
                method: values.method,
                headers: values.headers,
                ...body,
            })
            if (!res.ok || !res.body) {
                Logger.error('Status ' + res.status)
                // Do not log response bodies which may contain credentials or private prompts.
                return this.onError()
            }
            const reader = res.body.getReader()
            this.closeStream = () => {
                try {
                    void reader.cancel().catch(() => undefined)
                    this.cancelled = true
                } catch {}
            }
            while (true) {
                const { value, done } = await reader.read()
                if (this.cancelled) break
                const data = this.decoder.decode(value, { stream: !done })
                this.parser.push(data, done).forEach((item) => this.onEvent(item))
                if (done) break
            }
        } catch (e) {
            if (this.abortController.signal.aborted) {
                Logger.debug('Abort caught')
            }
            if (!this.abortController.signal.aborted) {
                Logger.error('Request Failed: ' + e)
                this.onError()
            }
        } finally {
            this.closeStream()
            this.onClose()
        }
    }

    public setOnEvent(callback: (data: string) => void) {
        this.onEvent = callback
    }

    public setOnError(callback: () => void) {
        this.onError = callback
    }

    public setOnClose(callback: () => void) {
        this.onClose = callback
    }
}
