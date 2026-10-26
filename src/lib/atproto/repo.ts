/**
 * `com.atproto.repo.listRecords` のレコード取得ユーティリティ。
 *
 * 責務と処理概要:
 * - cursor ページングを内部で辿り、指定 repo/collection のレコードを新しい順に、
 *   指定日時より古いページに達するまで収集する（`.kiro/specs/timeline-api`）。
 * - 実際に呼び出すメソッドは `listRecords` のみのため、`Agent` 全体ではなく
 *   最小インターフェース型を引数に取る（テストでは軽量なフェイクを渡せる）。
 */

import type { Agent } from "@atproto/api"

type ListRecordsAgent = {
    com: {
        atproto: {
            repo: Pick<Agent["com"]["atproto"]["repo"], "listRecords">
        }
    }
}

/**
 * 指定日時より新しいレコードを、新しい順に cursor ページングしながら取得する。
 *
 * 処理の趣旨:
 * - `listRecords` を `reverse: true`（rkey の降順＝TID の新しい順）で呼び、全件を読まずに
 *   必要な範囲で打ち切る。保存済みレコードの総数に比例した取得と解析を避けるため。
 * - ページ内のすべてのレコードの `value.createdAt` が `sinceMs` より古くなった時点で、
 *   次のページを取得しない。`createdAt` が文字列でない、または日時として読めないレコードは
 *   古いとみなさず、取得を続ける。
 * - 返すのは取得したページのレコードすべてで、`sinceMs` より古いレコードも含みうる
 *   （呼び出し元は始点にマージンを持たせ、レコード単位の絞り込みを必要としない）。
 *
 * Input:
 * - `agent`: `com.atproto.repo.listRecords` を持つ認証済み Agent（または同等の最小インターフェース）
 * - `params.repo`: 取得対象 repo DID
 * - `params.collection`: 取得対象コレクション
 * - `sinceMs`: 取得範囲の始点（エポックミリ秒）
 *
 * Output:
 * - 新しい順に並んだレコード配列
 *
 * 例:
 * - 1ページ目が全件 `sinceMs` より古い場合、そのページだけを返して打ち切る。
 */
export const listRecordsSince = async (
    agent: ListRecordsAgent,
    params: { repo: string; collection: string },
    sinceMs: number,
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
                reverse: true,
            })
            .then(res => res.data)

        const page = res.records ?? []
        records.push(...page)
        cursor = res.cursor

        const allOlder =
            page.length > 0 &&
            page.every((record: any) => {
                const createdAt = Date.parse(record?.value?.createdAt)
                return !Number.isNaN(createdAt) && createdAt < sinceMs
            })
        if (allOlder) break
    } while (cursor)

    return records
}
