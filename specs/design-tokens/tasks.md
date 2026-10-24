# スマホ幅のUI拡大 タスク一覧

## Phase 1: トークンの上書き

- 対応: D-1
- [x] T-1.1: `tokens.css` にスマホ幅の上書きブロックを追加する。
- [x] T-1.2: `button.ui.module.css` と `avatar.ui.module.css` にスマホ幅の上書きブロックを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/mobileScale.spec.ts` 幅390pxで投稿フォームを開く → 本文が18px、すべてのボタン高さが44px以上になる

## Phase 2: 直書きの置換

- 対応: D-2
- [x] T-2.1: フォントサイズの直書きをトークン参照へ置き換える。
- [x] T-2.2: 余白の直書きをトークン参照へ置き換える。
- [x] T-2.3: フォントサイズの直書きが無いことを検査するテストを追加する。
- 検証: `npx vitest run tests/styles/hardcodedFontSize.test.ts`
- E2E: `tests/e2e/mobileScale.spec.ts` 幅390pxでログインのページを開く → ボタンの左右余白が16pxになる

## Phase 3: 下余白と表示確認

- 対応: D-3
- [x] T-3.1: `ui.module.css` に下余白クラスを追加し、一覧末尾とページ本文に付与する。
- [x] T-3.2: 幅390pxでフォントサイズ・ボタン高さ・下余白・横スクロールを確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/mobileScale.spec.ts` 幅390pxで設定ページを末尾までスクロールする → 末尾要素がフッターナビゲーションと重ならず、横スクロールが発生しない

## Phase 4: 横幅の限られたツールバー

- 対応: D-4
- [x] T-4.1: `button.ui.module.css` に `.compact-button` を追加し、投稿フォーム上部とセグメントの追加操作のボタンに付ける。
- [x] T-4.2: 受け入れ条件 AC-7 の E2E をタグ付きで追加する。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/draftListLayout.spec.ts` 幅390pxで投稿フォームを開く → 投稿のボタンの文字が16pxで左右余白が14px、キャンセルの左右余白が6pxになる
