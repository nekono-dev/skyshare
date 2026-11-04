# Implementation Plan

各分割（大タスク 2〜8）は、一件ずつ別のコミットにする（要件 5.1）。分割の間で `test:type`・`test:imports` を通してから次へ進むため、大タスクは順番に実行する（`(P)` は付けない）。

- [ ] 1. 基準の記録と着手前の確認
- [x] 1.1 `test:all` の基準を記録する
  - 着手前に `npm run test:all` を実行し、終了コードと通過件数を作業の記録に残す（2026-11-03 の基準として以後の比較に使う）
  - 分割の対象 7 件の行数（`wc -l`）を同じ記録に残す
  - 完了の状態: 終了コードと件数が記録され、分割前の行数が設計の表と一致する
  - _Requirements: 4.4, 4.5_

- [x] 1.2 上流の完了を確認する
  - `lib-layers` と `util-placement` が完了し、`contentEditableModel` が `components/composer/ThreadComposer/rules/contentEditableModel.ts` にあり、`shareSettings` が `@/lib/share/intent`（`isValidInstanceDomain`）と `@/lib/share/autoPopupTarget`（`AutoPopupTarget`・`AUTO_POPUP_TARGETS`）から import していることを確かめる（どちらも `util-placement` の出力）
  - 完了の状態: 上の 2 点が確認でき、未完了の場合は大タスク 5 と 8 を着手せずに報告する
  - _Requirements: 1.2, 3.4_

- [ ] 2. `lib/schedule/store` を `store/` に分割する（コミット 1）
- [x] 2.1 予約の保存・実行・認証情報・認可の状態を、責務ごとのファイルに移す
  - D1 の行の変換と変更件数を共通のファイルに置き、予約の CRUD・実行の遷移・認証情報・認可の状態を、それぞれ一つのファイルに置く
  - 内部のファイル間の参照は `./`、フォルダの外（`credentialCrypto`・`types`）は `@/lib/schedule/` で書く
  - 完了の状態: `schedule/store/` の各ファイルが設計の責務の一覧どおりに存在し、各ファイルの先頭コメントが責務を一文で示す
  - _Boundary: schedule/store_
  - _Requirements: 1.2, 2.1, 2.3, 2.4_

- [x] 2.2 `index.ts` で元の export を再エクスポートし、元のファイルを削除する
  - 元の export（`insertSchedule`・`getSchedule`・`listSchedules`・`STALE_SECONDS`・`CredentialStatus` などの型を含む）をすべて `index.ts` から出す
  - `schedule/store.ts` を削除し、`@/lib/schedule/store` の参照（`src/lib/schedule/*` とテスト）がそのまま解決されることを確かめる
  - 完了の状態: `npm run test:type` が終了コード 0、`npm run test:imports` が終了コード 0
  - _Boundary: schedule/store_
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2.3 予約の経路のテストで検証し、コミットする
  - `tests/route/schedule/*`・`tests/route/pages/schedule*.test.ts`・`tests/route/pages/scheduleCleanup.test.ts` を実行し、件数と結果が分割前と同じであることを確かめる
  - `wc -l` で分割後の全ファイルが 400 行以下であることを確かめる
  - 完了の状態: 対象のテストが通り、この分割だけのコミットが作られている
  - _Boundary: schedule/store_
  - _Requirements: 1.1, 4.1, 4.3, 5.1, 5.2_

- [ ] 3. `lib/session/cookies` を `cookies/` に分割する（コミット 2）
- [x] 3.1 Cookie の codec・セッションのモデル・プールの判断・ヘッダの組み立てを、責務ごとのファイルに移す
  - codec（base64・Cookie の解析）→ model（型と検証）→ pool（プールの判断）→ headers（Set-Cookie と Request の解析）の順に参照が一方向になるようにする
  - `@/env` の `atpService` は、それを使う `model.ts` が import する
  - 完了の状態: 循環が無く、各ファイルの先頭コメントが責務を一文で示す
  - _Boundary: session/cookies_
  - _Requirements: 1.2, 2.1, 2.3, 2.4_

- [x] 3.2 `index.ts` で再エクスポートし、テストの mock パスを直す
  - 元の export をすべて `index.ts` から出し、`lib/session/cookies.ts` を削除する
  - `tests/route/pages/bskySessionCompletion.test.ts` の `vi.mock("@/lib/session/cookies.js", …)` を `vi.mock("@/lib/session/cookies", …)` に変え、mock の内容は変えない
  - 完了の状態: `npm run test:type`・`npm run test:imports` が終了コード 0、mock が効いて `bskySessionCompletion` のテストが分割前と同じ結果で通る
  - _Boundary: session/cookies_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.3_

- [x] 3.3 Cookie・セッションのテストで検証し、コミットする
  - `tests/unit/lib/session/cookies.test.ts`・`tests/route/session/*`・`tests/route/pages/v1PageDelete.test.ts` を実行し、件数と結果が分割前と同じであることを確かめる
  - `wc -l` で分割後の全ファイルが 400 行以下であることを確かめる
  - 完了の状態: 対象のテストが通り、この分割だけのコミットが作られている
  - _Boundary: session/cookies_
  - _Requirements: 1.1, 4.1, 5.1, 5.2_

- [ ] 4. `lib/image/postImageProcessing` を `postImageProcessing/` に分割する（コミット 3）
- [x] 4.1 幾何・画像の読み込み・Canvas の圧縮・合成の公開の処理を、責務ごとのファイルに移す
  - 切り抜きの幾何（純粋）・画像の読み込み・Canvas の Blob 化と圧縮（バイト予算）・合成と公開の処理（`compose`）を分ける
  - `compose` が `encode` と `geometry` を参照し、逆向きの参照を作らない
  - `VISUAL_IMAGE_COUNT` の import は、それを使う `compose` が持つ
  - 完了の状態: 各ファイルが 400 行以下で、先頭コメントが責務を一文で示す
  - _Boundary: postImageProcessing_
  - _Requirements: 1.1, 1.2, 2.1, 2.3, 2.4_

- [x] 4.2 `index.ts` で元の export を再エクスポートし、元のファイルを削除する
  - 元の export（`TARGET_WIDTH`・`TARGET_HEIGHT`・`CropArea`・`SlotCropState`・`SlotDef`・`loadImage`・`loadImageSize`・`getSlotDefs`・`computeInitialCrop`・`computeCropAroundCenter`・`canUsePostImageAsIs`・`createOgpThumbnailFromBlob`・`CompositeOverlay`・`createProcessedImages`・`createCroppedThumbnail`・`createDefaultThumbnail`）をすべて出す
  - 完了の状態: `npm run test:type`・`npm run test:imports` が終了コード 0
  - _Boundary: postImageProcessing_
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4.3 画像のテストで検証し、コミットする
  - `tests/unit/lib/image/postImageProcessing.test.ts` を実行し、件数と結果が分割前と同じであることを確かめる
  - 完了の状態: 対象のテストが通り、この分割だけのコミットが作られている
  - _Boundary: postImageProcessing_
  - _Requirements: 4.1, 4.3, 5.1, 5.2_

- [ ] 5. `lib/settings/shareSettings` を `shareSettings/` に分割する（コミット 4）
  - _Depends: 1.2_
- [x] 5.1 自動ポップアップ・インスタンスドメイン・真偽値の設定・本文欄の行数を、種類ごとのファイルに移す
  - 自動ポップアップ（`autoPopup`）・インスタンスドメイン（`instanceDomain`）・真偽値（`toggles`。リンクカード優先の実効値を含む）・本文欄の行数（`textareaRows`）に分ける
  - `AUTO_POPUP_TARGETS`・`AutoPopupTarget` は `@/lib/share/autoPopupTarget` から再エクスポートする
  - 完了の状態: 各ファイルが 400 行以下で、先頭コメントが責務を一文で示す
  - _Boundary: shareSettings_
  - _Requirements: 1.1, 1.2, 2.1, 2.3, 2.4_

- [x] 5.2 `index.ts` で元の export を再エクスポートし、元のファイルを削除する
  - 元の export（既定値の定数・読み書きの関数・`AUTO_POPUP_TARGETS`・`AutoPopupTarget` を含む）をすべて出す
  - `isValidInstanceDomain` の import 元は `@/lib/share/intent` とする
  - 完了の状態: `npm run test:type`・`npm run test:imports` が終了コード 0
  - _Boundary: shareSettings_
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5.3 設定のテストで検証し、コミットする
  - `tests/unit/lib/settings/shareSettingsLegacyRead.test.ts` と、`shareSettings` を参照する経路のテストを実行し、件数と結果が分割前と同じであることを確かめる
  - 完了の状態: 対象のテストが通り、この分割だけのコミットが作られている
  - _Boundary: shareSettings_
  - _Requirements: 4.1, 4.3, 5.1, 5.2_

- [ ] 6. `lib/timeline/guest/posts.ts` のダミーデータを分ける（コミット 5）
- [x] 6.1 単独の投稿・スレッドの投稿・本文のリンクの範囲の計算を、別のファイルに移す
  - 単独の投稿（`guest1`〜`guest-rich-text`）を `postsBasic.ts`、スレッドの投稿と不明な投稿を `postsThread.ts`、本文のリンクの範囲の計算を `postFacets.ts` に移す
  - `postsBasic.ts` と `postsThread.ts` は、判断の関数（検索・組み立て）を含まない。データを返す関数だけを置く
  - 完了の状態: 両ファイルが 400 行以下で、判断の関数を含まない
  - _Boundary: guest/posts_
  - _Requirements: 1.1, 2.2, 2.3_

- [x] 6.2 `posts.ts` で連結し、外向きの export を保つ
  - `posts.ts` に `findGuestPost`・`buildGuestPosts`（単独の投稿 → スレッドの投稿と不明な投稿の順に連結）・`buildGuestThreads` を残し、元の export を変えない
  - `guest/index.ts` のヘッダコメントのファイル一覧を更新する（処理は変えない）
  - 完了の状態: `buildGuestPosts(t)` の件数・順序・uri が分割前と同じで、`npm run test:type`・`npm run test:imports` が終了コード 0
  - _Boundary: guest/posts_
  - _Requirements: 2.4, 3.1, 3.2, 4.1_

- [x] 6.3 ゲストの経路で検証し、コミットする
  - `tests/unit/lib/site/envValues.test.ts` と、`@/lib/timeline/guest` を参照する経路のテストを実行し、件数と結果が分割前と同じであることを確かめる
  - 完了の状態: 対象のテストが通り、この分割だけのコミットが作られている
  - _Boundary: guest/posts_
  - _Requirements: 4.1, 4.3, 5.1, 5.2_

- [ ] 7. `lib/survey/gate` を `gate/` に分割する（コミット 6）
- [x] 7.1 純粋な状態遷移・判定・画面の効果と送信・辞退を、責務ごとのファイルに移す
  - 状態遷移（`state.ts`: 判定の結果の型・`planGateEntry`・`gateReducer`・`resolveSubmitOutcome`）は、入出力に依存しない
  - 判定（`check.ts`: `runGateCheck`）と画面の効果（`runtime.ts`: `GateRuntime`・`enterPage`・送信と辞退・`createLiveRuntime`・`createDialogHandlers`）を分ける
  - 完了の状態: `state.ts` が `@/lib/survey/launchCheck`・`@/lib/survey/deviceRecord` を import しない。各ファイルが 400 行以下
  - _Boundary: survey/gate_
  - _Requirements: 1.1, 2.1, 2.3, 2.4_
  - 決定（2026-11-04、利用者の判断 (a)）: `planGateEntry` の入力に `excluded: boolean` を足し、除外の判定（`isSurveyPageExcluded`）は呼び出し側の `enterPage`（`runtime.ts`）で行って結果を渡す。`state.ts` は `launchCheck`・`deviceRecord` を import しない。入力が同じなら結果は HEAD と同じで、export 名（`planGateEntry`）は残す。シグネチャ変更はこの 1 点のみ。design.md の `survey/gate` の節にも同じ決定を書いた。
- [x] 7.2 `index.ts` で元の export を再エクスポートし、元のファイルを削除する
  - 元の export（`GateCheckResult`・`GateDeps`・`SubmitAnswers`・`SubmitOutcome`・`runGateCheck`・`resolveSubmitOutcome`・`GateEntryPlan`・`planGateEntry`・`GateState`・`initialGateState`・`GateAction`・`gateReducer`・`GateRuntime`・`DeclineRuntime`・`enterPage`・`applySubmitResult`・`applyDecline`・`handleDecline`・`handleSubmit`・`createLiveRuntime`・`createDialogHandlers`）をすべて出す
  - 完了の状態: `npm run test:type`・`npm run test:imports` が終了コード 0。`SurveyGate` の import（`@/lib/survey/gate`）が変わらない
  - _Boundary: survey/gate_
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 7.3 アンケートのテストで検証し、コミットする
  - `tests/unit/lib/survey/respondentHash.test.ts`・`tests/route/survey/*` を実行し、件数と結果が分割前と同じであることを確かめる
  - 状態遷移（`gateReducer`・`planGateEntry`）が、分割前と同じ入力で同じ結果になることを、export の一覧の比較と `npm run test:type` で確かめる
  - 完了の状態: 対象のテストが通り、この分割だけのコミットが作られている
  - _Boundary: survey/gate_
  - _Requirements: 4.1, 4.3, 5.1, 5.2_

- [ ] 8. 投稿の編集の平文モデル（`contentEditableModel`）を分割する（コミット 7。`rules/` の子フォルダは作らず、接頭辞付きの平置きファイルに分ける）
  - _Depends: 1.2_
- [ ] 8.1 平文モデル・DOM の走査とキャレット・削除の判定と画素位置の測定を、責務ごとのファイルに移す
  - 平文モデル（`contentEditableModelParts.ts`: `TextPart`・`CARET_ANCHOR`・`partsToPlainText`・`resolvePartOffset`）は純粋に保つ
  - DOM の走査・選択・キャレット（`contentEditableModelDom.ts`）と、削除の判定・画素位置の測定（`contentEditableModelEdit.ts`）に分ける
  - 完了の状態: `contentEditableModelParts.ts` が DOM の型・関数を使わない。各ファイルが 400 行以下
  - _Boundary: contentEditableModel_
  - _Requirements: 1.1, 2.1, 2.3, 2.4_

- [ ] 8.2 `contentEditableModel.ts` で元の export を再エクスポートする（ファイルは残す）
  - 元の export（`TextPart`・`CARET_ANCHOR`・`partsToPlainText`・`resolvePartOffset`・`extractPlainText`・`resolveIndexToNodeOffset`・`getPlainTextSelection`・`setPlainTextCaret`・`findCaretAnchorNode`・`resolveAnchorAwareDeleteText`・`measureIndexPixelPosition`）をすべて出す
  - 元のパス（`contentEditableModel.ts`）を残すため、呼び出し側（`useSuggest`・`PostBodyEditor`・`contentEditableReconcile`・`highlightNodeParts`）の import は変えない
  - 完了の状態: `npm run test:type`・`npm run test:imports` が終了コード 0
  - _Boundary: contentEditableModel_
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 8.3 入力の経路で検証し、コミットする
  - `npm run test:component` のうち、`ThreadComposer` の本文欄を含む対象を実行し、件数と結果が分割前と同じであることを確かめる
  - 完了の状態: 対象のテストが通り、この分割だけのコミットが作られている
  - _Boundary: contentEditableModel_
  - _Requirements: 4.1, 4.3, 5.1, 5.2_

- [ ] 9. 最終確認
- [ ] 9.1 全体の検証を行う
  - `npm run apigen` を実行し、`git status` で `src/client/openapi/` と OpenAPI 文書に差分が無いことを確かめる
  - 分割後の全ファイル（6 件のフォルダの中身・`guest/posts.ts`・`contentEditableModel*.ts`）について、`wc -l` が 400 行以下であることを確かめる
  - 完了の状態: 生成物に差分が無く、全ファイルが 400 行以下
  - _Requirements: 1.1, 1.3, 4.2_

- [ ] 9.2 `npm run test:all` で最終確認する
  - `npm run test:all` が終了コード 0 で終わり、通過件数が 1.1 で記録した基準を下回らないことを確かめる
  - 完了の状態: 終了コード 0、件数が基準以上
  - _Requirements: 4.4, 4.5_

### 1.1・1.2 基準と上流の確認（記録）

- `npm run test:all`（着手前）: 終了コード 0。unit 49/49（327 件）、component 5/5（13 件）、route 23/23（212 件）、render 1/1（2 件）、e2e 7 件。`npm run apigen` の差分は無い。
- 分割対象 7 件の行数は、design の表と一致する。`lib/settings/shareSettings.ts` は util-placement の import 変更（70de585）により 718 行から 716 行になっていたため、design の表を 716 に直した（記録の日付は 2026-11-04）。
- 上流（lib-layers・util-placement）は完了している。`contentEditableModel` の所在と、`shareSettings` の import 元（`@/lib/share/intent`・`@/lib/share/autoPopupTarget`）を確認した。

### 2.1〜2.3 store の分割（記録）

- `lib/schedule/store.ts` を `store/` に分けた（rows・schedules・execution・credentials・oauthState と index）。公開名 32 件は index で変わらない。
- 2.1 はレビュー承認の後に、2.2 は承認の後にコミットした（コミットは b09377d・c5f16f6）。
- 予約の経路のテスト（route 23 ファイル 212 件、unit のスケジュール 3 ファイル 13 件）が通過した。

### 3.2 カバレッジの閾値（利用者の決定により解決）

- 利用者の決定: `session/cookies` の各ファイルが、フォルダ合算ではなく単独で分岐カバレッジ 80% を満たすこと。フォルダ合算の回避策は使わない。
- 対応: `codec.ts`・`model.ts`・`pool.ts`・`headers.ts` それぞれにファイル単位の閾値（分岐 80%）を置いた（`config/test/vitest.unit.config.ts`）。`index.ts` は再エクスポートのみのため閾値の対象外。
- 変更前の分岐: `codec.ts` 50.00%、`model.ts` 87.50%、`pool.ts` 83.33%、`headers.ts` 82.60%（合計 80.28%）。`codec.ts` の base64 と Cookie 解析の異常系が未テストだった。
- 変更後の分岐: `codec.ts` 90.00%、`model.ts` 87.50%、`pool.ts` 83.33%、`headers.ts` 82.60%。テストは `tests/unit/lib/session/codecEdgeCases.test.ts`（14 件）を新規に追加した。既存の `cookies.test.ts` は変えていない。
- `model.ts`・`pool.ts`・`headers.ts` は 80% を超えているが余裕は小さい。今後の変更で割れやすい。
- `config/test/stryker.config.mjs` の mutate も 4 ファイルへ変えた。
- 3.3: Cookie・セッションのテスト（unit 1 ファイル 12 件、route の session・pages 12 ファイル 139 件）が通過した。

### 4.1〜4.3 postImageProcessing の分割（記録）

- 4 ファイル（geometry・source・encode・compose）と index を作り、旧ファイルを削除した（コミット 30bc320・192fab6）。公開名 16 件は変わらない。
- 画像のテスト（unit 1 ファイル 9 件）と route 全体（23 ファイル 212 件）が通過した。

### 5.1〜5.3 shareSettings の分割（記録）

- `lib/settings/shareSettings.ts` を `shareSettings/` に分けた（autoPopup・instanceDomain・toggles・textareaRows と index）。コミット 6936fb5・8f23dd1。
- index は元の公開名（29 件）に、設計の指定に従い `AUTO_POPUP_TARGETS`・`AutoPopupTarget`（`@/lib/share/autoPopupTarget` からの再エクスポート）を加えた。元のファイルは import のみでこの 2 件を export していなかったため、設計の指定を優先した。
- 設定のテストが通過した（unit の settings・share 系）。全体は 5.2 の検査で確認済み。
- 旧パスを指す古いコメントが 4 箇所残る（`lib/share/autoPopupTarget.ts`・`suggestSettings.ts`・`hashtagHistorySettings.ts`・`postGateSettings.ts`）。振る舞いに影響しないため本タスクでは直さない。

### 6.1〜6.3 ゲストのダミーデータの分割（記録）

- `timeline/guest/posts.ts` のデータを `postsBasic.ts`・`postsThread.ts`・`postFacets.ts` へ分け、`posts.ts` は連結と検索だけにした（コミット 576e203・7a36cb8）。外向きの名前 3 件と出力は HEAD と一致した（一時テストで比較）。
- ゲストの経路を含む unit・route のテストが通過した。

### 7.1 survey/gate の分割（記録）

- `planGateEntry` に `excluded` 入力を足し（利用者の決定 (a)）、`state.ts`・`check.ts`・`runtime.ts` に分けた。`gate.ts` は 7.2 まで再エクスポートの入口として残す。
- 検証: `test:all` 終了コード 0（unit 434・component 13・route 212・render 2・e2e 7）。レビュー APPROVED（指摘は任意の Suggestion のみ）。
- 7.2: `gate/index.ts` で元の 21 件を再エクスポートし、`gate.ts` を削除した。export 名は削除前と一致（レビュー APPROVED。ヘッダ説明の誤り 1 件を直した）。`test:all` 終了コード 0（unit 434・component 13・route 212・render 2・e2e 7）。
- 7.3: 検証のみ（コード変更なし）。`respondentHash` 5 件・route `survey` 16 件が通過。`planGateEntry` 880 ケース・`gateReducer` 320 ケース・`resolveSubmitOutcome` 7 ケースで分割前と差分 0。export 名 21 件一致。比較は HEAD の tests・config が分割前（b64b4a2^）と同一であることを前提にした。レビュー APPROVED。
- 7.1 の `planGateEntry` 入力変更（`excluded`）は、呼び出し側（`enterPage`）が `isSurveyPageExcluded` を計算して渡す形で、結果は分割前と同じ。
