/**
 * 作成した Skyshare Entry を API 応答の `skyshareEntry` フィールド用に整形する。
 *
 * - `lib/api` を参照しないのは、`lib/api` からの循環依存を避けるため。
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
