/**
 * entry の作成（POST）の判断（`specs/src-pages-thin` の EntryPost）。
 *
 * 責務と処理概要:
 * - `uri` 指定時は既存投稿からの発行（from-post）に分岐し、その結果を応答の形にする。
 * - 新規投稿では、トップレベル `reply` の所有を検証し、`posts` の各要素・`createEntry` の
 *   検証と埋め込み・アップロード（`postEntryMedia`）を経て、`createBskyThread` で
 *   投稿・gate・skyshare entry を 1 回の `applyWrites` で作成する。
 * - 判断の結果を `Outcome<EntryPostResponse>` で返す。HTTP の応答への変換は呼び出し側（ページ）が行う。
 *
 * 注意:
 * - 入力の検証（ヘッダ・認証・FormData・スキーマ）はページが行い、検証済みの値を受け取る。
 * - `lib/api` は参照しない（`lib/api` が `lib/entry` を参照する循環を避けるため）。
 *   応答の形が api の推論型に代入できることは、ページの型注釈付きの代入で確かめる。
 * - 想定外の例外（from-post の途中の失敗など）は握りつぶさず、呼び出し側へ投げる。
 */
import type { Agent } from "@atproto/api"
import type { BskyReplyRef } from "@/lib/atproto/recordTypes"
import { isReplyRefOwnedBySelf } from "@/lib/atproto/post"
import { createEntryFromExistingPost } from "@/lib/entry/fromPost"
import {
    createBskyThread,
    type ThreadPostInput,
} from "@/lib/entry/createBskyThread"
import {
    preparePostMedia,
    uploadEntryVisual,
    validateCreateEntry,
    type EntryPostMediaInput,
} from "@/lib/entry/postEntryMedia"
import { toEntrySummary, type EntrySummaryDto } from "@/lib/entry/entryResponse"
import { bskyPostUrlgen } from "@/lib/entry/url"
import type { Outcome } from "@/util/outcome"

/** 作成の入力の認証情報（呼び出し者）。 */
export type EntryPostSession = {
    did: string
    handle: string
}

/**
 * 作成の要求（ページが入力の検証を済ませた値）。
 * - `uri` を持つ場合は既存投稿からの発行（from-post）。
 * - それ以外は新規投稿（1 件、またはスレッドとして複数件）。
 */
export type EntryPostRequest =
    | {
          uri: string
          visual: Blob
          heading?: string
          caption?: string
      }
    | {
          posts: EntryPostMediaInput[]
          reply?: BskyReplyRef
          createEntry?: boolean
          visual?: Blob
          heading?: string
          caption?: string
      }

export type EntryPostInput = {
    agent: Agent
    session: EntryPostSession
    request: EntryPostRequest
}

/** 作成の応答の形（`posts` と、作成された場合の `skyshareEntry`）。 */
export type EntryPostResponse = {
    posts: { url: string; uri: string; cid: string }[]
    skyshareEntry?: EntrySummaryDto
}

/**
 * 投稿（1 件、またはスレッド）と、（指定時は）skyshare entry を作成する。
 *
 * Input:
 * - `agent`: 呼び出し者の認証済み agent
 * - `session`: 呼び出し者の DID と handle
 * - `request`: ページが検証済みの入力（既存投稿からの発行、または新規投稿）
 *
 * Output:
 * - 成功時: `{ ok: true, value: EntryPostResponse }`
 * - 失敗時: 400（from-post の入力不正・reply の所有・createEntry の検証・埋め込みの検証）・
 *   404（from-post の対象投稿なし）・500（外部連携の失敗）
 */
export const postEntry = async (
    input: EntryPostInput,
): Promise<Outcome<EntryPostResponse>> => {
    const { agent, session, request } = input

    // フェーズ 4.5: uri 指定時は既存投稿からの発行（from-post）に分岐する
    if ("uri" in request) {
        const fromPostResult = await createEntryFromExistingPost(
            agent,
            request.uri,
            session,
            request.visual,
            request.heading,
            request.caption,
        )
        if (!fromPostResult.ok) {
            return { ok: false, status: fromPostResult.status }
        }

        return {
            ok: true,
            value: {
                posts: [
                    {
                        url: fromPostResult.bskyUrl,
                        uri: fromPostResult.skyshareEntry.sourceUri,
                        cid: fromPostResult.skyshareEntry.sourceCid,
                    },
                ],
                skyshareEntry: toEntrySummary(fromPostResult.skyshareEntry),
            },
        }
    }

    // フェーズ 6: トップレベル reply(スレッド接続)の所有権検証
    // root/parentのuriが自分自身のapp.bsky.feed.postを指していない場合、
    // 他人の投稿への不正なreply chain構築とみなし400を返す。
    if (!isReplyRefOwnedBySelf(request.reply, session.did)) {
        console.warn("createEntry: reply ref not owned by caller")
        return { ok: false, status: 400 }
    }

    // フェーズ 5a: トップレベル createEntry:true の検証（posts全体を見て初めて判定できるため、
    // 個々のposts[i]の検証より先に行う）。
    const createEntryCheck = validateCreateEntry({
        createEntry: request.createEntry,
        visual: request.visual,
    })
    if (!createEntryCheck.ok) {
        return { ok: false, status: createEntryCheck.status }
    }

    // フェーズ 5b: 各postsについて検証・embed作成・アップロードを行う
    const threadPostInputs: ThreadPostInput[] = []
    for (const item of request.posts) {
        const postMedia = await preparePostMedia(agent, item)
        if (!postMedia.ok) {
            return { ok: false, status: postMedia.status }
        }
        threadPostInputs.push(postMedia.value)
    }

    // フェーズ 5c: createEntry:true の場合、visualを1回だけアップロードし
    // entry作成の入力を組み立てる（`source`は常にposts[0]、design.md §7.2）。
    const entryUpload = await uploadEntryVisual(agent, {
        createEntry: request.createEntry,
        visual: request.visual,
        heading: request.heading,
        caption: request.caption,
    })
    if (!entryUpload.ok) {
        return { ok: false, status: entryUpload.status }
    }
    const entryInput = entryUpload.value

    // フェーズ 7: 投稿＋gate＋skyshare entryを1回のapplyWritesで原子的に作成
    let results
    try {
        results = await createBskyThread(
            agent,
            session.did,
            threadPostInputs,
            request.reply,
            entryInput,
        )
    } catch (err) {
        console.error("createEntry: applyWrites failed", err)
        return { ok: false, status: 500 }
    }

    // フェーズ 8: 結果の組み立て
    return {
        ok: true,
        value: {
            posts: results.posts.map(result => {
                const rkey = result.uri.split("/").slice(-1)[0]
                return {
                    url: bskyPostUrlgen(session.handle, rkey),
                    uri: result.uri,
                    cid: result.cid,
                }
            }),
            skyshareEntry: results.skyshareEntry
                ? toEntrySummary(results.skyshareEntry)
                : undefined,
        },
    }
}
