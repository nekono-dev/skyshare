# Brief: survey-definition

## Problem

運営者は、利用者の動向を探るための期間を限ったアンケートを実施したいが、質問をソフトウェアに組み込むと、質問を変えるたびにコードを変更することになり、フォークの環境にも不要なコードの影響が及ぶ。

## Current State

アンケートの質問・選択肢・期間を持つ仕組みはない。

## Desired Outcome

質問・選択肢・期間・多言語の文言が、GitHub のリポジトリ変数 `SURVEY_CONFIG` を元にビルド時に静的ファイルとして生成・配信される。変数が未設定の環境では何も起こらない。

## Approach

共有のスキーマ（Zod）で設定を検証し、現在のアンケートと保持期限は時刻を引数に取る純粋関数で判定する。存在の有無はビルド時の旗にして、設定が無い環境では通信しない。

## Scope

- **In**: 設定の形式と検証、期間と保持期限の判定、多言語の文言、設定の取得、変数からの生成と CI への組み込み。
- **Out**: 回答の保存、画面、変数の登録・削除の運用。

## Boundary Candidates

- 設定の形式と検証、期間の判定、設定の取得、生成と CI への組み込み

## Out of Boundary

- 回答のデータ、質問の描画、施行ワークフロー

## Upstream / Downstream

- **Upstream**: `LOCALES`（i18n）、Astro のビルド定数、`ASSETS`
- **Downstream**: survey-api、survey-form、survey-operation

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `site-config`（ビルド時の運用者設定）、`i18n-locale`

## Constraints

質問をソースコードに持たない。秘密情報を設定に含めない。設定の値を CI のログに出さない。
