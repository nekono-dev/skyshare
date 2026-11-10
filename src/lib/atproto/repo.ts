/**
 * `com.atproto.repo.listRecords` を cursor でたどり、全件が指定日時より古いページが現れた時点で打ち切る。
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
 * 指定日時より新しいレコードを、cursor ページングしながら取得する。
 *
 * - `listRecords` を既定の並びで呼ぶ。ページ内のすべてのレコードの `value.createdAt` が `sinceMs` より古いとき、次のページを取得しない。この打ち切りは、既定の並びが新しい順であることを前提とする（lexicon は並びを定めていないため、前提として書く）。
 * - `Date.parse` が NaN を返すレコード（`createdAt` が無い、または日時として読めない値）は古いとみなさず、取得を続ける。
 * - 返すのは取得したページのレコードすべてで、`sinceMs` より古いレコードも含みうる。レコード単位の絞り込みは行わない。
 *
 * Input:
 * - `agent`: `com.atproto.repo.listRecords` を持つ認証済み Agent（または同等の最小インターフェース）
 * - `params.repo`: 取得対象 repo DID
 * - `params.collection`: 取得対象コレクション
 * - `sinceMs`: 取得範囲の始点（エポックミリ秒）
 *
 * Output:
 * - 取得したレコードの配列（ページの順に連結したもの）
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
