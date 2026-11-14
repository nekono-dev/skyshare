# R2 バケットの使い方

R2（Cloudflare のオブジェクトストレージ）を使うときの、プロジェクト全体の規則。

## 規則

- **用途ごとにバケットを分ける。** 1 つのバケットを、複数の用途で共有しない。バインディングはバケット全体への権限になり、接頭辞（ディレクトリ）での分離は約束事にすぎないため、データの機微さ・寿命・公開範囲が違うものを同じバケットに入れない。
- **名前は `skyshare-<用途>`。** `<用途>` は英小文字と数字で、2 語まで（ハイフンは 1 つまで）にし、長くしすぎない。例: `skyshare-schedule-images`・`skyshare-survey-results`。
- **環境の区別は末尾の `-develop`。** テンプレート（`config/wrangler.template.jsonc`）には本番の名前を書き、develop は `scripts/config/render-wrangler.mjs` が `-develop` を付ける。プレビュー（`dev/*`）は develop のバケットを使う（D1 と同じ）。
- **接頭辞は、1 つの用途の中の整理に使う。** 例: 統計ファイルの `index.json` と `surveys/<id>.json`。同じ機微さ・寿命・公開範囲の小さなデータをまとめる例外は、spec の設計で理由を書いて認める。
- **バインディングの名前は、用途を表す大文字の名前にする。** 例: `SCHEDULE_IMAGES`・`SURVEY_RESULTS`。
- **ビルドや dev が実際のバケットを読む `remote: true` は、バインディングごとに、認証情報（`CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID`）があるときだけ `render-wrangler` が付ける。** 無いときは接続せず、その機能が無い前提で動く（PoC の結果は `.kiro/specs/survey-results-public/brief.md`）。

## 既存のバケット

- `skyshare-schedule-images`（予約の添付画像の一時保管）。
- アカウントにある `skyshare` は、用途が不明のため触らない。

---

_updated_at: 2026-11-13_
