/**
 * Bluesky `app.bsky.draft.*` レコードの入出力検証・変換ユーティリティ群。
 *
 * 責務と処理概要:
 * - `/v2/bsky/drafts` エンドポイントが受け取るリクエストボディ・クエリの検証。
 * - `app.bsky.draft.*` から返るレスポンスの最小要件検証。
 * - `com.atproto.label.defs#selfLabels` 形式のラベル値の抽出・組み立て。
 */

import { isObjectRecord } from "@/util/object"

export type DraftViewPayload = {
    id: string
    text: string
    labels?: string[]
    createdAt: string
    updatedAt: string
}

/**
 * `com.atproto.label.defs#selfLabels` からラベル値の配列を抽出する。
 *
 * Input:
 * - `value`: draftPost.labels 候補
 *
 * Output:
 * - ラベル値の配列。値が無ければ `undefined`
 *
 * 例:
 * - 入力: `{ values: [{ val: "sexual" }] }`
 * - 出力: `["sexual"]`
 */
export const extractLabelValues = (value: unknown): string[] | undefined => {
    if (!isObjectRecord(value) || !Array.isArray(value.values)) {
        return undefined
    }

    const labels = value.values
        .map(entry =>
            isObjectRecord(entry) && typeof entry.val === "string"
                ? entry.val
                : undefined,
        )
        .filter((val): val is string => val !== undefined)

    return labels.length > 0 ? labels : undefined
}

/**
 * 下書き本体から一覧表示に必要な最小要件(先頭投稿の text/labels)を取り出す。
 *
 * 処理の趣旨:
 * - 画像等の埋め込みはデバイスローカル参照のためこのアプリでは扱えず、
 *   langs/postgateEmbeddingRules/threadgateAllow も一覧表示や再利用では使わない。
 *
 * Input:
 * - `value`: draft 候補
 *
 * Output:
 * - 検証済み `{ text, labels? }`。不正時は `undefined`
 *
 * 例:
 * - 入力: `{ posts: [{ text: "hello" }] }`
 * - 出力: `{ text: "hello" }`
 */
export const parseDraft = (
    value: unknown,
): { text: string; labels?: string[] } | undefined => {
    if (!isObjectRecord(value) || !Array.isArray(value.posts)) {
        return undefined
    }

    const firstPost = value.posts[0]
    if (!isObjectRecord(firstPost) || typeof firstPost.text !== "string") {
        return undefined
    }

    return {
        text: firstPost.text,
        labels: extractLabelValues(firstPost.labels),
    }
}

/**
 * 下書き削除リクエストを検証する。
 *
 * Input:
 * - `value`: JSON ボディ候補
 *
 * Output:
 * - 検証済み `{ id }`。不正時は `undefined`
 *
 * 例:
 * - 入力: `{ id: "3ldrafttid" }`
 * - 出力: 同等オブジェクト
 */
export const parseDeleteDraftBody = (
    value: unknown,
): { id: string } | undefined => {
    if (!isObjectRecord(value) || typeof value.id !== "string") {
        return undefined
    }
    return { id: value.id }
}

/**
 * 下書き作成・更新で共通の本文(text/labels)を検証する。
 *
 * Input:
 * - `value`: JSON ボディ候補
 *
 * Output:
 * - 検証済み `{ text, labels? }`。不正時は `undefined`
 *
 * 例:
 * - 入力: `{ text: "hello", labels: ["sexual"] }`
 * - 出力: 同等オブジェクト
 */
export const parseDraftPostInput = (
    value: unknown,
): { text: string; labels?: string[] } | undefined => {
    if (!isObjectRecord(value) || typeof value.text !== "string") {
        return undefined
    }

    if (value.labels !== undefined) {
        if (
            !Array.isArray(value.labels) ||
            !value.labels.every(label => typeof label === "string")
        ) {
            return undefined
        }
    }

    return {
        text: value.text,
        labels: Array.isArray(value.labels)
            ? (value.labels as string[])
            : undefined,
    }
}

/**
 * 下書き作成リクエストを検証する。
 *
 * Input:
 * - `value`: JSON ボディ候補
 *
 * Output:
 * - 検証済み `{ text, labels? }`。不正時は `undefined`
 *
 * 例:
 * - 入力: `{ text: "hello" }`
 * - 出力: 同等オブジェクト
 */
export const parseCreateDraftBody = parseDraftPostInput

/**
 * 下書き更新リクエストを検証する。
 *
 * Input:
 * - `value`: JSON ボディ候補
 *
 * Output:
 * - 検証済み `{ id, text, labels? }`。不正時は `undefined`
 *
 * 例:
 * - 入力: `{ id: "3ldrafttid", text: "hello" }`
 * - 出力: 同等オブジェクト
 */
export const parseUpdateDraftBody = (
    value: unknown,
): { id: string; text: string; labels?: string[] } | undefined => {
    if (!isObjectRecord(value) || typeof value.id !== "string") {
        return undefined
    }

    const body = parseDraftPostInput(value)
    if (!body) {
        return undefined
    }

    return { id: value.id, ...body }
}

/**
 * ラベル値の配列から `com.atproto.label.defs#selfLabels` を組み立てる。
 *
 * Input:
 * - `labels`: 自己ラベル値の配列
 *
 * Output:
 * - selfLabels オブジェクト。空/未指定時は `undefined`
 *
 * 例:
 * - 入力: `["sexual"]`
 * - 出力: `{ $type: "com.atproto.label.defs#selfLabels", values: [{ val: "sexual" }] }`
 */
export const buildSelfLabels = (labels: string[] | undefined) => {
    if (!labels || labels.length === 0) {
        return undefined
    }

    return {
        $type: "com.atproto.label.defs#selfLabels" as const,
        values: labels.map(val => ({ val })),
    }
}

/**
 * 下書き一覧クエリを検証する。
 *
 * Input:
 * - `request`: HTTP リクエスト
 *
 * Output:
 * - 検証済み `{ limit?, cursor? }`。不正時は `undefined`
 *
 * 例:
 * - 入力: `GET /v2/bsky/drafts?limit=20&cursor=abc`
 * - 出力: `{ limit: 20, cursor: "abc" }`
 */
export const parseDraftQuery = (
    request: Request,
): { limit?: number; cursor?: string } | undefined => {
    const url = new URL(request.url)
    const limitRaw = url.searchParams.get("limit")
    const cursorRaw = url.searchParams.get("cursor")

    const query: { limit?: number; cursor?: string } = {}

    if (limitRaw !== null) {
        const limit = Number(limitRaw)
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            return undefined
        }
        query.limit = limit
    }

    if (cursorRaw !== null) {
        if (cursorRaw.length === 0) {
            return undefined
        }
        query.cursor = cursorRaw
    }

    return query
}

/**
 * 下書き一覧レスポンスを最小要件で検証する。
 *
 * Input:
 * - `value`: getDrafts のレスポンス候補
 *
 * Output:
 * - 検証済み `{ cursor?, drafts }`。不正時は `undefined`
 *
 * 例:
 * - 入力: `{ drafts: [{ id, draft, createdAt, updatedAt }] }`
 * - 出力: 同等オブジェクト
 */
export const parseDraftViewsResponse = (
    value: unknown,
): { cursor?: string; drafts: DraftViewPayload[] } | undefined => {
    if (!isObjectRecord(value) || !Array.isArray(value.drafts)) {
        return undefined
    }

    const parsedDrafts: DraftViewPayload[] = []
    for (const draftView of value.drafts) {
        if (!isObjectRecord(draftView)) {
            return undefined
        }

        if (
            typeof draftView.id !== "string" ||
            typeof draftView.createdAt !== "string" ||
            typeof draftView.updatedAt !== "string"
        ) {
            return undefined
        }

        const draft = parseDraft(draftView.draft)
        if (!draft) {
            return undefined
        }

        parsedDrafts.push({
            id: draftView.id,
            text: draft.text,
            labels: draft.labels,
            createdAt: draftView.createdAt,
            updatedAt: draftView.updatedAt,
        })
    }

    if (value.cursor !== undefined && typeof value.cursor !== "string") {
        return undefined
    }

    return {
        cursor: value.cursor,
        drafts: parsedDrafts,
    }
}
