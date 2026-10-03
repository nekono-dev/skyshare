# スマホレイアウトのUI拡大 タスク一覧

## Phase 1: トークン

- [x] `tokens.css` にスマホ幅の上書きブロックを追加（design.md §2）。
- [x] `button.ui.module.css` の `--size-button-*` のスマホ上書き。

## Phase 2: 直書きの置換

- [x] font-size の直書きをトークンへ（design.md §3）。
- [x] 余白の直書きをトークンへ。

## Phase 3: 個別指定の整理

- [x] design.md §4 の各指定を見直す。

## Phase 4: 検証・文書

- [ ] `npm run build` / `npm test` / E2E。スマホ幅（390×844）とPC幅で目視確認。
- [x] README にトークン記述なし（更新不要）。
