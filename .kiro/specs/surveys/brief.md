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
- 保持期限: `period.ts`（純粋関数）と `retention.ts`。回答済みの集合は終了時刻以後、回答は終了の 1 か月後に削除。Worker の日次の後片付けから起動される（`src/worker.ts`）。
- 型: `lib/survey/env.ts` と `request.ts`、`store.ts` は D1 の型を `@/lib/platform/cfTypes` から取る（既知の不一致）。

## Desired Outcome

- 提示の判定の順序（除外・端末の記録・サーバーの確認）が記録されている。
- 匿名性の規則（回答者の値、保存する項目、ログに出さない項目）が記録されている。
- 保持期限の規則と、削除が失敗したときの扱い（項目ごとに続行）が記録されている。

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
