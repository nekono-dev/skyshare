# Brief: comment-policy

## Problem

コメントの書き方の基準が無く、経緯や旧 spec 参照を書かないという判断を、作業ごとに個別に下している。

## Current State

- `specs/...` を指すコメントは 89 行。実在するのは `specs/src-pages-thin` の 3 行だけで、残りは既に無い spec を指す。
- 要件番号（「要件 1.2」など）は 161 行、cc-sdd・kiro への言及は 74 行、経緯（「旧・以前・移行」など）は 52 行、日付入りの記述は 99 行。
- 基準が文書化されていないため、判別の結果がばらつく。

## Desired Outcome

コメントの基準が steering にあり、以降の作業（comments-*）がそれを判断の正本にする。

## Approach

基準（残す・削る・判別の仕方）を `.kiro/steering/comments.md` に書く。既存の良い例と悪い例を 1 件ずつ添える。基準は「現在の振る舞いと理由だけを残す」。

## Scope

- **In**: コメントの基準（`.kiro/steering/comments.md` の新規作成）
- **Out**: 個々のファイルの書き換え（comments-* の各 spec）

## Boundary Candidates

- 基準の文書（comments.md）
- 参照は `tech.md` の「Code Quality」の節だけにし、重複させない。

## Out of Boundary

- 実際のコメントの書き換え（comments-lib・comments-components-pages・comments-tests・comments-scripts-config・comments-api-schema）
- 文字列リテラルの変更

## Upstream / Downstream

- **Upstream**: 既存の steering（tech.md・structure.md）
- **Downstream**: comments-lib・comments-components-pages・comments-tests・comments-scripts-config・comments-api-schema

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: なし（steering の規約だけを対象とする）

## Constraints

- 振る舞いを変えない。`npm run test:type`・`test:imports`・unit・component・route・render が通ること（e2e は最終統合の段階で comments-api-schema が行う）。
- コメントの基準は `.kiro/steering/comments.md`（comment-policy の成果物）に従う。
- 判別に迷うコメントは、残したうえで差分の報告に挙げる（黙って削らない）。
- 基準の文書は、人が読む前提で日本語で書く（CLAUDE.md の規約）。

## 決定事項（2026-11-08 追補）

### 1. 先頭ヘッダの制約

- 対象: 自前のモジュール（`src`・`scripts`・`hack` の `.ts`・`.tsx`・`.astro`・`.mjs`）。テストファイルも同じ規則に従う。
- 形: 目的を 1〜2 行で書く。制約（不変条件・外部仕様・動作の前提）がある場合だけ、箇条書きを最大 3 項目足す。
- 上限: ヘッダ全体は 6 行以内。責務の逐条の説明と、コードの言い換えは書かない。
- 除外: 生成物（`src/client/**`）、`*.d.ts`、テストの fixture。
- 上限の数値は暫定。実際に書いてみて、削れない制約が多いときに見直す。

### 2. テストで守る項目

- 先頭ヘッダがあること、上限行数を超えないこと。
- 禁止パターン（コメント内）: `specs/`、`要件 \d`、`\b(AC|FR|NFR)-?\d`、`cc-sdd`、`kiro`（ただし、`kiro` の語を含むスキルの説明や、外部の名称として必要な場合は除く）。
- 日付（`20\d\d-\d\d-\d\d`）は、バッククォートで囲んだ入力例の中だけ許す。
- 「旧」「以前」「移行」「経緯」は語として正当に使われることがあるため、テストでは失敗にせず、レビューで判断する。
- 例外は、理由を付けた許容リスト（`import-allowlist.json` と同じ方式）で管理する。
- 検査の置き場所: `tests/unit/scripts/commentRules.test.ts`（既存の steering 系テストと同じ形）。

## 進捗（2026-11-08）

- 実装済み: 基準（`.kiro/steering/comments.md`）、検査（`scripts/architecture/commentRules.ts`）、テスト（`tests/unit/scripts/commentRules.test.ts`）、許容リスト（`config/comments/allowlist.json`）。
- 許容リストには、既存の違反を所有 spec（comments-_）ごとに記録している。各 comments-_ spec は、担当の項目を消すことで完了する。
