/**
 * ライブテスト: 第三者の返信が、ルート削除後も残ること（任意。第三者アカウントが必要）。
 *
 * 責務と処理概要:
 * - `SKYSHARE_E2E_PEER_IDENTIFIER`・`SKYSHARE_E2E_PEER_APP_PASSWORD`が無ければスキップする
 *   （`specs/e2elive/design.md §9`）。
 * - 検証用アカウントのスレッド（A→B）のルートAに、第三者アカウントが返信する。
 *   Aの「リンク・Bluesky投稿を削除」（A・Bが削除される）の後も、第三者の返信は残る。
 * - 第三者アカウント側の作成物も、終了時に本文の識別子で削除する。
 */
import { expect, test } from "./liveTest"
import { loadPeerAccount } from "./env"
import { getPublicPostText, gotoAndFindCard, makePng } from "./helpers"
import {
    createEntryRecord,
    createPdsAgent,
    createPost,
    createThread,
    deleteByTag,
} from "./pds"

test.describe.configure({ timeout: 180_000 })

test("e2elive/AC-17: ルートの削除後も、第三者の返信は残る", async ({
    page,
    agent,
    tag,
}) => {
    const peer = loadPeerAccount()
    test.skip(!peer, "第三者アカウントの認証情報が未設定")
    const peerAgent = await createPdsAgent(peer!, "peer")

    try {
        const rootText = `${tag} peer root`
        const [root] = await createThread(agent, [
            { text: rootText, images: [makePng(300, 200)] },
            { text: `${tag} peer own reply` },
        ])
        await createEntryRecord(agent, {
            source: root,
            visual: makePng(300, 200),
            caption: rootText,
        })
        const peerReply = await createPost(peerAgent, {
            text: `${tag} peer third party`,
            reply: { root, parent: root },
        })

        const card = await gotoAndFindCard(page, "/", rootText)
        await card.getByRole("button", { name: "投稿を削除" }).click()
        await page
            .getByRole("button", { name: "リンク・Bluesky投稿を削除" })
            .click()
        const dialog = page.getByRole("dialog")
        // 第三者の返信は削除予定に含まれず、残る旨が表示される
        await expect(dialog).toContainText(
            "第三者からの返信は削除されず残ります",
        )
        await dialog.getByRole("button", { name: "全て削除" }).click()

        await expect
            .poll(() => getPublicPostText(root.uri), { timeout: 60_000 })
            .toBeNull()
        expect(await getPublicPostText(peerReply.uri)).toBe(
            `${tag} peer third party`,
        )
    } finally {
        await deleteByTag(peerAgent, tag)
    }
})
