/**
 * クライアント側の表示言語ストア。
 *
 * 責務と処理概要:
 * - 現在の表示言語をモジュール状態として保持し、購読者（React の `useSyncExternalStore`）へ通知する。
 * - Astro の各 island は別々の React ルートだが、同一バンドル内のモジュールは共有されるため、
 *   このストアひとつで全 island の言語が同期する。
 * - 言語が変わるたびに `<html lang>` と `.astro` の静的DOMを更新する。
 * - 別タブでの言語設定の変更（`storage` イベント）にも追従する。
 * - ブラウザ専用。サーバーでは `getLocale` を呼ばない（React 側は `getServerSnapshot` で既定言語を返す）。
 */
import { applyDomTranslations } from "./applyDom"
import {
    DEFAULT_LOCALE,
    resolveLocale,
    type Locale,
    type LocaleSetting,
} from "./locale"
import {
    LOCALE_SETTING_KEY,
    readLocaleSetting,
    writeLocaleSetting,
} from "./localeSetting"

let current: Locale = DEFAULT_LOCALE
const listeners = new Set<() => void>()

/**
 * 現在の表示言語を返す。
 *
 * Output:
 * - 初期化前は既定言語
 */
export const getLocale = (): Locale => current

/**
 * 言語変更の購読を登録する（`useSyncExternalStore` の subscribe 用）。
 *
 * Output:
 * - 購読解除関数
 */
export const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/**
 * 保存済み設定とブラウザ言語から、現在の表示言語を求める。
 *
 * Output:
 * - 保存値があればその言語。`system` ならブラウザ言語（一致なしは既定言語）
 */
const resolveCurrentLocale = (): Locale => {
    const setting = readLocaleSetting()
    return resolveLocale(
        setting === "system" ? undefined : setting,
        navigator.languages ?? [],
    )
}

/**
 * 表示言語を確定し、`<html lang>`・静的DOMを更新して購読者へ通知する。
 *
 * 処理の趣旨:
 * - `force` が偽で値が変わらない場合は何もしない。強制時（初期化・ページ遷移後）は
 *   値が同じでも DOM を更新する（サーバーが別の言語で描画している場合があるため）。
 *
 * Input:
 * - `locale`: 確定する言語
 * - `force`: 値が同じでも DOM を更新するか
 */
const commit = (locale: Locale, force: boolean): void => {
    const changed = locale !== current
    if (!changed && !force) return
    current = locale
    document.documentElement.lang = locale
    applyDomTranslations(locale)
    if (changed) listeners.forEach(listener => listener())
}

/**
 * ブラウザの状態から表示言語を決め直して反映する。
 * 初回ロードと、ページ遷移（`astro:page-load`）のたびに呼ぶ。
 */
export const syncLocaleFromBrowser = (): void => {
    commit(resolveCurrentLocale(), true)
}

/**
 * 言語設定を保存し、即座に表示へ反映する。
 *
 * Input:
 * - `setting`: `ja`/`en`/`system`
 *
 * 例:
 * - 入力: `"en"` → localStorage に保存し、全文言が英語へ切り替わる
 */
export const setLocaleSetting = (setting: LocaleSetting): void => {
    writeLocaleSetting(setting)
    commit(resolveCurrentLocale(), true)
}

if (typeof window !== "undefined") {
    syncLocaleFromBrowser()
    document.addEventListener("astro:page-load", syncLocaleFromBrowser)
    // 別タブで言語設定が変更された場合（localStorage の変更は他タブへ storage イベントで届く）にも
    // 追従する。`key === null` は localStorage 全体のクリア。
    window.addEventListener("storage", event => {
        if (event.key === LOCALE_SETTING_KEY || event.key === null) {
            syncLocaleFromBrowser()
        }
    })
}
