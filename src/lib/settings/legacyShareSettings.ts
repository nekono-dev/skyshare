/**
 * 公開済みの旧共有設定を「自動ポップアップするSNS」へ引き継ぐ一時的なモジュール。
 *
 * 責務と処理概要:
 * - 旧設定（自動ポップアップをOFFにする／タイッツーにクロスポスト／Mastodonにクロスポスト／
 *   X投稿ボタンを表示）の localStorage 保存値から、新しい選択値を決めて保存し、旧キーを削除する。
 * - 利用者の移行が完了した時点で削除する前提のため、他のモジュールへの依存は
 *   `shareSettings.ts` の `readAutoPopupTargetSetting` 先頭からの呼び出し1か所に限る。
 *   削除する場合は、このファイルとテストを削除し、その呼び出し1行を消す。
 */
import type { AutoPopupTarget } from "@/lib/settings/shareSettings"

/** 旧設定の保存キー（このモジュールだけが知る）。 */
const LEGACY_KEYS = {
    noAutoPopupAfterPost: "noAutoPopupAfterPost",
    crosspostToTaittsuu: "crosspostToTaittsuu",
    crosspostToMastodon: "crosspostToMastodon",
    showCrosspostXButton: "showCrosspostXButton",
} as const

/** 新しい選択値の保存キー（`shareSettings.ts` の保存キーと同じ値）。 */
const AUTO_POPUP_TARGET_KEY = "autoPopupTarget"

export type LegacyShareSettings = {
    crosspostToTaittsuu: boolean
    crosspostToMastodon: boolean
    showCrosspostXButton: boolean
}

/**
 * 旧設定の値から、新しい「自動ポップアップするSNS」の選択値を決める。
 *
 * 処理の趣旨:
 * - タイッツーにクロスポスト・Mastodonにクロスポスト・X投稿ボタンを表示 のうち
 *   2つ以上がONなら「投稿時に選択する」。
 * - ちょうど1つだけONなら、そのSNS（タイッツー/Mastodon/X）。
 * - いずれもOFFなら既定の「X」。
 * - 「自動ポップアップをOFFにする」は判定に使わない（単独でONの場合は既定の「X」が
 *   対象になるため）。
 *
 * Input:
 * - `legacy`: 旧設定3項目の値
 *
 * Output:
 * - 引き継ぎ先の選択値
 *
 * 例:
 * - 入力: `{ crosspostToTaittsuu: true, crosspostToMastodon: true, showCrosspostXButton: false }`
 * - 出力: `"ask"`
 * - 入力: `{ crosspostToTaittsuu: true, crosspostToMastodon: false, showCrosspostXButton: false }`
 * - 出力: `"taittsuu"`
 */
export const deriveAutoPopupTarget = (
    legacy: LegacyShareSettings,
): AutoPopupTarget => {
    const enabledCount = [
        legacy.crosspostToTaittsuu,
        legacy.crosspostToMastodon,
        legacy.showCrosspostXButton,
    ].filter(enabled => enabled).length

    if (enabledCount >= 2) {
        return "ask"
    }
    if (legacy.crosspostToTaittsuu) {
        return "taittsuu"
    }
    if (legacy.crosspostToMastodon) {
        return "mastodon"
    }
    return "x"
}

/**
 * 旧設定を新しい選択値へ引き継ぎ、旧キーを削除する。
 *
 * 処理の趣旨:
 * - 旧キーがいずれも保存されていなければ何もしない。
 * - 新しい選択値が未保存の場合のみ、旧設定から決めた値を保存する（保存済みの値は上書きしない）。
 * - 新しい選択値が保存済み、または保存に成功した場合に限り旧キーを削除する。
 *   保存に失敗した場合は旧キーを残し、次回の読み取り時に再試行する。
 * - 副作用: localStorage の書き込み・削除。localStorage が使えない環境の例外は握りつぶす。
 *
 * Input:
 * - なし
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: localStorage に `crosspostToTaittsuu=true`
 * - 出力: `autoPopupTarget=taittsuu` を保存し、旧キー4つを削除
 */
export const migrateLegacyShareSettings = (): void => {
    if (typeof window === "undefined") {
        return
    }

    try {
        const storage = window.localStorage
        const legacyValues = Object.values(LEGACY_KEYS).map(key =>
            storage.getItem(key),
        )
        if (legacyValues.every(value => value === null)) {
            return
        }

        if (storage.getItem(AUTO_POPUP_TARGET_KEY) === null) {
            const target = deriveAutoPopupTarget({
                crosspostToTaittsuu:
                    storage.getItem(LEGACY_KEYS.crosspostToTaittsuu) === "true",
                crosspostToMastodon:
                    storage.getItem(LEGACY_KEYS.crosspostToMastodon) === "true",
                showCrosspostXButton:
                    storage.getItem(LEGACY_KEYS.showCrosspostXButton) ===
                    "true",
            })
            storage.setItem(AUTO_POPUP_TARGET_KEY, target)
        }

        Object.values(LEGACY_KEYS).forEach(key => storage.removeItem(key))
    } catch (error) {
        // localStorage が使えない・書き込みに失敗した場合は旧キーを残したまま終了する。
    }
}
