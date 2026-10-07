/**
 * lexicons/ 配下の lexicon JSON の検証テスト。
 *
 * 責務と処理概要:
 * - 型付きクライアントの生成（lex gen-api）を廃止したため、lexicon 自体の妥当性は
 *   本テストで担保する（`npm test` = ローカル・CI 共通の検証工程）。
 * - 公式ライブラリ `@atproto/lexicon` の `Lexicons` で全 lexicon を読み込み、
 *   スキーマ構文・`$ref` の解決・レコードのバリデーションが成立することを確認する。
 * - `lexicons/com/atproto/repo/strongRef.json` は atproto サブモジュールへの symlink のため、
 *   サブモジュール未取得（空ディレクトリ）の場合もここで検知される。
 */
import { readFileSync } from "node:fs"
import { Lexicons, jsonToLex, type LexiconDoc } from "@atproto/lexicon"
import { describe, expect, it } from "vitest"

import { ENTRY_COLLECTION, DEFS_NSID } from "@/lib/atproto/nsid"

// lexicons/ 配下の全 JSON を `/lexicons/...` 形式のパスをキーに読み込む（symlink も辿る）
const lexiconFiles = import.meta.glob<LexiconDoc>("/lexicons/**/*.json", {
    eager: true,
    import: "default",
})
const docs = Object.values(lexiconFiles)

describe("lexicon JSONの検証", () => {
    it("lexicon JSONが1件以上読み込める", () => {
        expect(docs.length).toBeGreaterThan(0)
    })

    it("全lexiconがスキーマとして妥当で、$refがすべて解決できる", () => {
        // コンストラクタが各docを検証して登録する。不正なdocは例外になる。
        const lexicons = new Lexicons(docs)
        for (const doc of docs) {
            for (const defName of Object.keys(doc.defs)) {
                expect(() =>
                    lexicons.getDefOrThrow(`${doc.id}#${defName}`),
                ).not.toThrow()
            }
        }
        // 参照先の実在確認（entry.json が参照する先）
        expect(() =>
            lexicons.getDefOrThrow("com.atproto.repo.strongRef"),
        ).not.toThrow()
        expect(() =>
            lexicons.getDefOrThrow(`${DEFS_NSID}#manifest`),
        ).not.toThrow()
    })

    it("ファイルパスとlexiconのidが対応している（NSID → パス）", () => {
        for (const [path, doc] of Object.entries(lexiconFiles)) {
            const expected = `/lexicons/${doc.id.split(".").join("/")}.json`
            // `<prefix>.defs` のような末尾セグメントがファイル名になる
            expect(path).toBe(expected)
        }
    })

    it("lexiconのidが重複していない", () => {
        const ids = docs.map(doc => doc.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it("atprotoサブモジュール由来のstrongRefがリポジトリ公式の定義である", () => {
        const strongRef = JSON.parse(
            readFileSync("lexicons/com/atproto/repo/strongRef.json", "utf-8"),
        )
        expect(strongRef.id).toBe("com.atproto.repo.strongRef")
    })
})

describe("entryレコードのバリデーション", () => {
    const lexicons = new Lexicons(docs)
    // JSON形式（$link / $type: blob）を lexicon の内部表現（BlobRef）へ変換して検証する
    const validRecord = jsonToLex({
        $type: ENTRY_COLLECTION,
        source: {
            uri: "at://did:plc:abc/app.bsky.feed.post/3lxyz",
            cid: "bafyreib2rxk3rybk3aobmv5cjuql3bm2twh4jo5uxgf5kpqcsgz7soitae",
        },
        manifest: {
            visual: {
                $type: "blob",
                ref: {
                    $link: "bafkreibabalobzn6cd366ukcsjycp4yymjymgfxcv6xczmlgpemzkz3cfa",
                },
                mimeType: "image/png",
                size: 100,
            },
            heading: "見出し",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
    }) as Record<string, any>

    it("正しいレコードを受理する", () => {
        expect(() =>
            lexicons.assertValidRecord(ENTRY_COLLECTION, validRecord),
        ).not.toThrow()
    })

    it("必須項目（manifest）の欠落を拒否する", () => {
        const { manifest: _manifest, ...rest } = validRecord
        expect(() =>
            lexicons.assertValidRecord(ENTRY_COLLECTION, rest),
        ).toThrow()
    })

    it("headingの上限（100文字）超過を拒否する", () => {
        const record = {
            ...validRecord,
            manifest: { ...validRecord.manifest, heading: "あ".repeat(101) },
        }
        expect(() =>
            lexicons.assertValidRecord(ENTRY_COLLECTION, record),
        ).toThrow()
    })
})
