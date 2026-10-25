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

import {
    ENTRY_COLLECTION,
    DEFS_NSID,
    createNsidSet,
    resolveEntryLexiconId,
} from "@/lib/atproto/nsid"

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

    it("[lexicon/AC-10] 全lexiconがスキーマとして妥当で、$refがすべて解決できる", () => {
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

    it("[lexicon/AC-10] ファイルパスとlexiconのidが対応している（NSID → パス）", () => {
        for (const [path, doc] of Object.entries(lexiconFiles)) {
            const expected = `/lexicons/${doc.id.split(".").join("/")}.json`
            // `<prefix>.defs` のような末尾セグメントがファイル名になる
            expect(path).toBe(expected)
        }
    })

    it("[lexicon/AC-10] lexiconのidが重複していない", () => {
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

    it("[lexicon/AC-1] 正しいレコードを受理する", () => {
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

    it("[lexicon/AC-4] headingの上限（100バイト）超過を拒否し、ちょうどは受理する", () => {
        const record = {
            ...validRecord,
            manifest: { ...validRecord.manifest, heading: "a".repeat(101) },
        }
        expect(() =>
            lexicons.assertValidRecord(ENTRY_COLLECTION, record),
        ).toThrow()
        expect(() =>
            lexicons.assertValidRecord(ENTRY_COLLECTION, {
                ...validRecord,
                manifest: {
                    ...validRecord.manifest,
                    heading: "a".repeat(100),
                },
            }),
        ).not.toThrow()
    })

    it("[lexicon/AC-4] captionの上限（300バイト）超過を拒否し、代表画像はPNG・JPEG・WebPだけを許可する定義になっている", () => {
        const withManifest = (manifest: Record<string, unknown>) => ({
            ...validRecord,
            manifest: { ...validRecord.manifest, ...manifest },
        })
        expect(() =>
            lexicons.assertValidRecord(
                ENTRY_COLLECTION,
                withManifest({ caption: "a".repeat(300) }),
            ),
        ).not.toThrow()
        expect(() =>
            lexicons.assertValidRecord(
                ENTRY_COLLECTION,
                withManifest({ caption: "a".repeat(301) }),
            ),
        ).toThrow()
        // 代表画像の形式は、lexicon の定義（accept）で許可する。検証ライブラリは accept を強制しない
        const defs = docs.find(doc => doc.id === DEFS_NSID)!
        const visual = (defs.defs.manifest as any).properties.visual
        expect(visual.type).toBe("blob")
        expect(visual.accept).toEqual(["image/png", "image/jpeg", "image/webp"])
    })

    it("[lexicon/AC-2] 投稿以外のレコード種別を指す派生元への参照を受理する", () => {
        for (const uri of [
            "at://did:plc:abc/app.bsky.actor.profile/self",
            "at://did:plc:abc/app.bsky.graph.list/3lxyz",
        ]) {
            expect(() =>
                lexicons.assertValidRecord(ENTRY_COLLECTION, {
                    ...validRecord,
                    source: { ...validRecord.source, uri },
                }),
            ).not.toThrow()
        }
    })

    it("[lexicon/AC-3] 代表画像の無いマニフェストを拒否し、見出しと説明文の無いマニフェストを受理する", () => {
        const { visual: _visual, ...withoutVisual } = validRecord.manifest
        expect(() =>
            lexicons.assertValidRecord(ENTRY_COLLECTION, {
                ...validRecord,
                manifest: withoutVisual,
            }),
        ).toThrow()
        expect(() =>
            lexicons.assertValidRecord(ENTRY_COLLECTION, {
                ...validRecord,
                manifest: { visual: validRecord.manifest.visual },
            }),
        ).not.toThrow()
    })
})

describe("別ドメインへの書き換え", () => {
    const FROM = "dev.nekono.skyshare"
    const TO = "example.org.app"

    it("[lexicon/AC-6] idと参照を別ドメインのNSIDに書き換えると、導出される値とURIの扱いが書き換え後の値に従い、定義が妥当になる", () => {
        // 運用者が行う手順と同じく、entry.json・defs.json の id と ref の文字列だけを書き換える
        const rewritten = docs
            .filter(doc => doc.id.startsWith(`${FROM}.`))
            .map(doc => JSON.parse(JSON.stringify(doc).replaceAll(FROM, TO)))
        expect(rewritten.map(doc => doc.id).sort()).toEqual([
            `${TO}.defs`,
            `${TO}.entry`,
        ])

        const nsids = createNsidSet(
            resolveEntryLexiconId({
                "/lexicons/example/org/app/entry.json": rewritten.find(doc =>
                    doc.id.endsWith(".entry"),
                ),
            }),
        )
        expect(nsids.entryCollection).toBe(`${TO}.entry`)
        expect(nsids.defsNsid).toBe(`${TO}.defs`)
        expect(nsids.manifestType).toBe(`${TO}.defs#manifest`)
        const uri = nsids.entryAtUri("did:plc:abc", "3lxyz")
        expect(uri).toBe(`at://did:plc:abc/${TO}.entry/3lxyz`)
        expect(nsids.parseEntryAtUri(uri)).toEqual({
            actor: "did:plc:abc",
            rkey: "3lxyz",
        })
        // 書き換え前のコレクションは受理しない
        expect(
            nsids.parseEntryAtUri(`at://did:plc:abc/${ENTRY_COLLECTION}/3lxyz`),
        ).toBeUndefined()

        // 書き換え後の定義は、スキーマとして妥当で、参照が解決できる
        const strongRef = docs.find(
            doc => doc.id === "com.atproto.repo.strongRef",
        )!
        const lexicons = new Lexicons([...rewritten, strongRef])
        expect(() => lexicons.getDefOrThrow(nsids.manifestType)).not.toThrow()
        const entry = rewritten.find(doc => doc.id === nsids.entryCollection)
        // 読み込み済みの定義は参照に `lex:` が付くため、外して比べる
        expect(
            entry.defs.main.record.properties.manifest.ref.replace(/^lex:/, ""),
        ).toBe(nsids.manifestType)
    })
})

type PublishedField = { type: string; required: boolean; format?: string }

/** 現在のlexiconから、`<entry|defs>#<定義>.<項目>` をキーにした項目の一覧を作る。 */
const currentFields = (): Record<string, PublishedField> => {
    const fields: Record<string, PublishedField> = {}
    for (const doc of docs) {
        const kind = [ENTRY_COLLECTION, DEFS_NSID].indexOf(doc.id)
        if (kind < 0) continue
        const name = kind === 0 ? "entry" : "defs"
        for (const [defName, def] of Object.entries(doc.defs) as [
            string,
            any,
        ][]) {
            const object = def.type === "record" ? def.record : def
            const required = new Set<string>(object.required ?? [])
            for (const [prop, schema] of Object.entries(
                object.properties as Record<string, any>,
            )) {
                fields[`${name}#${defName}.${prop}`] = {
                    type: schema.type,
                    required: required.has(prop),
                    ...(schema.format ? { format: schema.format } : {}),
                }
            }
        }
    }
    return fields
}

describe("公開済みのlexiconとの互換", () => {
    const published = JSON.parse(
        readFileSync("tests/lexicons/publishedFields.json", "utf-8"),
    ) as Record<string, PublishedField>

    it("[lexicon/AC-11] 公開済みの項目の型・必須指定が変わっておらず、追加された項目はすべて任意である", () => {
        const current = currentFields()
        for (const [key, field] of Object.entries(published)) {
            // 削除・型の変更・必須化のいずれも互換性を壊す
            expect(current[key], `${key} が削除されている`).toBeDefined()
            expect(current[key].type, `${key} の型`).toBe(field.type)
            expect(current[key].required, `${key} の必須指定`).toBe(
                field.required,
            )
            expect(current[key].format, `${key} の形式`).toBe(field.format)
        }
        for (const [key, field] of Object.entries(current)) {
            if (key in published) continue
            expect(field.required, `追加した ${key} は任意にする`).toBe(false)
        }
    })
})
