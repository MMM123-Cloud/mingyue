/**
 * Splits a chat message into spoken dialogue and stage narration.
 *
 * Narration is written by the model as inline `*action*` spans or as whole lines
 * wrapped in full width / half width parentheses. The chat window renders the
 * narration outside the message bubble so actions read like stage directions
 * instead of being buried in the spoken text.
 */
export type NarrationSplit = {
    narration: string
    dialogue: string
}

const INLINE_ACTION = /\*+([^*\n]+?)\*+/g
const QUOTED_DIALOGUE = /[“"「『]([^”"」』\n]+)[”"」』]/g
const PAREN_LINE = /^[（(]\s*([\s\S]+?)\s*[）)]$/

export const splitNarration = (text?: string | null): NarrationSplit => {
    if (!text) return { narration: '', dialogue: '' }

    // Most models quote what the character says. When quotes are present they win: every
    // quoted span is speech, everything around it is stage narration.
    const quoted = [...text.matchAll(QUOTED_DIALOGUE)]
        .map((match) => match[1].trim())
        .filter(Boolean)
    if (quoted.length > 0) {
        const narration = text
            .replace(QUOTED_DIALOGUE, '\n')
            .replace(INLINE_ACTION, '$1')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join('\n')
        return { narration, dialogue: quoted.join('\n') }
    }

    const narration: string[] = []
    const dialogue: string[] = []

    for (const rawLine of text.split('\n')) {
        let line = rawLine.trim()
        if (!line) continue

        const paren = line.match(PAREN_LINE)
        if (paren) {
            const inner = paren[1].trim()
            if (inner) narration.push(inner)
            continue
        }

        const inline = [...line.matchAll(INLINE_ACTION)]
            .map((match) => match[1].trim())
            .filter(Boolean)
        if (inline.length) {
            narration.push(...inline)
            line = line.replace(INLINE_ACTION, '').trim()
        }

        if (!line) continue
        dialogue.push(line)
    }

    return {
        narration: narration.join('\n').trim(),
        dialogue: dialogue.join('\n').trim(),
    }
}
