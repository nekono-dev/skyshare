/**
 * Entry の応答の形（DTO）への整形
 *
 * 責務:
 * - `CreatedSkyshareEntry` を、レスポンス JSON の `skyshareEntry` フィールド用の形へ変換する。
 *
 * 注意:
 * - `lib/api` は参照しない（`lib/api` が `lib/entry` を参照する循環を避けるため）。
 *   応答の形が api の推論型に代入できることは、ページの型注釈付きの代入で確かめる。
 */
import type { CreatedSkyshareEntry } from "@/lib/entry/skyshareRecord"

/**
 * レスポンスの `skyshareEntry` フィールドの形。
 *
 * 処理の趣旨:
 * - クライアントが作成直後にフルリロード無しで削除ボタン等を出し分けられるよう、
 *   AT URI を含む詳細情報を持つ。
 */
export type EntrySummaryDto = {
    uri: string
    atUri: string
    cid: string
    createdAt: string
    sourceUri: string
    sourceCid: string
    heading: string | undefined
    caption: string | undefined
    visualUrl: string | undefined
}

/**
 * `CreatedSkyshareEntry` をレスポンス（`skyshareEntry` フィールド）用の形へ変換する（純粋関数）。
 *
 * 処理の趣旨:
 * - クライアントが作成直後にフルリロード無しで削除ボタン等を出し分けられるよう、
 *   AT URI を含む詳細情報を含める。
 *
 * Input:
 * - `entry`: `createBskyThread`/`createEntryFromExistingPost` が返した詳細情報
 *
 * Output:
 * - レスポンス JSON のトップレベル `skyshareEntry` フィールド値
 */
export const toEntrySummary = (
    entry: CreatedSkyshareEntry,
): EntrySummaryDto => ({
    uri: entry.webUrl,
    atUri: entry.atUri,
    cid: entry.cid,
    createdAt: entry.createdAt,
    sourceUri: entry.sourceUri,
    sourceCid: entry.sourceCid,
    heading: entry.heading,
    caption: entry.caption,
    visualUrl: entry.visualUrl,
})
