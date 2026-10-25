/**
 * `useSkyshareEntryStatus`（PostCardのentry作成・削除状態フック）の単体テスト。
 *
 * 責務と処理概要:
 * - node環境にはReactのレンダラが無いため、`react`の`useState`/`useRef`を
 *   スロット配列で動くごく小さな実装に差し替え、フック関数を直接呼び出して検証する。
 *   state更新後は`render()`で再度フックを呼び、最新の戻り値を得る。
 * - 通信（`createEntry`/`deleteEntry`）・画像合成・削除範囲判定は`vi.mock`で差し替える。
 * - 対象は `specs/timeline/tasks.md` のテストタスク
 *   （reply由来Visualでもsourceはrootのuriを送る／削除スコープの確定・
 *   `deleteBskyThread`を送らない／`onPostDeleted`の呼び出し条件／legacyでもダイアログが開く）。
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TimelinePost } from "@/lib/entry/posts"
import type { EntryDeleteScope } from "@/lib/entry/resolveEntryDeleteScope"

// ---- 最小のフックランタイム ----
const runtime = vi.hoisted(() => ({
    slots: [] as unknown[],
    index: 0,
}))

vi.mock("react", () => ({
    useState: <T>(init: T | (() => T)) => {
        const i = runtime.index++
        if (!(i in runtime.slots)) {
            runtime.slots[i] = {
                value: typeof init === "function" ? (init as () => T)() : init,
            }
        }
        const slot = runtime.slots[i] as { value: T }
        const set = (next: T | ((prev: T) => T)) => {
            slot.value =
                typeof next === "function"
                    ? (next as (p: T) => T)(slot.value)
                    : next
        }
        return [slot.value, set]
    },
    useRef: <T>(init: T) => {
        const i = runtime.index++
        if (!(i in runtime.slots)) runtime.slots[i] = { current: init }
        return runtime.slots[i]
    },
}))

vi.mock("@/lib/i18n/react", () => ({ useT: () => (key: string) => key }))

const api = vi.hoisted(() => ({
    createEntry: vi.fn(),
    deleteEntry: vi.fn(),
    createPostVisualBlob: vi.fn(),
    resolveEntryDeleteScope: vi.fn(),
}))

vi.mock("@/client/openapi/client", () => ({
    createEntry: api.createEntry,
    deleteEntry: api.deleteEntry,
}))
vi.mock("@/lib/entry/createPostVisual", () => ({
    createPostVisualBlob: api.createPostVisualBlob,
}))
vi.mock("@/lib/account/activeAccountSession", () => ({
    getActiveAccountDisplayName: async () => "tester",
}))
vi.mock("@/lib/entry/warmOgpCache", () => ({ warmOgpCache: async () => {} }))
vi.mock("@/util/waitForImageLoad", () => ({ waitForImageLoad: async () => {} }))
vi.mock("@/lib/entry/resolveEntryDeleteScope", () => ({
    resolveEntryDeleteScope: api.resolveEntryDeleteScope,
}))

import { useSkyshareEntryStatus } from "@/components/post/PostCard/useSkyshareEntryStatus"

type Options = Parameters<typeof useSkyshareEntryStatus>[1]

/** フックを1回描画し、最新の戻り値を返す */
const render = (item: TimelinePost, options?: Options) => {
    runtime.index = 0
    return useSkyshareEntryStatus(item, options)
}

/** 非同期処理（void async）の完了を待つ */
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

const makePost = (
    id: string,
    overrides: Partial<TimelinePost> = {},
): TimelinePost => ({
    uri: `at://did:plc:a/app.bsky.feed.post/${id}`,
    cid: `cid-${id}`,
    url: `https://bsky.app/profile/a.test/post/${id}`,
    indexedAt: "2026-01-01T00:00:00.000Z",
    author: { did: "did:plc:a", handle: "a.test" },
    text: `本文${id}`,
    images: [],
    ...overrides,
})

const withImage = (id: string) =>
    makePost(id, {
        images: [
            { url: `https://cdn.test/${id}.jpg`, alt: "", cid: `img-${id}` },
        ],
    })

const entryOf = (source: TimelinePost) => ({
    uri: "at://did:plc:a/dev.nekono.skyshare.entry/e1",
    cid: "entry-cid",
    createdAt: "2026-01-01T00:00:00.000Z",
    sourceUri: source.uri,
    sourceCid: source.cid,
    heading: "h",
    caption: "c",
    visualUrl: "https://cdn.test/v.jpg",
    webUrl: "https://skyshare.test/e/1",
})

beforeEach(() => {
    runtime.slots = []
    runtime.index = 0
    vi.clearAllMocks()
    api.createPostVisualBlob.mockResolvedValue({
        blob: new Blob(["x"]),
        videoDurationSec: undefined,
    })
})

describe("事後entry作成: sourceの送信", () => {
    it("Visual取得元がreplyでも、APIにはsourcePost（ルート）のuriが送られる", async () => {
        const root = makePost("root")
        const reply = withImage("reply")
        api.createEntry.mockResolvedValue({
            status: 200,
            data: {
                skyshareEntry: {
                    atUri: "at://did:plc:a/dev.nekono.skyshare.entry/e1",
                    uri: "https://skyshare.test/e/1",
                    visualUrl: "https://cdn.test/v.jpg",
                },
            },
        })
        const options: Options = { visualSourcePost: reply, sourcePost: root }

        let r = render(root, options)
        expect(r.display.kind).toBe("creatable")
        r.createEntryFromPost()
        await flush()

        expect(api.createPostVisualBlob).toHaveBeenCalledWith(reply)
        expect(api.createEntry).toHaveBeenCalledTimes(1)
        expect(api.createEntry.mock.calls[0][0].uri).toBe(root.uri)

        r = render(root, options)
        expect(r.display.kind).toBe("entry")
    })

    it("画像を持つ投稿が無ければ作成不可（ineligible）になる", () => {
        const r = render(makePost("root"))
        expect(r.display.kind).toBe("ineligible")
    })
})

describe("削除: 削除範囲の確定とダイアログ", () => {
    const root = withImage("root")
    const options = (extra: Options = {}): Options => ({ ...extra })

    const open = async (scope: EntryDeleteScope, extra: Options = {}) => {
        api.resolveEntryDeleteScope.mockResolvedValue(scope)
        const item = { ...root, skyshareEntry: entryOf(root) }
        let r = render(item, options(extra))
        r.requestDeleteEntry()
        await flush()
        r = render(item, options(extra))
        return { item, r }
    }

    it("deletableの削除範囲を確定してダイアログが開く", async () => {
        const scope: EntryDeleteScope = {
            kind: "deletable",
            posts: [root, makePost("r1")],
        }
        const { r } = await open(scope)
        expect(api.resolveEntryDeleteScope).toHaveBeenCalledWith(root.uri)
        expect(r.deleteScope).toEqual(scope)
        expect(r.isDeleteDialogOpen).toBe(true)
    })

    it("legacy（旧実装のentry）でもダイアログが開く", async () => {
        const { r } = await open({ kind: "legacy" })
        expect(r.deleteScope).toEqual({ kind: "legacy" })
        expect(r.isDeleteDialogOpen).toBe(true)
    })

    it("確定時はdeleteBskyThreadを送らず、deleteBskyPost:trueのみを送る", async () => {
        const onPostDeleted = vi.fn()
        api.deleteEntry.mockResolvedValue({ status: 200, data: {} })
        const { item, r } = await open(
            { kind: "deletable", posts: [root] },
            { onPostDeleted },
        )
        r.confirmDeleteEntry(true)
        await flush()

        expect(api.deleteEntry).toHaveBeenCalledTimes(1)
        const body = api.deleteEntry.mock.calls[0][0]
        expect(body).toEqual({
            uri: entryOf(root).uri,
            deleteBskyPost: true,
        })
        expect("deleteBskyThread" in body).toBe(false)
        expect(onPostDeleted).toHaveBeenCalledTimes(1)
        expect(render(item, { onPostDeleted }).display.kind).not.toBe("entry")
    })

    it("リンクのみ削除（deleteBskyPost:false）ではonPostDeletedを呼ばない", async () => {
        const onPostDeleted = vi.fn()
        api.deleteEntry.mockResolvedValue({ status: 200, data: {} })
        const { r } = await open(
            { kind: "deletable", posts: [root] },
            { onPostDeleted },
        )
        r.confirmDeleteEntry(false)
        await flush()

        expect(api.deleteEntry.mock.calls[0][0].deleteBskyPost).toBe(false)
        expect(onPostDeleted).not.toHaveBeenCalled()
    })

    it("削除APIが失敗（非200）した場合はonPostDeletedを呼ばず、entryを維持する", async () => {
        const onPostDeleted = vi.fn()
        api.deleteEntry.mockResolvedValue({ status: 500, data: {} })
        const { item, r } = await open(
            { kind: "deletable", posts: [root] },
            { onPostDeleted },
        )
        r.confirmDeleteEntry(true)
        await flush()

        expect(onPostDeleted).not.toHaveBeenCalled()
        const after = render(item, { onPostDeleted })
        expect(after.display.kind).toBe("entry")
        expect(after.deleteError).toBe("post.entry.deleteFailed")
    })

    it("キャンセルすると削除は実行されずダイアログが閉じる", async () => {
        const { item, r } = await open({ kind: "unknown" })
        r.cancelDeleteEntry()
        expect(api.deleteEntry).not.toHaveBeenCalled()
        expect(render(item).isDeleteDialogOpen).toBe(false)
    })
})
