# Brief: surveys

## Problem

ログイン後に一度だけアンケートを提示し、回答を匿名で保存する必要がある。回答者を特定できる形で保存すると、匿名性の約束が守れない。期間を過ぎたデータも残せない。

## Current State

- 設定の有無は配信時に決まる。`SURVEY_CONFIG`（変数）または `public/surveys/index.json`（生成物）。ビルドの旗 `PUBLIC_SURVEY_CONFIG_PRESENT` が偽なら、通信も読み出しもしない（`src/lib/site/surveyPresence.ts`・`src/lib/survey/loadConfig.ts`）。
- 形式: `src/lib/survey/definition.ts`（`SurveyConfigSchema`）。エラー報告に入力の値を含めない。
- 提示の判定: `src/lib/survey/gate.ts`（純粋な状態遷移）と `launchCheck.ts`（除外ページ、端末の記録、サーバーの確認）。`src/components/survey/SurveyGate/` が入口、`SurveyDialog/` が回答と辞退。
- 端末の記録: `deviceRecord.ts`（回答済みのアカウントを localStorage、辞退をタブに保存）。
- API（`src/pages/v2/surveys/[surveyId]/`）: `respondent.ts`（`GET` は回答済みの確認、`PUT` は回答済みの登録）、`answers.ts`（`POST` は回答の保存）。順に、認証（401）、ID の形式（400）、設定と期間（404）、鍵（503）。
- 回答者の値: `src/lib/survey/respondentHash.ts`。`HMAC-SHA256(鍵, surveyId + did)` を 16 進 64 文字で返す。鍵は `SURVEY_HASH_KEY`。
- 保存（D1）: `survey_respondents`（回答済みの集合）と `survey_answers`（匿名の回答）。`lib/survey/store.ts` が唯一の触る部品で、回答の保存は batch の 1 回。回答の順番は残さない（`answers.ts`）。
- 削除の契機（2026-11-22 更新。旧い保持期限の規則は下の「追補」で置き換え）: `period.ts`（純粋関数）と `daily.ts`。回答済みの集合は終了後の日次の枠で削除し、回答は集計の結果を保管先（R2）に保存できた後に削除する。Worker の日次の後片付けから起動される（`src/worker.ts`）。
- 機能の有効・無効: `feature.ts`（`isSurveyFeatureEnabled`）。D1（`DB`）と結果の保管先（`SURVEY_RESULTS`）の両方があるときだけ有効。
- 型: `lib/survey/env.ts` と `request.ts`、`store.ts` は D1 の型を `@/lib/platform/cfTypes` から取る（既知の不一致）。

## Desired Outcome

- 提示の判定の順序（除外・端末の記録・サーバーの確認）が記録されている。
- 匿名性の規則（回答者の値、保存する項目、ログに出さない項目）が記録されている。
- 削除の契機（集計の保存の成功後の削除）と、削除が失敗したときの扱い（項目ごとに続行）が記録されている。
- アンケート機能が D1 と R2 の両方を前提とすること（どちらかが無ければ無効）が記録されている。

## Approach

アンケートの判定・回答・保存・保持期限を所有する。設定の中身（質問と選択肢）は運用者の入力とし、本 spec は形式の検証だけを所有する。

## Scope

- **In**: 設定の形式と検証、提示の判定、回答と辞退の画面、回答の検証と保存、回答済みの確認、保持期限の削除。
- **Out**: 質問の内容と集計、設定の作成ツール（`scripts/survey/`・`scripts/render-survey-config.ts`）、Worker の入口（platform-runtime）。

## Boundary Candidates

- 設定と提示（definition.ts・loadConfig.ts・gate.ts・launchCheck.ts・SurveyGate）
- 回答の画面（answerDraft.ts・SurveyDialog・client.ts・deviceRecord.ts）
- 回答の保存と匿名性（answers.ts・store.ts・respondentHash.ts・respondent.ts・answers route）
- 保持期限（period.ts・retention.ts）

## Out of Boundary

- 質問の内容と集計、設定の作成、Worker の入口

## Upstream / Downstream

- **Upstream**: session-accounts（回答者の DID）、api-contract、i18n、ui-primitives（ChoiceQuestion）、platform-runtime（サイト設定・Worker・型）。
- **Downstream**: なし。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: session-accounts、platform-runtime（D1 の型の所在）。

## Constraints

- 回答者の識別子・値・回答内容・鍵をログや応答に出さない（失敗の記録は例外の種類の名前だけ）。
- 期間の判定は時刻を引数に取る純粋関数にする（`period.ts`）。
- 解消済み（2026-10-31）: D1 の型は `lib/platform/cfTypes.ts` にある。

## 確定した判断（2026-10-27）

- 匿名にする。回答（`survey_answers`、did を持たず日単位）と回答済みの集合（`survey_respondents`、`HMAC(SURVEY_HASH_KEY, survey_id + did)`）を別テーブルに分け、複数アカウントで 1 票にする。どちらも WITHOUT ROWID。回答の保存は `DB.batch()` で行い、集合の挿入の主キー違反を重複の検知に使う。
- 端末の localStorage（回答済みの `answered`・登録済みの did）を先に見て、D1 へのアクセスを減らす。
- 回答は必須。「回答しない」（`decline`）を含む回答は未完了として送らず、次の起動で再表示する。サーバーは 422 で拒否する。
- 質問は選択式のみ（単一・複数）。UI 文言は既存の i18n に乗せる。
- 設定は Git に置かず、GitHub 変数 `SURVEY_CONFIG`（JSON、ja と en の全言語必須）から CI がビルド前に静的ファイルを生成する。未設定（フォークを含む）は何もしない。不正な JSON はデプロイを失敗させる。
- 保持: 回答済みの集合は終了時、回答は終了の 1 か月後（JST 暦）に削除する。日次の処理は既存の毎分 Cron の 1 枠で行う（GitHub の定期実行は 60 日の無活動で止まるため不採用）。
- 保存先は D1（`skyshare` と `skyshare-develop`）。
- `SURVEY_HASH_KEY` は全環境で同じ値ではない。本番は別の D1、develop とそのプレビューは `-develop` の D1 を共用するため、同じ値にするのは develop とプレビューの間だけ。
- 施行の手順は `survey-run` skill に従う。

## 追補（2026-11-22、roadmap の surveys(b)）

上の「確定した判断（2026-10-27）」のうち、次の 2 点は後の決定で置き換えた。要件の作成時は、こちらを正とする。

- **保持期限の廃止と削除の契機**（`survey-results-aggregation` が所有）: 「回答は終了の 1 か月後に削除」という期限は廃止した。終了したアンケートの回答は、日次の枠で集計し、その結果を R2 の保管先に保存できた後に D1 から削除する。保存に失敗した回答は残し、翌日以降の日次の枠で再び試みる。回答済みの集合は、終了後の日次の枠で削除する。設定から外れた識別子の残存回答も、日次の枠が片付ける。
- **D1 と R2 の前提**: アンケート機能は D1（回答の保存）と R2（結果の保管先 `SURVEY_RESULTS`）の両方を前提とする。どちらかのバインディングが無い環境では、アンケートの API（回答済みの確認・登録・回答の保存）は 404 を返し、日次の処理も行わない（`isSurveyFeatureEnabled`）。
- **「回答しない」**（Phase 12、2026-11-19）: 質問の選択肢としての `decline` は設定の形式から削除し、指定すれば不正とする。辞退はダイアログの「回答しない」ボタンで行い、すべてのアンケートで選べる。回答を完了しないと送信できない点は変わらない。サーバーの 422 は廃止し、不正な回答は 400 で拒否する。
- 実機での確認（2026-11-21）: develop の試験用アンケートで、締切後の日次の枠が結果を保存し、D1 の回答と回答済みの集合がどちらも 0 件になったことを確かめた。
