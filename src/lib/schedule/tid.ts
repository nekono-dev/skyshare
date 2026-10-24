/**
 * レコードキーに使う TID（Timestamp Identifier）の採番。
 *
 * 責務と処理概要:
 * - 53 ビットのマイクロ秒の時刻と 10 ビットのクロック識別子から、13 文字の
 *   Base32 ソート可能な文字列を作る。atproto の TID と同じ形式。
 * - 直前の TID 以下の値を返さない（同じマイクロ秒でも単調に増える）。
 * - atproto のライブラリを読み込まない（無料枠の CPU 時間を守るため）。
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
