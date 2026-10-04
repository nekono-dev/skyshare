# lexicon NSID の可変化 設計

対応する要件定義書: [`requirements.md`](./requirements.md)

## 1. 全体方針

lexicon JSON（`lexicons/<逆順ドメイン>/.../entry.json`）の `id` を唯一の定義元とし、Vite のビルド時 glob で JSON を取り込んで NSID を導出する新モジュール `src/lib/atproto/nsid.ts` に集約する。アプリケーションコードは同モジュールの export のみを使い、NSID リテラルを持たない。

```
lexicons/<domain>/**/entry.json ──(import.meta.glob, eager)──▶ src/lib/atproto/nsid.ts
        │ id = "<prefix>.entry"                                   ENTRY_COLLECTION
        │                                                         DEFS_NSID
        └─(hack/gen-client.sh が find で探索)─▶ src/client/atproto  MANIFEST_TYPE
                                                  （生成物。アプリからは未使用）  entryAtUri / parseEntryAtUri
```

- 生成物 `src/client/atproto/` はアプリの手書きコードから import されていないため、参照先として使わない。
- `import.meta.glob` はビルド時に解決されるため、Workers ランタイムでファイル読み込みは発生しない（NFR-1）。vitest も Vite の変換を通るため同じコードが動く。

## 2. NSID モジュール（`src/lib/atproto/nsid.ts`）

### 2.1 導出

```ts
const entryLexicons = import.meta.glob<{ id: string }>(
  "/lexicons/**/entry.json",
  { eager: true, import: "default" },
)

export const resolveEntryLexiconId = (
  lexicons: Record<string, { id: string }>,
): string => {
  const found = Object.entries(lexicons)
  if (found.length !== 1) {
    throw new Error(
      `Exactly one entry.json is required under lexicons/ (found ${found.length}: ${found.map(([path]) => path).join(", ")})`,
    )
  }
  const id = found[0][1].id
  if (typeof id !== "string" || !id.endsWith(".entry")) {
    throw new Error(`The id of entry.json must end with ".entry": ${id}`)
  }
  return id
}

export const ENTRY_COLLECTION = resolveEntryLexiconId(entryLexicons)
const NSID_PREFIX = ENTRY_COLLECTION.slice(0, -".entry".length)
export const DEFS_NSID = `${NSID_PREFIX}.defs`
export const MANIFEST_TYPE = `${DEFS_NSID}#manifest`
```

- entry の NSID が `<prefix>.entry` の形であることを規約とし、defs は同じ prefix の `<prefix>.defs` と規約で決める（`defs.json` は `com.atproto.repo.defs` と同名ファイルが存在し、glob での特定が曖昧になるため）。
- `com/atproto/` 配下に `entry.json` は存在しないため、`**/entry.json` で Skyshare の定義だけが一致する。`.com` ドメインのフォークが `lexicons/com/` 配下に置かれる場合があるため、`com/` 配下の除外は行わない。複数一致・不一致はモジュール評価時に例外とする（FR-3）。
- エラーメッセージは、ts への日本語リテラルを禁止するプロジェクトの規約（i18n の直書き検出テスト）に合わせて英語で記述する。

### 2.2 URI の組み立てと解析

```ts
export const entryAtUri = (did: string, rkey: string): string =>
  `at://${did}/${ENTRY_COLLECTION}/${rkey}`

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const ENTRY_AT_URI_PATTERN = new RegExp(
  `^at://([^/]+)/${escapeRegExp(ENTRY_COLLECTION)}/([^/?#]+)$`,
)

export const parseEntryAtUri = (
  uri: string,
): { actor: string; rkey: string } | undefined => {
  const m = uri.match(ENTRY_AT_URI_PATTERN)
  return m ? { actor: m[1], rkey: m[2] } : undefined
}
```

- 正規表現はモジュールスコープで1回だけ生成する。
- 既存の正規表現と同じ文字クラス・終端を維持し、受理範囲を変えない。

## 3. 呼び出し側の置換

| 箇所                                                                | 現状                                                     | 変更後                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/entry/entry.ts` の `ENTRY_COLLECTION` 定義                 | 文字列リテラル                                           | 削除し、`nsid.ts` から import（再 export しない。利用側の import 元を `nsid.ts` へ変更する）                                                                                                                                                             |
| `src/lib/entry/entry.ts` の `at://` 解析（`parseSourceLocator` 内） | 正規表現リテラル                                         | `parseEntryAtUri` の結果を `{ actor, rkey }` として利用（`isDidIdentifier` 検証は呼び出し側に残す）                                                                                                                                                      |
| `src/lib/entry/skyshareRecord.ts`                                   | `collection`・`$type`（entry/manifest）のリテラル計5箇所 | `ENTRY_COLLECTION` / `MANIFEST_TYPE`                                                                                                                                                                                                                     |
| `src/lib/entry/createBskyThread.ts`                                 | `collection: "dev.nekono.skyshare.entry"`                | `ENTRY_COLLECTION`                                                                                                                                                                                                                                       |
| `src/lib/entry/guestDummyPosts.ts`                                  | `at://did:plc:guestdemo/<NSID>/<rkey>` 6箇所             | `entryAtUri("did:plc:guestdemo", "<rkey>")`                                                                                                                                                                                                              |
| `src/lib/api/schema/v2/entry/put.ts` / `delete.ts`                  | 説明文内の NSID                                          | NSID を含めない汎用表現（`Skyshare entry`）に変更する。`hack/build-openapi-document.ts` は tsx で実行され `import.meta.glob` が使えないため、スキーマ定義から `nsid.ts` を参照しない。`openapi/` と `src/client/openapi/client.ts` を orval で再生成する |
| `src/pages/v2/entries.ts` ほか `ENTRY_COLLECTION` の import 元      | `@/lib/entry/entry`                                      | `@/lib/atproto/nsid`                                                                                                                                                                                                                                     |

- `app.bsky.*` のリテラルは対象外のため変更しない。
- 後方互換のための再 export・ラッパーは作らない（v2 はリリース前）。

## 4. コード生成（`hack/gen-client.sh`）

```bash
#!/usr/bin/env bash
set -euo pipefail
OUTPUT_DIR="${1:-./dev/client/lexicon}"

# Skyshare 独自 lexicon のディレクトリは entry.json の位置から特定する
ENTRY_JSON=$(find ./lexicons -name entry.json)
[ "$(echo "$ENTRY_JSON" | grep -c .)" -eq 1 ] || {
  echo "entry.json は1つだけ必要です" >&2
  exit 1
}
APP_LEXICON_DIR=$(dirname "$ENTRY_JSON")

# 旧 NSID 由来の生成物を残さないため、出力先を空にしてから生成する
rm -rf "$OUTPUT_DIR"
npx lex gen-api --yes "$OUTPUT_DIR" \
  "$APP_LEXICON_DIR"/* \
  ./lexicons/com/atproto/repo/{strongRef,defs,listRecords,getRecord,createRecord,putRecord,deleteRecord}.json
```

- `src/client/atproto/` 配下は全て `lex gen-api` の生成物（`index.ts`・`lexicons.ts`・`types/`・`util.ts`）のため、出力先ごと削除しても再生成で復元される。実施前に `git status` で手書きファイルが無いことを確認する。
- `com/atproto/repo/*` は仕様上固定のためパスを直書きのまま維持する。

## 5. テスト

### 5.1 NSID モジュールの単体テスト（`tests/lib/atproto/nsid.test.ts`）

- `fs` で `lexicons/**/entry.json`・同ディレクトリの `defs.json` を読み、次を検証する。
  - `ENTRY_COLLECTION` が entry.json の `id` と一致する。
  - `DEFS_NSID` が defs.json の `id` と一致する。
  - entry.json の `manifest` プロパティの `ref` が `MANIFEST_TYPE` と一致する（FR-3）。
- `parseEntryAtUri` の入力例:
  - `at://did:plc:abc/<ENTRY_COLLECTION>/3lxyz` → `{ actor: "did:plc:abc", rkey: "3lxyz" }`
  - 別コレクション、末尾に `/` や `?`・`#` が付いたもの、`.` を任意文字に置換した NSID（エスケープ確認）→ `undefined`
- `entryAtUri` と `parseEntryAtUri` の往復で値が保たれる。

### 5.2 リテラル再混入防止（`tests/lib/atproto/nsidLiteral.test.ts`）

- entry.json の `id` から `NSID_PREFIX` 相当（`.entry` を除いた文字列）を算出する。
- `src/` 配下の `.ts`/`.tsx`/`.astro`（`src/client/` を除く）を走査し、ブロックコメントと行頭／空白直後の `//` 以降を除去した本文に、その文字列が含まれないことを検証する。

### 5.3 既存テストの置換

- `tests/pages/v2/**`・`tests/lib/atproto/repo.test.ts` の NSID リテラル（`collection`、`at://...` URI）を `ENTRY_COLLECTION` / `entryAtUri` に置き換える。テスト名に含まれる NSID の記述は `entry` の呼称に改める。

## 6. ドメイン変更の手順（`lexicons/README.md` に追記する内容）

1. `lexicons/` 配下のディレクトリを新ドメインの逆順構造へ移動する（例: `lexicons/com/example/myapp/`）。
2. `entry.json`・`defs.json` の `id`、および `entry.json` 内の `manifest` の `ref`（`<prefix>.defs#manifest`）を新 NSID に書き換える。
3. `npm run lexgen` でクライアントコードを再生成する。
4. `goat lex lint` で検証し、DNS TXT レコード（`_lexicon.<authority>`）の設定と `goat lex publish` を行う（アプリの責務外）。
5. 旧 NSID の既存レコードは自動では移行されない。

## 7. 検証用の別ドメイン構成

受け入れ条件（別ドメインでの成功）は、リポジトリのコピーを作業ディレクトリに作り、手順 1〜3 を適用して `tsc`・`vitest`・ビルドを実行して確認する。リポジトリ本体の lexicon は変更しない。
