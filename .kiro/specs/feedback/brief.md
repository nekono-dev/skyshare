# Brief: feedback

## Problem

利用者は不具合を報告し、機能を提案できる必要がある。送信は GitHub の公開 Issue になるため、載せる情報の範囲を明確にしないと、利用者の情報が意図せず公開される。

## Current State

- `src/pages/feedback.astro`・`src/components/feedback/FeedbackForm/`: 種別（不具合・機能の提案）を切り替える。未ログインではフォームを出さない。
- `src/lib/feedback/feedbackDraft.ts`: 両方の入力を一つの状態で持ち、必須と上限を判定し、送信の本文を組み立てる。
- `src/lib/feedback/limits.ts`: 上限（受付と画面で共有。zod などの重い依存は読まない）。
- `src/lib/feedback/issueContent.ts`: 種別でラベルを変える（`bug`・`enhancement`）。本文に入力、報告者（ハンドルと DID）、版、コミット、環境を載せる。利用者の入力はメンションなどとして解釈されない形で載せる。
- `src/lib/feedback/githubIssue.ts`: GitHub REST API で Issue を作る。認証は `FEEDBACK_GITHUB_TOKEN`。
- `src/pages/v2/feedback.ts`（`POST`）: 順に、ヘッダーの検証（400）、セッションの確認（401）、本文の検証（400）、設定の確認（503）、間隔制限（429）、Issue の作成（500）。報告者はセッションの `did` と `handle` だけから取る。
- 間隔制限: `wrangler.template.jsonc` の Rate Limiter `FEEDBACK_RATE_LIMITER`（60 秒に 1 件、キーは `session.did`）。

## Desired Outcome

- 送信の入力・検証・応答の規則が記録されている。
- Issue に載る情報（報告者・環境・版）の範囲と、公開される前提が記録されている。
- 間隔制限と、未設定時の扱いが記録されている。

## Approach

入力から Issue までの流れを所有する。認証は session-accounts の結果を使う。

## Scope

- **In**: フォームの種別と入力、必須と上限、送信 API、Issue の本文とラベル、間隔制限、エラーの応答。
- **Out**: GitHub 側の運用と Issue の管理、認証、文字数カウンタの部品（ui-primitives）。

## Boundary Candidates

- フォームと入力の状態（FeedbackForm・feedbackDraft.ts・limits.ts）
- 送信 API と間隔制限（v2/feedback.ts）
- Issue の組み立てと登録（issueContent.ts・githubIssue.ts）

## Out of Boundary

- 認証、文字数カウンタ、GitHub の運用

## Upstream / Downstream

- **Upstream**: session-accounts、api-contract、i18n、ui-primitives、platform-runtime（ビルドの版とリポジトリ）。
- **Downstream**: なし。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: session-accounts、ui-primitives。

## Constraints

- 報告者の識別子はセッションからだけ取る。
- 認証情報とユーザー入力の全文をログに出さない（`console.error` は設定の有無だけを出す）。
- 既知の不一致: なし（確認済みの範囲）。
