/**
 * 「自動ポップアップするSNS」設定の既定値・判定・読み書きを扱う。
 *
 * 責務と処理概要:
 * - 自動ポップアップ先の既定値、値の判定、localStorage への読み書きを提供する。
 * - `AUTO_POPUP_TARGETS`・`AutoPopupTarget` は `lib/share/autoPopupTarget` の定義を import して使うだけで、このファイルからは再エクスポートしない。
 */
import {
    AUTO_POPUP_TARGETS,
    type AutoPopupTarget,
} from "@/lib/share/autoPopupTarget"

const AUTO_POPUP_TARGET_KEY = "autoPopupTarget"

/** 「自動ポップアップするSNS」が未設定の場合に使う既定値。 */
export const DEFAULT_AUTO_POPUP_TARGET: AutoPopupTarget = "x"

/**
 * 値が `AutoPopupTarget` かを判定する。
 *
 * Input:
 * - `value`: 判定対象（外部入力を想定。文字列以外も受け付ける）
 *
 * Output:
 * - `AUTO_POPUP_TARGETS` のいずれかなら `true`
 *
 * 例:
 * - 入力: `"taittsuu"`
 * - 出力: `true`
 */
export const isAutoPopupTarget = (value: unknown): value is AutoPopupTarget =>
    AUTO_POPUP_TARGETS.some(target => target === value)

/**
 * 「自動ポップアップするSNS」設定を localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合・未設定時・不正な値の場合に返す既定値
 *
 * Output:
 * - 保存済み設定値。未設定/不正/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `"x"`
 * - 出力: `"taittsuu"`（保存済み値が taittsuu の場合）
 */
export const readAutoPopupTargetSetting = (
    defaultValue: AutoPopupTarget,
): AutoPopupTarget => {
    if (typeof window === "undefined") {
        return defaultValue
    }

    try {
        const rawValue = window.localStorage.getItem(AUTO_POPUP_TARGET_KEY)
        return isAutoPopupTarget(rawValue) ? rawValue : defaultValue
    } catch (error) {
        return defaultValue
    }
}

/**
 * 「自動ポップアップするSNS」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし（保存失敗時は UI 動作を優先し、例外を握りつぶす）
 *
 * 例:
 * - 入力: `"ask"`
 * - 出力: localStorage に `autoPopupTarget=ask` を保存
 */
export const writeAutoPopupTargetSetting = (value: AutoPopupTarget) => {
    if (typeof window === "undefined") {
        return
    }

    try {
        window.localStorage.setItem(AUTO_POPUP_TARGET_KEY, value)
    } catch (error) {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}
