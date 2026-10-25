/**
 * ライブテスト用の、検証用アカウントのPDS直接操作ヘルパー。
 *
 * 責務と処理概要:
 * - `@atproto/api`の`AtpAgent`で、検証用アカウントの投稿（`app.bsky.feed.post`）と
 *   entry（`dev.nekono.skyshare.entry`）レコードを直接作成・削除する（`specs/e2elive/design.md §6`）。
 *   アプリのAPIはentry経由でしか投稿を削除できないため、entryを持たない投稿の後始末にもこちらを使う。
 * - 作成する投稿の本文は必ず`[e2e <識別子>]`で始め（`createPost`が強制する）、削除は
 *   この形式の投稿と、それを`source`とするentryだけに限定する（`specs/e2elive/requirements.md NFR-4`）。
 * - 削除対象の選別（`planDeletion`）は純粋関数として切り出し、PDSなしで単体テストする。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { AtpAgent, type AtpSessionData } from "@atproto/api"
import type { LiveAccount } from "./env"

export const POST_COLLECTION = "app.bsky.feed.post"
export const ENTRY_COLLECTION = "dev.nekono.skyshare.entry"

/** 1回の削除で許容する件数の上限（識別子の誤りによる大量削除を防ぐ。NFR-4） */
export const DELETE_LIMIT = 50

/** `sweepStale`の既定の猶予（これより新しい投稿は、実行中の別プロセスのものとして残す） */
export const DEFAULT_STALE_MS = 60 * 60 * 1000

const TAG_PATTERN = /^\[e2e ([0-9a-z]+)\] /

/**
 * テストが作る投稿の識別子を生成する。
 *
 * Output: `[e2e <base36のタイムスタンプ>]`
 * Example: `[e2e mv07v03f]`
 */
export const makeRunTag = (now: number = Date.now()): string =>
    `[e2e ${now.toString(36)}]`

/**
 * 本文が削除・掃除の対象となる形式（`[e2e <識別子>] `で始まる）か判定する。
 *
 * Input: 投稿本文（`undefined`可）
 * Output: 対象ならtrue
 */
export const isE2eText = (text: string | undefined): boolean =>
    typeof text === "string" && TAG_PATTERN.test(text)

/**
 * 本文の識別子から、投稿を作った時刻（ミリ秒）を取り出す。
 *
 * Input: 投稿本文
 * Output: 時刻。形式に合わなければ`null`
 */
export const e2eTagTimeMs = (text: string | undefined): number | null => {
    const m = typeof text === "string" ? text.match(TAG_PATTERN) : null
    if (!m) return null
    const ms = parseInt(m[1], 36)
    return Number.isFinite(ms) ? ms : null
}

/** リポジトリのレコード（必要な部分のみ） */
export type RepoRecord = { uri: string; value: Record<string, unknown> }

export type DeletionPlan = { postUris: string[]; entryUris: string[] }

/**
 * 削除対象の投稿と、それを`source`とするentryを選ぶ。
 *
 * Input:
 * - `posts`/`entries`: リポジトリ内の全レコード
 * - `match`: 投稿本文が対象かを判定する関数（識別子の一致、古さの判定など）。
 *   `isE2eText`に合わない本文は、`match`の結果にかかわらず対象にならない。
 * - `limit`: 削除件数（投稿＋entry）の上限
 * - `includePosts`: falseならentryだけを対象にする（`deleteEntriesOnly`用）
 *
 * Output: 削除計画。上限を超える場合は何も返さず例外を投げる。
 */
export const planDeletion = ({
    posts,
    entries,
    match,
    limit = DELETE_LIMIT,
    includePosts = true,
}: {
    posts: RepoRecord[]
    entries: RepoRecord[]
    match: (text: string) => boolean
    limit?: number
    includePosts?: boolean
}): DeletionPlan => {
    const targets = posts.filter(p => {
        const text = p.value.text
        return typeof text === "string" && isE2eText(text) && match(text)
    })
    const targetUris = new Set(targets.map(p => p.uri))
    const entryUris = entries
        .filter(e => {
            const source = e.value.source as { uri?: string } | undefined
            return source?.uri !== undefined && targetUris.has(source.uri)
        })
        .map(e => e.uri)
    const postUris = includePosts ? targets.map(p => p.uri) : []
    if (postUris.length + entryUris.length > limit) {
        throw new Error(
            `削除対象が上限(${limit}件)を超えました（投稿${postUris.length}件・entry${entryUris.length}件）。識別子の指定を確認してください`,
        )
    }
    return { postUris, entryUris }
}

const rkeyOf = (atUri: string): string => atUri.split("/").pop()!

/** セッションの保存先 */
const sessionFile = (name: string) =>
    path.resolve(
        path.dirname(new URL(import.meta.url).pathname),
        `../../../playwright/.auth/${name}.json`,
    )

/**
 * アカウントのPDSエージェントを作る。保存済みセッションがあれば再利用し（ログインAPIの
 * レート制限を避ける）、無効なら再ログインして保存し直す。
 *
 * Input: 認証情報、セッション保存ファイル名（第三者アカウントは別名にする）
 * Output: ログイン済みの`AtpAgent`
 */
export const createPdsAgent = async (
    account: LiveAccount,
    name = "pds",
): Promise<AtpAgent> => {
    const file = sessionFile(name)
    const save = (session?: AtpSessionData) => {
        if (!session) return
        mkdirSync(path.dirname(file), { recursive: true })
        writeFileSync(file, JSON.stringify(session), { mode: 0o600 })
    }
    const agent = new AtpAgent({
        service: account.service,
        persistSession: (_evt, session) => save(session),
    })
    try {
        const saved = JSON.parse(readFileSync(file, "utf8")) as AtpSessionData
        await agent.resumeSession(saved)
        // 失効していると、取得時に例外になる
        await agent.com.atproto.repo.describeRepo({ repo: saved.did })
        return agent
    } catch {
        const res = await agent.login({
            identifier: account.identifier,
            password: account.password,
        })
        save(res.data as unknown as AtpSessionData)
        return agent
    }
}

/** コレクションの全レコードをページングして取得する */
const listAll = async (
    agent: AtpAgent,
    collection: string,
): Promise<RepoRecord[]> => {
    const out: RepoRecord[] = []
    let cursor: string | undefined
    do {
        const res = await agent.com.atproto.repo.listRecords({
            repo: agent.assertDid,
            collection,
            limit: 100,
            cursor,
        })
        out.push(
            ...res.data.records.map(r => ({
                uri: r.uri,
                value: r.value as Record<string, unknown>,
            })),
        )
        cursor = res.data.cursor
    } while (cursor)
    return out
}

/** 削除計画のレコードを、entry→投稿の順に10件ずつ`applyWrites`で削除する */
const execute = async (agent: AtpAgent, plan: DeletionPlan) => {
    const writes = [
        ...plan.entryUris.map(uri => ({
            $type: "com.atproto.repo.applyWrites#delete" as const,
            collection: ENTRY_COLLECTION,
            rkey: rkeyOf(uri),
        })),
        ...plan.postUris.map(uri => ({
            $type: "com.atproto.repo.applyWrites#delete" as const,
            collection: POST_COLLECTION,
            rkey: rkeyOf(uri),
        })),
    ]
    for (let i = 0; i < writes.length; i += 10) {
        await agent.com.atproto.repo.applyWrites({
            repo: agent.assertDid,
            writes: writes.slice(i, i + 10),
        })
    }
}

export type CreatedPost = { uri: string; cid: string }

/**
 * 投稿を作成する。本文は`[e2e <識別子>] `で始まらなければならない。
 *
 * Input:
 * - `text`: 本文（識別子付き）
 * - `images`: 添付するPNG（最大4枚）
 * - `reply`: 返信先（スレッドの根と直前の投稿）
 * - `createdAt`: 投稿日時（ISO文字列。省略時は現在）
 *
 * Output: 作成した投稿のURIとCID
 */
export const createPost = async (
    agent: AtpAgent,
    opts: {
        text: string
        images?: Buffer[]
        reply?: { root: CreatedPost; parent: CreatedPost }
        createdAt?: string
    },
): Promise<CreatedPost> => {
    if (!isE2eText(opts.text)) {
        throw new Error(
            "テスト投稿の本文は`[e2e <識別子>] `で始める必要があります",
        )
    }
    const images = await Promise.all(
        (opts.images ?? []).map(async buf => ({
            image: (await agent.uploadBlob(buf, { encoding: "image/png" })).data
                .blob,
            alt: "",
        })),
    )
    const res = await agent.com.atproto.repo.createRecord({
        repo: agent.assertDid,
        collection: POST_COLLECTION,
        record: {
            $type: POST_COLLECTION,
            text: opts.text,
            createdAt: opts.createdAt ?? new Date().toISOString(),
            ...(images.length
                ? { embed: { $type: "app.bsky.embed.images", images } }
                : {}),
            ...(opts.reply
                ? {
                      reply: {
                          root: {
                              uri: opts.reply.root.uri,
                              cid: opts.reply.root.cid,
                          },
                          parent: {
                              uri: opts.reply.parent.uri,
                              cid: opts.reply.parent.cid,
                          },
                      },
                  }
                : {}),
        },
    })
    return { uri: res.data.uri, cid: res.data.cid }
}

/**
 * 自己返信の連鎖（スレッド）を作成する。
 *
 * Input: 識別子付きの投稿内容の配列（先頭がルート）
 * Output: 作成した投稿（先頭がルート）
 */
export const createThread = async (
    agent: AtpAgent,
    items: { text: string; images?: Buffer[]; createdAt?: string }[],
): Promise<CreatedPost[]> => {
    const created: CreatedPost[] = []
    for (const item of items) {
        created.push(
            await createPost(agent, {
                ...item,
                reply: created.length
                    ? { root: created[0], parent: created[created.length - 1] }
                    : undefined,
            }),
        )
    }
    return created
}

/**
 * entryレコードを直接作成する（旧実装形式の`source`が返信投稿のentryなど、アプリのAPIでは
 * 作れないentryの用意に使う）。`source`は識別子付き投稿でなければならない。
 *
 * Input: `source`（投稿のURIとCID）、visual用PNG、見出し・キャプション
 * Output: 作成したentryのURI
 */
export const createEntryRecord = async (
    agent: AtpAgent,
    opts: {
        source: CreatedPost
        visual: Buffer
        heading?: string
        caption?: string
    },
): Promise<{ uri: string }> => {
    const blob = (
        await agent.uploadBlob(opts.visual, { encoding: "image/png" })
    ).data.blob
    const res = await agent.com.atproto.repo.createRecord({
        repo: agent.assertDid,
        collection: ENTRY_COLLECTION,
        record: {
            $type: ENTRY_COLLECTION,
            source: { uri: opts.source.uri, cid: opts.source.cid },
            manifest: {
                visual: blob,
                heading: opts.heading ?? "e2e",
                caption: opts.caption ?? "e2e",
            },
            createdAt: new Date().toISOString(),
        },
    })
    return { uri: res.data.uri }
}

/**
 * 識別子`tag`の投稿と、それを`source`とするentryを削除する（entry→投稿の順）。
 *
 * Output: 削除した件数
 */
export const deleteByTag = async (
    agent: AtpAgent,
    tag: string,
): Promise<{ posts: number; entries: number }> => {
    const plan = planDeletion({
        posts: await listAll(agent, POST_COLLECTION),
        entries: await listAll(agent, ENTRY_COLLECTION),
        match: text => text.startsWith(`${tag} `),
    })
    await execute(agent, plan)
    return { posts: plan.postUris.length, entries: plan.entryUris.length }
}

/**
 * 識別子`tag`の投稿に紐づくentryだけを削除する（投稿は残す）。
 * 「entryの無い既存投稿」を用意するフィクスチャ用。
 *
 * Output: 削除したentryの件数
 */
export const deleteEntriesOnly = async (
    agent: AtpAgent,
    tag: string,
): Promise<number> => {
    const plan = planDeletion({
        posts: await listAll(agent, POST_COLLECTION),
        entries: await listAll(agent, ENTRY_COLLECTION),
        match: text => text.startsWith(`${tag} `),
        includePosts: false,
    })
    await execute(agent, plan)
    return plan.entryUris.length
}

/**
 * `[e2e `形式の投稿のうち、作成から`olderThanMs`以上経ったものと、そのentryを削除する。
 * 異常終了した前回の取りこぼしの回収に使う。`dryRun`のときは削除せず対象の件数だけ返す。
 *
 * Output: 削除した（`dryRun`なら削除予定の）件数
 */
export const sweepStale = async (
    agent: AtpAgent,
    {
        olderThanMs = DEFAULT_STALE_MS,
        dryRun = false,
        now = Date.now(),
    }: { olderThanMs?: number; dryRun?: boolean; now?: number } = {},
): Promise<{ posts: number; entries: number }> => {
    const plan = planDeletion({
        posts: await listAll(agent, POST_COLLECTION),
        entries: await listAll(agent, ENTRY_COLLECTION),
        match: text => {
            const t = e2eTagTimeMs(text)
            return t !== null && now - t >= olderThanMs
        },
    })
    if (!dryRun) await execute(agent, plan)
    return { posts: plan.postUris.length, entries: plan.entryUris.length }
}
