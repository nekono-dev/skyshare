/**
 * Bluesky投稿（1件、またはスレッドとして複数件）と、各投稿に付随する
 * threadgate/postgate・skyshare entryを、`com.atproto.repo.applyWrites`で
 * 原子的に（全件成功か全件失敗か）作成するオーケストレーション。
 *
 * 責務と処理概要:
 * - 各投稿の`rkey`を`TID`で事前採番し、`app.bsky.feed.post`レコードの値を
 *   `buildBskyPostRecord`（`@/lib/atproto/post`）で組み立て、`cidForLex`
 *   （`@atproto/lex-cbor`）でCIDを事前計算する。これにより、次の投稿の
 *   `reply.parent`（および`reply.root`）や、同一投稿のskyshare entryの`source`を、
 *   PDSへの書き込みを待たずに構築できる（レコードCIDは値のDAG-CBORエンコード＋
 *   SHA-256という純粋関数であり、事前計算した値はPDSが実際に計算する値と一致する）。
 * - gate（threadgate/postgate）は`buildThreadgateRecord`/`buildPostgateRecord`
 *   （`@/lib/atproto/gate`）で、skyshare entryは`buildSkyshareEntryRecord`
 *   （`@/lib/entry/skyshareRecord`）で、それぞれレコード値を組み立てる。
 * - 組み立てた全レコードを1回の`applyWrites`で送信する。PDS側は1トランザクションとして
 *   全件成功/全件失敗を保証する。
 * - 戻り値は、事前計算した値ではなくPDSからの応答（`results`）を信頼して組み立てる。
 */
import { TID } from "@atproto/common-web"
import { cidForLex, type LexValue } from "@atproto/lex-cbor"
import type { AtpAgent } from "@atproto/api"
import type * as Components from "@/lib/api/schema/common"
import { buildBskyPostRecord, BSKY_POST_COLLECTION } from "@/lib/atproto/post"
import {
    buildThreadgateRecord,
    buildPostgateRecord,
    type PostGateValue,
} from "@/lib/atproto/gate"
import {
    buildSkyshareEntryRecord,
    toCreatedSkyshareEntry,
    type CreatedSkyshareEntry,
} from "@/lib/entry/skyshareRecord"

type ApplyWritesAgent = {
    com: {
        atproto: {
            repo: Pick<AtpAgent["com"]["atproto"]["repo"], "applyWrites">
        }
    }
}

/** 1件分の投稿入力。 */
export type ThreadPostInput = {
    text: string
    facets?: Components.CommonFacetsType
    langs?: string[]
    embed?: any
    selfLabel?: string
    gate?: PostGateValue
    /** 指定時のみ、この投稿に紐づくskyshare entryも同じバッチで作成する */
    entry?: {
        visual: any
        postText: string
        userName: string
    }
}

export type ThreadPostResult = {
    uri: string
    cid: string
    skyshareEntry?: CreatedSkyshareEntry
}

type WriteOp = {
    $type: string
    collection: string
    rkey: string
    value: Record<string, unknown>
}

/**
 * 投稿（1件、またはスレッドとして複数件）と、付随するgate・skyshare entryを、
 * 1回の`applyWrites`で原子的に作成する。
 *
 * Input:
 * - `agent`: `com.atproto.repo.applyWrites`を持つ認証済みAtpAgent（または同等の最小インターフェース）
 * - `did`: 投稿者のDID（`applyWrites`の`repo`に使う）
 * - `posts`: 投稿入力の配列（1件以上）
 * - `firstReply`: 先頭の投稿が接続する既存スレッドへのStrongRef（未指定なら通常投稿として開始）
 *
 * Output:
 * - `posts`と同じ順番の`ThreadPostResult[]`
 *
 * 失敗時の方針:
 * - `applyWrites`が失敗した場合はErrorをthrowする。呼び出し元でcatchして500を返す
 *   （部分成功状態は存在しない。原子的トランザクションのため）。
 *
 * 例:
 * - 入力: `posts=[{text:"1件目"}, {text:"2件目(リプライ)"}]`
 * - 出力: `[{uri:"at://.../post/aaa",cid:"bafy1"}, {uri:"at://.../post/bbb",cid:"bafy2"}]`
 *   （2件目のレコードは内部的に`reply:{root:1件目,parent:1件目}`を持って作成される）
 */
export const createBskyThread = async (
    agent: ApplyWritesAgent,
    did: string,
    posts: ThreadPostInput[],
    firstReply?: Components.CommonReplyRefType,
): Promise<ThreadPostResult[]> => {
    const writes: WriteOp[] = []
    const postWriteIndexes: number[] = []
    const entryWriteIndexes: (number | undefined)[] = []
    const entryRecords: (Record<string, unknown> | undefined)[] = []

    let prevTid: InstanceType<typeof TID> | undefined
    let rootRef: Components.CommonStrongRefType | undefined
    let prevPostRef: Components.CommonStrongRefType | undefined

    for (const [i, post] of posts.entries()) {
        const tid = TID.next(prevTid)
        prevTid = tid
        const rkey = tid.toString()
        const uri = `at://${did}/${BSKY_POST_COLLECTION}/${rkey}`
        const createdAt = new Date().toISOString()

        const reply: Components.CommonReplyRefType | undefined =
            i === 0
                ? firstReply
                : rootRef && prevPostRef
                  ? { root: rootRef, parent: prevPostRef }
                  : undefined

        const record = buildBskyPostRecord({
            text: post.text,
            facets: post.facets,
            langs: post.langs,
            embed: post.embed,
            selfLabel: post.selfLabel,
            reply,
            createdAt,
        })

        const cid = (await cidForLex(record as unknown as LexValue)).toString()
        const postRef: Components.CommonStrongRefType = { uri, cid }

        writes.push({
            $type: "com.atproto.repo.applyWrites#create",
            collection: BSKY_POST_COLLECTION,
            rkey,
            value: record,
        })
        postWriteIndexes.push(writes.length - 1)

        if (i === 0) {
            rootRef = reply?.root ?? postRef
        }
        prevPostRef = postRef

        if (post.gate) {
            const threadgateRecord = buildThreadgateRecord(
                uri,
                post.gate,
                createdAt,
            )
            const postgateRecord = buildPostgateRecord(
                uri,
                post.gate,
                createdAt,
            )
            if (threadgateRecord) {
                writes.push({
                    $type: "com.atproto.repo.applyWrites#create",
                    collection: "app.bsky.feed.threadgate",
                    rkey,
                    value: threadgateRecord,
                })
            }
            if (postgateRecord) {
                writes.push({
                    $type: "com.atproto.repo.applyWrites#create",
                    collection: "app.bsky.feed.postgate",
                    rkey,
                    value: postgateRecord,
                })
            }
        }

        if (post.entry) {
            const entryRkey = TID.nextStr()
            const entryRecord = buildSkyshareEntryRecord({
                sourceUri: uri,
                sourceCid: cid,
                visual: post.entry.visual,
                postText: post.entry.postText,
                userName: post.entry.userName,
                createdAt,
            })
            writes.push({
                $type: "com.atproto.repo.applyWrites#create",
                collection: "dev.nekono.skyshare.entry",
                rkey: entryRkey,
                value: entryRecord,
            })
            entryWriteIndexes.push(writes.length - 1)
            entryRecords.push(entryRecord)
        } else {
            entryWriteIndexes.push(undefined)
            entryRecords.push(undefined)
        }
    }

    const res = await agent.com.atproto.repo.applyWrites({
        repo: did,
        writes: writes as never,
    })
    const results = res.data.results ?? []

    return posts.map((_, i) => {
        const postResult = results[postWriteIndexes[i]] as
            { uri: string; cid: string } | undefined
        if (!postResult) {
            throw new Error(
                `createBskyThread: missing applyWrites result for post index ${i}`,
            )
        }

        const entryIndex = entryWriteIndexes[i]
        const entryRecord = entryRecords[i]
        let skyshareEntry: CreatedSkyshareEntry | undefined
        if (entryIndex !== undefined && entryRecord) {
            const entryResult = results[entryIndex] as
                { uri: string; cid: string } | undefined
            if (entryResult) {
                skyshareEntry = toCreatedSkyshareEntry(
                    entryRecord,
                    did,
                    entryResult,
                )
            }
        }

        return {
            uri: postResult.uri,
            cid: postResult.cid,
            skyshareEntry,
        }
    })
}
