/**
 * `com.atproto.repo.listRecords` の全件取得ユーティリティ。
 *
 * 責務と処理概要:
 * - cursor ページングを内部で辿り、指定 repo/collection のレコードを全件収集する。
 * - 実際に呼び出すメソッドは `listRecords` のみのため、`AtpAgent` 全体ではなく
 *   最小インターフェース型を引数に取る（テストでは軽量なフェイクを渡せる）。
 */

import type { AtpAgent } from "@atproto/api"

type ListRecordsAgent = {
    com: {
        atproto: {
            repo: Pick<AtpAgent["com"]["atproto"]["repo"], "listRecords">
        }
    }
}

/**
 * 指定 repo/collection のレコードを cursor ページングしながら全件取得する。
 *
 * Input:
 * - `agent`: `com.atproto.repo.listRecords` を持つ認証済み AtpAgent（または同等の最小インターフェース）
 * - `params.repo`: 取得対象 repo DID
 * - `params.collection`: 取得対象コレクション（例: `dev.nekono.skyshare.entry`）
 *
 * Output:
 * - `listRecords` の `records` を全ページぶん連結した配列
 *
 * 例:
 * - 入力: `listAllRecords(agent, { repo: "did:plc:abc", collection: "dev.nekono.skyshare.entry" })`
 * - 出力: 2ページに渡って合計150件あれば、150件の配列
 */
export const listAllRecords = async (
    agent: ListRecordsAgent,
    params: { repo: string; collection: string },
) => {
    const records: any[] = []
    let cursor: string | undefined

    do {
        const res = await agent.com.atproto.repo
            .listRecords({
                repo: params.repo,
                collection: params.collection,
                cursor,
                limit: 100,
            })
            .then(res => res.data)

        records.push(...(res.records ?? []))
        cursor = res.cursor
    } while (cursor)

    return records
}
