# クリエイターモードのリンクと装飾 タスク一覧

## Phase 1: 純粋関数

- 対応: D-1, D-3
- [ ] T-1.1: `byteOffset.ts`・`facetReindex.ts`・`manualFacets.ts`・`yaytext.ts` を実装する。
- [ ] T-1.2: 範囲の再計算と変換表の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/postFeatures tests/util/postFeatures`

## Phase 2: リンクのツール

- 対応: D-2
- [ ] T-2.1: `LinkFacetPanel` と手動リンクの強調表示を実装し、ツールの一覧に登録する。
- [ ] T-2.2: 送信時に手動リンクと自動検出を統合する。
- 検証: `npm run build`
- E2E: `tests/e2e/creatorRichtext.spec.ts` 本文の一部を選んでリンクのツールでURLを確定し投稿する → その範囲がリンクとして送信される

## Phase 3: 装飾のツール

- 対応: D-4
- [ ] T-3.1: `YayTextPanel` を実装し、URLの手動リンクへの置き換えを行ってからツールの一覧に登録する。
- 検証: `npm run build`
- E2E: `tests/e2e/creatorRichtext.spec.ts` 本文に書いたURLを選んで太字にする → 装飾後の文字列に元のURLの手動リンクが付く
