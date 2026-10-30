# Brief: survey-form

## Problem

開催中のアンケートを、ログイン情報のある利用者に、一度だけ・必須で表示する画面がない。

## Current State

起動時にアンケートを判定する処理も、回答済みの記録もない。

## Desired Outcome

アクティブなアカウントでアプリを開いたとき、開催中で未回答なら回答必須のダイアログを表示する。回答済みなら端末に記録し、アカウントを追加しても再度聞かない。

## Approach

端末の記録（localStorage）を最初に確認して、D1 へのアクセスを最小にする。「回答しない」を含む回答は送らず、そのタブの間は再表示せず、次の起動で再度表示する。

## Scope

- **In**: 起動時の判定、ダイアログ、端末側の記録、辞退の扱い、画面文言の i18n。
- **Out**: 設定の形式、回答の保存、ゲストへの表示。

## Boundary Candidates

- 判定と記録、ダイアログ

## Out of Boundary

- 設定の生成、回答の検証と保存

## Upstream / Downstream

- **Upstream**: survey-definition、survey-api、choice-question、アカウントのセッション
- **Downstream**: なし

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `account-session`、`app-shell`、`privacy-policy`（ポリシーのページでは表示しない）

## Constraints

プライバシーポリシーのページでは表示しない。取得の失敗では表示せずに進める。UI の変更は Playwright の実動作確認を含める。
