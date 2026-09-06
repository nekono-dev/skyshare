/**
 * `src/pages/v2/**` のルートテスト用、duck-typed なフェイク AtpAgent 生成ヘルパー。
 *
 * 責務と処理概要:
 * - `tests/lib/entry/fromPost.test.ts` の `makeAgent(overrides)` パターンをルート層に
 *   拡張したもの。`locals.agent` はテストでは実 `AtpAgent` を必要とせず、ルートおよび
 *   ルートが呼び出す `src/lib/entry/*` / `src/lib/atproto/*` が実際に呼ぶメソッドだけを
 *   `vi.fn()` で用意すれば良い（モックの境界は常に atproto 通信の実体＝agent に置く）。
 * - 各メソッドは「全分岐が成功する」既定値を返す。個々のテストは `overrides` で
 *   ピンポイントに `mockRejectedValue` 等へ差し替えて、失敗系の分岐を駆動する。
 * - `com.atproto.*` / `app.bsky.draft.*` はネスト1階層ぶんだけマージする
 *   （例: `createFakeAgent({ com: { atproto: { repo: { createRecord: vi.fn()... } } } })`
 *   のように、変更したいメソッドだけを指定すれば他のデフォルト値は保持される）。
 */
import { vi } from "vitest"

export type FakeAgentOverrides = {
    uploadBlob?: any
    getProfile?: any
    post?: any
    getAuthorFeed?: any
    getPosts?: any
    app?: {
        bsky?: {
            draft?: {
                getDrafts?: any
                createDraft?: any
                updateDraft?: any
                deleteDraft?: any
            }
        }
    }
    com?: {
        atproto?: {
            repo?: {
                createRecord?: any
                getRecord?: any
                putRecord?: any
                deleteRecord?: any
                listRecords?: any
            }
            identity?: {
                resolveHandle?: any
            }
            sync?: {
                getBlob?: any
            }
        }
    }
}

/** `com.atproto.repo.getRecord` の既定応答（対象投稿・対象entryの2種を collection で出し分け）。 */
const defaultGetRecord = vi.fn(
    async ({
        collection,
    }: {
        repo: string
        collection: string
        rkey: string
    }) => {
        if (collection === "app.bsky.feed.post") {
            return {
                data: {
                    cid: "bafypostcid",
                    value: {
                        $type: "app.bsky.feed.post",
                        text: "hello",
                        embed: {
                            $type: "app.bsky.embed.images",
                            images: [{ image: { ref: "bafkreimg" }, alt: "" }],
                        },
                    },
                },
            }
        }
        // dev.nekono.skyshare.entry
        return {
            data: {
                cid: "bafyentrycid",
                value: {
                    source: {
                        uri: "at://did:plc:author/app.bsky.feed.post/3lpost",
                        cid: "bafypostcid",
                    },
                    manifest: {
                        visual: { ref: "bafkrevisual", mimeType: "image/jpeg" },
                    },
                    createdAt: "2024-01-01T00:00:00.000Z",
                },
            },
        }
    },
)

/** `com.atproto.repo.createRecord` の既定応答（entry作成とgate作成を collection で出し分け）。 */
const defaultCreateRecord = vi.fn(
    async ({
        collection,
    }: {
        repo: string
        collection: string
        rkey?: string
    }) => {
        if (collection === "dev.nekono.skyshare.entry") {
            return {
                data: {
                    uri: "at://did:plc:author/dev.nekono.skyshare.entry/3lentry",
                    cid: "bafyentrycid",
                },
            }
        }
        return {
            data: {
                uri: `at://did:plc:author/${collection}/3lpost`,
                cid: "bafygatecid",
            },
        }
    },
)

export const createFakeAgent = (overrides: FakeAgentOverrides = {}): any => ({
    uploadBlob:
        overrides.uploadBlob ??
        vi.fn().mockResolvedValue({
            data: {
                blob: {
                    $type: "blob",
                    ref: { $link: "bafkreuploaded" },
                    mimeType: "image/jpeg",
                },
            },
        }),
    getProfile:
        overrides.getProfile ??
        vi.fn().mockResolvedValue({ data: { displayName: "Alice" } }),
    post:
        overrides.post ??
        vi.fn().mockResolvedValue({
            uri: "at://did:plc:author/app.bsky.feed.post/3lpost",
            cid: "bafypostcid",
        }),
    getAuthorFeed:
        overrides.getAuthorFeed ??
        vi.fn().mockResolvedValue({ data: { feed: [], cursor: undefined } }),
    getPosts:
        overrides.getPosts ??
        vi.fn().mockResolvedValue({ data: { posts: [] } }),
    app: {
        bsky: {
            draft: {
                getDrafts:
                    overrides.app?.bsky?.draft?.getDrafts ??
                    vi.fn().mockResolvedValue({
                        data: { drafts: [], cursor: undefined },
                    }),
                createDraft:
                    overrides.app?.bsky?.draft?.createDraft ??
                    vi.fn().mockResolvedValue({ data: { id: "3ldrafttid" } }),
                updateDraft:
                    overrides.app?.bsky?.draft?.updateDraft ??
                    vi.fn().mockResolvedValue({ data: {} }),
                deleteDraft:
                    overrides.app?.bsky?.draft?.deleteDraft ??
                    vi.fn().mockResolvedValue({ data: {} }),
            },
        },
    },
    com: {
        atproto: {
            repo: {
                createRecord:
                    overrides.com?.atproto?.repo?.createRecord ??
                    defaultCreateRecord,
                getRecord:
                    overrides.com?.atproto?.repo?.getRecord ?? defaultGetRecord,
                putRecord:
                    overrides.com?.atproto?.repo?.putRecord ??
                    vi
                        .fn()
                        .mockImplementation(
                            async ({
                                repo,
                                rkey,
                            }: {
                                repo: string
                                rkey: string
                            }) => ({
                                data: {
                                    uri: `at://${repo}/dev.nekono.skyshare.entry/${rkey}`,
                                    cid: "bafyupdatedcid",
                                },
                            }),
                        ),
                deleteRecord:
                    overrides.com?.atproto?.repo?.deleteRecord ??
                    vi.fn().mockResolvedValue({}),
                listRecords:
                    overrides.com?.atproto?.repo?.listRecords ??
                    vi.fn().mockResolvedValue({
                        data: { records: [], cursor: undefined },
                    }),
            },
            identity: {
                resolveHandle:
                    overrides.com?.atproto?.identity?.resolveHandle ??
                    vi.fn().mockResolvedValue({
                        data: { did: "did:plc:resolved" },
                    }),
            },
            sync: {
                getBlob:
                    overrides.com?.atproto?.sync?.getBlob ??
                    vi.fn().mockResolvedValue({
                        data: new Uint8Array([1, 2, 3]),
                        headers: { "content-type": "image/png" },
                    }),
            },
        },
    },
})

/** 認証済みセッション相当のダミー値。`did`/`handle` はテスト全体で共通の既定値。 */
export const fakeSession = {
    did: "did:plc:author",
    handle: "alice.bsky.social",
} as any
