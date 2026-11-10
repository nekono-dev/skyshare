# Brief: test-foundation

> 注: 本 brief は、roadmap に載っていなかった既存 spec（`test-foundation`）の discovery 記録を後から補ったもの。内容は requirements.md・design.md・steering の `testing.md` から要約した（2026-11-08）。

## Problem

旧テスト（`_tests/`）は、テストの方針を決めないまま実装された負債だった。機能ごとに検証の層・置き場所・ツールがばらばらで、どの振る舞いをどこで検証するかが分からなかった。

## Current State

- 旧テストは破棄した。新しいテストは `src/` の現行の実装から作る。
- 層ごとの実行環境（Node・workerd・happy-dom・Astro の container・Playwright）と設定ファイル（`config/test/`）は整った。
- 方針の正本は `.kiro/steering/testing.md`（承認済み）。

## Desired Outcome

- 検証層（unit・route・component・render・e2e、live は別の任意の層）と、その実行環境・置き場所（`tests/`）が一つに決まっている。
- P0 の振る舞い（セッション・予約の実行・アンケートの匿名性など）の分岐カバレッジの基準があり、push 前に全層が実行される。
- CI（PR）は E2E を必須にし、テストの独立性と再現性を求める。

## Approach

振る舞い（受入基準）単位でテストを作り、受入基準の種類ごとに検証層を割り当てる。外部の実サービスには依存させず、Bluesky は偽のサーバー（`tests/support/fakeBluesky`）に置き換える。route 層だけ workerd で実行し、実行環境の差を検出する。

## Scope

- **In**: 検証層の定義と実行環境、テストの配置、優先度（P0・P1・P2）、P0 の分岐カバレッジ基準、push 前の全層の強制、CI（PR）の必須ゲート、E2E の六つの流れ。
- **Out**: 個々の機能のテストケース（各機能 spec）、実 Bluesky に対する live 層（`live-tests` spec）、`scripts/`・`_legacy/`・外部サービスの内部のテスト、既存の古い設定やコメントの整理。

## Boundary Candidates

- 検証層の定義と実行環境（設定ファイル）
- テストの配置と支援（`tests/support/`、fixtures）
- ゲート（pre-push・CI）

## Out of Boundary

- 機能ごとの受入基準（各 spec が持つ）
- live 層の仕様（`live-tests`）

## Upstream / Downstream

- **Upstream**: steering `testing.md`（方針の正本）、実装（`src/`）
- **Downstream**: `live-tests`（依存）、今後の機能 spec のテストの作り方

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `live-tests`（live 層を別 spec で定める）、`ops-config-secrets`（pre-push の挙動）

## Constraints

- 本番の設定（`wrangler.template.jsonc`・`.github/workflows/e2e.yaml`）は、テストの基盤のために変えない。
- テストの題名は英語（`testing.md` の規則）。
- P0 の分岐カバレッジは 80%（`testing.md` の基準）。
