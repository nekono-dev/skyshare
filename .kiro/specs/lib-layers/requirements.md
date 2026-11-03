# Requirements Document

## Introduction

`src/lib/` は 21 の領域と直下の `guestMode.ts` がフラットに並び、基盤（認証・API・画像など、他の領域が土台にするもの）と業務（予約・Entry・アンケートなど、機能そのもの）の区別がない。本仕様は `lib/` を基盤と業務の二つの層に分け、依存の向きを一方向（業務 → 基盤）にする。あわせて 1〜2 ファイルだけの領域を統合し、`structure.md` の依存表と依存規則の検査を新しい層に合わせる。利用者に見える振る舞い、API の入出力、生成物は変えない。

## Boundary Context

- **In scope**: `src/lib/` の各領域の層への分類、基盤から業務への依存の解消（import の付け替えと処理の所在の見直しを含む）、1〜2 ファイル領域の統合、`structure.md` の依存表・領域一覧・依存規則の節の改訂、`test:imports` が層の方向を検査すること
- **Out of scope**: 利用者に見える振る舞い・API の入出力・DB スキーマ、400 行を超えるファイルの分割（`lib-large-files`）、`src/util/` の配置（`util-placement`）、`src/components/` の配置（`components-small-areas`）、検査の追加全般（`structure-checks`）
- **Adjacent expectations**: `util-placement` と `lib-large-files` は、本仕様で決めた層と移動先に従う。`api-contract`（`lib/api` の契約）・`platform-runtime`（`lib/platform` の型）・`session-accounts`（`session`・`oauth`）の振る舞いは変えない。

## Requirements

### Requirement 1: 層の分類

**Objective:** As a 開発者, I want `lib/` の各領域がどちらの層に属するかを一覧で知りたい, so that 新しいコードをどの層に置くかを判断できる

#### Acceptance Criteria

1. The `lib` 層の構成 shall classify every `lib` 領域 and `lib/guestMode.ts` as 基盤 or 業務 (the placement of the API contract region `lib/api` is decided in design and recorded there)
2. The `lib` 層の構成 shall record the 基盤 and 業務 classification in `structure.md`
3. When a 領域 is added to `lib/`, the 領域の一覧 in `structure.md` shall be updated with its layer in the same change

### Requirement 2: 依存の向き

**Objective:** As a 開発者, I want 業務から基盤への一方向の依存だけを許す, so that 基盤の変更が業務へ逆流しない

#### Acceptance Criteria

1. The 基盤 layer shall not import any module of a 業務 region
2. The 業務 layer shall be allowed to import modules of the 基盤 layer
3. The `lib` 層の構成 shall not contain any import cycle among regions, including type-only imports
4. When the existing dependencies from 基盤 to 業務 (`lib/api` → `lib/feedback`・`lib/survey`、`lib/session/bskySessionRefresh.ts` → `lib/api`) are resolved, the system shall keep the observable behavior defined in Requirement 5 unchanged
5. If a dependency from 基盤 to 業務 cannot be removed within this spec, then the import allowlist shall record it with its owning spec and reason

### Requirement 3: 層の検査

**Objective:** As a 開発者, I want 層の方向の違反を `test:imports` で検出したい, so that 規約が人の確認に頼らず守られる

#### Acceptance Criteria

1. When a 基盤 module imports a 業務 module that is not recorded in the import allowlist, the `test:imports` shall fail
2. When this spec is completed, the import allowlist shall contain no layer-direction entries for the dependencies resolved under Requirement 2.4
3. The 依存規則の検査 section of `structure.md` shall describe the layer-direction rule in the same form as the checker enforces it

### Requirement 4: 小さい領域の統合

**Objective:** As a 開発者, I want 1〜2 ファイルしかない領域を減らしたい, so that 領域の単位が実際の責務と合う

#### Acceptance Criteria

1. The `lib/account` 領域 shall be merged into `lib/session`, and every former `lib/account` export shall remain reachable from `lib/session`
2. When a 領域 has one or two files after the merge, the 領域 shall either be merged into a related 領域 or have its reason for remaining separate recorded in `structure.md`
3. When a 領域 is merged or removed, the 領域の一覧 in `structure.md` shall match the actual directories under `lib/`

### Requirement 5: 振る舞いの不変

**Objective:** As a 運用者, I want 配置の組み替えで利用者に見える動作が変わらないこと, so that 安心して移動を進められる

#### Acceptance Criteria

1. The system shall keep all user-visible behavior, including screens, messages, and HTTP responses, unchanged from the state before this spec
2. The system shall keep the API input and output contract unchanged, so that `npm run apigen` produces no diff in the generated output
3. When a module is moved or renamed, the system shall update the import paths of the affected code and tests in the same change, without changing the meaning of any test
4. When this spec is completed, `npm run test:all` shall exit with code 0, and the number of passed tests shall be not less than the count recorded before implementation starts (2026-11-03 baseline)
