# `dev.nekono.skyshare.*` レコード タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

## Phase 1: lexicon定義 【完了】

- [x] `dev.nekono.skyshare.entry`（`source`・`manifest`・`createdAt`の3フィールド、`source`は`com.atproto.repo.strongRef`で参照先collectionを制約しない）を定義する（[entry.json](../../../lexicons/dev/nekono/skyshare/entry.json)）。
- [x] `dev.nekono.skyshare.defs#manifest`（`visual`必須・`heading`/`caption`任意）を定義する（[defs.json](../../../lexicons/dev/nekono/skyshare/defs.json)）。
- [x] `goat lex lint`でエラーが出ないことを確認する。
- [x] DNS TXTレコードによる所有権証明（`_lexicon.skyshare.nekono.dev`）を設定し、`goat lex publish`でPDSへ公開する（[lexicons/README.md](../../../lexicons/README.md)）。

## 今後の変更時の留意事項

- 既存フィールドの型変更・必須化・削除は行わない（NFR-1）。フィールドを追加する場合は必ず`optional`とする。
- `source`を特定collectionに固定する変更は行わない（NFR-2）。collection種別の制約はAPI層（[specs/entry/backend](../backend/design.md)）の責務とする。
