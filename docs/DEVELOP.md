# 開発者ガイド

この文書は、開発者と運用者が行う**手順**だけを書く。設計の理由と規約は次の正本を参照する。

- 技術・構成・テストの方針: `.kiro/steering/`（`product.md`・`tech.md`・`structure.md`・`testing.md`）
- 機能の段階と仕様: `.kiro/steering/roadmap.md` と `.kiro/specs/<機能>/`
- エージェント（Claude Code）の規約: `CLAUDE.md`（Codex は Claude Code の子エージェントとして使う。規約は同じ `CLAUDE.md` の「Codex as a Child Agent (MCP)」）

Skyshare v2 は Cloudflare Workers 上で動く。v1 の機能を使う場合だけ、v1 のバックエンドと設定値が要る。

## 1. 準備

前提: Node.js 22.16.0（CI と同じ版）、`git`、`gh`（GitHub の操作に使う）。

1. Git の準備（atproto は submodule。`lexicons/com/atproto/repo/strongRef.json` がその中へのシンボリックリンク）

   ```sh
   git submodule update --init --depth 1 atproto
   ```

2. 依存の導入（`npm ci` は CI と同じ。`prepare` が `scripts/git/setup-git-hooks.mjs` を実行し、`core.hooksPath` を `.githooks` にする）

   ```sh
   npm ci
   npm run codegen # src/client/（生成物。Git 管理外）
   ```

3. ローカルの設定（`config/develop.json` と `.dev.vars` を用意し、`wrangler.jsonc` を生成する）

   ```sh
   npm run setup:local
   ```

   運営者の値を変えたら `config/develop.json` を編集して、もう一度 `npm run setup:local` を実行する。完了の確かめ方: `wrangler.jsonc` が生成され、`.dev.vars` に `SCHEDULE_ENC_KEY`・`OAUTH_CLIENT_KEY`・`SURVEY_HASH_KEY` の行がある（値は表示しない）。

   `config/develop.json` の形（`vars` は Worker と画面に入る公開の値。`siteHost` は配備のときだけ使う）:

   ```json
   {
     "vars": {
       "PUBLIC_NODE_ENV": "develop",
       "PUBLIC_LEGACY_BACKEND_ENDPOINT": "_legacy版UIを使う場合、_legacy版backendのエンドポイント",
       "PUBLIC_OGP_EXTRACTOR_API": "OGP ExtractorのURL（APIのパスに/v1/extractを含めない）",
       "PUBLIC_DEFAULT_ATP_SERVICE": "https://api.bsky.app",
       "PUBLIC_PLC_DIRECTORY_BASE_URL": "https://plc.directory",
       "PUBLIC_OPERATOR_NAME": "運営者の名前",
       "PUBLIC_OPERATOR_EMAIL": "運営者のメールアドレス",
       "PUBLIC_PRIVACY_ENACTED_AT": "2000-01-01",
       "PUBLIC_PRIVACY_REVISED_AT": "2000-01-01"
     }
   }
   ```

4. エージェントの導入（Claude Code のクラウドセッションでは開始時に自動で行われる）
   - cc-sdd: SessionStart の `scripts/agent/install-cc-sdd.sh --claude` が、固定版（3.1.0）のスキルと設定の雛形を導入する（受け付ける引数は `--claude` だけ）。これらは MIT のため `.gitignore` の対象で、コミットしない。`CLAUDE.md` は導入で書き換えない（プロジェクトの文書として直接編集する）。
   - BRW（branch-release-workflow）: `.claude/settings.json` が、取得元（GitHub の `nekono-dev/claude-plugins`）とプラグインの有効化を宣言する。SessionStart の `node scripts/agent/ensure-brw-plugin.mjs` が、無いものだけを導入する。導入した直後のセッションではスキルが使えないため、セッションを開き直す。
   - 導入に失敗すると、次の入力が止まり、理由に再試行の方法が出る。新しいセッションを開くか、Claude の外（通常のターミナル）で理由に出たコマンドを実行する。
   - Codex（任意。ローカルだけ）: `codex` を入れてあると、Claude Code が Codex を子エージェントとして呼ぶ（`.mcp.json` の MCP サーバー `codex`。設定は `.codex/config.toml`）。使うには、Codex の対話画面でこのリポジトリを一度信頼し、Claude Code で MCP サーバー `codex` を承認する（承認は追跡しない `.claude/settings.local.json` に入る）。`codex` を入れていて未信頼のあいだは、入力が止まり、理由に手順が出る。`codex` が無い環境（クラウドセッションなど）では、Claude Code だけで作業する。

### 1.1 作業ブランチの worktree と新しい clone

Git 管理外のファイル（`node_modules`・`src/client/`・`wrangler.jsonc`・`.dev.vars`）は含まれない。上の 1〜3 を行う。`wrangler.jsonc` は作業元からコピーせず、`npm run setup:local` で作る。

配備の設定（`scripts/config/render-deploy-config.mjs`）だけが環境変数 `BRW_PLUGIN_DIR` を使う。手元の開発・テストでは不要。

## 2. 日常の開発

### 2.1 起動・ビルド

| コマンド            | 内容                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev`       | 生成と設定を整えてから Astro の開発サーバーを起動する（`https://localhost:4321`）    |
| `npm run dev:build` | 本番と同じビルドを行い、`wrangler dev` で Worker として動かす（Cron は動かない）     |
| `npm run build`     | 本番向けのビルド（`dist/`）。運営者情報が未設定ならここで失敗する                    |
| `npm run prev`      | ビルドしてから `wrangler preview` で作業ブランチ用の Preview を出す                  |
| `npm run deploy`    | 手元から配備する。通常の配備は CI が行うため、運用者の明示的な依頼があるときだけ使う |

`npm run dev` と `npm run build` は、先頭で `build:prepare`（`codegen`・`survey:render`・`format`）を実行する。`format` は `prettier --write .` のため、作業ツリー全体を整形する。

> 注意: `npm run dev` と `npm run build` は、`build:prepare` の `format` で repo 全体に prettier を掛ける。無関係なファイルが整形されることがあるため、コミット前に `git status` で差分を確認し、戻すものは `git checkout -- <パス>` で戻す。

### 2.2 テストと型検査

| コマンド                 | 内容                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| `npm run test:type`      | 型検査（`tsc --noEmit`）                                           |
| `npm run test:unit`      | 単体テスト（`tests/unit/`。`scripts/` のスクリプトのテストを含む） |
| `npm run test:component` | 部品のテスト（`tests/component/`）                                 |
| `npm run test:route`     | API のルートのテスト（`tests/route/`）                             |
| `npm run test:render`    | 画面の描画のテスト（`tests/render/`）                              |
| `npm run test:lexicon`   | 独自 lexicon の検査（`goat` が必要。`lexicons/README.md` を参照）  |
| `npm run test:e2e`       | E2E（後述の「E2E」）                                               |
| `npm run test:all`       | 上のすべて（`npm test` と同じ。push 前の hook と CI が使う）       |
| `npm run test:mutation`  | 変異テスト（Stryker）                                              |
| `npm run test:watch`     | Vitest の監視モード                                                |

完了の確かめ方: `npm run test:all` が終了コード 0 で終わること。

### 2.3 push 前の検査

`.githooks/pre-push` は `npm run test:all`（全層のテスト。E2E を含む）だけを実行する。GitHub の Variables・Secrets への登録は push では行わない（登録は手動。「5.0 デプロイ前の準備」）。

## 3. 設定と生成物

### 3.1 どこに何があるか

| 場所                        | 内容                                                                           | 管理                                               |
| --------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| `config/<名前>.json`        | 公開してよい設定（運営者の名前・接続先・日付）。`develop`・`e2e`・`production` | Git 管理外（例 `config/*.example.json` を追跡）    |
| `.dev.vars`                 | 秘密情報だけ。ローカルの鍵と、GitHub へ登録する値                              | Git 管理外（`config/.dev.vars.template` から作る） |
| `wrangler.jsonc`            | Worker の設定                                                                  | 生成物。`npm run setup:local` 等が上書きする       |
| `public/surveys/index.json` | アンケートの配信用の設定                                                       | 生成物（`npm run survey:render`）                  |
| `src/client/`               | API クライアント（OpenAPI 文書から生成）                                       | 生成物（`npm run codegen`）                        |

- 設定の生成（`config/<名前>.json` → `wrangler.jsonc`）は `scripts/config/render-wrangler.mjs` が行う。生成の入口は `renderWranglerFile`（同じプロセスで呼べる）。
- 秘密の準備（`.dev.vars` の空の値を埋める）は `scripts/secrets/prepare-local-env.mjs`、GitHub と Worker への登録は `scripts/secrets/sync-github-variables.mjs` と `scripts/secrets/ensure-worker-secrets.mjs` が行う。
- 自動化に使う資材は `scripts/` に置く（npm スクリプト・CI・hooks・設定ファイルから呼ばれるもの）。`scripts/` の領域は `agent`・`config`・`secrets`・`survey`（アンケートの設定の生成）・`e2e`・`dev`・`build`・`git`・`lib`。
- `hack/` は手作業のための便利ツール置き場。無くても自動化は動く。現在は `hack/survey-cli/`（`npm run survey`。アンケートの登録・状態確認・除去の CLI）だけ。

### 3.2 アンケート（ログイン時）

アンケートの質問・選択肢・文言・期間は、コードに持たず、変数 `SURVEY_CONFIG`（JSON 文字列）で渡す。設定の構造と規則は `.kiro/specs/surveys/` を参照する。

- `npm run survey:render` が `SURVEY_CONFIG` を検証して `public/surveys/index.json` を作る。未設定なら作らず、以前の生成物を消す。不正な値なら、不正な項目の位置だけを示して失敗する（値は表示しない）。
- ビルドは、設定があるとき `PUBLIC_SURVEY_CONFIG_PRESENT` を `"true"` にして埋め込む（`astro.config.mjs`）。偽のときは設定を取得しない。
- 手元で試す:

  ```sh
  SURVEY_CONFIG="$(cat my-survey.json)" npm run dev
  # 設定なしで確認する: 変数を渡さず public/surveys/ を消して起動する
  rm -rf public/surveys && npm run dev
  ```

- 本番・develop・プレビューのビルドにだけ、リポジトリ変数 `SURVEY_CONFIG` を渡す（検証と E2E のジョブには渡さない）。
- アンケートの登録・状態確認・期限切れの除去は専用 CLI だけで行う: `npm run survey -- status`・`npm run survey -- add --file <一時ファイル> [--dry-run]`・`npm run survey -- prune [--dry-run]`。手順は `.claude/skills/survey-run/SKILL.md`（Codex は `.agents/skills/survey-run/`）。

## 4. 品質

### 4.1 E2E（Playwright）

```sh
npm run test:e2e                      # scripts/e2e/run-e2e.mjs: 開発サーバーの起動 → Playwright → 後始末
npm run test:e2e -- --project=firefox # 引数は Playwright に渡す
```

- 実行の流れは `scripts/e2e/run-e2e.mjs` が担う。検証用の偽の Bluesky（`scripts/e2e/survey-e2e-harness.mjs`）とアンケートの設定を用意し、`astro dev --background` を起動して、終了後に自分が起動したサーバーだけを止める。既に起動している開発サーバーは使い、止めない。
- プロジェクト: `chromium`・`firefox`・`webkit`・`webkit-iphone`（`config/test/playwright.config.ts`）。ブラウザは初回に入れる。

  ```sh
  npx playwright install chromium firefox webkit
  sudo npx playwright install-deps firefox webkit # OS の依存パッケージ（任意）
  ```

- ヘッドレスブラウザで日本語や絵文字を表示するには、フォントが要る（例: `sudo apt-get install fonts-noto-cjk fonts-noto-color-emoji`）。
- CI（`.github/workflows/e2e.yaml`）は、`npm run codegen` の後に `npm run test:e2e` を実行する。PR の必須ゲートで、`deploy.yaml` からも呼ばれる。

### 4.2 実アカウントのテスト（live・任意）

実 Bluesky（PDS）との契約（セッションの作成、ハンドルの解決、プロフィールの取得）を、検証用アカウントで確かめる。**開発者がローカルで任意に実行する。CI・pre-push・`npm run test:all` には含めない。** 読み取り専用で、投稿などは作らない。

1. 検証専用のアカウントを用意する（本番のアカウントは使わない）。
2. 非秘密の値を `config/live.json` に書く（雛形は `config/live.example.json`。`identifier` がハンドル、`service` は省略可）。
3. アプリパスワードを `.dev.vars` の `SKYSHARE_E2E_APP_PASSWORD` に書く（雛形は `config/.dev.vars.template`）。`.env` 系のファイルは使わない。
4. 実行する。

```sh
npm run test:live
```

設定が無いとき、テストは全てスキップされ（理由を表示）、終了コードは 0 になる。

### 4.3 多言語対応（i18n）

表示言語は日本語（`ja`）と英語（`en`）。設定画面の「表示言語」で選ぶ。選択は localStorage の `uiLocale` に保存され、未選択時はブラウザの言語（`navigator.languages`）を使い、一致しなければ日本語になる。仕様は `.kiro/specs/i18n/`。

辞書は `src/lib/i18n/messages/{ja,en}/<ドメイン>.ts`。型検査（`npm run test:type`）が、英語辞書の欠落とパラメータの過不足を検出する。

1. 辞書に同じキーで追加する（キーは `<ドメイン>.<要素><用途>`、例 `post.composer.submit`。値は `{name}` でパラメータを持てる）。
2. 使う:
   - React: `const { t } = useT()`（`@/components/i18n/useTranslation`）→ `t("post.composer.submit")`
   - `.astro`: `const { t } = createTranslator(Astro.locals.locale)`（`@/lib/i18n/translate`）。SSG のページは文言をクライアントで書き換えるため、`data-i18n="キー"`・`data-i18n-aria-label="キー"` を付ける。ページタイトルは `Baselayout` の `pageTitleKey` に渡す。
3. 日時・数値は `useFormat()`（React）か `formatDateTime`・`formatNumber`（`@/lib/i18n/format`）を使い、ロケールを固定しない。
4. 件数で変わる文言は、日本語に `<キー>_other`、英語に `<キー>_one` と `<キー>_other` を定義し、`tn("<キー>", count)` で呼ぶ。
5. 文中にアイコンやリンクを入れるときは、辞書に `{icon}` のスロットを書き、`renderSlots`（`@/components/i18n/renderSlots`）で描画する。
6. 表示後に言語を切り替えても追従させる文言は、翻訳済みの文字列ではなく文言キー（`PlainMessageKey`）か `deferMessage(key)` を state に持つ。
7. APIは利用者向けの文言を返さない（`errorResponseFromStatus` の固定文字列）。画面の文言は `errorMessageKeyFromStatus`（`@/lib/i18n/errorMessage`）で選ぶ。

言語を追加するには、`LOCALES`（`src/lib/i18n/locale.ts`）と `intlLocale`（`translate.ts`・`format.ts`）に加え、日本語と同じキー集合の辞書を `messages/<言語>/` に作り、複数形のカテゴリ（`Intl.PluralRules`）を用意し、`LocaleSelect` に選択肢を足す。

## 5. 運用（CI/CD・リリース）

### 5.0 デプロイ前の準備（手動の登録）

配備（`release/**`・`develop` への push、手動実行の deploy）の前に、運用者が GitHub の Variables・Secrets を手元の値に合わせる。push では自動で登録されないため、この手順を省くと古い値で配備される。

```sh
npm run sync:github -- --dry-run   # 登録する名前だけを表示する（値は表示しない）
npm run sync:github                # GitHub の Variables・Secrets に登録する（値が変わったものだけ）
gh variable list -R <owner>/<repo> # 登録できたか確認する
```

- `config/production.json` と `.dev.vars` の値を登録する。値の無い Secret は登録しない（既存の値は消えない）。
- 書き込み権限が無いときは、登録はスキップされる（エラーにはならない）。

- プライバシーポリシーの制定日・改定日（`PUBLIC_PRIVACY_ENACTED_AT`・`PUBLIC_PRIVACY_REVISED_AT`）は、main へのリリース時に同じ日付で登録する。公開前の本文の変更は改定として扱わない。公開後に本文を変えたら、改定日だけを更新する。

### 5.1 ブランチと配備

| ブランチ     | 配備先の Worker                         | ドメイン                   | 用途                                   |
| ------------ | --------------------------------------- | -------------------------- | -------------------------------------- |
| `release/**` | `skyshare`（本番）                      | `<SITE_HOST>`              | 本番。ブランチ別のプレビューは作らない |
| `develop`    | `skyshare-develop`                      | `develop.<SITE_HOST>`      | Cron を含む確認用の環境                |
| `dev/**`     | `skyshare-develop` の Preview（`XXXX`） | `XXXX.develop.<SITE_HOST>` | ブランチごとの確認（Cron は動かない）  |
| `main`       | 配備しない                              | —                          | 公開の基準。直接の作業をしない         |

- `release/**` と `develop` への push で `.github/workflows/deploy.yaml` が起動し、テスト・型検査・E2E を通った場合だけ配備する。手動実行（Actions → deploy → Run workflow）は既定で `dry_run`（ビルドと `wrangler deploy --dry-run` のみ）になる。
- `dev/**` への push で `.github/workflows/preview.yaml` が develop 用の Worker の Preview を作る（`wrangler preview`。XXXX は 46 文字以内。develop が一度配備済みであること）。同じブランチへ再 push しても URL は変わらない。
- `release/**` はすべて同じ本番の Worker・D1・R2 に配備するため、配備は直列化している。古いリリースへの再 push で本番を巻き戻さないよう、新しい名前でリリースを切る。本番へのリリースは明示的な依頼に基づいて行う。
- `wrangler preview` では Cron が動かない。予約の自動投稿は develop 環境（`https://develop.<SITE_HOST>`）で確認する。D1・R2 は本番と別なので、本番の予約には触れない。

### 5.2 CI の流れ（deploy.yaml）

1. `scripts/agent/setup-brw.mjs` で BRW を取得し、`BRW_PLUGIN_DIR` を設定する。
2. `scripts/config/render-deploy-config.mjs`（`--develop` は develop 用）が、GitHub の Variables から `config/production.json`・`wrangler.jsonc`・`_legacy/frontend/.env.production` を作る。必須の値が無ければ異常終了する（誤配備の防止）。
3. D1 のマイグレーション（`migrations/`）を、その D1 に適用する。プレビューは develop の D1 を使うため、スキーマを変えるブランチは develop へ取り込んでから確認する。
4. `scripts/secrets/ensure-worker-secrets.mjs` が、未登録の Worker のシークレットだけを生成して登録する（6.4）。
5. ビルドと配備。

ローカルでマイグレーションを試すには `npx wrangler d1 migrations apply DB --local` を実行する（`.dev.vars` の鍵は `npm run setup:local` が作る）。未リリースのため、最終の構造は `migrations/0001_initial.sql` に統合している。本番の D1 は未作成で、初回の `release/*` は空の DB へ `0001_initial.sql` を適用する。過去の分割マイグレーションを適用した DB は、新規 DB に作り直してから適用する。

### 5.3 ブランチ宣言と BRW（branch-release-workflow）

- 導入は Claude Code だけが対象で、セッションの開始時に自動で行う（1 の 4）。`.claude/settings.json` の宣言（`extraKnownMarketplaces` の `nekono-dev`、`enabledPlugins` の `branch-release-workflow@nekono-dev`）に従い、無いものだけをプロジェクトのスコープで導入する。端末に BRW の clone は置かない。既存の登録やプラグインを外す操作はしない。
- 宣言の正本は `.branch-release-workflow.json`（リポジトリのルート）。`.claude/branch-release-workflow.json` は正本へのシンボリックリンク（旧パスを読む利用者向け）。内容を二重に持たない。
- 取得元は `.branch-release-workflow-source.json`（`repository`・`branch`）。CI は `node scripts/agent/setup-brw.mjs`（引数なし）で同じブランチの最新コミットを取得し、clone のパスを得る。
- 共有 skill を更新したら、取得元（`nekono-dev/claude-plugins`）へ反映する。次のセッションの開始時に、プラグインの更新が試される。
- 作業ブランチの作成・続き・片付けは skill `branch-release-workflow` に従う（作業ブランチへの push は許可を求めない。worktree はマージか PR の後に片付ける）。

- worktree は push では片付けず、`develop` へのマージ後（または `main` への PR 作成後）に `brw finish` で片付ける。

### 5.4 main への取り込み前のアンケート除去

main へのマージまたは取り込み（PR の作成を含む）を依頼されたら、マージ前にローカルで `npm run survey -- prune` を実行し、結果の 1 行を報告する（手順は `.claude/skills/survey-run/SKILL.md`）。

本番のビルドは `SURVEY_CONFIG` を読むため、除去で変数が更新された場合は、その更新が本番の配備より先に反映されるようにする。除去と回答データの確認には運営者のローカル認証済みの CLI を使う。CI に変数の書き込み権限は与えない。除去に失敗したとき、または対象を確認できず保持したときは、その結果を利用者に伝える。

### 5.5 本番の CPU 時間・エラーの確認

Cloudflare API で、Worker の CPU 超過とエラーを取得できる。トークンは読み取り専用のものを、ローカルの環境変数ファイルに置く（値はコミットしない）。

- GraphQL `workersInvocationsAdaptive`（`scriptName` は `skyshare`）で、日別・時間別の status と `quantiles.cpuTime*`（µs）が取れる。CPU 超過は status が `exceededResources`。
- Observability の `POST /accounts/{account_id}/workers/observability/telemetry/query` で、`$workers.outcome`（exceededCpu・ok・canceled）と `$workers.cpuTimeMs` をルート別に集計できる。
- 本番やプレビューへの連続リクエストは負荷になる。実行は利用者に依頼する。

## 6. 初回の設定（運用者）

フォークして動かす場合も、この順で行う。値は運営者ごとに違うため、コードには書かない。

### 6.1 Cloudflare と GitHub の準備

1. Cloudflare に、公開するドメインのゾーンを追加する。
2. Cloudflare の API トークンを作る（テンプレート「Edit Cloudflare Workers」に、アカウントの「D1 編集」を加える。D1 を名前で探すことと、マイグレーションに使う）。
3. `gh` を入れてログインし、確かめる。

   ```sh
   gh auth login # GitHub.com → HTTPS → ブラウザで認証
   gh auth status
   ```

### 6.2 運営者の値（GitHub の Variables）

```sh
cp config/production.example.json config/production.json
$EDITOR config/production.json
```

編集の後、「5.0 デプロイ前の準備」の手順（`--dry-run` で名前を確かめる → 登録 → `gh variable list` で確認）で GitHub の Variables に登録する。

- `siteHost` は変数 `SITE_HOST` に、`vars` の各項目は同名の変数になる。空の値は登録しない。
- GitHub のリポジトリは git の remote の origin から判定する（SSH の別名でもよい）。判定できないときは `-- --repo <owner>/<repo>` を付ける。
- 登録されているが `config/production.json` に無い変数は警告だけ出し、削除しない。`SURVEY_CONFIG` は `npm run survey` が管理するため対象外。
- 書き込み権限が無い人（コントリビュータ）は、登録をスキップする（エラーにはならない）。

| 名前                             | 必須 | 内容                                                                             |
| -------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `SITE_HOST`                      | 必須 | 公開するドメイン（例: `skyshare.example.com`）。develop は `develop.<SITE_HOST>` |
| `PUBLIC_LEGACY_BACKEND_ENDPOINT` | 必須 | _legacy 版 backend のエンドポイント                                              |
| `PUBLIC_DEFAULT_ATP_SERVICE`     | 必須 | ATP サービスの URL                                                               |
| `PUBLIC_NODE_ENV`                | 必須 | `production`（Cookie に Secure 属性を付ける）                                    |
| `PUBLIC_OGP_EXTRACTOR_API`       | 必須 | OGP Extractor の URL                                                             |
| `PUBLIC_PLC_DIRECTORY_BASE_URL`  | 必須 | PLC ディレクトリサービスの URL                                                   |
| `PUBLIC_OPERATOR_NAME`           | 必須 | 運営者の名称（個人なら活動名でよい）。プライバシーポリシーに載る                 |
| `PUBLIC_OPERATOR_EMAIL`          | 必須 | 個人情報の問い合わせ窓口のメールアドレス                                         |
| `PUBLIC_OPERATOR_BLUESKY_HANDLE` | 任意 | 窓口の Bluesky ハンドル（`@` なし）                                              |
| `PUBLIC_PRIVACY_ENACTED_AT`      | 必須 | プライバシーポリシーの制定日（`YYYY-MM-DD`）                                     |
| `PUBLIC_PRIVACY_REVISED_AT`      | 必須 | 最終改定日（`YYYY-MM-DD`）。本文を改定したら更新する                             |
| `PUBLIC_GA_MEASUREMENT_ID`       | 任意 | Google アナリティクスの測定 ID（`G-XXXX`）。未登録ならタグを出さない             |
| `SURVEY_CONFIG`                  | 任意 | アンケートの JSON（3.2）。`npm run survey` が管理する                            |

Worker・D1・R2 の名前は固定（6.5）。D1 は `database_id` を書かず名前で解決する。プライバシーポリシーの本文（`src/lib/i18n/messages/*/privacy.ts`）は実装に合わせて書いてあるため、実装を変えたら本文も見直す。lexicon の NSID（`dev.nekono.skyshare.*`）は、運用者が違っても Entry を相互に読めるよう変えない。

### 6.3 Secrets（CI が配備に使う）

1. `.dev.vars` に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を書く（`config/.dev.vars.template` の項目）。
2. `npm run sync:github` が、値のある名前を GitHub の Secrets へ登録する。値の無い名前は登録しない。GitHub の Secrets に既にある値は消えない。

### 6.4 Worker のシークレット（自動）

予約の暗号鍵 `SCHEDULE_ENC_KEY`・OAuth の署名鍵 `OAUTH_CLIENT_KEY`・アンケートの鍵 `SURVEY_HASH_KEY` は手で登録しない。`scripts/secrets/ensure-worker-secrets.mjs` が、本番・develop の配備の後と、プレビューの配備の前に、未登録のものだけを生成して登録する。登録済みの値は上書きしない（値は読み出せないため、確かめられるのは名前の有無だけ）。

- develop とプレビューの基本設定は同じ値にそろえる（D1 を共用するため）。本番は別の値になる。
- 既にあるプレビューは、作られた時点の基本設定のシークレットを持ち続ける。必要なシークレットが欠けたプレビューは、preview.yaml が配備の前に削除し、同じ URL で作り直す。
- 片方にだけ登録済みのときの扱い:
  - `OAUTH_CLIENT_KEY`: 作り直して両方へ登録する（古い鍵で得た予約の許可は、利用者が許可し直す）。
  - `SCHEDULE_ENC_KEY`・`SURVEY_HASH_KEY`: 作り直すと保管済みの認証情報の復号や回答済みの記録の照合が壊れるため、CI は登録せずに失敗する。手で両方を同じ値にそろえる:

    ```sh
    openssl rand -base64 32 > key.txt
    npx wrangler secret put SCHEDULE_ENC_KEY --name skyshare-develop < key.txt
    npx wrangler preview base-config secret put SCHEDULE_ENC_KEY --worker-name skyshare-develop < key.txt
    rm key.txt
    ```

    `SURVEY_HASH_KEY` も同じ手順で名前を替える。
- 鍵を替えたいときは、配信先からシークレットを削除して配備し直す（`npx wrangler secret delete <名前> --name <Worker 名>`。develop ではプレビューの基本設定からも消す）。

### 6.5 D1・R2（予約投稿）

予約投稿は D1・R2・Cron Trigger を使う（無料枠の範囲）。初回の配備の前に、本番用と develop 用を作る。プレビューは develop 用を共用する。

```sh
npx wrangler d1 create skyshare # database_id の登録は不要（名前で解決する）
npx wrangler d1 create skyshare-develop
for b in skyshare-schedule-images skyshare-schedule-images-develop; do
  npx wrangler r2 bucket create "$b"
  npx wrangler r2 bucket lifecycle add "$b" expire-15d --expire-days 15 -y # 削除漏れの画像を自動で消す（予約は14日後まで）
done
```

| Worker             | ドメイン              | D1・R2                                                 |
| ------------------ | --------------------- | ------------------------------------------------------ |
| `skyshare`         | `<SITE_HOST>`         | `skyshare`・`skyshare-schedule-images`                 |
| `skyshare-develop` | `develop.<SITE_HOST>` | `skyshare-develop`・`skyshare-schedule-images-develop` |

### 6.6 OAuth（予約と Bluesky ログイン）

- ログインと予約の許可は、同じ Bluesky の OAuth クライアントで得る。クライアントのメタデータは `/oauth/client-metadata.json`（client_id）と `/oauth/jwks.json`（公開鍵）で公開し、戻り先は `/oauth/callback/`。Bluesky の認可サーバーがこれらを取りに来るため、本番とプレビューには公開された https の配信元が要る。
- シークレットの名前は `OAUTH_CLIENT_KEY`。鍵を替えると `kid` が変わり、古い鍵で得た認可は更新できなくなるため、利用者は設定で許可し直す。
- OAuth でログインできるのは、Bluesky がホスティングするアカウント（bsky.social など）だけ。それ以外のアカウントと、旧形式の投稿の削除は、アプリパスワードでログインする。
- ローカル（`npm run dev`）では、配信元がループバック（`localhost`）のため、開発用の公開クライアント（`http://localhost?...`）として振る舞い、秘密鍵を使わない。戻り先は `http://127.0.0.1:4322/oauth/callback/` に限られるため、`scripts/dev/oauth-loopback-forwarder.ts` が `127.0.0.1:4322` で受けて `https://localhost:4321` へ転送する。ブラウザでは `https://localhost:4321` を開く（cookie がホストごとのため）。

### 6.7 不具合の報告・機能の提案（GitHub Issue）

設定のページの「不具合の報告・新機能の提案」（`/feedback/`）は、送られた内容を公開の Issue として登録する。登録先は、ビルド時の `GITHUB_REPOSITORY`（手元では `git remote get-url origin`）で決まる。

1. GitHub の Settings → Developer settings → Fine-grained personal access tokens で、トークンを作る。Repository access は登録先のリポジトリだけ、Permissions は **Issues: Read and write** だけにする。
2. 登録先のリポジトリに、ラベル `bug` と `enhancement` があることを確かめる（GitHub の既定のラベル）。
3. トークンを `.dev.vars` の `FEEDBACK_GITHUB_TOKEN` に書き、`npm run sync:github -- --worker` で本番・develop・プレビューの Worker に登録する（`--worker` を付けたときだけ登録する）。

未登録の間は、送信すると「受け付けを停止しています」と表示される。送信の回数は Rate Limiting（`config/wrangler.template.jsonc` の `ratelimits`）で、アカウントごとに 60 秒に 1 件。トークンには期限があり、切れると送信が失敗するため、新しいトークンで上の 3 つをやり直す。ローカルで試すと実際に Issue が作られるため、試験用のリポジトリで試す。

### 6.8 初回の配備

1. `release/XXX` を作って push し本番へ、`develop` に push して develop 環境へ配備する（Actions → deploy → Run workflow で `dry_run` を外して実行してもよい）。
2. develop を 1 回配備した後に 6.7 の登録を行う。以降、`dev/XXXX` への push でプレビューが作られる。

### 6.9 push では登録しない（決定 2026-10-31）

`.githooks/pre-push` はテストだけを実行する。GitHub の Variables・Secrets への登録は、運用者が `npm run sync:github` を手動で実行する（「5.0 デプロイ前の準備」）。
