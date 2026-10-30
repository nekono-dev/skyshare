# Brief: survey-api

## Problem

アンケートの回答を、回答者を特定できない形で保存し、同じ利用者（複数アカウントを含む）に何度も聞かないための仕組みがない。

## Current State

D1 には予約投稿のテーブルだけがある。

## Desired Outcome

回答済みの集合（did のハッシュ）と匿名の回答を別のテーブルに保存し、重複を防ぎ、保持期限を過ぎたデータを自動で削除する。

## Approach

回答の保存は 1 回のバッチで行い、回答済みの集合への挿入の主キー違反で重複を検知する。通常のログインでは D1 に触れない設計とする。削除は既存の毎分の定期実行の日次の 1 枠で行う。

## Scope

- **In**: D1 のテーブルとマイグレーション、回答済みの確認・登録・回答の保存の API、ハッシュ、期間外の拒否、「回答しない」を含む回答の拒否、保持期限による削除。
- **Out**: 設定の形式、画面、集計。

## Boundary Candidates

- 回答の保存、回答済みの集合、日次の削除

## Out of Boundary

- 質問の描画、端末側の記録、運営の手順

## Upstream / Downstream

- **Upstream**: survey-definition（検証と保持期限）、D1、セッション
- **Downstream**: survey-form、survey-operation（削除の確認）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `schedule-store`（同じ D1 を使う）、`schedule-runner`（定期実行を共有）

## Constraints

Workers の無料枠の CPU 10ms。D1 の読み書きを最小にする。回答と did を結びつけない。ハッシュ鍵 `SURVEY_HASH_KEY` は全環境で同じ値。
