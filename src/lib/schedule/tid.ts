/**
 * レコードキー用の atproto TID 形式の値を採番する。
 *
 * - 53-bit のマイクロ秒時刻と 10-bit のクロック識別子を使い、前回値より大きい 13 文字の Base32 値を返す。
 * - Cron から使うため `@atproto/*` を読み込まず、Workers Free の CPU 上限 10 ms を守る。
 */

const ALPHABET = "234567abcdefghijklmnopqrstuvwxyz"
// Workers ではグローバルスコープで乱数を生成できないため、最初の採番のときに決める
let clockId: number | undefined

const encode = (value: bigint): string => {
    let out = ""
    for (let i = 12; i >= 0; i--) {
        out += ALPHABET[Number((value >> BigInt(i * 5)) & 31n)]
    }
    return out
}

const decodeTimestamp = (tid: string): bigint => {
    let value = 0n
    for (const ch of tid) {
        const idx = ALPHABET.indexOf(ch)
        if (idx < 0) throw new Error("invalid TID")
        value = (value << 5n) | BigInt(idx)
    }
    return value >> 10n
}

export const nextTid = (prev?: string): string => {
    let timestamp = BigInt(Date.now()) * 1000n
    if (prev) {
        const last = decodeTimestamp(prev)
        if (timestamp <= last) timestamp = last + 1n
    }
    clockId ??= crypto.getRandomValues(new Uint16Array(1))[0]! & 0x3ff
    return encode((timestamp << 10n) | BigInt(clockId))
}
