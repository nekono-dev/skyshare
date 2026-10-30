# Brief: survey-operation

## Problem

アンケートの施行（質問の聞き取り、他言語の翻訳、変数の登録、期限切れの変数の削除）が手作業になり、登録ミスや削除漏れが起こりうる。

## Current State

変数の登録も削除も、手順が定まっていない。

## Desired Outcome

運営者がアンケートを実施したい旨を伝えると、必要項目の聞き取り・翻訳・検証・登録までが機械的・冪等に進む。回答データの削除が終わった期限切れのアンケートは、次のリリースで運営者の指示なしに変数から除かれる。

## Approach

決定的な CLI（追加・状態・削除）に判断を寄せ、手順を定型のスキルにする。削除は main へのマージの手順の定型工程として、手元の認証済みの `wrangler` と `gh` で行う。

## Scope

- **In**: 聞き取り項目の定型化、翻訳の作成と確認、`gh variable set` による登録（冪等）、期限切れの変数の削除条件（期限超過かつ回答データが 0 件）、トークンの最小化。
- **Out**: 設定の形式、回答の保存と削除の実行、画面。

## Boundary Candidates

- 登録（追加・更新）、状態の確認、期限切れの削除

## Out of Boundary

- 設定のスキーマ、D1 のテーブル

## Upstream / Downstream

- **Upstream**: survey-definition（スキーマ）、survey-api（削除済みかの確認）
- **Downstream**: なし

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `site-config`（`deploy.env` と変数の登録）

## Constraints

CI に変数の書き込み権限を預けない（`GITHUB_TOKEN` は変数を書けない）。変数は 48KB 以内。出力は 1 行の要約に固定する。
