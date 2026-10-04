# `dev.nekono.skyshare.*` レコード要件定義

lexiconスキーマ自体の要件を整理する。API層がこのlexiconをどう使うか（所有権検証・原子的書き込み・スレッド構造の扱い等）は要件の対象外とし、[specs/api/requirements.md](../../api/requirements.md)・[specs/entry/backend/requirements.md](../backend/requirements.md)を参照。

## 1. 機能要件

### FR-1: entryレコードは「他の1つのATレコードへの参照」と「表示用マニフェスト」を持つ

- `dev.nekono.skyshare.entry`は、`source`（派生元レコードへの`strongRef`）・`manifest`（表示用固定情報）・`createdAt`の3フィールドで構成される。
- `source`は特定のレコード種別（collection）に縛られない汎用の`strongRef`として定義する。

### FR-2: マニフェストは代表画像を必須とし、見出し・説明文は任意とする

- `dev.nekono.skyshare.defs#manifest`は`visual`（blob）のみを必須とし、`heading`/`caption`は省略可能なフィールドとして定義する。
- `visual`の受け入れ形式は`image/png`・`image/jpeg`・`image/webp`に限定する。

## 2. 非機能要件

### NFR-1: lexiconの後方互換性

- `dev.nekono.skyshare.entry`/`dev.nekono.skyshare.defs`は既にPDSへ公開済み（GoATによる`goat lex publish`）のlexiconであり、他のPDS・AppViewからも解決される。既存フィールドの型変更・必須化・削除は既存レコード・既存クライアントとの互換性を壊すため行わない。フィールドを追加する場合は必ず任意（optional）とすること。

### NFR-2: `source`をcollection非依存の参照として維持する

- `source`を特定のcollection（例: `app.bsky.feed.post`）に固定しないことで、将来的に画像投稿以外のレコード種別からentryを派生させる拡張の余地を残す。collection種別の制約（現状は`app.bsky.feed.post`のみを許可）は、lexiconではなくAPI層の責務とする。

### NFR-3: `heading`/`caption`の任意性を維持する

- `heading`/`caption`を`required`に含めないことで、将来的に別のクライアント・別の生成経路がこれらを省略したentryを作成できる余地を残す。現在の主要な生成経路（Skyshare本体のAPI）がこれらへ常に値を設定するかどうかは、API層の実装方針であり、lexicon自体の要件ではない。

## 3. 受け入れ条件（Acceptance Criteria）

- `goat lex lint`が`entry.json`/`defs.json`に対してエラーを出さない
- `visual`を含まない`manifest`はlexiconバリデーションで拒否される
- `heading`/`caption`を含まない`manifest`（`visual`のみ）はlexiconバリデーションを通過する
- `source`に`app.bsky.feed.post`以外のcollectionのuriを指定してもlexiconバリデーション自体は拒否しない（API層で拒否されることの確認は本書の対象外）
