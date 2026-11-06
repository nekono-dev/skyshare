# 要件書

## 概要

部品フォルダの外に置かれたファイル、利用されないサンプル画面とデッドコード、データと判断が混ざったゲストのダミーデータ、実装と合わない steering の領域一覧を整える。利用者に見える画面と操作は変えない（サンプル画面の削除を除く。下の隣接する期待を参照）。

2026-11-01 の確認（brief の記述を、現在のコードで照合した結果）:

- **部品フォルダ外のファイル**: 13 件。brief の 10 件に、`src-lib-ui-boundary` で領域の直下へ移った 3 件（`image/croppedImageStyle.ts`・`schedule/useScheduleAvailability.ts`・`settings/useShareToggles.ts`）を加えた。
- **例外（部品フォルダ外に置いてよいもの）**: `composer/ThreadComposer/hooks/`・`rules/`（`src-composer-layout` の規則）と、`i18n/` の翻訳の入口（`useTranslation.ts`・`renderSlots.tsx`。`structure.md` の規則）。
- **ゲストのダミーデータ**: 利用者は 6 箇所（`Timeline`・`PostCard`・`EntryCard`・`EntryList`・`useSkyshareEntryStatus`、テスト 1 件）。brief は `PostCard` を挙げていなかった。
- **古いコメント**: `pages/samples/choice-question.astro` と `pages/entries/sample.astro` が指す e2e のファイル（`choiceQuestion.spec.ts`・`entryThreadDetail.spec.ts` など）は存在しない。
- **許容リスト**（`config/architecture/import-allowlist.json`）に、移動対象のファイルの項目は無い。

用語:

- **部品フォルダ**: `index.tsx`（または `index.astro`）を持つフォルダ。
- **領域の直下**: `src/components/<領域>/` の直下で、部品フォルダの外にあるファイル。

## 境界の文脈

- **対象内**: 部品フォルダ外のファイルの配置、サンプル画面と `ChoiceQuestionSample` の削除、デッドコード（`PaginationModeSelect`・`components/dead.md`）の削除、ゲストのダミーデータと判断の分割、`structure.md` の `lib` の領域一覧、古いコメントの修正。
- **対象外**: `/entries/sample`（`pages/entries/sample.astro`）の削除（v2 リリース後に別途行う。本 spec では残す）、部品の表示と操作、ゲストモードの振る舞い、`lib` の業務の判断、import の表記（`src-import-style`）、運用ツールの配置（`ops-tooling-layout`）、`ComponentList` の内部の分割（要件の対象外。分割の要否は design で扱う）。
- **隣接する期待**: `/samples/choice-question` は削除により 404 になる。この変化は、2026-11-01 に利用者が了承した決定として扱う。`/entries/sample` は残す（ゲストモードの「Entryを開く」の遷移先）。

## 要件

### 1. 部品フォルダ外のファイルの配置

**目的:** 開発者として、`components/` の中で、どのファイルがどの部品に属するかを、フォルダ名だけで読み取りたい。

#### 受入基準

1. The `src/components/` shall の部品フォルダの外に、`.ts`・`.tsx`・`.astro` のソースファイルを置かない（例外は 1.3 の一覧に限る）。
2. When 部品フォルダの外のファイル（`help/helpEntries.tsx`・`privacy/PolicyCards.tsx`・`share/useWebShareCrosspost.ts`・`image/croppedImageStyle.ts`・`schedule/useScheduleAvailability.ts`・`settings/useShareToggles.ts`・`layout/AnalyticsTag.astro`・`layout/Metadatas.astro`・`layout/nav/NavIcon.astro`）を移すとき, the 実装 shall それを所有する部品のフォルダへ移し、そのスタイル（`*.module.css`）を同じフォルダに残す。
3. Where 設計が、部品の子として置くと役割がわかりにくくなると記録した例外（現時点では `composer/ThreadComposer/` の `hooks/`・`rules/` の子フォルダと、`i18n/` の翻訳の入口（`useTranslation.ts`・`renderSlots.tsx`）、`layout/nav/` の共有の処理（`navItems.ts`・`syncAccountAvatar.ts`・`syncActiveState.ts`・`syncGuestModeQuery.ts`。Sidebar と FooterNav が共有するため、どちらの部品の子にもできない）), the `src/components/` shall それらを例外として部品フォルダの外に置いてよい。部品の子として整理してまとまりが良くなるファイルは、例外にせず部品の子として配置する。
4. If 部品フォルダの外に、1.3 の例外の一覧にないソースファイルが置かれたとき, the 構造の検査 shall その違反を報告する。

### 2. 選択式質問のサンプル画面の削除

**目的:** 利用者として、本番にだけ存在する確認用の画面が見えないようにしたい。開発者として、読まれないサンプルを残さないようにしたい。

#### 受入基準

1. When 訪問者が `/samples/choice-question` を開いたとき, the システム shall 404 の応答を返す（2026-11-01 の利用者の了承による変化）。
2. The `src/components/common/` shall `ChoiceQuestionSample` を含まず、`common/README.md` は、削除されたサンプルと存在しない参照（`docs/features/choice-question`）を示さない。
3. The システム shall `/entries/sample` の画面を従来どおり配信し、ゲストモードの「Entryを開く」の遷移先として使えるようにする。
4. The ソースのコメント shall 存在しないテストのファイルを指さない（`pages/samples/choice-question.astro`・`pages/entries/sample.astro`）。

### 3. デッドコードの削除

**目的:** 開発者として、到達しない経路を読まずに済むようにしたい。

#### 受入基準

1. The `src/components/` shall `PaginationModeSelect` と `components/dead.md` を含まず、`common/README.md` はそれらを示さない。
2. While 利用者がタイムラインを表示している間（保存されているページング設定の値にかかわらず）, the タイムライン shall 従来どおり無限スクロールで表示する。
3. The 実装 shall 到達しない「ページング」の分岐を削除する。その分岐だけが使っていた部品（`common/PageSizeSelect/`・`ComponentList` の `useCursorPaginationController`）・設定の読み書き（`readPageSizeSetting`・`writePageSizeSetting`）・型（`PaginationMode`）・固定値（`"infinite" as PaginationMode`）も削除する。利用者に見える変化を作らない。

### 4. ゲストのダミーデータと判断の分割

**目的:** 開発者として、ダミーのデータと判断の関数を別の場所で読めるようにしたい。`guestDummyPosts.ts`（790 行）を読むときに、データと判断が混ざらないようにするため。

#### 受入基準

1. The 実装 shall ダミーのデータ（投稿・Entry・動画）だけを `lib/timeline/guest/` に置き、判断の関数を含まない。
2. The 判断の関数（`resolveGuestDeleteScope` など）shall `lib/guestMode.ts` に置く。
3. When ゲストが、タイムライン・Entry の一覧・Entry のカード・投稿のカードを表示したとき, the 画面 shall 分割の前と同じダミーの内容と、同じ削除の範囲の判定を示す。
4. The 利用者の部品（`Timeline`・`PostCard`・`EntryCard`・`EntryList`・`useSkyshareEntryStatus`）shall 分割の後も、同じ結果を返す（import の付け替えのみ）。

### 5. steering の領域一覧

**目的:** 開発者として、`structure.md` の領域の一覧を見れば、`src/lib/` と `src/components/` の領域がすべて分かるようにしたい。

#### 受入基準

1. The `.kiro/steering/structure.md` shall `src/lib/` の領域（`account`・`codegen`・`image`・`privacy`・`site`・`video` と `guestMode.ts`）を、すべて一覧に含む。
2. The `.kiro/steering/structure.md` shall `src/components/` の領域（`account`・`common`・`layout`・`i18n` を含む）を、すべて一覧に含む。
3. When 領域の一覧が実装と合わなくなったとき, the 構造の検査 shall その差を報告する（検査の方法は design で決める）。

### 6. 既存の検証と振る舞いの不変

**目的:** 開発者として、移動と削除が安全に行われたと確かめたい。テストの件数と検査の結果が後退しないようにするため。

#### 受入基準

1. The 変更 shall 既存のテストの期待値を変えず、変更は import パス・移動後のパス・削除したサンプルとデッドコードのテストだけにする。
2. The 変更 shall `npm run test:all` が終了コード 0 で通過し、件数が最新の基準（unit 297・component 13・route 211・render 2・e2e 7）を下回らない。
3. The 変更 shall 許容リスト（`config/architecture/import-allowlist.json`）の項目を増やさない（70 件以下のまま）。
4. The e2e（7 件）shall 移動と削除の前と同じ結果で通過する（`/samples/choice-question` を開く e2e は無い）。
