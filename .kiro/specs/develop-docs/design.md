# Design Document

## Overview

**Purpose**: `DEVELOP.md` を、開発者と運用者が行う手順だけの文書に作り直す。設計の理由は steering・spec を参照する。
**Users**: 開発者（日常の作業）、運用者（初回の設定・リリース）。
**Impact**: `DEVELOP.md` の章立てと本文が変わる。README は導線だけを確かめる。

### Goals

- 章を「準備 → 日常の開発 → 設定と生成物 → 品質 → 運用」の順に並べる
- 手順のコマンドを `package.json` と `scripts/` の実在のものに合わせる
- 食い違い（E2E の Secret、BRW の正本の記述、`release/*` と `develop`）を直す

### Non-Goals

- steering・spec の内容、スクリプトの中身、利用者向けの文書

## Architecture

### Existing Architecture Analysis

`docs/DEVELOP.md` は約 37KB。章は「デプロイ環境・準備・テスト・ビルド・設定・ローカル起動・wrangler・コード生成・リリース・CI/CD（運用者ごとの設定・アンケート・フォーク・予約の初期設定・不具合報告の初期設定・E2E）・プレビュー・i18n・E2E・アンケート除去」。設計の理由（なぜ D1 を共用するか等）が手順に混ざっている。

### 文書の構成（目次）

1. 役割と正本（この文書は手順。設計は steering・spec）
2. 準備（前提・初回の clone・依存の導入・エージェントの導入）
3. 日常の開発（起動・テスト・型検査・ビルド）
4. 設定と生成物（config・wrangler.jsonc・.dev.vars・アンケートの設定）
5. 品質（E2E・ライブテスト・i18n）
6. 運用（リリース・CI/CD・プレビュー・develop）
7. 初回の設定（GitHub の Variables・Secrets・予約の鍵・不具合報告）

### 章ごとの正本

| 章                 | 手順の正本                                           | 設計の正本                        |
| ------------------ | ---------------------------------------------------- | --------------------------------- |
| 準備・エージェント | `package.json`（`prepare`）・`.claude/settings.json` | `.kiro/specs/ops-agent-setup/`    |
| 設定と生成物       | `scripts/config/`                                    | `.kiro/specs/ops-config-secrets/` |
| 品質（E2E）        | `scripts/e2e/`・`.github/workflows/e2e.yaml`         | `.kiro/specs/test-foundation/`    |
| 運用（CI/CD）      | `.github/workflows/`                                 | `.kiro/specs/ops-tooling-layout/` |
| i18n               | `src/lib/i18n/`                                      | `.kiro/specs/i18n/`               |

## Components and Interfaces

本文書はコンポーネントを持たない。各章は「実行するコマンド」「完了の確かめ方」「正本のパス」の 3 点だけを書く。

## Data Models

- 変数名（`SKYSHARE_E2E_*`・`SCHEDULE_ENC_KEY`・`OAUTH_CLIENT_KEY`・`SURVEY_HASH_KEY` など）と Secret・Variable の名前だけを書く。値は書かない。

## Error Handling

- 食い違いを見つけたときの扱い: 文書を直す。コードが誤りなら文書ではなく spec に記録して別の作業にする（この作業では直さない）。

## Testing Strategy

- **参照の検査**: `docs/DEVELOP.md` に出るパス（`scripts/`・`.kiro/`・`.github/`）と `npm run <name>` の名前が、実在することを `test -e` と `node -e` で確かめる。
- **食い違いの検査**: `E2E_ENV` の残存が 0 件、`build:pripare` の残存が 0 件、`.claude/branch-release-workflow.json` の記述が正本の配置と一致する。
- **書式**: `npm run format:check` 相当（prettier）を通す（`.prettierrc`）。

## Risks and Open Questions

- pre-push で GitHub の Variables を登録する挙動は、既知の論点。文書には現在の動作を書き、見直しは未決定である旨を書く（利用者の判断を待つ）。

### 現況との対応（2026-11-10 追補）

| 設計時の記述                  | 現在              | 変えた spec      |
| ----------------------------- | ----------------- | ---------------- |
| リポジトリ直下の `DEVELOP.md` | `docs/DEVELOP.md` | repo-root-layout |
