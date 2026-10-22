/**
 * 1件の予約を、進捗に従って段階的に実行する。
 *
 * 責務と処理概要:
 * - 予約用の認証情報でセッションを更新し、更新後の更新用トークンを投稿より先に保管する。
 * - 画像のアップロード → 投稿の先頭からの順次作成 → 投稿ごとの制限の作成 → entry の作成の順に進める。
 * - 通信が1回成功するたびに進捗を保存する。通信の予算が尽きる・レート制限を受ける・
 *   一時的に失敗するときは、進捗を保ったまま待機中へ戻して次の実行に持ち越す。
 * - レコードは予約時に採番したキー（TID）で `putRecord` する。書き込み後・進捗の保存前に
 *   中断しても、再実行は同じキーへ書き込むため、同じ位置の投稿が2件になることはない。
 * - 認証の失効・入力の不正・画像の欠落は再試行せず、分類コードを記録して失敗にする。
 *
 * 実装上の制約:
 * - atproto のライブラリを読み込まない。レコードの組み立ては副作用のない純粋関数だけを使う。
 * - ログにはコードと識別子だけを出力し、トークンと応答の本文は出力しない。
 */
import { buildBskyPostRecord, BSKY_POST_COLLECTION } from "@/lib/atproto/post"
import { buildPostgateRecord, buildThreadgateRecord } from "@/lib/atproto/gate"
import { createExternalEmbed, createImageEmbed } from "@/lib/atproto/embed"
import { ENTRY_COLLECTION } from "@/lib/atproto/nsid"
import { buildSkyshareEntryRecord } from "@/lib/entry/skyshareRecord"
import type { ScheduleEnv } from "./cfTypes"
import { removeImages } from "./imageStaging"
import { nextTid } from "./tid"
import {
    deleteCredential,
    finishSchedule,
    loadCredential,
    releaseSchedule,
    saveCredential,
    saveProgress,
} from "./store"
import type { Progress, ScheduleRow } from "./types"
import { emptyProgress } from "./types"
import type { StoredPayload, StoredPost } from "./validateSchedule"
import { callXrpc, type Budget, type XrpcFailureKind } from "./xrpcClient"

export type FailureCode =
    | "CredentialMissing"
    | "CredentialInvalid"
    | "CredentialExpired"
    | "InvalidRecord"
    | "ImageMissing"
    | "RetryExceeded"

export const MAX_ATTEMPTS = 5

export type ExecuteOutcome = "posted" | "released" | "failed"

/** 実行を中断する理由。`run` の中で投げ、最後にまとめて状態を記録する */
class Stop extends Error {
    constructor(
        readonly action:
            | { type: "release"; countAttempt: boolean }
            | { type: "fail"; code: FailureCode }
            | { type: "abandon" },
    ) {
        super("stop")
    }
}

const release = (countAttempt: boolean) =>
    new Stop({ type: "release", countAttempt })
const fail = (code: FailureCode) => new Stop({ type: "fail", code })

const parseJson = <T>(text: string, fallback: T): T => {
    try {
        return JSON.parse(text) as T
    } catch {
        return fallback
    }
}

/** 通信の失敗の種類から、予約をどう扱うかを決める。`authCode` は認証の失敗で失敗にするときの分類 */
const stopFor = (kind: XrpcFailureKind, authCode?: FailureCode): Stop => {
    switch (kind) {
        case "BudgetExceeded":
        case "RateLimited":
            return release(false)
        case "Auth":
            return authCode ? fail(authCode) : release(true)
        case "Invalid":
            return fail(authCode ?? "InvalidRecord")
        default:
            return release(true)
    }
}

export const executeSchedule = async (
    env: ScheduleEnv,
    budget: Budget,
    row: ScheduleRow,
    now: number,
    fetchImpl: typeof fetch = fetch,
): Promise<ExecuteOutcome> => {
    const imageKeys = parseJson<string[]>(row.imageKeys, [])
    const progress: Progress = {
        ...emptyProgress(),
        ...parseJson<Partial<Progress>>(row.progress, {}),
    }
    const payload = parseJson<StoredPayload>(row.payload, { posts: [] })

    const save = async () => {
        const ok = await saveProgress(env.DB, row.id, progress, now)
        // 別の実行に回収された予約には、これ以上書き込まない
        if (!ok) throw new Stop({ type: "abandon" })
    }

    const call = async (
        service: string,
        token: string,
        nsid: string,
        body: unknown,
        contentType?: string,
        authCode?: FailureCode,
    ) => {
        const result = await callXrpc(
            budget,
            { service, nsid, method: "POST", token, body, contentType },
            fetchImpl,
        )
        if (!result.ok) throw stopFor(result.kind, authCode)
        return result.json
    }

    const run = async (): Promise<void> => {
        // 1. セッションの更新。更新後のトークンを、投稿より先に保管する
        let credential
        try {
            credential = await loadCredential(
                env.DB,
                env.SCHEDULE_ENC_KEY,
                row.did,
            )
        } catch {
            throw fail("CredentialInvalid")
        }
        if (!credential) throw fail("CredentialMissing")
        const { service } = credential

        const refreshed = await call(
            service,
            credential.token,
            "com.atproto.server.refreshSession",
            undefined,
            undefined,
            "CredentialExpired",
        )
        if (
            typeof refreshed?.accessJwt !== "string" ||
            typeof refreshed?.refreshJwt !== "string" ||
            refreshed?.did !== row.did
        ) {
            throw fail("CredentialInvalid")
        }
        try {
            await saveCredential(
                env.DB,
                env.SCHEDULE_ENC_KEY,
                { did: row.did, service, token: refreshed.refreshJwt },
                now,
            )
        } catch {
            throw release(true)
        }
        const access: string = refreshed.accessJwt

        // 2. レコードキーの採番
        if (progress.rkeys.length === 0) {
            let prev: string | undefined
            const count = payload.posts.length + 1 // 末尾の1つは entry 用
            for (let i = 0; i < count; i++) {
                prev = nextTid(prev)
                progress.rkeys.push(prev)
            }
            await save()
        }

        // 3. 画像のアップロード
        const wanted = new Set<number>()
        for (const post of payload.posts) {
            for (const n of post.images ?? []) wanted.add(n)
            if (post.ogImage !== undefined) wanted.add(post.ogImage)
        }
        if (payload.createEntry && payload.visual !== undefined) {
            wanted.add(payload.visual)
        }
        for (const n of [...wanted].sort((a, b) => a - b)) {
            if (progress.blobs[n] !== undefined) continue
            const key = imageKeys[n]
            const object = key ? await env.SCHEDULE_IMAGES.get(key) : null
            if (!object) throw fail("ImageMissing")
            const json = await call(
                service,
                access,
                "com.atproto.repo.uploadBlob",
                await object.arrayBuffer(),
                object.httpMetadata?.contentType ?? "application/octet-stream",
            )
            if (!json?.blob) throw release(true)
            progress.blobs[n] = json.blob
            await save()
        }

        const createdAt = new Date(now * 1000).toISOString()
        const put = (collection: string, rkey: string, record: unknown) =>
            call(service, access, "com.atproto.repo.putRecord", {
                repo: row.did,
                collection,
                rkey,
                record,
                validate: false,
            })

        // 4. 投稿の順次作成
        for (let i = progress.created.length; i < payload.posts.length; i++) {
            const post = payload.posts[i]!
            const first = progress.created[0]
            const reply = (
                i === 0
                    ? payload.reply
                    : {
                          root:
                              (payload.reply as { root?: unknown } | undefined)
                                  ?.root ?? first,
                          parent: progress.created[i - 1],
                      }
            ) as never
            const record = buildBskyPostRecord({
                text: post.text ?? "",
                facets: post.facets as never,
                langs: post.langs,
                embed: buildEmbed(post, progress),
                selfLabel: post.selfLabels,
                reply,
                createdAt,
            })
            const json = await put(
                BSKY_POST_COLLECTION,
                progress.rkeys[i]!,
                record,
            )
            if (
                typeof json?.uri !== "string" ||
                typeof json?.cid !== "string"
            ) {
                throw release(true)
            }
            progress.created.push({ uri: json.uri, cid: json.cid })
            await save()
        }

        // 5. 投稿ごとの返信と引用の制限
        for (let i = progress.gates; i < payload.posts.length; i++) {
            const gate = payload.posts[i]!.gate as never
            const uri = progress.created[i]!.uri
            if (gate) {
                const threadgate = buildThreadgateRecord(uri, gate, createdAt)
                if (threadgate) {
                    await put(
                        "app.bsky.feed.threadgate",
                        progress.rkeys[i]!,
                        threadgate,
                    )
                }
                const postgate = buildPostgateRecord(uri, gate, createdAt)
                if (postgate) {
                    await put(
                        "app.bsky.feed.postgate",
                        progress.rkeys[i]!,
                        postgate,
                    )
                }
            }
            progress.gates = i + 1
            await save()
        }

        // 6. entry の作成。派生元は常にスレッドの先頭の投稿
        if (payload.createEntry && !progress.entryDone) {
            const source = progress.created[0]!
            const visual =
                payload.visual !== undefined
                    ? progress.blobs[payload.visual]
                    : undefined
            if (!visual) throw fail("InvalidRecord")
            await put(
                ENTRY_COLLECTION,
                progress.rkeys[payload.posts.length]!,
                buildSkyshareEntryRecord({
                    sourceUri: source.uri,
                    sourceCid: source.cid,
                    visual,
                    heading: payload.heading,
                    caption: payload.caption,
                    createdAt,
                }),
            )
            progress.entryDone = true
            await save()
        }
    }

    // 終了した予約の画像を消す。認証情報は他の予約や次の予約で使うため、ここでは消さない
    // （未使用の認証情報は定期実行の後片付けが30日後に削除する）。
    const cleanup = async () => {
        await removeImages(env.SCHEDULE_IMAGES, imageKeys).catch(() => {})
    }

    try {
        if (payload.posts.length === 0) throw fail("InvalidRecord")
        await run()
    } catch (err) {
        if (!(err instanceof Stop)) throw err
        const action = err.action
        if (action.type === "abandon") return "released"
        if (action.type === "fail") {
            await finishSchedule(
                env.DB,
                row.id,
                { status: "failed", lastError: action.code },
                now,
            )
            // 認証の失効が分かった認証情報は使えないため削除し、設定の表示をオフに戻す
            if (action.code === "CredentialExpired") {
                await deleteCredential(env.DB, row.did)
            }
            await cleanup()
            return "failed"
        }
        // 一時的な失敗は、回数の上限に達したら失敗にする
        if (action.countAttempt && row.attempts + 1 >= MAX_ATTEMPTS) {
            await finishSchedule(
                env.DB,
                row.id,
                { status: "failed", lastError: "RetryExceeded" },
                now,
            )
            await cleanup()
            return "failed"
        }
        await releaseSchedule(env.DB, row.id, action.countAttempt, now)
        return "released"
    }

    await finishSchedule(
        env.DB,
        row.id,
        { status: "posted", resultUri: progress.created[0]!.uri },
        now,
    )
    await cleanup()
    return "posted"
}

/** 画像（手動添付）とリンクカードは同時に埋め込めないため、画像を優先する */
const buildEmbed = (post: StoredPost, progress: Progress) => {
    if (post.images && post.images.length > 0) {
        return createImageEmbed(
            post.images.map(n => progress.blobs[n]),
            post.imagesMeta as never,
        )
    }
    if (post.ogMeta && post.ogImage !== undefined) {
        return createExternalEmbed(
            post.ogMeta as never,
            progress.blobs[post.ogImage],
        )
    }
    return undefined
}
