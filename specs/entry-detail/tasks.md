# entry詳細ページ タスク一覧

## Phase 1: 表示用データ

- 対応: D-1
- [x] T-1.1: `[slug].astro` で派生元のスレッドを取得し、`EntryPostView` の配列を組み立てる。
- [x] T-1.2: 連鎖の抽出の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/atproto/threadChain.test.ts`
- E2E: `tests/e2e/entryThreadDetail.spec.ts` スレッド由来のサンプルページを開く → 先頭から末尾まで古い順に表示される

## Phase 2: ページの構成

- 対応: D-2
- [x] T-2.1: `EntryDetailView` をヘッダーカードと投稿カードの並びに置き換え、余白を追加する。
- [x] T-2.2: 見出しの非表示・派生元削除時の表示・404の表示を確認するテストを追加する。
- 検証: `npm run build` と `npm run test:astro`
- E2E: `tests/e2e/entryPostCards.spec.ts` スレッドのサンプルページを開く → カードが順に並び、連結線と各カードのリアクション数が表示される

## Phase 3: サーバー描画

- 対応: D-3
- [x] T-3.1: JavaScript無効時と幅360pxの表示を確認する。
- 検証: `npm run build`
- E2E: `tests/e2e/entryPostCards.spec.ts` JavaScriptを無効にしてサンプルページを開く → サムネイルが表示され、幅360pxで横スクロールが無い

## Phase 4: SSR結果の再利用

- 対応: D-4
- [x] T-4.1: `entryPageCache` を追加し、`middleware.ts` で表示言語の判定の後に登録する。
- [x] T-4.2: 保存・再利用・言語ごとの分離・保存対象外・失敗時の動作の単体テストを追加する。
- 検証: `npx vitest run tests/lib/entry/entryPageCache.test.ts`

## Phase 5: 埋め込みの表示

- 対応: D-5
- [ ] T-5.1: `postEmbedView.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
- [ ] T-5.2: `PostLinkCard`・`PostQuote` を作成し、`PostBody` と `[slug].astro` に組み込む。
- [ ] T-5.3: サンプルページにリンクカードと引用の投稿を加え、E2Eテストを追加する。
- 検証: `npx vitest run tests/lib/entry/postEmbedView.test.ts`
- E2E: `tests/e2e/entryEmbed.spec.ts` サンプルページを開く → リンクカードと引用の枠が表示され、それぞれ新しいタブでリンク先を開く
