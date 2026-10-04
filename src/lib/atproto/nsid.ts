/**
 * Skyshare 独自 lexicon の NSID を一元管理するモジュール。
 *
 * 責務と処理概要:
 * - `lexicons/` 配下の `entry.json` の `id` を唯一の定義元として、ビルド時に NSID を導出する。
 * - entry の NSID は `<prefix>.entry` の形を規約とし、defs の NSID は `<prefix>.defs` と決める。
 * - `at://` URI の組み立て・解析（entry を指す URI のみ受理）を提供する。
 * - アプリケーションコードは Skyshare 独自 NSID の文字列リテラルを持たず、本モジュールを経由する。
 *
 * 異常系:
 * - `entry.json` が 0 件または複数件、あるいは `id` が `.entry` で終わらない場合は、
 *   モジュール評価時（起動時・ビルド時）に原因を示す Error を投げる。
 *
 * 補足:
 * - `import.meta.glob` はビルド時に解決されるため、Workers 上でもファイル読み込みは発生しない。
 */

const ENTRY_SUFFIX = ".entry"

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

/** entry レコードのコレクション名（= entry lexicon の NSID） */
export const ENTRY_COLLECTION = resolveEntryLexiconId(entryLexicons)

const NSID_PREFIX = ENTRY_COLLECTION.slice(0, -ENTRY_SUFFIX.length)

/** defs lexicon の NSID */
export const DEFS_NSID = `${NSID_PREFIX}.defs`

/** manifest 定義の型識別子（`$type` / `ref` に使う） */
export const MANIFEST_TYPE = `${DEFS_NSID}#manifest`

const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const ENTRY_AT_URI_PATTERN = new RegExp(
    `^at://([^/]+)/${escapeRegExp(ENTRY_COLLECTION)}/([^/?#]+)$`,
)

/**
 * entry を指す `at://` URI を組み立てる。
 *
 * - 入力: `("did:plc:abc", "3lxyz")`
 * - 出力: `"at://did:plc:abc/<ENTRY_COLLECTION>/3lxyz"`
 */
export const entryAtUri = (did: string, rkey: string): string =>
    `at://${did}/${ENTRY_COLLECTION}/${rkey}`

/**
 * entry を指す `at://` URI を解析する。別コレクション・余分なパス/クエリ/フラグメント付きは `undefined`。
 *
 * - 入力: `"at://did:plc:abc/<ENTRY_COLLECTION>/3lxyz"`
 * - 出力: `{ actor: "did:plc:abc", rkey: "3lxyz" }`
 */
export const parseEntryAtUri = (
    uri: string,
): { actor: string; rkey: string } | undefined => {
    const match = uri.match(ENTRY_AT_URI_PATTERN)
    return match ? { actor: match[1], rkey: match[2] } : undefined
}
