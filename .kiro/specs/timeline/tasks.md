# Implementation Plan

- [x] 1. グループの表示
- [x] 1.1 `Timeline` と `ThreadCard` でスレッドグループの折りたたみと展開を表示する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 4.1_
- [x] 1.2 entryを開くリンクの位置と単独の投稿の操作を確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/timelineThread.spec.ts` ゲスト表示でスレッドAを展開する → 3件が古い順に表示され、起点にスレッドのタグが無い
  - E2E: `tests/e2e/timelineEntryAction.spec.ts` ゲスト表示でentryを持つ投稿を表示する → entryを開くリンクが操作の列の右端に置かれる
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 4.1_

- [x] 2. 後からのentryの作成
- [x] 2.1 `entryCandidate.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
- [x] 2.2 `useSkyshareEntryStatus` で素材と派生元を分けて扱う。
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
- [x] 2.3 entryの作成で起点の投稿のURIが送られることを確認するテストを追加する。
  - 検証: `npx vitest run tests/components/post/ThreadCard/entryCandidate.test.ts`
  - E2E: `tests/e2e/timelineThread.spec.ts` ゲスト表示でスレッドCを表示する → 起点のカードにだけentryを作成のボタンが表示される
  - E2E: `tests/e2e/timelineEntryAction.spec.ts` 起点に画像が無く返信に画像があるスレッドでentryを作成する → 送られる派生元が起点の投稿になる
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. 削除の後の一覧
- [x] 3.1 `ThreadCard` から起点のURIで一覧のグループを取り除く。
  - 検証: `npm run build`
  - E2E: `tests/e2e/entryDeleteDialog.spec.ts` ゲスト表示でスレッドBの起点のBluesky投稿を含む削除を確定する → スレッド全体が一覧から消える
  - _Requirements: 3.1, 3.2_

- [x] 4. スレッド単位のコントラスト
- [x] 4.1 `ThreadCard` でグループ単位の判定を求め、返信の `PostCard` に `muted` を渡す。
  - _Requirements: 1.4, 4.1, 4.2_
- [x] 4.2 `card-muted` でボタン内のアイコンと本文のリンクのコントラストを下げる。
  - _Requirements: 1.4, 4.1, 4.2_
- [x] 4.3 スレッド単位のコントラストと共有のボタンのアイコンを確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/timelineThread.spec.ts` ゲスト表示で画像の無いスレッドを展開する → 起点と返信のすべてのカードがコントラストを下げるクラスを持つ
  - _Requirements: 1.4, 4.1, 4.2_

- [x] 5. 後続の投稿のツールバー
- [x] 5.1 `PostCard` に `hideToolbar` を設け、`ThreadCard` が後続の投稿に指定する。
  - _Requirements: 1.5_
- [x] 5.2 後続のカードにツールバーが無いことを確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/timelineThread.spec.ts` ゲスト表示でスレッドを展開する → 起点のカードにだけツールバーが表示される
  - _Requirements: 1.5_
