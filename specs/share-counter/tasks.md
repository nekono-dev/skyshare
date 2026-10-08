# 共有先の文字数カウンタ タスク一覧

## Phase 1: 減算量の算出

- 対応: D-1
- [x] T-1.1: `estimateEntryUrl.ts` に `estimateSkyshareEntryUrl` を実装する。
- [x] T-1.2: URL予測の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/share/counterReserve.test.ts`

## Phase 2: カウンタへの適用

- 対応: D-2
- [x] T-2.1: `counterReserve.ts` に `resolveCounterTargets` と `resolveCounterReserve` を実装する。
- [x] T-2.2: `ThreadComposer` と `ThreadSegmentForm` でカウンタの表示と上限の補正を行う。
- [ ] T-2.3: 画像を自分で添付による上限の復帰と、2件目以降の投稿の上限を確認するE2Eテストを追加する。
- 検証: `npx vitest run tests/lib/share/counterReserve.test.ts -t resolveCounter`
- E2E: `tests/e2e/intentShare.spec.ts` 自動ポップアップするSNSを切り替えて投稿フォームを開く → 選択に応じたX・タイッツーのカウンタと、上限300のBlueskyのカウンタが表示される
