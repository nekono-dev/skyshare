/**
 * dev.nekono.skyshare.entry レコードのビルダー・更新ユーティリティ。
 *
 * 責務と処理概要:
 * - bsky 投稿情報と visual blob から skyshare entry レコードの値を組み立てる純粋関数
 *   （`buildSkyshareEntryRecord`）を提供する。実際に atproto へ書き込む処理
 *   （`com.atproto.repo.applyWrites`での原子的な作成）は `src/lib/entry/createBskyThread.ts` が担う。
 * - 更新（`updateSkyshareEntry`、PUT /v2/entry用）は単一レコードの読み書きのみのため、
 *   従来通りこのファイルが直接 atproto を呼び出す。
 */
import type { AtpAgent } from "@atproto/api"
import { blobToCdnUrl, ENTRY_COLLECTION } from "@/lib/entry/entry"
import { skyshareEntryUrlgen } from "@/lib/entry/url"

type RepoUpdateAgent = {
    com: {
        atproto: {
            repo: Pick<
                AtpAgent["com"]["atproto"]["repo"],
                "getRecord" | "putRecord"
            >
        }
    }
}

/**
 * 作成に成功した skyshare entry の情報。
 * `atUri` は削除 API（DELETE /v2/entry）の対象指定に必要。
 */
export type CreatedSkyshareEntry = {
    atUri: string
    cid: string
    createdAt: string
    sourceUri: string
    sourceCid: string
    heading: string
    caption: string
    visualUrl?: string
    webUrl: string
}

/**
 * skyshare entry レコードの値を組み立てる（純粋関数、副作用なし）。
 *
 * 処理の趣旨:
 * - bsky 投稿の URI・CID と、visual blob、テキスト情報から
 *   `dev.nekono.skyshare.entry` レコードの値を組み立てる。
 *
 * Input:
 * - `sourceUri`/`sourceCid`: 紐づく bsky 投稿の AT URI・CID
 * - `visual`: skyshare entry の manifest.visual に使う blob 参照
 * - `postText`: 投稿本文（caption として使用）
 * - `userName`: 投稿者表示名
 * - `createdAt`: ISO 8601 の作成日時
 *
 * Output:
 * - `dev.nekono.skyshare.entry` レコードの値（`$type`込み）
 */
export const buildSkyshareEntryRecord = (params: {
    sourceUri: string
    sourceCid: string
    visual: any
    postText: string
    userName: string
    createdAt: string
}): Record<string, unknown> => {
    const { sourceUri, sourceCid, visual, postText, userName, createdAt } =
        params
    const headingText = postText.trim()

    return {
        $type: ENTRY_COLLECTION,
        source: {
            uri: sourceUri,
            cid: sourceCid,
        },
        manifest: {
            $type: "dev.nekono.skyshare.defs#manifest",
            visual,
            heading: `${userName} 's Post`,
            caption: headingText.length > 0 ? headingText : "",
        },
        createdAt,
    }
}

/**
 * `buildSkyshareEntryRecord`で組み立てたレコード値と、実際に作成された結果
 * （atproto応答のuri/cid）から、レスポンス用の `CreatedSkyshareEntry` を組み立てる。
 *
 * Input:
 * - `record`: `buildSkyshareEntryRecord`が返したレコード値
 * - `did`: entryレコードのrepo（DID）。CDN URL組み立てに使う
 * - `result`: 実際に作成された結果（`{ uri, cid }`。`applyWrites`の`CreateResult`、
 *   または`createRecord`のレスポンス）
 *
 * Output:
 * - `CreatedSkyshareEntry`
 */
export const toCreatedSkyshareEntry = (
    record: Record<string, unknown>,
    did: string,
    result: { uri: string; cid: string },
): CreatedSkyshareEntry => {
    const manifest = record.manifest as {
        visual?: { ref?: unknown; mimeType?: string }
        heading: string
        caption: string
    }
    const source = record.source as { uri: string; cid: string }
    const rkey = result.uri.split("/").slice(-1)[0]

    return {
        atUri: result.uri,
        cid: result.cid,
        createdAt: record.createdAt as string,
        sourceUri: source.uri,
        sourceCid: source.cid,
        heading: manifest.heading,
        caption: manifest.caption,
        visualUrl: blobToCdnUrl(did, manifest.visual),
        webUrl: skyshareEntryUrlgen(did, rkey),
    }
}

/**
 * 更新に成功した skyshare entry の情報。
 */
export type UpdatedSkyshareEntry = {
    atUri: string
    cid: string
    heading: string
    caption: string
}

/**
 * skyshare entry レコードの heading/caption を更新する。
 *
 * 処理の趣旨:
 * - atproto の putRecord はレコード全体を書き直す方式のため、まず対象レコードを
 *   取得し、source・manifest.visual・createdAt は既存値のまま維持しつつ
 *   manifest.heading/caption のみ差し替えて書き戻す。
 * - 取得時の cid を swapRecord に指定し、取得後に他リクエストがレコードを
 *   更新していた場合の競合（lost update）を検出する。
 * - 副作用: atproto 外部 API を呼び出してレコードを取得・更新。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent
 * - `repo`: 対象レコードの repo（DID）
 * - `rkey`: 対象レコードの rkey
 * - `heading`: 新しい heading
 * - `caption`: 新しい caption
 *
 * Output:
 * - `UpdatedSkyshareEntry`
 *
 * 失敗時の方針:
 * - getRecord/putRecord が失敗した場合は Error を throw する。呼び出し元で
 *   catch して resolveXrpcStatus によりステータスへ変換する
 *   （対象が見つからない場合は RecordNotFound として自動的に 404 になる）。
 *
 * 例:
 * - 入力：agent(Auth済み),repo="did:plc:abc",rkey="3lxyz",heading="旅行",caption="京都にて"
 * - 出力：{ atUri: "at://did:plc:abc/dev.nekono.skyshare.entry/3lxyz", cid: "bafy...", heading: "旅行", caption: "京都にて" }
 */
export const updateSkyshareEntry = async (
    agent: RepoUpdateAgent,
    repo: string,
    rkey: string,
    heading: string,
    caption: string,
): Promise<UpdatedSkyshareEntry> => {
    const currentRes = await agent.com.atproto.repo.getRecord({
        repo,
        collection: "dev.nekono.skyshare.entry",
        rkey,
    })
    const current = currentRes.data.value as {
        source: { uri: string; cid: string }
        manifest: { visual: unknown }
        createdAt: string
    }

    const record = {
        $type: "dev.nekono.skyshare.entry",
        source: current.source,
        manifest: {
            $type: "dev.nekono.skyshare.defs#manifest",
            visual: current.manifest.visual,
            heading,
            caption,
        },
        createdAt: current.createdAt,
    }

    const putRes = await agent.com.atproto.repo.putRecord({
        repo,
        collection: "dev.nekono.skyshare.entry",
        rkey,
        record,
        swapRecord: currentRes.data.cid,
    })

    return {
        atUri: putRes.data.uri,
        cid: putRes.data.cid,
        heading,
        caption,
    }
}
