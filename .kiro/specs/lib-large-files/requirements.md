# Requirements Document

## Introduction

`src/` の `lib/` と `util/` には 400 行を超えるファイルが 7 件あり、一つのファイルに複数の責務が入っている。このため、変更の影響範囲を読み取りにくく、テストの対象も分かれにくい。本仕様は、この 7 件を責務ごとのファイルに分割する。分割の前後で、利用者に見える振る舞い、外から見た export の名前と戻り値は変えない。

## Boundary Context

- **In scope**: 次の 7 件の分割、分割後の外向きの import の維持と更新、分割に伴うテストの import の更新
  - `lib/image/postImageProcessing.ts`（856 行）
  - `lib/settings/shareSettings.ts`（718 行）
  - `lib/schedule/store.ts`（676 行）
  - `lib/timeline/guest/posts.ts`（643 行。ダミーデータが中心）
  - `lib/session/cookies.ts`（443 行）
  - `lib/survey/gate.ts`（415 行）
  - `util/textarea/contentEditableModel.ts`（426 行。移動先は `util-placement` の決定に従う）
- **Out of scope**: 振る舞いの変更、責務の再設計、新しい機能の追加、既存の契約（API の入出力・DB スキーマ・OpenAPI の文書）の変更、`lib` の層の分類（`lib-layers`）、`util` の移動（`util-placement`）、生成物（`src/client/openapi/`）、検査の規則の追加（`structure-checks`）
- **Adjacent expectations**: `lib-layers` と `util-placement` は、本仕様の着手時点で移動先の層とパスが確定している。本仕様は、その確定後のパスを対象にする。`media-attachments`・`settings`・`scheduled-posting`・`session-accounts`・`surveys`・`timeline-browsing`・`post-composition` の振る舞いは変えない。

## Requirements

### Requirement 1: 分割の対象と上限

**Objective:** As a 開発者, I want 400 行を超える 7 件が責務ごとに分かれていること, so that 一つのファイルの変更の影響範囲が読み取りやすくなる

#### Acceptance Criteria

1. When this spec is completed, the system shall contain no file in the seven target files listed in the Boundary Context that exceeds 400 lines
2. When a target file is split, the system shall place each resulting file under the same region (folder) as the original file, unless the design records a reason for placing it elsewhere
3. When a target file is split, the system shall not create any new file that exceeds 400 lines under `src/lib/` or `src/util/`

### Requirement 2: 責務の分離

**Objective:** As a 開発者, I want 分割後のファイルが一つの責務だけを持つこと, so that テストの対象を責務ごとに選べる

#### Acceptance Criteria

1. When a target file contains more than one responsibility, the system shall separate the responsibilities so that each resulting file has one responsibility
2. When `lib/timeline/guest/posts.ts` is split, the system shall place its dummy data in a file that contains only data, and that file shall contain no decision function
3. When a split file is created, the system shall keep the responsibility of each file describable in one sentence in its header comment
4. If a split would require a file to import from a file that imports it back, then the system shall not perform that split and shall choose another boundary (no import cycle among the split files)

### Requirement 3: 外から見た契約の不変

**Objective:** As a 開発者, I want 分割の前後で呼び出し側の見え方が変わらないこと, so that 呼び出し側の変更を最小にできる

#### Acceptance Criteria

1. When a target file is split, the system shall keep every export name of the original file reachable under the original module path
2. When a target file is split, the system shall keep the parameters, return values, and thrown errors of every exported function unchanged
3. Where the original module path is referenced by callers, the system shall re-export from the original module path (for example through `index.ts`) so that callers need no change beyond the import statement the design records
4. When a caller's import path changes because of a split, the system shall update the import in the same change, and the import shall follow the `@/` rule in `structure.md`

### Requirement 4: 振る舞いの不変とテストの維持

**Objective:** As a 運用者, I want 分割によって利用者に見える振る舞いが変わらないこと, so that 安心して分割を進められる

#### Acceptance Criteria

1. The system shall keep all user-visible behavior unchanged from the state before this spec, including screens, messages, and HTTP responses
2. The system shall keep the API input and output contract unchanged, so that `npm run apigen` produces no diff in `src/client/openapi/`
3. When test imports or mock paths refer to a moved or split module, the system shall update them in the same change without changing the meaning of any test
4. When this spec is completed, `npm run test:all` shall exit with code 0
5. When this spec is completed, the number of passed tests shall be not less than the count recorded before implementation starts (2026-11-03 baseline)

### Requirement 5: 変更の単位

**Objective:** As a レビュー担当者, I want 分割を一件ずつ追えること, so that 問題が出たときに該当の分割だけを戻せる

#### Acceptance Criteria

1. When a target file is split, the system shall record that split in its own commit, and no commit shall contain the splits of two or more target files
2. When a split is completed, the system shall pass `npm run test:type` and `npm run test:imports` before the next split starts
