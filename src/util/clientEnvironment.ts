/**
 * ブラウザの実行環境（OS・ブラウザ・ホーム画面からの起動か）の判定。
 *
 * 責務と処理概要:
 * - 識別文字列（User-Agent）から OS とブラウザの名前と版を判定する（純粋関数）。
 * - `display-mode` のメディアクエリと iOS の `navigator.standalone` から、ホーム画面に追加した
 *   アプリ（PWA）として起動しているかを判定する。
 * - Chromium 系の `navigator.userAgentData` があれば、凍結された識別文字列では分からない値
 *   （Windows 11 か、ブラウザの詳しい版）で判定を補う。
 * - ドメインの知識を持たない汎用の処理（不具合の報告に添える環境の情報の収集に使う）。
 */

export type ClientEnvironment = {
    os: string
    browser: string
    userAgent: string
    /** ホーム画面から起動したか（PWA） */
    standalone: boolean
}

/** `navigator.userAgentData` の、この処理が使う部分の形 */
type UserAgentData = {
    brands?: { brand: string; version: string }[]
    platform?: string
    getHighEntropyValues?: (hints: string[]) => Promise<{
        platform?: string
        platformVersion?: string
        fullVersionList?: { brand: string; version: string }[]
    }>
}

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

/**
 * ホーム画面に追加したアプリ（PWA）として起動しているかを判定する。
 *
 * Input:
 * - `win`: 判定に使う `window`（`matchMedia` と `navigator` を読む）
 *
 * Output:
 * - `display-mode` が standalone・fullscreen・minimal-ui のいずれかか、
 *   iOS の `navigator.standalone` が true なら true
 */
export const detectStandalone = (win: Window): boolean => {
    const modes = ["standalone", "fullscreen", "minimal-ui"]
    const byMedia = modes.some(
        mode =>
            typeof win.matchMedia === "function" &&
            win.matchMedia(`(display-mode: ${mode})`).matches,
    )
    const nav = win.navigator as Navigator & { standalone?: boolean }
    return byMedia || nav.standalone === true
}

/**
 * userAgentData の高精度の値で、識別文字列の判定を補う。
 *
 * 処理の趣旨:
 * - Windows は `platformVersion` の先頭が13以上なら 11、それ未満なら 10 とする。
 * - ブラウザは、"Not A Brand" のような偽の銘柄と、派生ブラウザが併記する "Chromium" を除いた
 *   最初の銘柄と、その詳しい版を使う。
 *
 * Output:
 * - 補った `{ os, browser }`。取得に失敗したら `base` をそのまま返す
 */
const refineWithUserAgentData = async (
    data: UserAgentData,
    base: { os: string; browser: string },
): Promise<{ os: string; browser: string }> => {
    if (typeof data.getHighEntropyValues !== "function") return base
    try {
        const values = await data.getHighEntropyValues([
            "platformVersion",
            "fullVersionList",
        ])
        let { os, browser } = base
        if (values.platform === "Windows" && values.platformVersion) {
            const major = Number(values.platformVersion.split(".")[0])
            os = major >= 13 ? "Windows 11" : "Windows 10"
        }
        const brands = (values.fullVersionList ?? []).filter(
            entry => !/not.?a.?brand/i.test(entry.brand),
        )
        const brand =
            brands.find(entry => entry.brand !== "Chromium") ?? brands[0]
        if (brand) {
            const name = brand.brand.replace(/^Google |^Microsoft /, "")
            browser = `${name} ${brand.version}`
        }
        return { os, browser }
    } catch {
        return base
    }
}

/**
 * 実行中のブラウザの環境の情報を集める。
 *
 * Input:
 * - `win`: 対象の `window`
 *
 * Output:
 * - `ClientEnvironment`。userAgentData があれば高精度の値で補う
 *
 * 例:
 * - 入力: Windows 11 の Chrome の `window`
 * - 出力: `{ os: "Windows 11", browser: "Chrome 141.0.7390.55", userAgent: "...", standalone: false }`
 */
export const collectClientEnvironment = async (
    win: Window,
): Promise<ClientEnvironment> => {
    const nav = win.navigator as Navigator & { userAgentData?: UserAgentData }
    const userAgent = nav.userAgent
    const base = parseUserAgent(userAgent, nav.maxTouchPoints ?? 0)
    const refined = nav.userAgentData
        ? await refineWithUserAgentData(nav.userAgentData, base)
        : base
    return { ...refined, userAgent, standalone: detectStandalone(win) }
}
