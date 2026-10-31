/**
 * skyshare entry の削除の判断（`specs/src-pages-thin` の EntryDelete）。
 *
 * 責務と処理概要:
 * - `deleteBskyPost` 指定時は削除対象（元投稿とその後続投稿）を entry 削除より前に導出する。
 *   導出できない場合は何も削除しない。
 * - entry の URI の所有検証はページが行い、検証済みの rkey を入力として受け取る。
 * - entry レコードを削除し、その後に Bluesky 投稿を削除する。投稿の削除の失敗は応答を失敗にしない。
 * - 判断の結果を `Outcome` で返す。HTTP の応答への変換は呼び出し側（ページ）が行う。
 *
 * 注意:
 * - `lib/api` は参照しない（`lib/api` が `lib/entry` を参照する循環を避けるため）。
 * - 想定外の例外（entry 自体の削除の失敗など）は握りつぶさず、呼び出し側へ投げる。
 */
import type { Agent } from "@atproto/api"
import { ENTRY_COLLECTION } from "@/lib/atproto/nsid"
import { parseOwnedAtUri } from "@/lib/atproto/atUri"
import { resolveDeleteTargets } from "@/lib/entry/resolveDeleteTargets"
import type { Outcome } from "@/util/outcome"

/** 削除の入力の認証情報（呼び出し者）。 */
export type DeleteEntrySession = {
    did: string
    handle: string
}

/**
 * 削除の要求（ページが URI の所有を検証済みの値）。
 * - `entryRkey`: 削除対象の entry のレコードキー（呼び出し者の DID 配下のもの）
 * - `deleteBskyPost`: 紐づく Bluesky 投稿も削除するかどうか
 */
export type DeleteEntryRequest = {
    entryRkey: string
    deleteBskyPost?: boolean
}

export type DeleteEntryInput = {
    agent: Agent
    session: DeleteEntrySession
    request: DeleteEntryRequest
}

/**
 * entry と（指定時は）紐づく Bluesky 投稿を削除する。
 *
 * Input:
 * - `agent`: 呼び出し者の認証済み agent
 * - `session`: 呼び出し者の DID
 * - `request`: 所有検証済みの entry の rkey と、Bluesky 投稿も削除するかどうか
 *
 * Output:
 * - 成功時: `{ ok: true, value: undefined }`
 * - 失敗時: 404（削除前の entry が見つからない）・409（返信投稿が指定された）・
 *   500（削除対象の導出に失敗）
 */
export const deleteEntry = async (
    input: DeleteEntryInput,
): Promise<Outcome<void>> => {
    const { agent, session, request } = input
    const entryRkey = request.entryRkey

    // deleteBskyPost 指定時のみ、削除前に entry レコードから source（元投稿）を取得する。
    let sourceUri: string | undefined
    if (request.deleteBskyPost) {
        try {
            const entryRecordRes = await agent.com.atproto.repo.getRecord({
                repo: session.did,
                collection: ENTRY_COLLECTION,
                rkey: entryRkey,
            })
            const entryValue = entryRecordRes.data.value as {
                source?: { uri?: string }
            }
            sourceUri =
                typeof entryValue?.source?.uri === "string"
                    ? entryValue.source.uri
                    : undefined
        } catch (err) {
            console.warn("deleteEntry: entry not found before delete", err)
            return { ok: false, status: 404 }
        }
    }

    // 削除範囲を確定できない場合は何も削除しないよう、entry削除より前に導出する。
    let deleteRkeys: string[] | undefined
    if (request.deleteBskyPost && sourceUri) {
        const parsedSourceUri = parseOwnedAtUri(
            sourceUri,
            "app.bsky.feed.post",
            session.did,
        )
        if (parsedSourceUri) {
            let result
            try {
                result = await resolveDeleteTargets(
                    agent,
                    session.did,
                    sourceUri,
                )
            } catch (err) {
                console.error(
                    "deleteEntry: failed to resolve delete targets",
                    err,
                )
                return { ok: false, status: 500 }
            }
            if (result.kind === "notThreadRoot") {
                return { ok: false, status: 409 }
            }
            if (result.kind === "targets") {
                deleteRkeys = result.rkeys
            }
        }
    }

    await agent.com.atproto.repo.deleteRecord({
        repo: session.did,
        collection: ENTRY_COLLECTION,
        rkey: entryRkey,
    })

    if (deleteRkeys && deleteRkeys.length > 0) {
        try {
            if (deleteRkeys.length === 1) {
                await agent.com.atproto.repo.deleteRecord({
                    repo: session.did,
                    collection: "app.bsky.feed.post",
                    rkey: deleteRkeys[0],
                })
            } else {
                await agent.com.atproto.repo.applyWrites({
                    repo: session.did,
                    writes: deleteRkeys.map(rkey => ({
                        $type: "com.atproto.repo.applyWrites#delete",
                        collection: "app.bsky.feed.post",
                        rkey,
                    })) as never,
                })
            }
        } catch (err) {
            // entry 自体の削除は既に成功しているため、bsky 投稿削除の失敗で
            // リクエスト全体を失敗扱いにはしない。
            console.error("deleteEntry: failed to delete bsky posts", err)
        }
    }

    return { ok: true, value: undefined }
}
