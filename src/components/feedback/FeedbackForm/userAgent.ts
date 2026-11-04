/**
 * 識別文字列（User-Agent）から、OS とブラウザの名前と版を判定する（純粋関数）。
 *
 * 責務と処理概要:
 * - 識別文字列と `maxTouchPoints` だけから OS とブラウザを判定する。ブラウザの値は使わない。
 * - 利用元は `FeedbackForm/clientEnvironment.ts` だけのため、この部品の内側に置く（利用者の決定 U-3）。
 * - import を持たない。
 */

const UNKNOWN = "Unknown"

/** `10_15_7` のような区切りを `10.15.7` にする */
const dotted = (version: string): string => version.replace(/_/g, ".")

/**
 * 識別文字列から OS を判定する。
 *
 * 処理の趣旨:
 * - 上から順に最初に一致したものを使う。iPadOS 13 以降は Mac と同じ識別文字列を送るため、
 *   `Macintosh` で触れる点が2つ以上のときは iPadOS とみなす（版は識別文字列から分からない）。
 */
const detectOs = (ua: string, maxTouchPoints: number): string => {
    const ios = /(iPhone|iPad|iPod).*? OS (\d+(?:_\d+)*)/.exec(ua)
    if (ios) {
        return `${ios[1] === "iPad" ? "iPadOS" : "iOS"} ${dotted(ios[2])}`
    }
    if (/Macintosh/.test(ua) && maxTouchPoints > 1) return "iPadOS"
    const android = /Android (\d+(?:\.\d+)*)/.exec(ua)
    if (android) return `Android ${android[1]}`
    if (/Android/.test(ua)) return "Android"
    const windows = /Windows NT (\d+\.\d+)/.exec(ua)
    if (windows) {
        // Windows 11 も識別文字列は NT 10.0 のため、判定は userAgentData で補う
        return windows[1] === "10.0"
            ? "Windows 10/11"
            : `Windows NT ${windows[1]}`
    }
    const mac = /Mac OS X (\d+(?:[._]\d+)*)/.exec(ua)
    if (mac) return `macOS ${dotted(mac[1])}`
    if (/Macintosh/.test(ua)) return "macOS"
    if (/CrOS/.test(ua)) return "ChromeOS"
    if (/Linux/.test(ua)) return "Linux"
    return UNKNOWN
}

/** ブラウザの判定の規則。上から順に最初に一致したものを使う（Chrome を名乗る派生のブラウザを先に置く） */
const BROWSER_RULES: [RegExp, string][] = [
    [/EdgiOS\/([\d.]+)/, "Edge"],
    [/Edg(?:e|A)?\/([\d.]+)/, "Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
    [/FxiOS\/([\d.]+)/, "Firefox"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/CriOS\/([\d.]+)/, "Chrome"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/Version\/([\d.]+).*Safari\//, "Safari"],
]

const detectBrowser = (ua: string): string => {
    for (const [pattern, name] of BROWSER_RULES) {
        const match = pattern.exec(ua)
        if (match) return `${name} ${match[1]}`
    }
    if (/Safari\//.test(ua)) return "Safari"
    return UNKNOWN
}

/**
 * 識別文字列から OS とブラウザの名前と版を返す。
 *
 * Input:
 * - `ua`: `navigator.userAgent`
 * - `maxTouchPoints`: `navigator.maxTouchPoints`（iPadOS と macOS の判別に使う）
 *
 * Output:
 * - `{ os, browser }`。判定できない部分は "Unknown"
 *
 * 例:
 * - 入力: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) ... Version/18.1 Mobile/15E148 Safari/604.1"
 * - 出力: `{ os: "iOS 18.1", browser: "Safari 18.1" }`
 */
export const parseUserAgent = (
    ua: string,
    maxTouchPoints = 0,
): { os: string; browser: string } => ({
    os: detectOs(ua, maxTouchPoints),
    browser: detectBrowser(ua),
})
