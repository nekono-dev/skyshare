# タイムライン タスク一覧

## Phase 1: グループの表示

- 対応: D-1
- [x] T-1.1: `Timeline` と `ThreadCard` でスレッドグループの折りたたみと展開を表示する。
- [x] T-1.2: entryを開くリンクの位置と単独の投稿の操作を確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/timelineThread.spec.ts` ゲスト表示でスレッドAを展開する → 3件が古い順に表示され、起点にスレッドのタグが無い
- E2E: `tests/e2e/timelineEntryAction.spec.ts` ゲスト表示でentryを持つ投稿を表示する → entryを開くリンクが操作の列の右端に置かれる

## Phase 2: 後からのentryの作成

- 対応: D-2
- [x] T-2.1: `entryCandidate.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
- [x] T-2.2: `useSkyshareEntryStatus` で素材と派生元を分けて扱う。
- [x] T-2.3: entryの作成で起点の投稿のURIが送られることを確認するテストを追加する。
- 検証: `npx vitest run tests/components/post/ThreadCard/entryCandidate.test.ts`
- E2E: `tests/e2e/timelineThread.spec.ts` ゲスト表示でスレッドCを表示する → 起点のカードにだけentryを作成のボタンが表示される
- E2E: `tests/e2e/timelineEntryAction.spec.ts` 起点に画像が無く返信に画像があるスレッドでentryを作成する → 送られる派生元が起点の投稿になる

## Phase 3: 削除の後の一覧

- 対応: D-3
- [x] T-3.1: `ThreadCard` から起点のURIで一覧のグループを取り除く。
- 検証: `npm run build`
- E2E: `tests/e2e/entryDeleteDialog.spec.ts` ゲスト表示でスレッドBの起点のBluesky投稿を含む削除を確定する → スレッド全体が一覧から消える

## Phase 4: スレッド単位のコントラスト

- 対応: D-4
- [ ] T-4.1: `ThreadCard` でグループ単位の判定を求め、返信の `PostCard` に `muted` を渡す。
- [ ] T-4.2: `card-muted` でボタン内のアイコンと本文のリンクのコントラストを下げる。
- [ ] T-4.3: スレッド単位のコントラストと共有のボタンのアイコンを確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/timelineThread.spec.ts` ゲスト表示で画像の無いスレッドを展開する → 起点と返信のすべてのカードがコントラストを下げるクラスを持つ
