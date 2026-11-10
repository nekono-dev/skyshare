/**
 * Skyshare 独自 lexicon の NSID を一元管理する。
 *
 * - `lexicons/` 配下の `entry.json` の `id`（`<prefix>.entry`）を唯一の定義元とし、defs の NSID は `<prefix>.defs` とする。
 * - `entry.json` が 0 件か複数件、または `id` が `.entry` で終わらないときは、モジュール評価時に Error を投げる。
 * - アプリのコードは独自 NSID の文字列リテラルを持たず、このモジュールを経由する。
 */

const ENTRY_SUFFIX = ".entry"

// import.meta.glob はビルド時に解決するため、Workers でもファイル読み込みは発生しない
const entryLexicons = import.meta.glob<{ id: string }>(
    "/lexicons/**/entry.json",
    { eager: true, import: "default" },
)

/**
 * entry.json の `id`（`<prefix>.entry`）を検証して返す。
 *
 * - 入力: `{ "/lexicons/dev/nekono/skyshare/entry.json": { id: "dev.nekono.skyshare.entry" } }`
 * - 出力: `"dev.nekono.skyshare.entry"`
 */
export const resolveEntryLexiconId = (
    lexicons: Record<string, { id: string }>,
): string => {
    const found = Object.entries(lexicons)
    if (found.length !== 1) {
        throw new Error(
            `Exactly one entry.json is required under lexicons/ (found ${found.length}: ${found
                .map(([path]) => path)
                .join(", ")})`,
        )
    }
    const id = found[0][1].id
    if (typeof id !== "string" || !id.endsWith(ENTRY_SUFFIX)) {
        throw new Error(
            `The id of entry.json must end with "${ENTRY_SUFFIX}": ${id}`,
        )
    }
    return id
}

/** entry の NSID から導出する値と、それを使う URI の組み立て・解析 */
export type NsidSet = {
    /** entry レコードのコレクション名（= entry lexicon の NSID） */
    entryCollection: string
    /** defs lexicon の NSID */
    defsNsid: string
    /** manifest 定義の型識別子（`$type` / `ref` に使う） */
    manifestType: string
    /** entry を指す `at://` URI を組み立てる */
    entryAtUri: (did: string, rkey: string) => string
    /** entry を指す `at://` URI を解析する。別コレクション・余分なパス/クエリ/フラグメント付きは `undefined` */
    parseEntryAtUri: (
        uri: string,
    ) => { actor: string; rkey: string } | undefined
}

const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * entry の NSID から、defs・manifest の NSID と URI の組み立て・解析を導出する。
 *
 * - ドメインが変わっても、この導出規則で defs と URI の値が決まる。
 *
 * - 入力: `"dev.nekono.skyshare.entry"`
 * - 出力: `{ entryCollection: "dev.nekono.skyshare.entry", defsNsid: "dev.nekono.skyshare.defs", ... }`
 */
export const createNsidSet = (entryId: string): NsidSet => {
    const prefix = entryId.slice(0, -ENTRY_SUFFIX.length)
    const defsNsid = `${prefix}.defs`
    const pattern = new RegExp(
        `^at://([^/]+)/${escapeRegExp(entryId)}/([^/?#]+)$`,
    )
    return {
        entryCollection: entryId,
        defsNsid,
        manifestType: `${defsNsid}#manifest`,
        entryAtUri: (did, rkey) => `at://${did}/${entryId}/${rkey}`,
        parseEntryAtUri: uri => {
            const match = uri.match(pattern)
            return match ? { actor: match[1], rkey: match[2] } : undefined
        },
    }
}

const nsids = createNsidSet(resolveEntryLexiconId(entryLexicons))

/** entry レコードのコレクション名（= entry lexicon の NSID） */
export const ENTRY_COLLECTION = nsids.entryCollection

/** defs lexicon の NSID */
export const DEFS_NSID = nsids.defsNsid

/** manifest 定義の型識別子（`$type` / `ref` に使う） */
export const MANIFEST_TYPE = nsids.manifestType

/**
 * entry を指す `at://` URI を組み立てる。
 *
 * - 入力: `("did:plc:abc", "3lxyz")`
 * - 出力: `"at://did:plc:abc/<ENTRY_COLLECTION>/3lxyz"`
 */
export const entryAtUri = nsids.entryAtUri

/**
 * entry を指す `at://` URI を解析する。別コレクション・余分なパス/クエリ/フラグメント付きは `undefined`。
 *
 * - 入力: `"at://did:plc:abc/<ENTRY_COLLECTION>/3lxyz"`
 * - 出力: `{ actor: "did:plc:abc", rkey: "3lxyz" }`
 */
export const parseEntryAtUri = nsids.parseEntryAtUri
