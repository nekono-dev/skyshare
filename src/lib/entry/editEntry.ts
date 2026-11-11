/**
 * Skyshare Entry の見出しと本文を更新する判断を行う。
 *
 * - URI の所有確認は呼び出し側が済ませ、検証済み rkey を受け取る。
 * - `lib/api` を参照しないのは、`lib/api` からの循環依存を避けるため。
 * - 予期しない例外は呼び出し側へ投げ、ページ側で状態コードに変換する。
 */
import type { Agent } from "@atproto/api"
import { updateSkyshareEntry } from "@/lib/entry/skyshareRecord"
import type { Outcome } from "@/types/outcome"

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
