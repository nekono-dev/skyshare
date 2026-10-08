# Skyshare独自lexicon 設計書

## 1. 構成

| パス                                      | 責務                                   |
| ----------------------------------------- | -------------------------------------- |
| `lexicons/dev/nekono/skyshare/entry.json` | entryレコードの定義                    |
| `lexicons/dev/nekono/skyshare/defs.json`  | マニフェストの定義                     |
| `lexicons/README.md`                      | 公開手順とドメイン変更の手順           |
| `src/lib/atproto/nsid.ts`                 | NSIDの導出とentryのURIの組み立て・解析 |
| `tests/lexicons/lexicons.test.ts`         | lexicon定義の検証                      |
| `tests/lib/atproto/nsidLiteral.test.ts`   | NSIDの直書きの検出                     |

## 2. 設計項目

### D-1: レコード定義 (FR-1, FR-2, FR-3, FR-4, NFR-1)

| NSID                     | 型                     | 項目        | 必須 | 制約                                                     |
| ------------------------ | ---------------------- | ----------- | ---- | -------------------------------------------------------- |
| `<prefix>.entry`         | `record`（`key: tid`） | `source`    | 必須 | `com.atproto.repo.strongRef`（参照先の種別を制約しない） |
|                          |                        | `manifest`  | 必須 | `<prefix>.defs#manifest`                                 |
|                          |                        | `createdAt` | 必須 | `datetime`                                               |
| `<prefix>.defs#manifest` | `object`               | `visual`    | 必須 | blob（`image/png` `image/jpeg` `image/webp`）            |
|                          |                        | `heading`   | 任意 | `maxLength: 100`                                         |
|                          |                        | `caption`   | 任意 | `maxLength: 300`                                         |

- 派生元の種別を投稿に限定する制約はAPI側で行い、lexiconには書かない。
- 公開には GoAT（`goat lex lint` / `goat lex check-dns` / `goat lex publish`）を使う。公開後は他のPDSからも解決されるため、追加するフィールドは任意にする。

### D-2: NSIDの導出 (FR-5, FR-7, NFR-2)

```ts
const entryLexicons = import.meta.glob<{ id: string }>(
  "/lexicons/**/entry.json",
  { eager: true, import: "default" },
)
export const resolveEntryLexiconId = (
  lexicons: Record<string, { id: string }>,
): string => {
  const found = Object.entries(lexicons)
  if (found.length !== 1)
    throw new Error(
      `Exactly one entry.json is required under lexicons/ (found ${found.length}: ...)`,
    )
  const id = found[0][1].id
  if (typeof id !== "string" || !id.endsWith(".entry"))
    throw new Error(`The id of entry.json must end with ".entry": ${id}`)
  return id
}
export const ENTRY_COLLECTION = resolveEntryLexiconId(entryLexicons)
const NSID_PREFIX = ENTRY_COLLECTION.slice(0, -".entry".length)
export const DEFS_NSID = `${NSID_PREFIX}.defs`
export const MANIFEST_TYPE = `${DEFS_NSID}#manifest`
```

- `import.meta.glob` はビルド時に解決されるため、Workers上でファイルを読まない。
- defs は同名の `com.atproto.repo.defs` が存在して glob で特定できないため、entry と同じ prefix から規約で導出する。
- エラーメッセージは、ソースコードの日本語直書きを禁止する規約に合わせて英語で書く。

### D-3: URIと呼び出し側 (FR-6, FR-9)

```ts
export const entryAtUri = (did: string, rkey: string): string => `at://${did}/${ENTRY_COLLECTION}/${rkey}`
const ENTRY_AT_URI_PATTERN = new RegExp(`^at://([^/]+)/${escapeRegExp(ENTRY_COLLECTION)}/([^/?#]+)$`)
export const parseEntryAtUri = (uri: string): { actor: string; rkey: string } | undefined
```

| 呼び出し側                          | 利用する値                                                   |
| ----------------------------------- | ------------------------------------------------------------ |
| `src/lib/entry/skyshareRecord.ts`   | `ENTRY_COLLECTION` / `MANIFEST_TYPE`                         |
| `src/lib/entry/createBskyThread.ts` | `ENTRY_COLLECTION`                                           |
| `src/lib/entry/entry.ts`            | `parseEntryAtUri`                                            |
| `src/lib/entry/guestDummyPosts.ts`  | `entryAtUri`                                                 |
| `src/lib/api/schema/v2/entry/*.ts`  | NSIDを含めない説明文（tsx実行のため `nsid.ts` を参照しない） |

ドメインの変更手順（`lexicons/README.md`）: ディレクトリを新ドメインへ移す → `entry.json`・`defs.json` の `id` と `manifest` の `ref` を書き換える → `npm test` → `goat lex lint` と公開。

### D-4: 検証 (FR-8, FR-10, NFR-3)

| テスト                                  | 内容                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/lexicons/lexicons.test.ts`       | `import.meta.glob("/lexicons/**/*.json")` の全定義を `new Lexicons(docs)` で検証し、参照の解決・パスとidの対応・idの重複なし・正例と負例の `assertValidRecord` を確認する |
| `tests/lib/atproto/nsid.test.ts`        | 導出値とlexicon定義のidの一致、マニフェストの参照の一致、`resolveEntryLexiconId` の異常系、URIの往復と拒否                                                                |
| `tests/lib/atproto/nsidLiteral.test.ts` | `src/`（`src/client/` を除く）の `.ts` `.tsx` `.astro` からコメントを除いた本文にNSIDの prefix が含まれないこと                                                           |

CIの検証ジョブで vitest と `npm run lint:lexicon`（goat）を両方実行する。

## 3. エラー処理

| 事象                          | 処理                                                     |
| ----------------------------- | -------------------------------------------------------- |
| entry定義が0件・複数・id不正  | モジュール評価時に例外を投げ、ビルドとテストを失敗させる |
| URIが別コレクション・形式不正 | `parseEntryAtUri` が `undefined` を返す                  |
