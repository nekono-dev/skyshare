/**
 * 責務: アンケートの 2 つのテーブルを作る移行（0001_initial.sql）の構造を確かめる。
 * 処理概要: 既存の移行をすべて適用した SQLite から、列・主キー・挿入順（rowid）の有無・外部キーを調べる。
 */
import { describe, expect, test } from "vitest"
import { DatabaseSync } from "node:sqlite"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

/** 全移行を適用した SQLite を返す */
const migrated = (): DatabaseSync => {
    const db = new DatabaseSync(":memory:")
    const dir = path.resolve(__dirname, "../../../migrations")
    for (const file of readdirSync(dir).sort()) {
        db.exec(readFileSync(path.join(dir, file), "utf8"))
    }
    return db
}

type Column = { name: string; type: string; notnull: number; pk: number }

/** テーブルの列情報を返す */
const columnsOf = (db: DatabaseSync, table: string): Column[] =>
    db.prepare(`PRAGMA table_info(${table})`).all() as Column[]

describe("アンケートの表の移行", () => {
    test("初期マイグレーション 1 本で予約・OAuth・アンケートの最終構造を作る", () => {
        const dir = path.resolve(__dirname, "../../../migrations")
        expect(readdirSync(dir).filter(file => file.endsWith(".sql"))).toEqual([
            "0001_initial.sql",
        ])
        const db = migrated()
        const tables = db
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
            )
            .all()
            .map(row => row.name)
        expect(tables).toEqual([
            "schedule_credentials",
            "schedule_oauth_states",
            "scheduled_posts",
            "survey_answers",
            "survey_respondents",
        ])
        const credentials = columnsOf(db, "schedule_credentials")
        expect(credentials.map(column => column.name)).toEqual([
            "did",
            "service",
            "token_enc",
            "updated_at",
            "authorized_at",
            "reauth_required",
        ])
        expect(
            db
                .prepare("PRAGMA index_info(scheduled_posts_owner)")
                .all()
                .map(row => row.name),
        ).toEqual(["did", "status", "run_at"])
    })

    test("[survey-api/10.7] 全移行の適用で 2 つの表ができる", () => {
        const db = migrated()
        const names = (
            db
                .prepare(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'survey_%'",
                )
                .all() as { name: string }[]
        )
            .map(r => r.name)
            .sort()
        expect(names).toEqual(["survey_answers", "survey_respondents"])
    })

    test("[survey-api/6.5] 回答済みの集合は、アンケートと回答者の値だけを主キーとして持ち、参照も時刻も持たない", () => {
        const db = migrated()
        const cols = columnsOf(db, "survey_respondents")
        expect(cols.map(c => c.name)).toEqual(["survey_id", "did_hash"])
        expect(cols.every(c => c.type === "TEXT" && c.notnull === 1)).toBe(true)
        expect(cols.map(c => c.pk)).toEqual([1, 2])
        expect(
            db.prepare("PRAGMA foreign_key_list(survey_respondents)").all(),
        ).toEqual([])
    })

    test("[survey-api/6.2][survey-api/6.3] 匿名の回答は、内容と回答した日だけを持ち、回答者に関わる列を持たない", () => {
        const db = migrated()
        const cols = columnsOf(db, "survey_answers")
        expect(cols.map(c => c.name)).toEqual([
            "survey_id",
            "id",
            "answers",
            "answered_on",
        ])
        expect(cols.every(c => c.type === "TEXT" && c.notnull === 1)).toBe(true)
        expect(cols.map(c => c.pk)).toEqual([1, 2, 0, 0])
        expect(
            db.prepare("PRAGMA foreign_key_list(survey_answers)").all(),
        ).toEqual([])
    })

    test("[survey-api/6.5] どちらの表も挿入順（rowid）を持たない", () => {
        const db = migrated()
        for (const table of ["survey_respondents", "survey_answers"]) {
            expect(() =>
                db.prepare(`SELECT rowid FROM ${table}`).all(),
            ).toThrow()
        }
    })

    test("[survey-api/6.5] 同じ組の重複は主キーで拒まれ、別のアンケートなら入る", () => {
        const db = migrated()
        const ins = db.prepare(
            "INSERT INTO survey_respondents (survey_id, did_hash) VALUES (?, ?)",
        )
        ins.run("s1", "h")
        expect(() => ins.run("s1", "h")).toThrow(
            /UNIQUE constraint failed: survey_respondents/,
        )
        expect(() => ins.run("s2", "h")).not.toThrow()
        const insA = db.prepare(
            "INSERT INTO survey_answers (survey_id, id, answers, answered_on) VALUES (?, ?, ?, ?)",
        )
        insA.run("s1", "a", "{}", "2026-10-28")
        expect(() => insA.run("s1", "a", "{}", "2026-10-28")).toThrow(
            /UNIQUE constraint failed/,
        )
    })
})
