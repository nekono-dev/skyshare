# `dev.nekono.skyshare.*` レコード設計書

対象ファイル:

- Lexicon定義: [lexicons/dev/nekono/skyshare/entry.json](../../../lexicons/dev/nekono/skyshare/entry.json) / [defs.json](../../../lexicons/dev/nekono/skyshare/defs.json)
- 公開・検証手順: [lexicons/README.md](../../../lexicons/README.md)（GoATによるlint・DNS検証・PDSへの公開）

本書は`dev.nekono.skyshare.*` lexicon自体のスキーマ定義を整理したものである。このlexiconをAPI層（`/v2/entry`等）がどう生成・検証・利用しているかは、本書の対象外とする。

- lexiconをAPI全体でどう扱うか（所有権検証・原子的書き込み・公式lexiconとの関係等の横断的な設計）は [specs/api/design.md](../../api/design.md) を参照。
- `dev.nekono.skyshare.entry`の`source`がBlueskyのスレッド構造をどこまで意識するか等、entry APIとしての振る舞いは [specs/entry/backend/design.md](../backend/design.md) を参照。

## 1. 概要

Skyshareは、Bluesky投稿（`app.bsky.feed.post`）とは別に、独自レコード`dev.nekono.skyshare.entry`をユーザー自身のPDS（AT Protocolリポジトリ）上に作成する。このレコードを「skyshare entry」と呼ぶ。

lexicon（AT Protocolのスキーマ定義）は逆順FQDN（`dev.nekono.skyshare.*`）で命名され、DNS TXTレコードによる所有権証明（`_lexicon.skyshare.nekono.dev`）とGoATツールによるPDSへの公開を経て運用される（[lexicons/README.md](../../../lexicons/README.md)）。

| NSID | lexiconファイル | 役割 |
|---|---|---|
| `dev.nekono.skyshare.entry` | [entry.json](../../../lexicons/dev/nekono/skyshare/entry.json) | レコード本体（`main`、`record`型） |
| `dev.nekono.skyshare.defs` | [defs.json](../../../lexicons/dev/nekono/skyshare/defs.json) | 共有定義。現状は`manifest`のみを持つ |

## 2. `dev.nekono.skyshare.entry`（レコード本体）

`type: record`、`key: tid`（rkeyはTIDで採番される）。

```json
{
  "source": { "uri": "at://...", "cid": "bafy..." },
  "manifest": { "$type": "dev.nekono.skyshare.defs#manifest", "visual": {...}, "heading": "...", "caption": "..." },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `source` | `com.atproto.repo.strongRef`（`{uri, cid}`） | 必須 | このentryの派生元となる、他のATレコードへの参照 |
| `manifest` | `dev.nekono.skyshare.defs#manifest`への参照 | 必須 | 表示用の固定情報（3節参照） |
| `createdAt` | ISO 8601 datetime文字列 | 必須 | entry自体の作成日時 |

`source`は`com.atproto.repo.strongRef`という汎用のuri/cid参照であり、lexicon定義上は参照先のcollection種別を制約しない（`app.bsky.feed.post`に限定する記述はlexicon側には存在しない）。

## 3. `dev.nekono.skyshare.defs#manifest`

`type: object`。

```json
{
  "visual": { "$type": "blob", "ref": {...}, "mimeType": "image/jpeg" },
  "heading": "alice.bsky.social 's Post",
  "caption": "京都にて"
}
```

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `visual` | blob（`accept: image/png, image/jpeg, image/webp`） | 必須 | entryの代表画像 |
| `heading` | string（`maxLength: 100`） | 任意 | 見出し |
| `caption` | string（`maxLength: 300`） | 任意 | 説明文 |

`heading`/`caption`はいずれも`required`配列に含まれておらず、lexicon上は「見出し・説明文の無いentry」も許容するスキーマになっている。

## 4. 公開・運用

- lexiconはGoAT（`goat lex lint` / `goat lex check-dns` / `goat lex publish`）を用いてlint・DNS検証・PDSへの公開を行う（[lexicons/README.md](../../../lexicons/README.md)）。
- 公開後のlexiconは他のPDS・AppViewからも解決可能になるため、後方互換性の制約を受ける（[requirements.md](requirements.md) NFR-1）。
