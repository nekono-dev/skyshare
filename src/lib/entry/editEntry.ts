/**
 * skyshare entry の見出しと本文の更新の判断（`specs/src-pages-thin` の EntryEdit）。
 *
 * 責務と処理概要:
 * - entry レコードの見出し（heading）と本文（caption）を更新する。
 * - entry の URI の所有検証はページが行い、検証済みの rkey を入力として受け取る。
 * - 判断の結果を `Outcome` で返す。HTTP の応答への変換は呼び出し側（ページ）が行う。
 *
 * 注意:
 * - `lib/api` は参照しない（`lib/api` が `lib/entry` を参照する循環を避けるため）。
 * - 想定外の例外（entry が見つからない・書き込みの失敗など）は握りつぶさず、呼び出し側へ投げる。
 *   ページの外側の `catch` で、現行と同じ状態コードに変換される。
 */
import type { Agent } from "@atproto/api"
import { updateSkyshareEntry } from "@/lib/entry/skyshareRecord"
import type { Outcome } from "@/util/outcome"

/** 更新の入力の認証情報（呼び出し者）。 */
export type EditEntrySession = {
    did: string
    handle: string
}

/**
 * 更新の要求（ページが URI の所有を検証済みの値）。
 * - `entryRkey`: 更新対象の entry のレコードキー（呼び出し者の DID 配下のもの）
 * - `heading`: 更新後の見出し
 * - `caption`: 更新後の本文
 */
export type EditEntryRequest = {
    entryRkey: string
    heading: string
    caption: string
}

export type EditEntryInput = {
    agent: Agent
    session: EditEntrySession
    request: EditEntryRequest
}

/**
 * entry の見出しと本文を更新する。
 *
 * Input:
 * - `agent`: 呼び出し者の認証済み agent
 * - `session`: 呼び出し者の DID
 * - `request`: 所有検証済みの entry の rkey と、更新後の見出し・本文
 *
 * Output:
 * - 成功時: `{ ok: true, value: undefined }`
 * - 失敗の判断は行わない。entry が見つからない・書き込みの失敗などは例外として投げる
 *   （ページの外側の `catch` が `resolveXrpcStatus` で状態コードに変換する）。
 */
export const editEntry = async (
    input: EditEntryInput,
): Promise<Outcome<void>> => {
    const { agent, session, request } = input

    await updateSkyshareEntry(
        agent,
        session.did,
        request.entryRkey,
        request.heading,
        request.caption,
    )

    return { ok: true, value: undefined }
}
