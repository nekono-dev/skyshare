# プレビュー運用 タスク一覧

## Phase 1: URL と provider

- 対応: D-1, D-2
- [x] T-1.1: URL の算出と provider の切り替えを実装する。
- [x] T-1.2: 雛形の書き込みと後始末の既定動作の単体テストを受け入れ条件のタグ付きで追加する。
- [x] T-1.3: 宣言の aliasStripPrefix を検証し、URL・workflow 雛形・後始末の名前に反映して、AC-9 の単体テストを加える。
- 検証: `node tests/selftest.mjs`

## Phase 2: 検査

- 対応: D-3, D-4
- [x] T-2.1: 宣言外の CI の警告と Cloudflare の検査を実装し、単体テストを追加する。
- 検証: `node --check providers/cloudflare-previews.mjs && node tests/selftest.mjs`

## Phase 3: workers.dev 関連キー

- 対応: D-5
- [x] T-3.1: 独自ドメインの有効判定と wrangler-config を実装し、検査の警告を追加する。
- [x] T-3.2: AC-7, AC-8 の単体テストを追加し、SKILL.md に使い方を書く。
- 検証: `node tests/selftest.mjs && node --check scripts/brw.mjs`
