# Brief: develop-docs

## Problem

`DEVELOP.md`（約 37KB）は、手順・設計の理由・運用の決まり・E2E の詳細が 1 つに混ざっている。運用の手順を追記するたびに章が増え、構成が崩れている。設計の責務（steering と spec の役割）と手順の区別がない。実際の設定（E2E の Secret など）と食い違う記述も残る。

## Current State

- 章の構成（見出し）: デプロイ環境・準備・テスト・ビルド・設定（config と wrangler.jsonc）・ローカル起動・wrangler・コード生成・リリース・CI/CD（運用者ごとの設定・アンケート・フォーク・予約の初期設定・不具合報告の初期設定・E2E）・プレビュー・多言語対応（i18n）・E2E・main への取り込み前のアンケート除去。
- 食い違い（確認済み）: E2E の Secret を `E2E_ENV` として説明するが、`.env.e2e.template` は `SKYSHARE_E2E_*` の個別の変数を示す。`e2e.yaml` は `config/e2e.json` を使い、GitHub の Variables は使わないと書く。
- 旧記録（memory）にあった競合マーカーは、現在の `DEVELOP.md` には残っていない（解消済み）。`release/*` と `develop` の記述の食い違いは、`.claude/branch-release-workflow.json` の現在の値（`baseBranch: develop`）で確かめる。
- 参照の古さ: `scripts/` の旧パス、`build:pripare`、`.claude/branch-release-workflow.json` の「正本へのリンク」の記述。

## Desired Outcome

- `DEVELOP.md` は、開発者・運用者が行う手順だけを載せる（準備・起動・テスト・リリース・CI・初期設定・E2E）。
- 設計の理由と責務は steering（`.kiro/steering/`）と spec（`.kiro/specs/`）へ参照で移す。文書に設計の議論は残さない。
- 記述は確定した構成（ops-agent-setup・ops-config-secrets・ops-tooling-layout の後）と現在の設定ファイルに合う。食い違いは直す。

## Approach

手順と設計を分ける。各手順は、実行するコマンドと確認方法だけを書き、理由は steering・spec を指す。章の並びは「初めて使う → 日常の開発 → 運用（CI・初期設定）→ 品質（テスト・E2E）」の順にする。

## Scope

- **In**: `DEVELOP.md` の章立て・本文・食い違いの修正、`README.md`・`README-jp.md` の開発者向けの導線（必要な場合のみ）。
- **Out**: 利用者向けの文書、`.kiro/steering/` と `.kiro/specs/` の内容（別の作業）、スクリプトの中身。

## Boundary Candidates

- 手順の章（準備・起動・リリース・CI）
- 運用の初期設定の章（予約・不具合報告・E2E の Secret）
- 品質の章（テスト・E2E・i18n）

## Out of Boundary

- 設計の議論（steering・spec へ移す）、アプリの仕様、Cloudflare・GitHub の実際の設定

## Upstream / Downstream

- **Upstream**: ops-agent-setup・ops-config-secrets・ops-tooling-layout（記述の対象の構成）
- **Downstream**: なし

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `ops-tooling-layout`（パスの参照）

## Constraints

- 文書は日本語（`CLAUDE.md`・`spec.json.language`）。
- 秘密の値は書かない（変数名と登録の手順だけ）。
- 手順のコマンドは実際に存在する `package.json` のスクリプトを指す（存在確認をしてから書く）。
