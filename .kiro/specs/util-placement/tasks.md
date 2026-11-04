# Implementation Plan

着手条件と順序（lib-layers との関係）:

- 本仕様は lib-layers の完了の後に始める。`structure.md` の「lib の領域の依存の向き」と「領域の一覧」は、lib-layers 5.1・5.2 が先に改訂する。本仕様の 6.1 は、その結果（lib-layers 5.2 で併合された依存の表）に、本仕様の変更（`lib/share`・`lib/feedback` の参照、`util` の残り 5 件、`src/types/`）を重ねて書き換える。併合の手順は 6.1 に書く。
- 共有ファイルの編集順: `tests/unit/scripts/importRules.test.ts` は lib-layers 4.2 の後に本仕様 6.2 で例のパスを直す（lib-layers → util-placement → structure-checks の順）。`components/feedback/FeedbackForm/index.tsx`・`lib/feedback/*` は lib-layers 2.1 の後に本仕様 4.2・4.3 で import を付け替える。`components/composer/ThreadComposer/hooks/useDraftFlow.ts` は lib-layers 3.2（`draftList`）の後に本仕様 5.2（`util/links`）で付け替える。
- 利用者の決定はすべて design の「決定の記録」の節に記録済み（U-1 は案 C、U-2 は `util/` に残す、U-3 は部品の内側、型の規則）。未決定の項目は無い。

- [ ] 1. 着手前の基準と決定の記録
- [x] 1.1 test:all の基準と生成物の差分を記録する
  - 着手前の `npm run test:all` の終了コードと通過件数を、実装の記録に残す（以降の完了の条件の基準にする）
  - 着手前の `npm run apigen` の後に `src/client/openapi/` と OpenAPI 文書に差分が無いことを確かめる（差分がある場合は本仕様の着手前に別途直す）
  - 完了の条件: 基準の件数、終了コード、apigen に差分が無いことが記録されている
  - _Requirements: 5.3, 5.4, 5.5_
- [x] 1.2 利用者の決定を design の「決定の記録」に記録する（記録済み）
  - U-1（案 C。`lib/share` は純粋な組み立てのみ。ブラウザ側は `components/share/IntentShareDialog/` の内側）、U-2（`waitForImageLoad` は `util/` に残す）、U-3（`parseUserAgent` は `components/feedback/FeedbackForm/` の内側）、型の規則（`lib` が使う `util`・`components` の型は `src/types/`。外部パッケージを import しない）を design に書く
  - 完了の条件: design の「決定の記録」と「決定から生じる例外と差分」の節があり、タスクの対象がそれと一致している
  - _Requirements: 1.9, 2.6, 3.1, 7.2_

- [ ] 2. lib/share と lib/settings の循環の解消
- [x] 2.1 AutoPopupTarget の値と型を lib/share へ移す
  - 投稿後に自動でポップアップする SNS の一覧と型を、lib/share の 1 ファイルへ移す（中身と名前は変えない）
  - 設定の読み書き（shareSettings）と、共有の文字数の予約（counterReserve）が、移した先を参照する
  - 完了の条件: lib/share から lib/settings への参照が 0 件で、設定の読み込みと既存の共有のテストが移動の前と同じ結果を返す
  - _Depends: 1.1_
  - _Requirements: 2.4, 2.5, 5.2_

- [ ] 3. util/share と textCount を一括で移す（一つの変更として行う）
  - 理由: `intent.ts`・`webShare.ts`・`openIntentPopup.ts` は純粋な部分とブラウザ部分が分かれており、一部だけ移すと `util` から `lib` への参照が中間状態に残る。よって、3.1 の一つの変更として行う
- [x] 3.1 util/share と util/textCount を lib/share と components/share/IntentShareDialog へ一括で移す
  - 純粋な部分を `lib/share` へ移す: `util/share/intentLength.ts`・`util/share/truncateText.ts`・`util/textCount.ts` → `lib/share/`（中身と名前は変えない）。`util/share/intent.ts` の `IntentTarget`・`isValidInstanceDomain`・`BuildIntentTextOptions`・`resolveTruncateLimit`・`buildIntentSuffix`・`buildIntentText`・`IntentUrlOptions`・`buildIntentUrl` → `lib/share/intent.ts`。`util/share/webShare.ts` の `buildWebShareText`・`toShareFile` → `lib/share/webShareData.ts`
  - ブラウザ部分を `components/share/IntentShareDialog/` の内側へ移す（案 C）: `util/share/openIntentPopup.ts`（`preOpenPopupWindow`・`openIntentPopup`）→ `openIntentPopup.ts`。`util/share/webShare.ts` の `canShareWithWebApi`・`shareWithWebApi`（と内部の型）→ `webShare.ts`。`util/share/intent.ts` の `OpenIntentPopupOptions`・`openIntentPopupFor` は削除する
  - 呼び出し側の合成（振る舞いは変えない）: `IntentShareDialog/index.tsx` の `openIntentPopupFor(target, text, options)` を、`buildIntentUrl` の結果が無ければ `false`、有れば `openIntentPopup(url, preOpenedWindow)` を呼ぶ形に書き換える。`ThreadComposer/rules/shareDispatch.ts` は `components/` を import せず、`openIntentPopup`・`canShareWithWebApi`・`shareWithWebApi` を `runShareDispatch` の引数（`browser`）で受け取る（決定 U-4、案 (b)）。その引数を `ThreadComposer/hooks/useThreadSubmit.ts` が `components/share/IntentShareDialog/` から import して渡す。同じ合成（`buildIntentUrl` と `openIntentPopup`）を `shareDispatch.ts` の中でも行う
  - import の付け替え: `lib/settings/shareSettings.ts`（`isValidInstanceDomain` → `@/lib/share/intent`）、`lib/share/counterReserve.ts`（相対 import `./intent`・`./intentLength`・`./autoPopupTarget`）、`components/settings/Settings/index.tsx`・`useShareToggles.ts`（`@/lib/share/intent`）、`IntentShareDialog/index.tsx`（`@/lib/share/intent` と同じ部品フォルダの `./openIntentPopup`・`./webShare`）、`ThreadComposer/hooks/useThreadSubmit.ts`（`@/components/share/IntentShareDialog/openIntentPopup`・`@/components/share/IntentShareDialog/webShare`。`runShareDispatch` へ渡す）、`ThreadComposer/rules/shareDispatch.ts`（`@/lib/share/...` のみ。`components/` は import しない）、`PostCard/useWebShareCrosspost.ts`（`@/components/share/IntentShareDialog/webShare`）、`ThreadSegmentForm/index.tsx`・`ImageAltDialog/index.tsx`（`@/lib/share/textCount`）
  - 部品の位置は変えず、import の先だけを変える（呼び出し側の合成を除く）
  - 完了の条件: `util/share/` と `util/textCount.ts` が無い。`ThreadComposer/rules/shareDispatch.ts` が `@/components/` を import しない（`composerSplit` の検査が通る）。`lib/share/` に `window`・`navigator`・`document` の参照が 0 件。`lib/share/` の内側の import が `util` と `lib/settings` を参照しない。共有の操作と設定の表示のテストが移動の前と同じ結果を返す
  - _Depends: 2.1_
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 1.7, 5.2_
- [x] 3.2 文字数のテストを tests の lib/share 配下へ移す
  - `tests/unit/util/textCount.test.ts`・`textCountFallback.test.ts` を `tests/unit/lib/share/` へ移し、import のパスだけを変える（期待値は変えない）
  - 完了の条件: `tests/unit/util/textCount*.test.ts` が無く、文字数のテストが移動の前と同じ結果を返す
  - _Depends: 3.1_
  - _Requirements: 1.7, 5.2_

- [ ] 4. 業務の判断を lib/atproto と lib/feedback へ、型を src/types へ移す
- [x] 4.1 (P) 国旗・リンク化・オブジェクト判定を lib/atproto へ移す
  - util/emoji/countryFlag・util/autoLink・util/object を lib/atproto の内側へ移し、利用元（languageFlag・richTextSegments・draft）の import を付け替える
  - 移動した兄弟どうしの import（例: `draft` → `object`）は、相対 import（`./`）にする
  - 完了の条件: util/emoji が存在せず、三つの利用元が移動の前と同じ結果を返し、lib/atproto から util への参照が 0 件
  - _Boundary: lib/atproto_
  - _Depends: 1.1_
  - _Requirements: 1.4, 1.7, 5.2_
- [x] 4.2 (P) clientEnvironment を三つに分ける（型・純粋な判定・ブラウザの読み取り）
  - `ClientEnvironment` の型を `src/types/clientEnvironment.ts` へ移す（この 1 ファイルだけを持つ。import を持たない）
  - `parseUserAgent` と補助（`detectOs`・`detectBrowser`・`dotted`・`UNKNOWN`・`BROWSER_RULES`）を `components/feedback/FeedbackForm/userAgent.ts` へ移す（import を持たない。U-3 の決定）
  - `detectStandalone`・`UserAgentData`・`refineWithUserAgentData`・`collectClientEnvironment` を `components/feedback/FeedbackForm/clientEnvironment.ts` へ移し、`parseUserAgent` は `./userAgent` から import する
  - `lib/feedback/feedbackDraft.ts` の型の import を `@/types/clientEnvironment` へ、`FeedbackForm/index.tsx` の import を `@/types/clientEnvironment`・`./clientEnvironment` へ付け替える
  - 完了の条件: `util/clientEnvironment.ts` が存在せず、`src/types/` に `clientEnvironment.ts` がある。`lib/feedback` が `window`・`navigator`・React を参照しない。既存のテストが移動の前と同じ結果を返す
  - _Boundary: lib/feedback, components/feedback, src/types_
  - _Depends: 1.1, lib-layers 2.1_
  - _Requirements: 1.6, 7.1, 7.2, 5.2_
- [x] 4.3 (P) Outcome と FormDataFieldKind の型を src/types へ移す
  - `util/outcome.ts` を `src/types/outcome.ts` へ移し、`util/outcome.ts` を削除する（型だけのモジュール。冒頭の説明は残す）
  - `util/formData.ts` の `FormDataFieldKind`・`LeafFormDataFieldKind` を `src/types/formData.ts` へ移す（両方とも export する。`LeafFormDataFieldKind` は `util/formData.ts` の関数が使うため）。`formData.ts` には関数（`formDataIndexedArrayToObjects`・`formDataToObject`）を残し、型は `import type` で `@/types/formData` から読む
  - 利用元の `Outcome` の import を `@/types/outcome` へ付け替える: `lib/entry/`（`postEntry`・`editEntry`・`deleteEntry`・`postEntryMedia`）、`lib/schedule/`（`scheduleCredential`・`scheduleItem`・`scheduleCollection`・`scheduleImage`）、`lib/feedback/submitFeedback.ts`（`submitFeedback.ts` は lib-layers 2.1 の後）
  - 利用元の `FormDataFieldKind` の import を `@/types/formData` へ付け替える: `lib/api/schema/v2/entry/post.ts`・`lib/api/schema/v2/schedules/post.ts`。関数を使う `lib/schedule/stageSchedule.ts`・`pages/v2/entry.ts` は `@/util/formData` のまま
  - 完了の条件: `util/outcome.ts` が無く、`src/types/` に 3 ファイル（`clientEnvironment.ts`・`outcome.ts`・`formData.ts`）があり、どれも型だけで外を import しない。`npm run apigen` の後に生成物の差分が無い
  - _Boundary: src/types, lib/entry, lib/schedule, lib/api, lib/feedback_
  - _Depends: 1.1, lib-layers 2.1_
  - _Requirements: 7.1, 7.2, 3.1, 3.2, 5.2, 5.3_

- [ ] 5. 利用元の部品の内側へ移す
- [x] 5.1 util/textarea の 5 件を ThreadComposer の rules へ移す
  - util/textarea の contentEditableModel・contentEditableReconcile・highlightNodeParts・facetHighlightSegments・suggestTrigger を ThreadComposer の rules の内側へ移し、利用元（useSuggest と PostBodyEditor）の import を相対のパスに付け替える
  - 移動先の内側どうしの import（例: `contentEditableReconcile` → `contentEditableModel`）は、`@/util/…` ではなく相対のパス（`./`）にする（同じ部品フォルダの内部は相対 import、`structure.md` の規則）
  - 完了の条件: util/textarea が存在せず、編集欄の入力・候補・ハイライトのテストが移動の前と同じ結果を返す
  - _Depends: 1.1_
  - _Requirements: 1.3, 5.2_
- [x] 5.2 util/links を ThreadComposer の rules へ移す
  - util/links を ThreadComposer の rules の 1 ファイルへ移し、useDraftFlow の import を付け替える
  - useDraftFlow は lib-layers 3.2（`draftList` の import）の後に行う。`rules/` の内側の import は相対のパスにする
  - 完了の条件: 現在のタブで別のページへ移るクリックの判定が、移動の前と同じ結果を返す
  - _Depends: 5.1, lib-layers 3.2_
  - _Requirements: 1.7, 5.2_
- [x] 5.3 (P) util/listbox の 2 件を Dropdown の内側へ移す
  - util/listbox の filter と navigation を Dropdown の内側へ移し、Dropdown の import を付け替える（分類フォルダ select の直下には置かない）
  - 完了の条件: util/listbox が存在せず、選択肢の絞り込みと矢印キーの移動の結果が変わらない
  - _Boundary: common/select/Dropdown_
  - _Depends: 1.1_
  - _Requirements: 1.2, 5.2_
- [x] 5.4 (P) util/scrollLock を Overlay の内側へ移す
  - util/scrollLock を Overlay の内側へ移し、Overlay の import を付け替える（分類フォルダ dialog の直下には置かない）
  - 完了の条件: util/scrollLock が存在せず、モーダルの表示中の参照カウントの振る舞いが変わらない
  - _Boundary: common/dialog/Overlay_
  - _Depends: 1.1_
  - _Requirements: 1.5, 5.2_
- [x] 5.5 置き場を子フォルダ `rules/` へ直す（5.3・5.4 の訂正）
  - 理由: 5.3・5.4 は `Dropdown/filter.ts`・`Dropdown/navigation.ts`・`Overlay/scrollLock.ts` を部品フォルダの直下に置いた。`structure.md` の規則では部品フォルダの直下は配線（`index.tsx`・`index.module.css`）と子フォルダだけである。判断は子フォルダ `rules/` に置く（フックなら `hooks/`）
  - 作業: `Dropdown/filter.ts`・`Dropdown/navigation.ts` を `Dropdown/rules/` へ、`Overlay/scrollLock.ts` を `Overlay/rules/` へ移す。利用元（Dropdown・Overlay の import）と、移動した兄弟どうしの import を付け替える。design.md・tasks.md のうち移動先のパスを書いた箇所を `rules/` のパスに直す
  - 利用者の決定により、`rules/` に置くことを優先する。`scrollLock` が DOM を使うため `rules/` の純粋性の検査に引っかかる場合は、検査を弱めず、_Blocked_ の理由として報告する
  - 完了の条件: `Dropdown/`・`Overlay/` の直下に `.ts` が無い（`index.tsx`・`index.module.css` と子フォルダだけ）。`tests/unit/scripts/componentLayout.test.ts` と既存のテストが通る。選択肢の絞り込み・矢印キー・スクロールロックの結果が変わらない
  - _Boundary: common/select/Dropdown, common/dialog/Overlay_
  - _Depends: 5.3, 5.4_
  - _Requirements: 1.2, 1.5, 5.2_

- [ ] 6. 規約と文書の改訂
- [x] 6.1 structure.md の util・src/types の規約と lib の依存の表を改訂する
  - 依存の表: 既存の依存の表（`lib/api`・`lib/site` の行を含む）を土台にし、`lib/share`・`lib/settings`・`lib/atproto`・`lib/feedback` の行を実際の import に合わせて書き換える。`lib/api` の行には `src/types`（`FormDataFieldKind` の型。`schema/v2/entry/post.ts`・`schedules/post.ts` が import する）を加える（`src/types` は型だけの葉のため、依存の向きは変わらない）。`lib/site` の行は変えない
  - util の節に「利用元が複数領域のときだけ util に置く」と四つの分類規則を書き、利用元が一つになった関数は利用元へ移し、util へ戻さないと書く。`util/waitForImageLoad.ts` の例外（DOM を使うが二つの部品領域が使うため残す）を書く。「util/share/ のように下位フォルダで分ける」の文を削除する（既に無ければ確認のみ）
  - 新しい節「型（`src/types/`）」を書く（葉の規則: 外部パッケージを含めて外を import しない。型だけの宣言: `export type`・`export interface`・`import type` のみ。置く条件: `lib` が `util`・`components` で定義された型を使う場合）
  - 「依存の向き」（Code Organization Principles）の `src/types/` の記述を、外部パッケージを含めた葉の規則に合わせる（既に記述があれば確認のみ）
  - lib の依存の表（lib/atproto・lib/settings・lib/share・lib/feedback）を、移動後の実際の import と一致させる。`lib/feedback` の行は、lib-layers 5.2 の辺のうち `lib/api`（契約）と `lib/site` を残す（削除しない）。本仕様が変えるのは `util` と `src/types` の参照だけで、`util` を参照せず、`src/types`（`ClientEnvironment`・`Outcome`）を参照することを grep で確かめる
  - 「領域の一覧」は領域の名前だけを書くため、本仕様では変えない（`lib/share` の説明は追加しない）
  - 完了の条件: structure.md の util・src/types の記述と依存の表が、grep で確認した移動後の import と一致する
  - _Depends: 3.2, 4.1, 4.2, 4.3, 5.5, lib-layers 5.2_
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
- [x] 6.2 関連 spec とコメント・例の参照を更新する
  - src-duplicates の brief に、share の責務が lib/share へ統合された結論を追記する（既存の内容は残す）
  - importRules テストの例（`tests/unit/scripts/importRules.test.ts` の 97 行目 `["src/util/share/intent.ts", "util/share"]`）を、`["src/util/http.ts", "util"]` に直す（移動後に実在しないため。lib-layers 4.2 の後に行う）
  - `pages/jump.astro` のコメントにある `src/util/share/openIntentPopup.ts` のパスを、`src/components/share/IntentShareDialog/openIntentPopup.ts` に直す
  - 完了の条件: src-duplicates の brief の既存の内容が残り、追記が一箇所ある。コメントと例が存在しないパスを指さない
  - _Depends: 3.1, 1.2, lib-layers 4.2_
  - _Requirements: 6.1, 6.2, 5.2_

- [ ] 7. 最終確認
- [x] 7.1 util の残りと旧パスの参照を確認する
  - util 直下が 5 件（`http.ts`・`formData.ts`・`utf8Bytes.ts`・`padTwoDigits.ts`・`waitForImageLoad.ts`）だけであり、残した各モジュールの内容が変わっていない（`formData.ts` は型を除く）ことを確かめる
  - 各残したモジュールの利用元が二つ以上の領域にあることを grep で確認する
  - 移動した旧パス（util/share・util/textarea・util/listbox・util/emoji・util/autoLink・util/scrollLock・util/clientEnvironment・util/textCount・util/object・util/links・util/outcome・`util/formData` の型）を参照する箇所が 0 件
  - 完了の条件: 旧パスの検索が 0 件で、util 直下の一覧が 5 件と一致する
  - _Depends: 6.1, 6.2_
  - _Requirements: 1.1, 1.8, 3.1, 3.2, 3.3_
- [x] 7.2 型・import・循環・副作用の検査を通す
  - `npm run test:type`・`npm run test:imports`・`npm run test:unit` を実行し、いずれも終了コード 0 であることを確かめる
  - lib/share と lib/settings の循環が検出されないことを確かめる
  - `src/lib/share/`・`src/lib/feedback/`・`src/lib/atproto/` に `window.`・`document.`・`navigator.`・`new Image` が無いことと、`src/types/` が型だけで外（外部パッケージを含む）を import しないことを grep で確かめる
  - 完了の条件: 三つの検査が終了コード 0 で、循環の検出が 0 件、grep の該当が 0 件
  - _Depends: 7.1_
  - _Requirements: 2.4, 5.4, 7.3_
- [x] 7.3 全体の検査と生成物の差分を確認する
  - `npm run test:all` が終了コード 0 で、通過件数が 1.1 で記録した基準を下回らないことを確かめる
  - `npm run apigen` の後に `src/client/openapi/` と OpenAPI 文書に差分が無いことを確かめる
  - 完了の条件: test:all の終了コードが 0、件数が基準以上、apigen の差分が 0
  - _Depends: 7.2_
  - _Requirements: 1.8, 5.1, 5.3, 5.4, 5.5_

## Implementation Notes

### 1.1 test:all の基準と生成物の差分（着手前・HEAD 1c65503）

- `npm run test:all`: 終了コード 0（codegen・test:type・test:lexicon・test:imports・test:unit・test:component・test:route・test:render・test:e2e の全段が通過）
  - unit: Test Files 49/49、Tests 321/321
  - component: Test Files 5/5、Tests 13/13
  - route: Test Files 23/23、Tests 212/212
  - render: Test Files 1/1、Tests 2/2
  - e2e: 7 passed
- `npm run apigen`: 終了コード 0。実行後の `git status --porcelain src/client docs` は空で、`src/client/openapi/` と OpenAPI 文書に生成物の差分は無い。
- 作業ツリーの未コミット変更は `.kiro/steering/tech.md`・`.kiro/steering/testing.md`（利用者の既存の編集）のみで、test:all と apigen の実行による変化は無い。
- 以降の完了の条件の基準: 終了コード 0、通過件数は unit 321・component 13・route 212・render 2・e2e 7 を下回らないこと、apigen の差分 0。

### 1.2 利用者の決定の記録（確認のみ）

- design.md の「決定の記録（利用者の決定 2026-11-03）」に U-1（案 C）・U-2（`util/` に残す）・U-3（部品の内側）・型の規則が記録されている。「決定から生じる例外と差分（記録）」の節も存在する。タスク本文の対象と一致するため、design.md は変更していない。

### 5.1 実施の順序（記録）

- 5.1 は実装の後、レビューの前にコミットした（kiro-impl の手順は、レビューの承認の後にコミットする）。その後にレビューを行い、承認された。履歴は書き換えていない。以降のタスクは承認の後にコミットする。

### 5.5 置き場の訂正（記録）

- 5.3・5.4 が直下に置いた `Dropdown/filter.ts`・`Dropdown/navigation.ts`・`Overlay/scrollLock.ts` を、子フォルダ `rules/` へ移した（内容は同一）。
- `scrollLock.ts` は DOM を使うため、`rules/` は純粋な関数に限るという規則と完全には一致しない。利用者の決定により `rules/` に置いた。レビューでは注記として扱い、テストは通過した。

### 6.2 の内容の出所（記録）

- 6.2 のチェック（1f170d6）の時点では、三つの内容（importRules の例のパス・jump.astro のコメント・src-duplicates の追記）は既に 70de585 と c2d8dcc で入っていた。6.2 は内容を確認して完了とした。

### 7.1 旧パスの検査の基準（記録）

- 旧パスの 0 件は、コード（src・tests・scripts・config）を対象とした。コードに旧パスの参照は 0 件、`util/formData` からの型の import は 0 件。
- 文書に残る旧パスは、この確認の対象外として残した。主な残存箇所: `.kiro/steering/roadmap.md`（288–291・312・320・327・333 行）、`structure.md` の禁止の例と統合の経緯、util-placement 自身の requirements・design・tasks の本文、他の spec 文書（`src-duplicates`・`lib-layers`・`lib-large-files`・`components-small-areas` など。`util/share`・`util/links` 等の経緯の記述）。他の spec 文書の件数は確認していない範囲を含む。
- 利用者の判断（未決）: これらの文書の旧パスを「経緯の記録」として残すか、「現況」として直すか。
- 利用者の判断（未決）: roadmap.md の 333 行（`util/` の利用元の一覧）は移動の前の状態を書いたままである。これを現況に直すか、分析の記録として残すかは利用者が決める。
- util 直下は 5 件（formData・http・padTwoDigits・utf8Bytes・waitForImageLoad）と一致した。`formData.ts` の型以外は HEAD（基準は 1c65503）から変わっていない。

### 7.3 全体の検査（記録）

- `npm run test:all`: 終了コード 0。unit 49/49（327 件）、component 5/5（13 件）、route 23/23（212 件）、render 1/1（2 件）、e2e 7 件。基準（1.1）を満たす。
- `npm run apigen` の後、`src/client/openapi/` と OpenAPI 文書に差分は無い。`git diff 1c65503..HEAD -- src/client docs` も空。

- 利用者の決定（2026-11-04）: validate-impl の「e2e は手動確認が必要」の判定は、test:all の中の e2e 7 件が通過しているため GO として扱う。
- 利用者の決定（2026-11-04）: 5.1 はレビュー前に、7.1 の検証記録は承認前に commit した。履歴は書き換えず、この記録を残す。以後は承認後に commit する。
