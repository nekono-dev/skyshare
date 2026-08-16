/**
 * dev.nekono.skyshare.entry レコード作成ユーティリティ。
 *
 * 責務と処理概要:
 * - bsky 投稿情報と visual blob から skyshare entry レコードを組み立て、atproto へ作成する。
 * - `/v2/entry` の新規投稿時、および `uri` 指定時（既存投稿からの発行、from-post 相当）の両方から共有される。
 */
import type { AtpAgent, ComAtprotoServerRefreshSession } from "@atproto/api"
import { blobToCdnUrl } from "@/lib/entry"
import { parseAtUri, skyshareEntryUrlgen } from "@/lib/url"

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
 * skyshare entry レコードを作成し、その詳細情報を返す。
 *
 * 処理の趣旨:
 * - bsky 投稿の URI・CID と、visual blob、テキスト情報を含むレコード構造を生成・作成する。
 * - 副作用: atproto 外部 API を呼び出してレコードを作成。
 * - 呼び出し元（クライアント）がフルリロード無しに削除ボタン等を出し分けられるよう、
 *   一覧取得 API（GET /v2/entry）が返す形と同等の情報を返す。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent
 * - `bskyPostUri`: bsky 投稿の AT URI（source）
 * - `bskyPostCid`: bsky 投稿の CID
 * - `visual`: skyshare entry の manifest.visual に使う blob 参照
 * - `postText`: 投稿本文（caption として使用）
 * - `userName`: 投稿者表示名
 * - `session`: セッション情報（DID 取得用）
 *
 * Output:
 * - `CreatedSkyshareEntry`（作成失敗時は `undefined`）
 *
 * 失敗時の方針:
 * - atproto API 失敗時は Error を throw。呼び出し元で catch して 500 を返す。
 *
 * 例:
 * - 入力：agent(Auth済み),uri="at://...",cid="bafy...",visual=blobRef,postText="Hello",userName="alice"
 * - 出力：{ atUri: "at://.../dev.nekono.skyshare.entry/xyz", webUrl: "https://skyshare.dev/did/rkey", ... }
 */
export const createSkyshareEntry = async (
    agent: AtpAgent,
    bskyPostUri: string,
    bskyPostCid: string,
    visual: any,
    postText: string,
    userName: string,
    session: ComAtprotoServerRefreshSession.OutputSchema,
): Promise<CreatedSkyshareEntry | undefined> => {
    const createdAt = new Date().toISOString()
    const headingText = postText.trim()

    const record = {
        $type: "dev.nekono.skyshare.entry",
        source: {
            uri: bskyPostUri,
            cid: bskyPostCid,
        },
        manifest: {
            $type: "dev.nekono.skyshare.defs#manifest",
            visual,
            heading: `${userName} 's Post`,
            caption: headingText.length > 0 ? headingText : "",
        },
        createdAt,
    }

    console.debug("createSkyshareEntry: record to create", record)

    const createRecordRes = await agent.com.atproto.repo.createRecord({
        repo: session.did,
        collection: "dev.nekono.skyshare.entry",
        record,
    })

    const parsedSkyshareUri = parseAtUri(createRecordRes.data.uri)
    if (!parsedSkyshareUri) {
        return undefined
    }

    return {
        atUri: createRecordRes.data.uri,
        cid: createRecordRes.data.cid,
        createdAt,
        sourceUri: bskyPostUri,
        sourceCid: bskyPostCid,
        heading: record.manifest.heading,
        caption: record.manifest.caption,
        visualUrl: blobToCdnUrl(session.did, visual),
        webUrl: skyshareEntryUrlgen(
            parsedSkyshareUri.repo,
            parsedSkyshareUri.rkey,
        ),
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
    agent: AtpAgent,
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
