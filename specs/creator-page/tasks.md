# クリエイターモードのページ タスク一覧

## Phase 1: ツールの組み立てと差し込み

- 対応: D-1, D-2
- [ ] T-1.1: `creatorTools.ts` に文脈の型とツールの一覧を作る。
- [ ] T-1.2: `ThreadComposer` と `ThreadSegmentForm` に `buildTools` を追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/creatorPage.spec.ts` 確認用のツールを登録して専用のページを開く → 各セグメントの本文の直下にツールボックスが表示され、通常の投稿フォームには表示されない

## Phase 2: ページ

- 対応: D-3
- [ ] T-2.1: `creator.astro` を作り、未認証のリダイレクトを実装する。
- [ ] T-2.2: 受け入れ条件のタグ付きのE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/creatorPage.spec.ts` 未認証で専用のページを開く → ログインのページへ移る
