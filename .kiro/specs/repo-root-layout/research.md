# Research & Design Decisions

---

**Purpose**: ルート直下の整理に伴う参照の調査と、配置の判断の根拠を残す。
---

## Summary

- **Feature**: `repo-root-layout`
- **Discovery Scope**: Extension（既存の設定ファイルの移動と参照の更新。新しい仕組みは作らない）
- **Key Findings**:
  - 移動に伴う影響は、設定の相対パス解決（vitest の `rootDir`、Playwright の `testDir`・`outputDir`、Stryker の設定読み込み、orval の `--config`）に集中する。
  - 参照は約 30 ファイルにある（コード・設定・CI・hooks・文書・テスト）。`scripts/` は `ops-tooling-layout` で配置済みのため、その後の状態を前提にできる。
  - `playwright/.auth/` の 3 ファイルを読むコードは無い。内容は古い認証の状態と見られ、扱いの判断が要る。

## Research Log

### 設定ファイルの相対パス解決

- **Context**: 設定を `config/test/` に移すと、`import.meta.url` から求める `rootDir` が変わる。
- **Sources Consulted**: `vitest.unit.config.ts`・`vitest.component.config.ts`・`vitest.route.config.ts`（`rootDir` と `migrations/`・`wrangler.template.jsonc` の読み込み）、`vitest.astro.config.ts`（`import.meta.dirname`）、`playwright.config.ts`（`testDir: "./tests/e2e/flows"`）、`stryker.config.mjs`（`vitest.configFile`・`tempDirName`）、`orval.config.ts`（`./scripts/build/...` の import）。
- **Findings**: 設定の中の相対パスは、設定ファイルのある場所か、プロセスの作業ディレクトリのどちらかを基準に解決される。ツールごとに基準が違うため、移動の後に各設定を直接確かめる必要がある。
- **Implications**: 各設定は `rootDir = path.resolve(設定の場所, "../..")` でプロジェクトの根を求める。Playwright の `testDir`・`outputDir` は設定ファイルからの相対で書く。

### 生成物の出力先

- **Context**: coverage・変異テスト・E2E の出力が根に散らかる（要件 4）。
- **Findings**: `coverage/`・`test-results/`・`.stryker-tmp/` は既定の出力先で、どれも `.gitignore` で個別に除外している。
- **Implications**: 単一のキャッシュ用フォルダ `.cache/` にまとめ、`.gitignore` は `/.cache/` の 1 行にする。`.cache/` は一般的な慣習で、ツールの既定と衝突しない。

### 文書の移動先（`docs/`）

- **Findings**: `DEVELOP.md`・`README-jp.md`・`promotion/` から相対リンクは出ていない（`promotion/` の HTML も相対参照なし）。`README-jp.md` は画像 `./public/...` を相対で指すため、移動後は `../public/...` に直す必要がある。`README.md` は GitHub の表示のため根に残し、`README-jp.md` へのリンクは無い。
- **Implications**: 移動の影響は `DEVELOP.md` の名前への参照（約 8 ファイル）と `README-jp.md` の画像パスだけ。

### `playwright/.auth/` の扱い

- **Findings**: `pds.json`・`live.json`・`peer.json` を読むコードは無い（`tests/unit/scripts/liveConfig.test.ts` が読むのは `config/live.json`）。権限は 600/664。
- **Implications**: 要件 4.4 に従い `tests/e2e/.auth/` へ移す（`.gitignore` 対象）。中身は読まずに移し、古い認証の状態かどうかは利用者が判断する（最終報告で確認する）。

### 完了済みの spec の記述

- **Findings**: `.kiro/specs/` の完了済み spec（`ops-tooling-layout` など）には、旧パスが多数残っている。
- **Implications**: 完了済みの spec は当時の決定の記録として扱い、書き換えない。現行を説明する文書（`.kiro/steering/`・`CLAUDE.md`・`AGENTS.md`）は更新する。要件 5.1 の「文書」の範囲をこの解釈で確定する（最終報告で確認）。

## Architecture Pattern Evaluation

| Option                                | Description                                 | Strengths                                                          | Risks / Limitations                                   | Notes |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- | ----- |
| 設定をルートに残す                    | 移動しない                                  | 変更なし                                                           | 根の散らかりが解消しない                              | 却下  |
| `tests/config/` に設定を置く          | テスト設定だけ `tests/` へ                  | テストの中で完結                                                   | `tests/` にツールの設定と実行の結果が混ざる           | 却下  |
| `config/test/` に置く（採用）         | テスト設定を `config/` の下の専用フォルダへ | 設定の置き場所が 1 つにまとまる。`tests/` はテストコードだけになる | `config/` は JSON 中心の既存の場所に加わる            | 採用  |
| 生成物を `tmp/` にまとめる            | 出力先の名前を `tmp/` にする                | 一般的な名前                                                       | `.gitignore` の扱いと、一時ファイルとの区別がしにくい | 却下  |
| 生成物を `.cache/` にまとめる（採用） | 出力先を `.cache/` 配下にする               | 1 行で除外でき、キャッシュの意味が明確                             | 新しいフォルダが 1 つ増える                           | 採用  |

## Design Decisions

### 決定 1: テスト設定の配置は `config/test/`

- **Context**: 要件 2。根から 7 ファイルを移す。
- **Alternatives**: `tests/config/`（上の表）
- **Selected**: `config/test/`。`config/` は運用の設定の置き場所で、`tests/` はテストコードだけにする。
- **Impact**: `package.json` の `-c` の引数、`tsconfig.json` の include、`stryker` の起動の引数、Playwright の `testDir`・`outputDir`。

### 決定 2: 生成物の出力先は `.cache/`

- **Context**: 要件 4。
- **Selected**: `.cache/coverage/`・`.cache/test-results/`・`.cache/stryker-tmp/`。`.gitignore` は `/.cache/` を 1 行にする。
- **Impact**: vitest の `coverage.reportsDirectory`、Playwright の `outputDir`、Stryker の `tempDirName`、CI のアーティファクトの `path`（`.github/workflows/e2e.yaml`）。

### 決定 3: `.dev.vars.template` は `config/` に置き、名前を変えない

- **Selected**: `config/.dev.vars.template`。`.dev.vars`（秘密情報）は根に残す（wrangler が読む規約）。
- **Impact**: `scripts/secrets/prepare-local-env.mjs`、`.claude/hooks/session-start.sh`（`cp`）。

### 決定 4: 文書の移動先は `docs/`

- **Selected**: `docs/DEVELOP.md`・`docs/README-jp.md`・`docs/promotion/`。`README.md` と `LICENSE*` は根に残す。
- **Impact**: `README-jp.md` の画像パスを `../public/...` に直す。`DEVELOP.md` の名前への参照を `docs/DEVELOP.md` に直す。

## Risks & Mitigations

- **orval の出力先の基準**: 設定を `config/` に移すと、`output.target`（`./src/client/...`）の基準が変わるおそれがある。→ 移動の前後で `npm run codegen` の出力を比べる（`src/client/` は Git 管理外のため、ハッシュで比較する）。
- **Astro の `getViteConfig`**: 設定の場所から `astro.config.mjs` を探すかどうか。→ `test:render` を実行して確かめ、必要なら `root` を渡す。
- **Stryker の設定の読み込み**: 既定では作業ディレクトリの設定を読む。→ `stryker run config/test/stryker.config.mjs` の形で起動できるか、`--help` と実行で確かめる。
- **`playwright/.auth/` の中身**: 古い認証情報の可能性。→ 中身は読まず、移動のみ行う。削除は利用者が判断する。
- **参照の取りこぼし**: → 移動の後に旧パスを検索し、残りが無いことを確かめる（完了済み spec を除く）。
