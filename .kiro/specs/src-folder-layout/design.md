# 設計書

## 概要

部品フォルダの外に置かれたファイルを、所有する部品のフォルダへ移す。利用されないサンプル画面・デッドコード（`PaginationModeSelect`・`dead.md`・ページングの分岐とその部品）を削除する。`lib/timeline/guestDummyPosts.ts` をデータ（`lib/timeline/guest/`）と判断（`lib/guestMode.ts`）に分け、`structure.md` の領域一覧を実装に合わせる。構造の規則（部品フォルダ外のファイル・領域の一覧）は、テストで機械的に確かめる。

利用者に見える画面と操作は変えない。例外は、`/samples/choice-question` の削除による 404（2026-11-01 の了承）だけである。

### 目標

- `src/components/` の部品フォルダ外のソースファイルを、1.3 の例外に限定する。
- 到達しないサンプル・デッドコードとページングの分岐を削除する。
- ゲストのダミーデータと削除範囲の判断を別モジュールに分ける。
- `structure.md` の `lib` と `components` の領域一覧を、実装と一致させる。
- 構造の規則を、テストで機械的に検査する。

### 非目標

- 部品の表示・操作・ゲストモードの振る舞いの変更。
- `ComponentList` の内部の分割（`useCursorPaginationController` の削除を除く）。
- import の表記の統一（`src-import-style`）。
- `lib` の業務の判断の変更。

## 境界の約束

### この spec が所有するもの

- `src/components/` のファイル配置（部品フォルダ外のファイルの移動、例外の一覧）。
- サンプル画面（`pages/samples/choice-question.astro`・`common/ChoiceQuestionSample/`）と、`pages/entries/sample.astro` のコメントの修正。
- デッドコード（`common/PaginationModeSelect/`・`dead.md`）と、ページングの分岐が使っていた部品・設定・型。
- `lib/timeline/guest/`（ゲストのダミーデータ）と `lib/guestMode.ts`（`resolveGuestDeleteScope`）の分割。
- `structure.md` の領域一覧（`lib`・`components`）と、構造の検査（テスト）。

### この spec が所有しないもの

- 部品の表示・操作、ゲストモードの振る舞い（利用者に見える変化を作らない）。
- `ComponentList` の内部の分割（要件の対象外）。
- import の表記（`src-import-style`）。
- 運用ツールの配置（`ops-tooling-layout`）。
- `/entries/sample` の画面の削除（v2 リリース後に別途行う）。

### 許容する依存

- 部品の子ファイル（同じ部品フォルダの中の `.ts`）を、所有する部品が import する。
- 部品どうしは、所有する部品の `index` を import する。例外として、型と小さな関数を兄弟の部品の子ファイルから import してよい（下の「移動の判断」を参照）。
- `lib/timeline/guest/` は `lib/guestMode.ts` を import しない（判断は上位に置く）。
- `lib/guestMode.ts` は `lib/timeline/guest/` を import してよい（`lib/` の下位の領域への依存）。

### 再検証の契機

- `lib/timeline/guest` の公開する関数・定数（`getGuestDummyData`・`GUEST_SAMPLE_ENTRY_PATH`）の変更。
- `lib/guestMode.ts` の公開する関数（`resolveGuestDeleteScope`）の変更。
- `structure.md` の領域一覧の変更（構造の検査の期待値が変わる）。
- `src-import-style` の着手（この spec の移動後の import の表記を前提にする）。

## 移動の判断

各ファイルの所有者は、そのファイルを import する部品のうち、状態・責務を持つ部品とした。

| 対象                                          | 利用者                                                                   | 配置先                                                | 理由                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------ |
| `help/helpEntries.tsx`                        | `Help`・`HelpItem`（型）                                                 | `help/Help/helpEntries.tsx`                           | 項目の一覧（データ）の所有者は `Help`                        |
| `privacy/PolicyCards.tsx`（＋`.module.css`）  | `pages/privacy.astro`                                                    | `privacy/PolicyCards/index.tsx`・`index.module.css`   | 単独の部品として index を持つ                                |
| `share/useWebShareCrosspost.ts`               | `PostCard` のみ                                                          | `timeline/PostCard/useWebShareCrosspost.ts`           | 利用者が 1 つ。部品の子ファイル                              |
| `image/croppedImageStyle.ts`                  | `ImagePicker` のみ                                                       | `image/ImagePicker/croppedImageStyle.ts`              | 利用者が 1 つ。部品の子ファイル                              |
| `schedule/useScheduleAvailability.ts`         | `ScheduleSetting`・`AuthorizationReturn`・`ThreadComposer`（型・関数）   | `schedule/ScheduleSetting/useScheduleAvailability.ts` | 予約の設定の状態を持つ `ScheduleSetting` が所有              |
| `settings/useShareToggles.ts`                 | `Settings`・`ThreadComposer`・`ComposerOptions`・`useThreadSubmit`（型） | `settings/Settings/useShareToggles.ts`                | 共有の設定の状態を持つ `Settings` が所有                     |
| `layout/AnalyticsTag.astro`                   | `Metadatas`・render テスト                                               | `layout/AnalyticsTag/index.astro`                     | 単独の部品として index を持つ                                |
| `layout/Metadatas.astro`                      | `Baselayout`                                                             | `layout/Metadatas/index.astro`                        | 単独の部品として index を持つ                                |
| `layout/nav/NavIcon.astro`（＋`.module.css`） | `Sidebar`・`FooterNav`                                                   | `layout/NavIcon/index.astro`・`index.module.css`      | 部品として index を持つ                                      |
| `layout/nav/navItems.ts`・`sync*.ts`（4 件）  | `Sidebar`・`FooterNav`（両方）                                           | **`layout/nav/` に残す（例外）**                      | 両方が共有するため、どちらの部品の子にもできない（要件 1.3） |

例外の判断（要件 1.3）: `layout/nav/` の 4 件は、Sidebar と FooterNav の両方が使う。どちらかの子に置くと、もう一方が兄弟の子を参照することになり、役割が読み取りにくくなる。よって例外とし、構造の検査の一覧に理由つきで記録する。

## ファイル構成計画

### 移動（`git mv` で履歴を残す）

| 移動前                                                | 移動後                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/components/help/helpEntries.tsx`                 | `src/components/help/Help/helpEntries.tsx`                                     |
| `src/components/privacy/PolicyCards.tsx`              | `src/components/privacy/PolicyCards/index.tsx`                                 |
| `src/components/privacy/PolicyCards.module.css`       | `src/components/privacy/PolicyCards/index.module.css`                          |
| `src/components/share/useWebShareCrosspost.ts`        | `src/components/timeline/Timeline/ThreadCard/PostCard/useWebShareCrosspost.ts` |
| `src/components/image/croppedImageStyle.ts`           | `src/components/composer/ThreadComposer/ImagePicker/croppedImageStyle.ts`      |
| `src/components/schedule/useScheduleAvailability.ts`  | `src/components/schedule/ScheduleSetting/useScheduleAvailability.ts`           |
| `src/components/settings/useShareToggles.ts`          | `src/components/settings/Settings/useShareToggles.ts`                          |
| `src/components/layout/AnalyticsTag.astro`            | `src/components/layout/AnalyticsTag/index.astro`                               |
| `src/components/layout/Metadatas.astro`               | `src/components/layout/Metadatas/index.astro`                                  |
| `src/components/layout/nav/NavIcon.astro`             | `src/components/layout/NavIcon/index.astro`                                    |
| `src/components/layout/nav/NavIcon.module.css`        | `src/components/layout/NavIcon/index.module.css`                               |
| `src/lib/timeline/guestDummyPosts.ts`（データの部分） | `src/lib/timeline/guest/assets.ts`・`posts.ts`・`entries.ts`                   |

### 新規

| パス                                         | 責務                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/timeline/guest/index.ts`            | 公開の入口。`GuestDummyData` 型、`GUEST_SAMPLE_ENTRY_PATH`、言語ごとのキャッシュ、`getGuestDummyData`。                            |
| `src/lib/timeline/guest/assets.ts`           | 画像の data URI（`placeholderImage`）と、`public/materials/` の画像・動画パス、Entry の遷移先（`GUEST_SAMPLE_ENTRY_PATH`）の定数。 |
| `src/lib/timeline/guest/posts.ts`            | 投稿データの組み立ての入口。本文・スレッド・facets の内訳は `postsBasic.ts`・`postsThread.ts`・`postFacets.ts`。                   |
| `src/lib/timeline/guest/entries.ts`          | ダミーの Entry（動画を含む）と、削除範囲の表（`deleteScopes`）。                                                                   |
| `tests/unit/scripts/componentLayout.test.ts` | 部品フォルダ外のソースファイルの検査（要件 1.4）。                                                                                 |
| `tests/unit/scripts/steeringRegions.test.ts` | `structure.md` の領域一覧と実装の差の検査（要件 5.3）。                                                                            |

### 削除

| パス                                                                              | 理由                                               |
| --------------------------------------------------------------------------------- | -------------------------------------------------- |
| `src/pages/samples/choice-question.astro`（と `src/pages/samples/` の空フォルダ） | サンプル画面（要件 2.1）                           |
| `src/components/common/ChoiceQuestionSample/`                                     | サンプル部品（要件 2.2）                           |
| `src/components/common/PaginationModeSelect/`                                     | デッドコード（要件 3.1）                           |
| `src/components/common/PageSizeSelect/`                                           | ページングの分岐だけが使う（要件 3.3）             |
| `src/components/dead.md`                                                          | デッドコードのメモ（要件 3.1）                     |
| `src/lib/timeline/guestDummyPosts.ts`                                             | `lib/timeline/guest/` に分けた後に削除（要件 4.1） |

### 編集（import・コメント・分岐の削除）

| パス                                                                                               | 変更                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/privacy.astro`                                                                          | 変更なし（`PolicyCards` は folder の index を import する）                                                                                                                                             |
| `src/layout/Baselayout.astro`                                                                      | `Metadatas` の import を `@/components/layout/Metadatas/index.astro` へ                                                                                                                                 |
| `src/components/layout/Metadatas/index.astro`                                                      | `AnalyticsTag` の import を移動後のパスへ                                                                                                                                                               |
| `src/components/layout/FooterNav/index.astro`・`Sidebar/index.astro`                               | `NavIcon` の import を `@/components/layout/NavIcon/index.astro` へ                                                                                                                                     |
| `src/components/help/Help/index.tsx`                                                               | `./helpEntries` へ                                                                                                                                                                                      |
| `src/components/help/HelpItem/index.tsx`                                                           | 型の import を `@/components/help/Help/helpEntries` へ                                                                                                                                                  |
| `src/components/composer/ThreadComposer/ImagePicker/index.tsx`                                     | `./croppedImageStyle` へ                                                                                                                                                                                |
| `src/components/timeline/Timeline/ThreadCard/PostCard/index.tsx`                                   | `./useWebShareCrosspost` へ。コメント（158 行）の参照先を `@/lib/timeline/guest`・`@/lib/guestMode` に直す                                                                                              |
| `src/components/schedule/ScheduleSetting/index.tsx`・`AuthorizationReturn/index.tsx`               | `./useScheduleAvailability`（ScheduleSetting）・移動後のパス（AuthorizationReturn）                                                                                                                     |
| `src/components/settings/Settings/index.tsx`                                                       | `./useShareToggles` へ                                                                                                                                                                                  |
| `src/components/composer/ThreadComposer/index.tsx`                                                 | `useScheduleAvailability`・`useShareToggles` の import を移動後のパスへ                                                                                                                                 |
| `src/components/composer/ThreadComposer/ComposerOptions/index.tsx`・`hooks/useThreadSubmit.ts`     | `useShareToggles` の型の import を移動後のパスへ                                                                                                                                                        |
| `src/components/timeline/Timeline/index.tsx`                                                       | 「ページング」の分岐（`paginationMode`・`pagedController`・`isPaged`・`PAGE_SIZE`・`pageSize` の状態・`NavigationBar` の paged 描画）を削除。ゲストのダミーデータの import を `@/lib/timeline/guest` へ |
| `src/components/entry/EntryList/index.tsx`                                                         | 同じ分岐（`PageSizeSelect` を含む）を削除。ゲストの import を `@/lib/timeline/guest` へ                                                                                                                 |
| `src/components/entry/EntryCard/index.tsx`・`entry/PostCardEntryActions/useSkyshareEntryStatus.ts` | `resolveGuestDeleteScope` の import を `@/lib/guestMode` へ                                                                                                                                             |
| `src/components/common/ComponentList/index.tsx`                                                    | `useCursorPaginationController`（と関連する説明文）を削除。`useInfiniteScrollController` は残す                                                                                                         |
| `src/lib/guestMode.ts`                                                                             | `resolveGuestDeleteScope` を追加（`getGuestDummyData` を `@/lib/timeline/guest` から import）                                                                                                           |
| `src/lib/settings/timelineSettings.ts`                                                             | `PaginationMode` 型、`timelinePageSize` の読み書き（`readPageSizeSetting`・`writePageSizeSetting`）、および参照する説明とコメントアウトを削除                                                           |
| `src/components/common/README.md`                                                                  | `PageSizeSelect`・`PaginationModeSelect`・`ChoiceQuestionSample` の記述と、存在しない `docs/features/choice-question` の参照を削除                                                                      |
| `src/pages/entries/sample.astro`                                                                   | 存在しない e2e のファイル名を指すコメントを、現存する検査に合わせる（要件 2.4）                                                                                                                         |
| `.kiro/steering/structure.md`                                                                      | `lib` の領域一覧（`account`・`codegen`・`image`・`privacy`・`site`・`video`・`guestMode.ts`）と `components` の領域一覧を補完。「既知の不一致」の記述を現状に合わせる                                   |
| `tests/render/components/AnalyticsTag.test.ts`                                                     | import を `@/components/layout/AnalyticsTag/index.astro` へ（要件 6.1）                                                                                                                                 |
| `tests/unit/lib/site/envValues.test.ts`                                                            | import を `@/lib/timeline/guest` へ（要件 6.1）                                                                                                                                                         |

### 現況との対応（2026-11-10 追補）

| 設計時のパス                                                       | 現在のパス                                                                                               | 変えた spec             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------- |
| `src/components/help/helpEntries.tsx`                              | `src/components/help/Help/helpEntries.tsx`                                                               | `src-folder-layout`     |
| `src/components/privacy/PolicyCards.tsx`・`PolicyCards.module.css` | `src/components/privacy/PolicyCards/index.tsx`・`index.module.css`                                       | `src-folder-layout`     |
| `src/components/share/useWebShareCrosspost.ts`                     | `src/components/timeline/Timeline/ThreadCard/PostCard/useWebShareCrosspost.ts`                           | `src-component-nesting` |
| `src/components/image/croppedImageStyle.ts`                        | `src/components/composer/ThreadComposer/ImagePicker/croppedImageStyle.ts`                                | `src-component-nesting` |
| `src/components/schedule/useScheduleAvailability.ts`               | `src/components/schedule/ScheduleSetting/useScheduleAvailability.ts`                                     | `src-folder-layout`     |
| `src/components/settings/useShareToggles.ts`                       | `src/components/settings/Settings/useShareToggles.ts`                                                    | `src-folder-layout`     |
| `layout/AnalyticsTag.astro`・`layout/Metadatas.astro`              | `src/components/layout/AnalyticsTag/index.astro`・`src/components/layout/Metadatas/index.astro`          | `src-folder-layout`     |
| `layout/nav/NavIcon.astro`・`NavIcon.module.css`                   | `src/components/layout/NavIcon/index.astro`・`index.module.css`                                          | `src-folder-layout`     |
| `src/lib/timeline/guest/posts.ts`                                  | `src/lib/timeline/guest/postsBasic.ts`・`postsThread.ts`・`postFacets.ts`（組み立ての入口は `posts.ts`） | `lib-large-files`       |

## アーキテクチャ

### 依存の向き（lib/timeline/guest と lib/guestMode.ts）

```
components (Timeline・EntryList・EntryCard・useSkyshareEntryStatus)
   → lib/guestMode.ts (判断: resolveGuestDeleteScope)
   → lib/timeline/guest (データ: getGuestDummyData・GUEST_SAMPLE_ENTRY_PATH)
   → lib/timeline/posts・lib/timeline/resolveEntryDeleteScope（型）・lib/atproto・lib/i18n（型）・vars
```

- `lib/timeline/guest/` は `lib/guestMode.ts` を参照しない（閉路を作らない）。
- 型のみの import も依存として数える（`structure.md` の規則）。

### ゲストのデータの組み立て

- `index.ts` が `buildGuestDummyData(t)` を呼び、`posts.ts`・`entries.ts` が返す値を 1 つの `GuestDummyData` にまとめる。
- `assets.ts` は `posts.ts`・`entries.ts` から使われる（循環を作らないため、遷移先の定数も `assets.ts` に置く）。
- 言語ごとのキャッシュは `index.ts` に残す（Workers のリクエスト間で状態が混ざらない、既存の前提）。

## 構成要素と契約

### 構造の検査（`componentLayout.test.ts`、要件 1.4）

- 入力: `src/components/` を再帰的に走査したソースファイル（`.ts`・`.tsx`・`.astro`）。
- 規則: 祖先のフォルダ（`src/components/` より下）のどれかに `index.tsx` または `index.astro` があれば、そのファイルは部品フォルダの中。どれもなければ部品フォルダの外。
- 例外: 部品フォルダの外のファイルのうち、下の一覧に載るものだけを許す。一覧にないファイルは違反として失敗させる。
- 例外の一覧（テスト内の定数。理由を併記する）:
  - `composer/ThreadComposer/hooks/`・`rules/` の子フォルダ（既存の規約）。
  - `i18n/useTranslation.ts`・`i18n/renderSlots.tsx`（翻訳の入口。`structure.md` の規則）。
  - `layout/nav/navItems.ts`・`syncAccountAvatar.ts`・`syncActiveState.ts`・`syncGuestModeQuery.ts`（共有の処理）。
- 注意: `composer/ThreadComposer/hooks/` 等は、部品フォルダ `ThreadComposer` の中にあるため、祖先の検査で部品フォルダの中と判定される。例外の一覧は、この検査の規則に従って決める（検査の結果に一致させる）。

### 領域の一覧の検査（`steeringRegions.test.ts`、要件 5.3）

- 入力: `src/lib/` の直下のフォルダと `.ts` ファイル、`src/components/` の直下のフォルダ、`.kiro/steering/structure.md`。
- 規則: 各領域の名前（`lib/<領域>`・`components/<領域>` の形、`guestMode.ts` を含む）が、`structure.md` にバッククォートで現れること。
- 失敗時: 一覧にない領域名を報告する（差の内容を示す）。

### ゲストのダミーデータ（`lib/timeline/guest`、要件 4.1）

- `getGuestDummyData(translator: Translator): GuestDummyData` — 表示言語ごとの組み立て済みのデータを返す（キャッシュ）。判断を含まない。
- `GUEST_SAMPLE_ENTRY_PATH: string` — ゲストの Entry の遷移先（`/entries/sample/`）。
- `GuestDummyData = { posts: TimelinePost[]; threads: ThreadGroup[]; entries: TimelineSkyshareEntry[]; deleteScopes: Record<string, EntryDeleteScope> }`。

### ゲストの判断（`lib/guestMode.ts`、要件 4.2）

- `resolveGuestDeleteScope(sourceUri: string, translator: Translator): EntryDeleteScope` — `getGuestDummyData(translator).deleteScopes[sourceUri]`、なければ `{ kind: "unknown" }`。振る舞いは現行と同じ。

## 要件のトレーサビリティ

| 要件 | 概要                                                   | 構成要素・契約                                                                  | 検証                             |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------- |
| 1.1  | 部品フォルダ外のソースファイルを置かない               | 移動の表・構造の検査                                                            | `componentLayout.test.ts`        |
| 1.2  | 移動時に所有する部品へ移し、スタイルを残す             | 移動の表（`.module.css` を同じフォルダへ）                                      | `test:all`・`test:imports`       |
| 1.3  | 例外は一覧に限る                                       | 例外の一覧（`layout/nav/` の共有の処理を含む）                                  | `componentLayout.test.ts`        |
| 1.4  | 新しい違反を報告する                                   | 構造の検査                                                                      | `componentLayout.test.ts` の負例 |
| 2.1  | `/samples/choice-question` は 404                      | 削除（`pages/samples/`）                                                        | 手動の確認（e2e に無い）         |
| 2.2  | `ChoiceQuestionSample` と README の参照を削除          | 削除・`common/README.md`                                                        | 検索（参照がないこと）           |
| 2.3  | `/entries/sample` は従来どおり                         | 変更なし                                                                        | e2e（entry 系）                  |
| 2.4  | 存在しないテストを指すコメントを直す                   | `pages/entries/sample.astro`                                                    | 検索                             |
| 3.1  | `PaginationModeSelect`・`dead.md` を削除               | 削除                                                                            | 検索                             |
| 3.2  | タイムラインは無限スクロールのまま                     | `Timeline`・`EntryList` の分岐の削除（無限スクロールの経路は残す）              | e2e（timeline 系）               |
| 3.3  | 到達しないページングの分岐と関連の部品・設定・型を削除 | 編集（分岐）・削除（`PageSizeSelect`）・`ComponentList`・`timelineSettings.ts`  | `test:all`・検索                 |
| 4.1  | ダミーのデータを `lib/timeline/guest/` に置く          | `guest/` の 4 ファイル                                                          | `test:all`                       |
| 4.2  | 判断の関数を `lib/guestMode.ts` に置く                 | `resolveGuestDeleteScope`                                                       | `test:all`                       |
| 4.3  | ゲストの表示と削除の判定を分割の前と同じにする         | 中身の移動のみ（内容は変えない）                                                | `test:all`・ゲストの e2e         |
| 4.4  | 利用者の部品は import の付け替えのみ                   | import の編集（`Timeline`・`EntryList`・`EntryCard`・`useSkyshareEntryStatus`） | `test:all`                       |
| 5.1  | `lib` の領域を一覧に含む                               | `structure.md`                                                                  | `steeringRegions.test.ts`        |
| 5.2  | `components` の領域を一覧に含む                        | `structure.md`                                                                  | `steeringRegions.test.ts`        |
| 5.3  | 差を検査で報告する                                     | 領域の一覧の検査                                                                | `steeringRegions.test.ts`        |
| 6.1  | 既存の期待値を変えない                                 | import・移動後のパスの変更のみ                                                  | `test:all`                       |
| 6.2  | `test:all` が 0 で、件数が基準を下回らない             | 検証                                                                            | `test:all`                       |
| 6.3  | 許容リストを増やさない                                 | 変更なし                                                                        | `test:imports`                   |
| 6.4  | e2e（7 件）が従来どおり通る                            | 検証                                                                            | `npm run test:e2e`               |

## テスト戦略

- 単体（unit）: 新しい構造の検査 2 件（負例を含む）。既存の `composerSplit.test.ts` は変更なし。件数は基準（297）より増える。
- 描画（render）: `AnalyticsTag` のテストの import 変更のみ。
- 経路（route）: 変更なし。
- コンポーネント（component）: 変更なし（`PostCard` のコメントのみ）。
- e2e: 7 件（既存）。特に、タイムラインの無限スクロール、Entry の一覧、ゲストモードの流れを確かめる。
- 検索: `ChoiceQuestionSample`・`PaginationModeSelect`・`PageSizeSelect`・`guestDummyPosts`・`useCursorPaginationController`・`docs/features/choice-question` が、ソース・テスト・steering に残らないこと。

## 移行とリスク

- 移動は 1 つの部品ごとに行い、各移動の後に import の検査（`npm run test:imports`）を通す。
- 分割（`guestDummyPosts`）は内容を変えず、ファイルの移動と import の付け替えに限る。行の内容の差は、移動後の `git diff -M` で確かめる。
- `lib/timeline` の `guest/` を追加した後は、`libRegionPairs` の閉路の検査が通ること（`lib/guestMode.ts` は region の外のファイル）。
- 削除の影響: `/samples/choice-question` の 404（了承済み）。`/entries/sample` は残す。
- 未解決の論点はなし。例外の一覧（`layout/nav/`）の採否は、設計の承認時に確認する。

## 未決の論点

- なし（移動の判断・例外・ページングの関連部品の削除は、この設計で決めた。承認時に変更があれば差し替える）。
