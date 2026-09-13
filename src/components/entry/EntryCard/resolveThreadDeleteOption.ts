/**
 * entry所有者向け削除確認ダイアログで「スレッド全体を削除」の選択肢を出し分けるための
 * 判定ロジック（`specs/entry/frontend/design.md §3.4`）。
 *
 * 責務と処理概要:
 * - `sourceUri`を起点に`app.bsky.feed.getPostThread`（公開API、未認証で呼べる）で
 *   reply chainを取得し、entry所有者自身の後続投稿のみを直線的に辿る
 *   （`extractOwnedLinearReplyChain`、entry/backendのスレッド削除・entry詳細ページの
 *   スレッド表示と共通のロジック）。
 * - `sourceUri`のrepo（DID）自体がentry所有者のDIDと一致するため、追加のセッション取得は
 *   不要（`sourceUri`は常に呼び出し者自身のentryのsourceであり、`/v2/entries/skyshare`が
 *   Cookie認証済みで自分のentryのみを返すため）。
 */
import { AppBskyFeedDefs } from "@atproto/api"
import { publicAtpAgent } from "@/lib/atproto/publicAgent"
import { extractOwnedLinearReplyChain } from "@/lib/atproto/threadChain"
import { MAX_THREAD_POST_COUNT } from "@/lib/atproto/threadLimit"
import { parseAtUri } from "@/lib/entry/url"

/**
 * `sourceUri`が指すBluesky投稿を起点に、entry所有者自身の後続投稿が実際に存在するか
 * （＝「スレッド全体を削除」の選択肢を表示すべきか）を判定する。
 *
 * Input:
 * - `sourceUri`: entryの`source`投稿のAT URI
 *
 * Output:
 * - 後続の自己投稿が1件以上存在する（抽出結果が2件以上）なら`true`、
 *   単発投稿（後続投稿なし）や取得失敗時は`false`
 */
export const resolveThreadDeleteOption = async (
    sourceUri: string,
): Promise<boolean> => {
    const parsedSourceUri = parseAtUri(sourceUri)
    if (!parsedSourceUri) return false

    try {
        const res = await publicAtpAgent.app.bsky.feed.getPostThread({
            uri: sourceUri,
            depth: MAX_THREAD_POST_COUNT,
        })
        if (!AppBskyFeedDefs.isThreadViewPost(res.data.thread)) return false

        const chain = extractOwnedLinearReplyChain(
            res.data.thread,
            parsedSourceUri.repo,
            MAX_THREAD_POST_COUNT,
        )
        return chain.length > 1
    } catch (err) {
        console.error("EntryCard: failed to resolve thread delete option", err)
        return false
    }
}
