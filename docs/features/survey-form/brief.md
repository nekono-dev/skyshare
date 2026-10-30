# Brief: survey-form

## Problem

開催中のアンケートを、ログイン情報のある利用者が投稿フォームから開ける入口がない。

## Current State

開催中のアンケートの判定と回答済みの記録は実装済み。従来は起動時にダイアログを自動表示していた。

## Desired Outcome

アクティブなアカウントで投稿画面を開いたとき、開催中で未回答なら投稿フォームの下に「アンケートにご協力ください」ボタンを表示する。押したときにダイアログを開き、回答済みと確認できたらボタンを隠す。本文と送信ボタンの左右端を揃え、集計結果はプライバシーポリシーに則って扱う旨を末尾に示す。

## Approach

端末の記録（localStorage）を最初に確認して、D1 へのアクセスを最小にする。確認が失敗してもボタンは表示する。「回答しない」を含む回答は送らず、閉じた後もボタンから開き直せる。

## Scope

- **In**: 投稿フォーム下の入口、回答済みの判定、ダイアログ、端末側の記録、辞退の扱い、画面文言の i18n。
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
