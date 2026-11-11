/**
 * ブラウザの表示モードと識別情報から、報告フォーム用の実行環境を集める。
 *
 * - Chromium 系の `navigator.userAgentData` で、凍結された識別文字列では分からない値
 *   （Windows 11 か、ブラウザの詳しい版）を補う。取得に失敗したら識別文字列の判定を使う。
 * - ブラウザの読み取りを行うため、この部品の内側に置く。純粋な判定は `./userAgent` にある。
 */
import type { ClientEnvironment } from "@/types/clientEnvironment"
import { parseUserAgent } from "./userAgent"

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
