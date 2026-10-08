/**
 * `app.bsky.feed.getPostThread`が返す `ThreadViewPost` から、投稿者自身が投稿した
 * 後続投稿のみを直線的に辿って時系列順に抽出する共通ロジック。
 *
 * 責務と処理概要:
 * - Timeline一覧のスレッドグルーピング（`specs/timeline-api`）、
 *   entry削除時のスレッド全体削除対象の導出（`specs/entry-api`）、
 *   entry詳細ページのスレッド表示（`specs/entry-detail`）は、
 *   いずれも「第三者の返信、およびその分岐先を除外し、投稿者自身の投稿のみを
 *   直線的に辿る」という同一の抽出規則を要求しているため、この1箇所に実装を集約する。
 */
import { AppBskyFeedDefs, AppBskyFeedPost } from "@atproto/api"

/**
 * `post.record.createdAt`（クライアント申告のISO 8601文字列）をエポックミリ秒に変換する。
 * パース不能/欠損の場合は`undefined`（分岐選択の時刻近接比較では「無限に遠い」として扱う）。
 */
const readPostCreatedAtMs = (
    post: AppBskyFeedDefs.PostView,
): number | undefined => {
    const record = post.record as AppBskyFeedPost.Main | undefined
    if (typeof record?.createdAt !== "string") return undefined
    const ms = new Date(record.createdAt).getTime()
    return Number.isNaN(ms) ? undefined : ms
}

/**
 * `candidates`（2件以上、いずれも`author.did === ownerDid`一致済み）のうち、`parent`の
 * `record.createdAt`と最も近い（絶対差が最小の）ものを1件選ぶ。同一ノードから複数の
 * 自分自身の返信が分岐している場合（実在する正当な分岐）のtie-break規則。
 *
 * 処理の趣旨:
 * - `createBskyThread.ts`はスレッド投稿を1回の`applyWrites`内でループしながら
 *   `createdAt`を採番するため、同一操作で作られた投稿群は`createdAt`が近接する。
 *   分岐が実在する場合、親に最も近い時刻の投稿を「意図した続き」とみなす。
 * - 絶対差が同値の候補が複数ある場合、`candidates`（＝`replies`の元の並び順）で
 *   先に現れた方を採用する。
 * - `createdAt`が欠損/パース不能な候補は「無限に遠い」として扱い、有効な
 *   タイムスタンプを持つ候補を優先する。全候補が無効な場合は先頭候補が残る。
 */
const pickClosestByCreatedAt = (
    parent: AppBskyFeedDefs.PostView,
    candidates: AppBskyFeedDefs.ThreadViewPost[],
): AppBskyFeedDefs.ThreadViewPost => {
    const parentMs = readPostCreatedAtMs(parent)
    const diff = (node: AppBskyFeedDefs.ThreadViewPost): number => {
        const ms = readPostCreatedAtMs(node.post)
        if (parentMs === undefined || ms === undefined) {
            return Number.POSITIVE_INFINITY
        }
        return Math.abs(ms - parentMs)
    }
    return candidates.reduce((closest, candidate) =>
        diff(candidate) < diff(closest) ? candidate : closest,
    )
}

/**
 * `threadView`（`source`投稿を起点とするスレッドツリー）から、`ownerDid`自身が
 * 投稿した後続投稿のみを、先頭（`source`自身）から時系列順に直線的に抽出する。
 *
 * 処理の趣旨:
 * - 起点（`threadView`自身）が`ownerDid`の投稿でない場合、空配列を返す。
 * - 各ノードの`replies`のうち`post.author.did === ownerDid`に一致する候補をすべて
 *   集め、次のノードを選ぶ。第三者の返信、および第三者の返信で分岐した先
 *   （それが仮にownerDid自身の投稿であっても）は候補に含めない。
 *   - 候補が0件なら打ち切る。
 *   - 候補が1件なら、`createdAt`の近さを問わずそのまま採用する（事後に日数を
 *     空けて既存投稿へ継ぎ足された正当な続きを誤って除外しないため）。
 *   - 候補が2件以上（実在する分岐）の場合のみ、`pickClosestByCreatedAt`で
 *     親に最も近い時刻の1件を選ぶ。
 * - `maxCount`件に達するか、次のノードが見つからなくなるまで続ける。
 *
 * Input:
 * - `threadView`: `getPostThread`が返す`ThreadViewPost`（`source`投稿を起点とするノード）
 * - `ownerDid`: 辿る対象を絞り込む投稿者のDID
 * - `maxCount`: 抽出する投稿数の上限（`source`自身を含む）
 *
 * Output:
 * - `threadView.post.author.did !== ownerDid`の場合: 空配列
 * - それ以外: `source`から時系列順（古い→新しい）に並んだ`PostView`の配列
 *   （最低1件、`source`自身を含む）
 */
export const extractOwnedLinearReplyChain = (
    threadView: AppBskyFeedDefs.ThreadViewPost,
    ownerDid: string,
    maxCount: number,
): AppBskyFeedDefs.PostView[] => {
    if (threadView.post.author.did !== ownerDid) {
        return []
    }

    const result: AppBskyFeedDefs.PostView[] = [threadView.post]

    let current: AppBskyFeedDefs.ThreadViewPost = threadView
    while (result.length < maxCount) {
        const candidates: AppBskyFeedDefs.ThreadViewPost[] = []
        for (const reply of current.replies ?? []) {
            if (!AppBskyFeedDefs.isThreadViewPost(reply)) {
                continue
            }
            if (reply.post.author.did !== ownerDid) {
                continue
            }
            candidates.push(reply)
        }

        if (candidates.length === 0) {
            break
        }

        const next =
            candidates.length === 1
                ? candidates[0]
                : pickClosestByCreatedAt(current.post, candidates)

        result.push(next.post)
        current = next
    }

    return result
}

/**
 * 投稿レコード自体（`record.reply`、`app.bsky.feed.post#replyRef`のStrongRef）から
 * スレッド先頭(root)投稿のuriを取り出す。`FeedViewPost.reply`（AppViewによる
 * enriched view、NotFoundPost/BlockedPost型で欠落しうる）には依存しない
 * （`specs/timeline-api`）。
 *
 * Input:
 * - `post`: 対象の`PostView`
 *
 * Output:
 * - 返信である場合、そのスレッド先頭投稿のuri。返信でない場合は`undefined`。
 */
export const extractReplyRootUri = (
    post: AppBskyFeedDefs.PostView,
): string | undefined =>
    (post.record as AppBskyFeedPost.Main | undefined)?.reply?.root?.uri

/**
 * AT URI（`at://<did-or-handle>/collection/rkey`）のauthority部分（DID）を取り出す。
 * `record.reply.root`/`parent`のStrongRef.uriは常にDID形式で記録されるため、
 * 追加のAPI呼び出しなしに「その投稿がどのrepoの所有か」を判定できる。
 * 他者起点スレッドの除外判定（`specs/timeline-api`）に用いる。
 *
 * Input:
 * - `uri`: AT URI文字列
 *
 * Output:
 * - authority部分。`at://`形式でない場合は`undefined`。
 *
 * Example:
 * - `extractRepoDidFromAtUri("at://did:plc:abc/app.bsky.feed.post/1")` → `"did:plc:abc"`
 */
export const extractRepoDidFromAtUri = (uri: string): string | undefined =>
    uri.match(/^at:\/\/([^/]+)/)?.[1]

/**
 * 投稿がスレッドの起点（`record.reply`を持たない投稿）かどうかを判定する。
 * entry削除時のBluesky投稿削除可否の判定（`specs/entry-api`）で、
 * サーバ（`resolveDeleteTargets`）とクライアント（`resolveEntryDeleteScope`）が
 * 同一の基準を用いるために共有する。
 *
 * Input:
 * - `post`: 対象の`PostView`
 *
 * Output:
 * - `record`が投稿レコードでない、または`record.reply`を持たない場合は`true`
 */
export const isThreadRootPost = (post: AppBskyFeedDefs.PostView): boolean =>
    !AppBskyFeedPost.isRecord(post.record) || !post.record.reply
