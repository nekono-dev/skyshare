/**
 * 返信可能ユーザー設定(threadgate)・引用許可設定(postgate)の
 * デフォルト値永続化ユーティリティ。
 *
 * 責務と処理概要:
 * - PostForm/Settingsが参照する `PostGateValue` のデフォルト値を localStorage で管理する。
 * - 「投稿後にデフォルト値を更新するか」トグルの状態も同様に管理する。
 * - SSR/プライベートモードなどで localStorage が利用不可でも安全に既定値へフォールバックする
 *   （`shareSettings.ts`/`hashtagHistorySettings.ts` と同じ方針）。
 */

import {
    DEFAULT_POST_GATE_VALUE,
    type PostGateValue,
    type ReplyAudience,
} from "@/lib/atproto/gate"

const POST_GATE_DEFAULT_KEY = "postGateDefault"
const SYNC_GATE_DEFAULT_AFTER_POST_KEY = "syncGateDefaultAfterPost"

const REPLY_AUDIENCES: ReplyAudience[] = ["everyone", "nobody", "custom"]

/**
 * localStorageから読み取った値が `PostGateValue` として妥当な形状かを検証する。
 *
 * 想定する入力形状:
 * - `JSON.parse` の戻り値（型不明の `unknown`）
 *
 * Input:
 * - `value`: 検証対象
 *
 * Output:
 * - 妥当な形状なら `true`
 */
const isValidPostGateValue = (value: unknown): value is PostGateValue => {
    if (!value || typeof value !== "object") return false
    const v = value as Record<string, unknown>
    return (
        typeof v.replyAudience === "string" &&
        REPLY_AUDIENCES.includes(v.replyAudience as ReplyAudience) &&
        typeof v.allowMentioned === "boolean" &&
        typeof v.allowFollower === "boolean" &&
        typeof v.allowFollowing === "boolean" &&
        Array.isArray(v.listUris) &&
        v.listUris.every(uri => typeof uri === "string") &&
        typeof v.allowQuote === "boolean"
    )
}

/**
 * 返信・引用設定のデフォルト値を localStorage から読み取る。
 *
 * 処理の趣旨:
 * - 未設定/JSON破損/形状不正のいずれの場合も `DEFAULT_POST_GATE_VALUE`
 *   （誰でも返信可能・引用許可）へフォールバックする。
 *
 * Input:
 * - なし
 *
 * Output:
 * - 保存済みのデフォルト値。未設定/失敗時は `DEFAULT_POST_GATE_VALUE`
 *
 * 例:
 * - 入力: 未設定
 * - 出力: `DEFAULT_POST_GATE_VALUE`
 */
export const readPostGateDefaultSetting = (): PostGateValue => {
    if (typeof window === "undefined") return DEFAULT_POST_GATE_VALUE

    try {
        const raw = window.localStorage.getItem(POST_GATE_DEFAULT_KEY)
        if (!raw) return DEFAULT_POST_GATE_VALUE

        const parsed: unknown = JSON.parse(raw)
        if (!isValidPostGateValue(parsed)) return DEFAULT_POST_GATE_VALUE

        return parsed
    } catch {
        return DEFAULT_POST_GATE_VALUE
    }
}

/**
 * 返信・引用設定のデフォルト値を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したいデフォルト値
 *
 * Output:
 * - なし
 */
export const writePostGateDefaultSetting = (value: PostGateValue): void => {
    if (typeof window === "undefined") return

    try {
        window.localStorage.setItem(
            POST_GATE_DEFAULT_KEY,
            JSON.stringify(value),
        )
    } catch {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}

/**
 * 指定した値が既定のデフォルト値（誰でも返信可能・引用許可）と一致するかを判定する。
 *
 * 処理の趣旨:
 * - PostFormの「返信・引用」ボタンの表示切り替え（デフォルトから変更されているか）に使う。
 *
 * Input:
 * - `value`: 判定対象の値
 *
 * Output:
 * - 既定のデフォルト値と一致すれば `true`
 *
 * 例:
 * - 入力: `DEFAULT_POST_GATE_VALUE`
 * - 出力: `true`
 */
export const isDefaultPostGateValue = (value: PostGateValue): boolean => {
    return (
        value.replyAudience === DEFAULT_POST_GATE_VALUE.replyAudience &&
        value.allowMentioned === DEFAULT_POST_GATE_VALUE.allowMentioned &&
        value.allowFollower === DEFAULT_POST_GATE_VALUE.allowFollower &&
        value.allowFollowing === DEFAULT_POST_GATE_VALUE.allowFollowing &&
        value.listUris.length === 0 &&
        value.allowQuote === DEFAULT_POST_GATE_VALUE.allowQuote
    )
}

/**
 * 「投稿後に返信・引用のデフォルト設定を更新するか」設定を localStorage から読み取る。
 *
 * Input:
 * - `defaultValue`: localStorage が利用できない場合や未設定時に返す既定値
 *
 * Output:
 * - 保存済み設定値。未設定/失敗時は `defaultValue`
 *
 * 例:
 * - 入力: `false`
 * - 出力: `true`（保存済み値が true の場合）
 */
export const readSyncGateDefaultAfterPostSetting = (
    defaultValue: boolean,
): boolean => {
    if (typeof window === "undefined") return defaultValue

    try {
        const rawValue = window.localStorage.getItem(
            SYNC_GATE_DEFAULT_AFTER_POST_KEY,
        )
        if (rawValue === null) return defaultValue
        return rawValue === "true"
    } catch {
        return defaultValue
    }
}

/**
 * 「投稿後に返信・引用のデフォルト設定を更新するか」設定を localStorage に保存する。
 *
 * Input:
 * - `value`: 保存したい設定値
 *
 * Output:
 * - なし
 */
export const writeSyncGateDefaultAfterPostSetting = (value: boolean): void => {
    if (typeof window === "undefined") return

    try {
        window.localStorage.setItem(
            SYNC_GATE_DEFAULT_AFTER_POST_KEY,
            String(value),
        )
    } catch {
        // 保存失敗時は UI 動作を優先し、例外を握りつぶす。
    }
}
