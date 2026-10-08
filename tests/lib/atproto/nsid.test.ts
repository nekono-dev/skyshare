import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
    DEFS_NSID,
    ENTRY_COLLECTION,
    MANIFEST_TYPE,
    entryAtUri,
    parseEntryAtUri,
    resolveEntryLexiconId,
} from "@/lib/atproto/nsid"

/** entry.json と同ディレクトリのlexicon JSONを読む */
const readLexicon = (name: string) => {
    const dirs = import.meta.glob("/lexicons/**/entry.json", { eager: false })
    const entryPath = Object.keys(dirs)[0]
    const dir = entryPath.slice(0, entryPath.lastIndexOf("/"))
    return JSON.parse(readFileSync(`.${dir}/${name}`, "utf-8"))
}

describe("lexicon JSONとの整合", () => {
    it("[lexicon/AC-5] ENTRY_COLLECTIONがentry.jsonのidと一致する", () => {
        expect(ENTRY_COLLECTION).toBe(readLexicon("entry.json").id)
    })

    it("DEFS_NSIDがdefs.jsonのidと一致する", () => {
        expect(DEFS_NSID).toBe(readLexicon("defs.json").id)
    })

    it("[lexicon/AC-8] entry.jsonのmanifest参照がMANIFEST_TYPEと一致する", () => {
        const entry = readLexicon("entry.json")
        expect(entry.defs.main.record.properties.manifest.ref).toBe(
            MANIFEST_TYPE,
        )
    })
})

describe("resolveEntryLexiconId", () => {
    it("1件で.entry終端なら返す", () => {
        expect(
            resolveEntryLexiconId({ "/a/entry.json": { id: "x.y.entry" } }),
        ).toBe("x.y.entry")
    })

    it("[lexicon/AC-7] 0件なら例外", () => {
        expect(() => resolveEntryLexiconId({})).toThrow(
            "Exactly one entry.json",
        )
    })

    it("[lexicon/AC-7] 複数件なら例外", () => {
        expect(() =>
            resolveEntryLexiconId({
                "/a/entry.json": { id: "a.entry" },
                "/b/entry.json": { id: "b.entry" },
            }),
        ).toThrow("found 2")
    })

    it("[lexicon/AC-7] idが.entryで終わらなければ例外", () => {
        expect(() =>
            resolveEntryLexiconId({ "/a/entry.json": { id: "a.record" } }),
        ).toThrow(".entry")
    })
})

describe("entryAtUri / parseEntryAtUri", () => {
    it("往復で値が保たれる", () => {
        const uri = entryAtUri("did:plc:abc", "3lxyz")
        expect(uri).toBe(`at://did:plc:abc/${ENTRY_COLLECTION}/3lxyz`)
        expect(parseEntryAtUri(uri)).toEqual({
            actor: "did:plc:abc",
            rkey: "3lxyz",
        })
    })

    it("[lexicon/AC-9] 別コレクションは受理しない", () => {
        expect(
            parseEntryAtUri("at://did:plc:abc/app.bsky.feed.post/3lxyz"),
        ).toBeUndefined()
    })

    it("[lexicon/AC-9] 末尾に余分なパス・クエリ・フラグメントが付くものは受理しない", () => {
        const base = entryAtUri("did:plc:abc", "3lxyz")
        expect(parseEntryAtUri(`${base}/`)).toBeUndefined()
        expect(parseEntryAtUri(`${base}?a=1`)).toBeUndefined()
        expect(parseEntryAtUri(`${base}#x`)).toBeUndefined()
    })

    it("NSID内のドットは任意文字として扱わない", () => {
        const mutated = ENTRY_COLLECTION.replace(".", "X")
        expect(
            parseEntryAtUri(`at://did:plc:abc/${mutated}/3lxyz`),
        ).toBeUndefined()
    })
})
