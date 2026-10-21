/**
 * ライブテスト: 後始末と掃除（実アカウント）。
 *
 * 責務と処理概要:
 * - entryを持たない投稿（アプリのAPIでは削除できない投稿）を、終了時の削除で取り除けること、
 *   同じ識別子の投稿が残らないことを確認する。
 * - 掃除（`sweepStale`）が、古い識別子付きの投稿だけを削除し、作成直後の投稿と元からある投稿を
 *   削除しないことを確認する。
 */
import type { AtpAgent } from "@atproto/api"
import { expect, test } from "./liveTest"
import {
    createPost,
    deleteByTag,
    makeRunTag,
    POST_COLLECTION,
    sweepStale,
} from "./pds"

test.describe.configure({ timeout: 120_000 })

/** 検証用アカウントの投稿のうち、本文に`text`を含むもの（先頭100件）の件数 */
const countContaining = async (agent: AtpAgent, text: string) => {
    const res = await agent.com.atproto.repo.listRecords({
        repo: agent.assertDid,
        collection: POST_COLLECTION,
        limit: 100,
    })
    return res.data.records.filter(r =>
        String((r.value as { text?: string }).text ?? "").includes(text),
    ).length
}

/** 元からある（識別子の無い）投稿のURI（先頭100件） */
const listOriginalUris = async (agent: AtpAgent) => {
    const res = await agent.com.atproto.repo.listRecords({
        repo: agent.assertDid,
        collection: POST_COLLECTION,
        limit: 100,
    })
    return res.data.records
        .filter(
            r =>
                !/^\[e2e /.test(
                    String((r.value as { text?: string }).text ?? ""),
                ),
        )
        .map(r => r.uri)
}

test("e2elive/AC-8 e2elive/AC-21: entryを持たない投稿を終了時の削除で取り除け、同じ識別子の投稿が残らない", async ({
    agent,
    tag,
}) => {
    await createPost(agent, { text: `${tag} cleanup a` })
    await createPost(agent, { text: `${tag} cleanup b` })
    expect(await countContaining(agent, tag)).toBe(2)

    const deleted = await deleteByTag(agent, tag)
    expect(deleted).toEqual({ posts: 2, entries: 0 })
    expect(await countContaining(agent, tag)).toBe(0)
})

test("e2elive/AC-9 e2elive/AC-22: 掃除は2時間前の投稿だけを削除し、作成直後の投稿と元からある投稿は残す", async ({
    agent,
    tag,
}) => {
    const staleTag = makeRunTag(Date.now() - 2 * 60 * 60 * 1000)
    await createPost(agent, { text: `${staleTag} cleanup stale` })
    await createPost(agent, { text: `${tag} cleanup fresh` })
    const originalBefore = await listOriginalUris(agent)

    await sweepStale(agent)

    expect(await countContaining(agent, staleTag)).toBe(0)
    expect(await countContaining(agent, tag)).toBe(1)
    // 削除で先頭100件の窓の中身が入れ替わるため、件数ではなく「元の投稿が全て残っている」ことを確認する
    expect(await listOriginalUris(agent)).toEqual(
        expect.arrayContaining(originalBefore),
    )
})
