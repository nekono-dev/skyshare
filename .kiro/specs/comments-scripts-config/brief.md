# Brief: comments-scripts-config

## Problem

`scripts`・`hack`・`config`・`.githooks` のコメントに、cc-sdd 導入前の仕組み・経緯・旧 spec 参照が残っている。

## Current State

- `scripts/architecture`・`scripts/agent`・`scripts/config`・`scripts/secrets` などに、旧 spec 参照（`structure-checks 3.2` など）と経緯の記述がある。
- `hack/survey-cli` と `config/` の説明も対象。

## Desired Outcome

運用の資材のコメントが、今の動作と使い方を述べている。

## Approach

各対象ファイルのコメントを、`.kiro/steering/comments.md` の基準に従って書き換える。

## Scope

- **In**: `scripts/**`・`hack/**`・`config/**`・`.githooks/**` のコメント
- **Out**: `src/**`・`tests/**`（他の spec）。`.github/workflows/**` の YAML はコメントだけを扱い、CI の挙動は変えない

## Boundary Candidates

運用スクリプトの領域（agent・config・secrets・survey・e2e・dev・build・git・lib）

## Out of Boundary

CI の挙動と設定値。

## Upstream / Downstream

- **Upstream**: comment-policy
- **Downstream**: なし

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: ops-tooling-layout・ops-config-secrets（配置と責務の所有者）

## Constraints

- 振る舞いを変えない。`npm run test:type`・`test:imports`・unit・component・route・render・e2e が通ること。
- コメントの基準は `.kiro/steering/comments.md`（comment-policy の成果物）に従う。
- 判別に迷うコメントは、残したうえで差分の報告に挙げる（黙って削らない）。
