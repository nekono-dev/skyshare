/**
 * D1 互換のテスト用データベース。
 *
 * 責務と処理概要:
 * - Node 標準の SQLite（`node:sqlite`）の上に、予約ストアが使う D1 の API
 *   （`prepare().bind().run()/first()/all()`）だけを載せる。
 * - `migrations/` の SQL を昇順に適用した状態で返す。
 * - 発行した問い合わせの回数を `queryCount` で数えられる（問い合わせ回数の検査用）。
 */
import { DatabaseSync } from "node:sqlite"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import type { D1Database } from "@/lib/schedule/cfTypes"

type Params = (string | number | null)[]

export type FakeD1 = D1Database & { queryCount: number }

const toRow = (row: Record<string, unknown> | undefined) =>
    row ? ({ ...row } as Record<string, unknown>) : null

export const createFakeD1 = (): FakeD1 => {
    const sqlite = new DatabaseSync(":memory:")
    const dir = path.resolve(__dirname, "../../migrations")
    for (const file of readdirSync(dir).sort()) {
        sqlite.exec(readFileSync(path.join(dir, file), "utf8"))
    }

    const state = { queryCount: 0 }

    const makeStatement = (sql: string, params: Params = []) => ({
        bind: (...args: Params) => makeStatement(sql, args),
        run: async () => {
            state.queryCount += 1
            const info = sqlite.prepare(sql).run(...params)
            return {
                success: true,
                meta: { changes: Number(info.changes) },
            }
        },
        first: async () => {
            state.queryCount += 1
            return toRow(sqlite.prepare(sql).get(...params))
        },
        all: async () => {
            state.queryCount += 1
            const rows = sqlite.prepare(sql).all(...params)
            return {
                success: true,
                results: rows.map(r => toRow(r)),
                meta: {},
            }
        },
        __sql: sql,
        __params: params,
    })

    const db = {
        prepare: (sql: string) => makeStatement(sql),
        get queryCount() {
            return state.queryCount
        },
    }
    return db as unknown as FakeD1
}
