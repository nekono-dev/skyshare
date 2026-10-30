# アンケートのプレビュー用 DB マイグレーション

## 目的と対象

`dev/readopt-features` のプレビューで、回答済みの確認・登録と匿名回答の保存を使えるようにする。
`dev/*` のプレビューは開発用 D1 `skyshare-develop` を共有する。プレビューの配備自体はマイグレーションを適用しない。

この作業は `develop` の `419e9c3` から作成した `dev/preview-survey-migration` で行う。
DB 名の変更を再採用し、既存の開発用 D1 に接続する。DB の新規作成やデータ移動は行わない。
機能コード・cc-sdd 設定は取り込まない。本番用 D1 `skyshare` と develop ブランチは変更しない。

## 適用前の確認結果

- Cloudflare の対象アカウントは `nekono.dev`。
- 開発用 D1 には `0001_schedule.sql` から `0005_schedule_owner_index.sql` まで適用済み。
- `survey_respondents` と `survey_answers` は未作成。
- 未適用の差分は `0006_survey.sql` のみ。再採用ブランチと同一の SQL を使う。
- 既存の予約テーブルや行は変更しない。過去のマイグレーションに含まれる削除処理は再実行しない。

## 実施計画

1. ローカルの SQLite で既存のマイグレーションに続けて `0006` を実行し、既存データが保持されることと、新テーブルの主キーを確認する。
2. Git 管理外の Wrangler 設定に対象アカウントと開発用 DB の実際の ID を明示する。`migrations_dir` はこのブランチの `migrations/` を絶対パスで指定する。
3. `wrangler d1 migrations list DB --remote --config <設定>` で未適用が `0006` だけであることを確認する。
4. `wrangler d1 migrations apply DB --remote --config <設定>` を実行する。
5. 未適用一覧が空であること、`d1_migrations` に `0006` があること、新テーブルの定義と主キーが SQL に一致することを確認する。
6. ブランチを push し、専用プレビューの配備結果と、再採用ブランチのプレビューの HTTP 応答を確認する。

## 適用後の扱い

追加テーブルは既存の develop のコードと互換性がある。問題があれば調査中はテーブルを残し、共有 DB の回答データを削除するロールバックは自動実行しない。
将来 `dev/readopt-features` を develop に取り込んだときは、同じファイル名が適用履歴に残るため再実行されない。
アンケートの表示には別途、開催中の `SURVEY_CONFIG` とログインが必要になる。

## 実施結果

未実施。
