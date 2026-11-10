# Implementation Plan

- [x] 1. 基準の記録と、構造の検査の追加
- [x] 1.1 変更の前の基準の件数を記録する
  - 変更の前に `npm run test:all` が終了コード 0 で通過し、件数（unit・component・route・render・e2e）が Implementation Notes に記録されている
  - e2e の 7 件の名前が記録され、後の検証で同じ 7 件を比べられる
  - _Requirements: 6.2, 6.4_

- [x] 1.2 部品フォルダ外のソースファイルを検査する単体テストを追加する
  - テストは `src/components/` を走査し、祖先に `index.tsx` または `index.astro` を持たないソースファイル（`.ts`・`.tsx`・`.astro`）を部品フォルダの外と判定する
  - 例外の一覧（`i18n/useTranslation.ts`・`i18n/renderSlots.tsx`・`layout/nav/navItems.ts`・`layout/nav/syncAccountAvatar.ts`・`layout/nav/syncActiveState.ts`・`layout/nav/syncGuestModeQuery.ts`）は、理由つきの定数としてテストに書かれている
  - 移動の前の現行のコードで、一覧にない部品フォルダ外のファイル（移動対象の 9 件）が違反として報告され、テストが失敗する
  - 一覧にない新しいファイルを置いた負例で、テストが違反を報告することが確かめられている
  - `composer/ThreadComposer/hooks/`・`rules/` は祖先に `ThreadComposer/index.tsx` があるため、部品フォルダの中と判定され、一覧に載せない（設計からの差は Implementation Notes に記録する）
  - _Boundary: 構造の検査_
  - _Requirements: 1.1, 1.3, 1.4_

- [x] 1.3 `structure.md` の領域一覧を検査する単体テストを追加する
  - テストは `src/lib/` の直下のフォルダと `.ts` ファイル、`src/components/` の直下のフォルダを、`.kiro/steering/structure.md` のバッククォートの名前と比べる
  - 移動の前の現行のコードで、`account`・`codegen`・`image`・`privacy`・`site`・`video`・`guestMode.ts` が一覧にないことが報告され、テストが失敗する
  - 一覧にない領域の名前を報告する形で、差の内容が失敗のメッセージに出る
  - _Boundary: 構造の検査_
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 2. 利用されないサンプルとデッドコードの削除
- [x] 2.1 選択式質問のサンプル画面と部品を削除する
  - `src/pages/samples/choice-question.astro` と `src/components/common/ChoiceQuestionSample/` が無く、空になった `src/pages/samples/` も無い
  - `common/README.md` から `ChoiceQuestionSample` の記述と `docs/features/choice-question` の参照が消えている
  - `/samples/choice-question` の応答が 404 になる（build 後のルーティングで確かめる）
  - _Boundary: サンプル画面_
  - _Requirements: 2.1, 2.2_

- [x] 2.2 デッドコードの部品と `dead.md` を削除する
  - `src/components/common/PaginationModeSelect/` と `src/components/dead.md` が無い
  - `common/README.md` の `PaginationModeSelect` の記述（一覧・図・注記）が消えている
  - _Boundary: デッドコード_
  - _Requirements: 3.1_

- [x] 2.3 `pages/entries/sample.astro` のコメントを現存する検査に合わせる
  - コメントが、存在しない e2e のファイル名（`entryThreadDetail.spec.ts` など）を指さない
  - `/entries/sample` の画面は変えず、e2e の entry 系が通る
  - _Boundary: サンプル画面_
  - _Requirements: 2.3, 2.4_

- [x] 3. ページングの分岐の削除
- [x] 3.1 タイムラインから、到達しない「ページング」の分岐を削除する
  - `Timeline` に `paginationMode`・`pagedController`・`isPaged`・`PAGE_SIZE`・`pageSize` の状態・paged 用の `NavigationBar` の描画が無い
  - 無限スクロールの経路（`infiniteController`）と表示は変わらず、タイムラインの e2e が通る
  - _Boundary: タイムライン_
  - _Requirements: 3.2, 3.3_

- [x] 3.2 Entry の一覧から、到達しない「ページング」の分岐を削除する
  - `EntryList` に `paginationMode`・`pagedController`・`isPaged`・`PAGE_SIZE`・`PageSizeSelect` の描画が無い
  - 無限スクロールの経路と表示は変わらず、Entry の一覧の e2e が通る
  - _Depends: 3.1_
  - _Boundary: Entry の一覧_
  - _Requirements: 3.2, 3.3_

- [x] 3.3 ページングだけが使っていた部品・設定・型を削除する
  - `src/components/common/PageSizeSelect/` が無い
  - `ComponentList` から `useCursorPaginationController` と、それを説明するコメントが消え、`useInfiniteScrollController` は残る
  - `src/lib/settings/timelineSettings.ts` から `PaginationMode` 型、`readPageSizeSetting`・`writePageSizeSetting`、関連するコメントアウトのコードが消え、同ファイルの他の設定は残る
  - `common/README.md` から `PageSizeSelect`・`PaginationModeSelect` の記述が消えている
  - `NavigationBar` は `DraftListPanel` が使うため残る
  - _Depends: 3.1, 3.2_
  - _Boundary: 共通部品, 設定_
  - _Requirements: 3.3_

- [x] 4. ゲストのダミーデータと判断の分割
- [x] 4.1 ダミーのデータを `lib/timeline/guest/` に移す
  - `src/lib/timeline/guest/` に、資材のパス（`assets.ts`）・投稿（`posts.ts`）・Entry（`entries.ts`）・公開の入口（`index.ts`）がある
  - `index.ts` は `getGuestDummyData` と `GUEST_SAMPLE_ENTRY_PATH` を公開し、言語ごとのキャッシュを持つ
  - 移動したファイルに判断の関数（`resolveGuestDeleteScope`）が含まれない
  - `git diff -M` で、移動したデータの本文が変わっていないことが確かめられている（import の付け替えを除く）
  - _Boundary: ゲストのダミーデータ_
  - _Requirements: 4.1_

- [x] 4.2 削除範囲の判断を `lib/guestMode.ts` に移す
  - `resolveGuestDeleteScope(sourceUri, translator)` が `src/lib/guestMode.ts` にあり、`@/lib/timeline/guest` の `getGuestDummyData` を使う
  - 判断の結果は、テーブルに無い `sourceUri` で `{ kind: "unknown" }` を返すなど、移動の前と同じ
  - `lib/timeline/guest/` が `lib/guestMode.ts` を import しない（閉路が無い）
  - _Depends: 4.1_
  - _Boundary: ゲストの判断_
  - _Requirements: 4.2_

- [x] 4.3 利用者の import を移動後のパスに付け替え、旧ファイルを削除する
  - `Timeline`・`EntryList` は `@/lib/timeline/guest` から、`EntryCard`・`useSkyshareEntryStatus` は `@/lib/guestMode` から import する
  - `PostCard` のコメント（158 行付近）の参照先を `@/lib/timeline/guest`・`@/lib/guestMode` に直す（`PostCard` は import していない）
  - `tests/unit/lib/site/envValues.test.ts` の import を `@/lib/timeline/guest` に付け替え、同じ期待値で通る
  - `src/lib/timeline/guestDummyPosts.ts` が無い
  - _Depends: 4.2, 3.1, 3.2_
  - _Boundary: ゲストの利用者_
  - _Requirements: 4.3, 4.4, 6.1_

- [x] 5. 部品フォルダ外のファイルの移動
- [x] 5.1 (P) 項目の一覧（`helpEntries.tsx`）を `Help` の子に移す
  - `src/components/help/Help/helpEntries.tsx` があり、`src/components/help/helpEntries.tsx` が無い
  - `Help` と `HelpItem` の import が移動後のパスを指し、ヘルプの表示は変わらない
  - _Boundary: ヘルプ_
  - _Requirements: 1.2_

- [x] 5.2 (P) プライバシーの方針の部品を、部品フォルダに移す
  - `src/components/privacy/PolicyCards/index.tsx` と `index.module.css` があり、移動前のファイルが無い
  - `pages/privacy.astro` の import（folder の index を指す形）が変わらず、プライバシーのページが表示される
  - _Boundary: プライバシー_
  - _Requirements: 1.2_

- [x] 5.3 (P) 共有の Web Share の処理を `PostCard` の子に移す
  - `src/components/timeline/PostCard/useWebShareCrosspost.ts` があり、`src/components/share/useWebShareCrosspost.ts` が無い
  - `PostCard` の import が `./useWebShareCrosspost` を指す
  - _Boundary: タイムラインの投稿カード_
  - _Requirements: 1.2_

- [x] 5.4 (P) 画像の切り抜きのスタイルを `ImagePicker` の子に移す
  - `src/components/image/ImagePicker/croppedImageStyle.ts` があり、移動前のファイルが無い
  - `ImagePicker` の import が `./croppedImageStyle` を指す
  - _Boundary: 画像の選択_
  - _Requirements: 1.2_

- [x] 5.5 予約の利用可否の処理を `ScheduleSetting` の子に移し、利用者の import を付け替える
  - `src/components/schedule/ScheduleSetting/useScheduleAvailability.ts` があり、移動前のファイルが無い
  - `ScheduleSetting`・`AuthorizationReturn`・`ThreadComposer` の import が移動後のパスを指す
  - 予約の設定の画面と、投稿の作成の画面の動作は変わらない
  - _Boundary: 予約の設定, 投稿の作成_
  - _Requirements: 1.2_

- [x] 5.6 共有の設定の切り替えの処理を `Settings` の子に移し、利用者の import を付け替える
  - `src/components/settings/Settings/useShareToggles.ts` があり、移動前のファイルが無い
  - `Settings`・`ThreadComposer`・`ComposerOptions`・`useThreadSubmit` の import（型を含む）が移動後のパスを指す
  - _Depends: 5.5_
  - _Boundary: 設定, 投稿の作成_
  - _Requirements: 1.2_

- [x] 5.7 (P) 日付の計測タグとメタデータの部品を、単独の部品フォルダに移す
  - `src/components/layout/AnalyticsTag/index.astro` と `src/components/layout/Metadatas/index.astro` があり、移動前のファイルが無い
  - `Metadatas` が `../AnalyticsTag/index.astro` を、`Baselayout` が `@/components/layout/Metadatas/index.astro` を import する
  - `tests/render/components/AnalyticsTag.test.ts` の import が移動後のパスを指し、同じ期待値で通る
  - _Boundary: レイアウト_
  - _Requirements: 1.2, 6.1_

- [x] 5.8 ナビゲーションのアイコンを部品フォルダに移す
  - `src/components/layout/NavIcon/index.astro` と `index.module.css` があり、`src/components/layout/nav/NavIcon.astro` と `NavIcon.module.css` が無い
  - `Sidebar` と `FooterNav` の `NavIcon` の import が移動後のパスを指す
  - `layout/nav/` には `navItems.ts` と `sync*.ts` の 4 件だけが残る（例外の一覧に載る）
  - _Depends: 5.7_
  - _Boundary: レイアウトのナビゲーション_
  - _Requirements: 1.2_

- [x] 6. 検証と steering の更新
- [x] 6.1 `structure.md` の領域一覧を実装に合わせる
  - `lib` の領域一覧に `account`・`codegen`・`image`・`privacy`・`site`・`video`・`guestMode.ts` が含まれる
  - `components` の領域一覧に `account`・`common`・`layout`・`i18n` が含まれる
  - 「既知の不一致」の記述（composer の `rules/`、`timeline/ThreadCard/entryCandidate.ts`）を現状に合わせる
  - `tests/unit/scripts/steeringRegions.test.ts`（1.3）が通る
  - _Depends: 4.3, 5.8_
  - _Boundary: steering_
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 6.2 部品フォルダ外のファイルが例外の一覧だけになったことを確かめる
  - `tests/unit/scripts/componentLayout.test.ts`（1.2）が通り、違反が 0 件である
  - _Depends: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  - _Boundary: 構造の検査_
  - _Requirements: 1.1, 1.3, 1.4_

- [x] 6.3 削除と移動の後に、残った旧い参照がないことを確かめる
  - ソース・テスト・steering に `ChoiceQuestionSample`・`PaginationModeSelect`・`PageSizeSelect`・`useCursorPaginationController`・`guestDummyPosts`・`docs/features/choice-question` が無い（検索の結果が 0 件）
  - _Depends: 2.1, 2.2, 3.3, 4.3, 6.2_
  - _Boundary: 検証_
  - _Requirements: 2.2, 3.1, 4.1_

- [x] 6.4 全体の検証を通し、基準を確かめる
  - `npm run test:all` が終了コード 0 で通過する
  - 件数（unit・component・route・render・e2e）が 1.1 で記録した基準を下回らない（unit は新しい構造の検査の分だけ増える）
  - 許容リスト（`config/architecture/import-allowlist.json`）の件数が 70 以下のまま
  - e2e の 7 件が 1.1 と同じ名前で通過する
  - 結果（件数・終了コード）が Implementation Notes に記録されている
  - _Depends: 6.3_
  - _Boundary: 検証_
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

## Implementation Notes

- 基準（1.1・変更の前・`npm run test:all` 終了コード 0）: unit 297・component 13・route 212（bskySessionRefresh の成功経路の route テストを追加した後の件数）・render 2・e2e 7（全件通過）。許容リストは 70 件。
- 1.2・1.3 は RED のコミット。移動（2.x〜5.x）と steering の更新（6.1）の後に GREEN になる。
- 設計からの差（1.2）: `composer/ThreadComposer/hooks/`・`rules/` は祖先の `ThreadComposer/index.tsx` により部品フォルダの中と判定されるため、例外の一覧に載せない。
- 4.1: 分割のあと、旧モジュールとの同値（両言語の `getGuestDummyData` と `resolveGuestDeleteScope` が deep-equal）を、一時的な単体テストで確かめ、テストは削除した。
- 5.x: 移動後の `test:unit`・`test:component`・`test:render` は通過。steering の検査（1.3）だけが、6.1 の更新まで失敗する（RED のまま）。
- 6.4（最終）: `npm run test:all` 終了コード 0。unit 302（基準 297 + 新しい検査 5）・component 13・route 212・render 2・e2e 7（全件通過）。許容リスト 70 件・違反 0・stale 0。途中で `layout/Metadatas` の領域をまたぐ相対 import を検出し、`@/` の形に直した。
- 審査（sanity review）の方式: inline（独立のサブエージェントは起動せず、同じ観点を本文脈で確かめた）。

### feature 検証（kiro-validate-impl, 2026-11-10）

- 判定は `GO`。全試験（`npm run test:all`）は終了コード 0（unit 700 件通過・2 件スキップ、component 13、route 212、render 2、e2e 10）。タスクは全て `[x]`、`_Blocked:_` は無い。受入基準は全てタスクの `_Requirements` から参照されている（突き合わせで未参照 0 件）。TODO・秘密情報の検出に該当は無い。判断の項目（タスク間の結線・設計との一致・境界）は Codex（`codex_exec`、読み取り専用）の独立した検証を入力にし、指摘は Claude が実物で確かめて採否を決めた。
- 指摘と処置: design.md に、後の spec（`util-placement`・`lib-large-files` ほか）で移動・分割・削除されたパスが残っていた。「現況との対応（2026-11-10 追補）」の表を加えた。`/samples/choice-question` は `src/pages/samples/` が無く、ルートとして存在しないことを確かめた。
