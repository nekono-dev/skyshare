# Implementation Plan

共有ファイルの編集順（本仕様の位置）:

- `tests/unit/scripts/importRules.test.ts`: lib-layers（4.2 で `libLayer` の正例を加える）→ util-placement（6.2 で例のパスを直す。util-placement は本仕様の完了が前提）→ structure-checks（2.2・2.3 で `reason` の fixture を加える）。
- `src/components/feedback/FeedbackForm/index.tsx`・`src/lib/feedback/*`: 本仕様（2.1 で `@/lib/api/contract/*` へ付け替える）が先。util-placement 4.2 は、その後の状態に対して `clientEnvironment` の import を付け替える。
- `src/components/composer/ThreadComposer/hooks/useDraftFlow.ts`: 本仕様 3.2（`draftList` の import を `@/lib/timeline/draftList` へ）が先。util-placement 5.2（`util/links` の import）は、その後の状態に対して行う。
- `src/pages/posts/[dbIndex]/[slug].astro`: 本仕様 3.4（`legacy/pagedb` の import を `@/lib/entry/legacyPagedb` へ）が先。layout-home 2.2（骨格の import を変える）は、本仕様の 3.4 の後に行う（layout-home 2.2 の `_Depends` に本仕様の 3.4 を記す）。

- [ ] 1. 基準の記録
- [x] 1.1 着手前の基準を記録する
  - 着手前の `npm run test:all` の終了コードと通過件数を、実装の記録に残す（要件 5.4 の基準）
  - 着手前の `npm run apigen` を実行し、`src/client/openapi/` と OpenAPI 文書に差分が無いことを確かめる（差分がある場合は本仕様の着手前に別途直す）
  - 完了の条件: 基準の件数と、apigen に差分が無いことが記録されている
  - _Requirements: 5.2, 5.4_

- [ ] 2. API 契約の基盤への移動（feedback・survey の逆流の解消）
- [x] 2.1 不具合の報告の制約値と送信内容の型を API 契約へ移す
  - 不具合の報告の文字数上限・再現頻度の値・文字数の数え方を、API 契約（基盤）の 1 ファイル（`contract/feedbackLimits`）に移す（旧 `feedback/limits` の内容を変えない）
  - 送信内容の型を API 契約の 1 ファイル（`contract/feedbackSubmission`）に移し、API の型検査（`typeCompat`）が移した先を参照する
  - 受付の API のスキーマと、報告フォームの文字数カウンタ・送信の可否の判定が、移した先の制約値を参照する。業務の Issue 本文の組み立てと送信の処理が、移した先の型を参照する
  - 二つの移動は一つの作業単位として同時に行う（片方だけでは `lib/api` と `lib/feedback` の双方向の依存が残り、`libRegionPairs` が失敗する）
  - 完了の条件: 業務の領域の `feedback/limits` への参照が無く、`lib/api` から `lib/feedback` への import が 0 件。`typeCompat` の検査が通り、API スキーマと画面が同じ値を読み、Issue 本文の組み立てのテストが移動の前と同じ結果を返す。`npm run test:all` が終了コード 0 で通る
  - _Requirements: 2.4, 5.1, 5.3_

- [x] 2.2 アンケートの識別子とパスの検証を API 契約へ移す
  - 識別子の検証（最大文字数・形式）と、パスの変数の検証を、API 契約の 1 ファイルに移す
  - アンケート設定の定義は、識別子の検証を移した先から読み込む。パスの検証を使う回答の処理と、API のパス・回答のスキーマも移した先を参照する
  - 完了の条件: アンケート設定の fixture テストが移動の前と同じ検証結果を返し、`scripts/survey` の読み込みが動く
  - _Requirements: 2.4, 5.1, 5.3_

- [x] 2.3 基盤から業務への参照が残らないことを確かめる
  - API 契約と API 領域のファイルが、業務の領域（`feedback`・`survey`・`schedule` など）を import しないことを、`test:imports` と import の検索で確かめる
  - 完了の条件: `test:type` と `test:imports` が終了コード 0 で、`lib/api` から `lib/feedback`・`lib/survey` への辺が 0 件
  - _Depends: 2.1, 2.2_
  - _Requirements: 2.4, 5.3_

- [ ] 3. 1〜2 ファイル領域の統合
- [x] 3.1 (P) `account` を `session` へ統合する
  - 利用者のセッション情報の共有キャッシュを `session` の領域へ移し、同じ公開の関数名で参照できる状態にする
  - 参照元の部品（ログイン・アカウント切り替え・投稿・Entry 一覧・予約の資格情報など）の import を移した先に変える
  - 完了の条件: `lib/account` が存在せず、関数の振る舞い（ログインの状態の判定）のテストが変わらない
  - _Boundary: Session（activeAccountSession）_
  - _Requirements: 4.1, 5.1, 5.3_

- [x] 3.2 (P) `draft` を `timeline` へ統合する
  - 下書きの一覧の整形を `timeline` の領域へ移す
  - 下書きの一覧を表示する部品と、下書きの読み込みの処理の import を移した先に変える
  - 完了の条件: `lib/draft` が存在せず、下書きの整形の結果が変わらない
  - _Boundary: Timeline（draftList）_
  - _Requirements: 4.2, 5.1, 5.3_

- [x] 3.3 (P) `privacy` を `site` へ統合する
  - プライバシーポリシーの文面を組み立てる処理を `site` の領域へ移す
  - 文面を表示する部品の import を移した先に変える
  - 完了の条件: `lib/privacy` が存在せず、文面の組み立ての結果が変わらない
  - _Boundary: Site（policySections）_
  - _Requirements: 4.2, 5.1, 5.3_

- [x] 3.4 (P) `legacy` を `entry` へ統合する
  - 旧 pageDB の投稿の取得と削除の処理を `entry` の領域へ移す
  - 旧投稿の表示ページ・旧 API の削除の経路・その経路のテストの `vi.mock` のパスを移した先に変える
  - 完了の条件: `lib/legacy` が存在せず、旧投稿の表示と削除のテストが同じ結果を返す
  - _Boundary: Entry（legacyPagedb）_
  - _Requirements: 4.2, 5.1, 5.3_

- [ ] 4. 層の分類と層の逆流の検査
- [x] 4.1 領域の層の対応表と、層の逆流の規則を追加する
  - `src/lib/` の各領域と `guestMode.ts` を基盤か業務に分類する対応表を、検査の部品に持つ
  - 基盤の領域から業務の領域への import を違反として数える規則（`libLayer`）を、既存の規則の一覧に加える。業務 → 基盤・基盤どうし・業務どうしは違反にしない
  - 規則の識別子を三か所に明示して加える: `rules.ts` の `RuleId` の union に `libLayer` を加える。`allowlist.ts` の `RULE_IDS` 配列に `libLayer` を加える。`allowlist.ts` の `DEFAULT_OWNERS`（`Record<RuleId, string>`）に `libLayer: "lib-layers"` を加える（`RULE_BASIS` も同じ型のため `libLayer` を持つ）
  - `RULE_IDS` と `DEFAULT_OWNERS` の二つは、`RuleId` の union を別々に持つ。structure-checks 2.1 が `RULE_IDS` を `rules.ts` へ一本化し、本仕様が加えた `allowlist.ts` の配列を置き換える（単一の定義は structure-checks 2.1 の完了後に成り立つ）
  - 規則の根拠（`RULE_BASIS`）を `structure.md` の依存の節に向ける
  - 完了の条件: 対応表が `src/lib/` の全領域を覆い、規則が基盤から業務への辺を 1 件として数える
  - _Boundary: LibLayerTable, libLayer rule_
  - _Depends: 2.3, 3.1, 3.2, 3.3, 3.4_
  - _Requirements: 1.1, 2.1, 2.2, 3.1_

- [x] 4.2 層の検査と対応表のテストを追加する
  - 規則の正例と負例（基盤 → 業務が違反、業務 → 基盤・基盤どうし・業務どうしが違反でない・`guestMode.ts` が業務）をテストに加える
  - 対応表が `src/lib/` の全領域を覆うことと、`structure.md` の層の表と一致することを確かめるテストを加える
  - 完了の条件: 追加したテストが通り、対応表から一つの領域を外すと失敗する
  - _Boundary: Layer consistency test_
  - _Depends: 4.1_
  - _Requirements: 1.1, 1.2, 3.1, 3.3_

- [x] 4.3 検査と閉路の確認を通す
  - 許容リストが空のまま `test:imports` が終了コード 0 で終わることを確かめる
  - 既存の閉路のテスト（`libRegionPairs`・`libCycles`）が、統合後の領域どうしでも閉路 0 件で通ることを確かめる
  - 完了の条件: `test:imports` の違反と stale が 0 件、閉路のテストが通る
  - _Depends: 4.2_
  - _Requirements: 2.3, 2.5, 3.2_

- [ ] 5. steering の改訂
- [x] 5.1 `structure.md` の領域の一覧と層の表を改訂する
  - 層の表（基盤・業務）を追加し、`guestMode.ts` の層を明記する
  - 領域の一覧から統合で消えた領域（`account`・`draft`・`privacy`・`legacy`）を外し、`session`・`timeline`・`site`・`entry` の説明に統合した内容を足す
  - `api/contract/` の役割（業務から下ろした入力の制約と送信内容の型）を `api` の説明に書く
  - `codegen` と `share` を残す理由（生成物の import 経路・`util-placement` で `lib/share` が増える）を記録する
  - 完了の条件: 領域の一覧が実在のフォルダと一致し、`steeringRegions.test.ts` が通る
  - 領域の一覧の改訂は、util-placement 6.1（`lib/share` の説明を変える）より先に行う。util-placement 6.1 は本仕様の 5.2 の後に行う（同じ節のため）
  - _Depends: 4.3_
  - _Requirements: 1.2, 1.3, 4.2, 4.3_

- [x] 5.2 `structure.md` の依存の節と検査の表を改訂する
  - 「lib の領域の依存の向き」の許可された依存を、移動後の実測に合わせて書き換える。書く行は次の最終の辺である（`structure.md` と同じ内容にする）
    - `lib/api`: `lib/atproto`・`lib/image`・`lib/oauth`・`lib/video`・`util`（`lib/feedback`・`lib/survey` の行を削る）
    - `lib/feedback`: `lib/api`（契約 `contract/feedbackLimits`・`contract/feedbackSubmission`）・`lib/site`・`src/types`（`ClientEnvironment`・`Outcome` の型）。`util` は参照しない（util-placement 6.1 が確かめる）
    - `lib/survey`: `lib/api`（契約 `contract/surveyPath`）・`lib/guestMode.ts`・`lib/platform`（型のみ）・`lib/i18n`（型のみ）・`util`（`util/http`）
    - `lib/site`: `lib/i18n`（型のみ）。`lib/privacy` の行は削除する（`lib/privacy` は `lib/site` へ統合するため）
    - `lib/guestMode.ts`（業務）: `lib/timeline`・`lib/i18n`（型のみ）
  - 「依存規則の検査」の表に `libLayer` の行（根拠と内容）を加え、規則の本文が検査の実装と同じ内容になるようにする
  - 完了の条件: 節の内容と `libLayers.test.ts` が見る対応表が一致する
  - 「依存規則の検査」の表と「lib の領域の依存の向き」の節は、util-placement 6.1 と structure-checks 5.1 より先に行う。両者は本タスクの後に行う（同じ表・同じ節を編集するため）
  - _Depends: 5.1_
  - _Requirements: 2.2, 3.3_

- [x] 5.3 steering と実装の一致を確かめる
  - `structure.md` の更新日（末尾の `updated_at`）を、この変更の日付に直す
  - `steeringRegions.test.ts`・`libLayers.test.ts` が通ることを確かめる
  - 完了の条件: 両方のテストが通り、`structure.md` の記載と実装の差が 0 件
  - _Depends: 5.2_
  - _Requirements: 1.3, 3.3_

- [x] 5.4 src-import-rules に libLayer を紐づける
  - src-import-rules の brief・requirements に libLayer（lib の基盤と業務の層の規則）を紐づける。検査の変更はしない。
  - 完了の条件: src-import-rules の brief・requirements に libLayer の規則（2.1・3.1）への紐づけが書かれ、`scripts/architecture/` と `tests/` に変更が無い
  - _Depends: 4.1_
  - _Requirements: 2.1, 3.1_

- [ ] 6. 最終検証
- [x] 6.1 生成物と古い参照が無いことを確かめる
  - `npm run apigen` を実行し、`src/client/openapi/` と OpenAPI 文書に差分が無いことを確かめる
  - 移動前のパス（`lib/account`・`lib/draft`・`lib/privacy`・`lib/legacy`・`lib/feedback/limits`・`lib/feedback/submission`・`lib/survey/pathParams`）が、ソース・テスト・設定のどこにも残っていないことを検索で確かめる
  - 完了の条件: 差分が 0 件で、移動前のパスの参照が 0 件
  - _Depends: 5.3, 5.4_
  - _Requirements: 5.2, 5.3_

- [ ] 6.2 全体の検証を通す
  - `npm run test:all` が終了コード 0 で終わり、通過件数が 1.1 で記録した基準を下回らないことを確かめる
  - 完了の条件: 終了コード 0 と件数の記録が残る
  - _Depends: 6.1_
  - _Requirements: 5.1, 5.4_

## Implementation Notes

### 1.1 着手前の基準（実装前のベースライン）

- `npm run test:all`: 終了コード 0
  - unit: 48 ファイル / 310 件 通過
  - component: 5 ファイル / 13 件 通過
  - route: 23 ファイル / 212 件 通過
  - render: 1 ファイル / 2 件 通過
  - e2e: 7 件 通過
  - type / lexicon / imports: 通過
- `npm run apigen`: 終了コード 0。`src/client/openapi/` と OpenAPI 文書（`docs/openapi.md`）に差分なし（`git status --porcelain` の出力が空）
- 着手前の開発サーバは停止を確認済み
