/**
 * ライブテスト共通のフィクスチャ（`test`）。
 *
 * 責務と処理概要:
 * - `agent`: 検証用アカウントのPDSエージェント（`pds.ts`）。
 * - `tag`: そのテスト専用の識別子（`makeRunTag`）。テストの成否にかかわらず、終了時に
 *   この識別子の投稿とentryを`deleteByTag`で削除する（`specs/e2elive/design.md §7`）。
 *   テストが作る投稿の本文は、必ずこの`tag`で始めること。
 */
import type { AtpAgent } from "@atproto/api"
import { test as base } from "../fixtures"
import { loadLiveAccount } from "./env"
import { createPdsAgent, deleteByTag, makeRunTag } from "./pds"

export { expect } from "../fixtures"

export const test = base.extend<{ agent: AtpAgent; tag: string }>({
    // eslint-disable-next-line no-empty-pattern
    agent: async ({}, use) => {
        await use(await createPdsAgent(loadLiveAccount()!))
    },
    tag: async ({ agent }, use) => {
        const tag = makeRunTag()
        try {
            await use(tag)
        } finally {
            await deleteByTag(agent, tag)
        }
    },
})
