# 開発者ガイド

## デプロイ環境

Skyshare v2 は Cloudflare Worker上で動作します。
v1と異なり、他サービスとの依存関係はありませんが、v1の機能を使う場合はv1のバックエンド、および設定値が必要です。

## 準備

1. `wrangler.jsonc` を作る。下の「運用者ごとの設定」と次の `PUBLIC_*` を環境変数に設定し、`node hack/render-deploy-config.mjs` を実行する（`wrangler.template.jsonc` の値が置き換わる）。

```json
  "vars": {
    "PUBLIC_LEGACY_BACKEND_ENDPOINT": "_legacy版UIを動作させていた場合、_legacy版backendのエンドポイントを入力",
    "PUBLIC_DEFAULT_ATP_SERVICE": "ATPサービスを入力",
    "PUBLIC_NODE_ENV": "develop or production　v2.0.X時点ではCookieにSecure属性をつけるかのフラグ",
    "PUBLIC_OGP_EXTRACTOR_API": "OGP ExtractorのURLを入力、APIのパスに/v1/extractを含まない場合、src/lib/api/schema/v1/extract/get.tsでパスを修正すること",
    "PUBLIC_PLC_DIRECTORY_BASE_URL": "PLCディレクトリサービスのURL",
  },
```

# 実行方法

## ビルド方法

ローカル実行の設定は、置き場所ごとに雛形を用意している（`.env` と `.dev.vars` は Git 管理対象外）。

- `.env`（`.env.template`）: ビルド時に使う `PUBLIC_*`（接続先・運営者情報など）。未設定でもダミー値で動く。
- `.dev.vars`（`.dev.vars.template`）: Worker のランタイム設定（`PUBLIC_NODE_ENV`・`SCHEDULE_ENC_KEY` など）。wrangler は `.dev.vars` がある間 `.env` を読まない。`npm run dev` の準備（`npm run setup:local`）が、無ければ雛形から作り、予約投稿の鍵（`SCHEDULE_ENC_KEY`・`SCHEDULE_OAUTH_KEY`）が未設定ならランダムに生成して書き込む（設定済みの値は上書きしない）。

```sh
cp .env.template .env
## astroによる簡易サーバ起動
npm run dev
## wranglerを用いた動作確認
npm run dev:build
## Cloudflare用のコード生成
npm run build
```

## バージョンのリリース操作

```sh
npm run deploy
```

## CI/CD（GitHub Actions）

`main` と `develop` への push で `.github/workflows/deploy.yaml` が起動し、テスト・型検査・E2E を通過した場合のみ Cloudflare Workers へデプロイする。

| ブランチ   | Worker                                  | ドメイン                   | D1・R2                                                          | 用途                                   |
| ---------- | --------------------------------------- | -------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| `main`     | `skyshare`                              | `<SITE_HOST>`              | `skyshare-schedule`・`skyshare-schedule-images`                 | 本番。ブランチ別のプレビューは作らない |
| `develop`  | `skyshare-develop`                      | `develop.<SITE_HOST>`      | `skyshare-schedule-develop`・`skyshare-schedule-images-develop` | Cron を含む確認用の環境                |
| `dev/XXXX` | `skyshare-develop` の Preview（`XXXX`） | `XXXX.develop.<SITE_HOST>` | develop と共用                                                  | ブランチごとの確認（Cron は動かない）  |

- develop 用の設定は `node hack/render-deploy-config.mjs --develop` が作る。Worker と、テンプレートにある D1・R2 の名前の末尾に `-develop` を付ける。プレビューの D1 は、D1 の一覧から名前で ID を引いて入れる（CI の API トークンに D1 の権限が要る）。
- 手動実行で `main`・`develop` 以外のブランチを選んでも、配備はしない。

`wrangler.jsonc` と `_legacy/frontend/.env.production` は `.gitignore` 対象のため、CI では `hack/render-deploy-config.mjs` が GitHub の Variables から生成する。

| 種別     | 名前                             | 内容                                                                                                                      |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`           | Workers のデプロイ権限を持つ API トークン                                                                                 |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`          | Cloudflare のアカウントID                                                                                                 |
| Secret   | `SPEC_LINT_TOKEN`                | 仕様書の検査コマンド `spec-lint`（GitHub Packages）の取得用。`read:packages` 権限のトークン。Actions の Secret に登録する |
| Variable | `PUBLIC_LEGACY_BACKEND_ENDPOINT` | _legacy版backendのエンドポイント                                                                                          |
| Variable | `PUBLIC_DEFAULT_ATP_SERVICE`     | ATPサービスのURL                                                                                                          |
| Variable | `PUBLIC_NODE_ENV`                | `production`（Cookieに Secure 属性を付ける）                                                                              |
| Variable | `PUBLIC_OGP_EXTRACTOR_API`       | OGP ExtractorのURL                                                                                                        |
| Variable | `PUBLIC_PLC_DIRECTORY_BASE_URL`  | PLCディレクトリサービスのURL                                                                                              |

このほか、下の「運用者ごとの設定」の Variables を登録する。

手動実行（Actions → deploy → Run workflow）では、既定で `dry_run` が有効になり、ビルドと `wrangler deploy --dry-run` のみ行って公開しない。

### 運用者ごとの設定

Skyshare は OSS のため、運用者ごとに変わる値はコードに書かず、GitHub の Variables（手元では環境変数）で渡す。別の運用者は、フォークして次の値を登録すれば同じコードを配備できる。必須の値が欠けると、`npm run build`（運営者情報）と `hack/render-deploy-config.mjs`（配備先）が異常終了する。開発時（`astro dev`・単体テスト）は、運営者情報が未設定でもダミー値で動く。

配備先（`hack/render-deploy-config.mjs` が `wrangler.template.jsonc` の `SITE_HOST` を置き換える）:

| 名前        | 必須 | 内容                                                                                                                               |
| ----------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_HOST` | 必須 | 公開するドメイン（例: `skyshare.example.com`）。develop は `develop.<SITE_HOST>`、プレビューは `<名前>.develop.<SITE_HOST>` になる |

Worker・D1・R2 の名前は上の表のとおり固定である。名前は Cloudflare のアカウントごとなので、運用者が違っても衝突しない。D1 は `database_id` を書かず名前で解決する（`wrangler deploy` が同じ名前の D1 を探してつなぐ。CI の API トークンに D1 の権限が要る）。独自ドメインのゾーンは、ドメインから自動で決まる。

運営者情報とアクセス解析（ビルド時に埋め込む。プライバシーポリシーと GA タグに使う。`src/lib/site/siteConfig.ts`）:

| 名前                             | 必須 | 内容                                                                                       |
| -------------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| `PUBLIC_OPERATOR_NAME`           | 必須 | 運営者の名称（個人なら活動名でよい。氏名と住所は請求に応じて回答する旨がポリシーに載る）   |
| `PUBLIC_OPERATOR_EMAIL`          | 必須 | 個人情報の問い合わせ・苦情の窓口のメールアドレス                                           |
| `PUBLIC_OPERATOR_BLUESKY_HANDLE` | 任意 | 窓口の Bluesky ハンドル（`@` なし）。未登録なら窓口はメールだけ                            |
| `PUBLIC_PRIVACY_ENACTED_AT`      | 必須 | プライバシーポリシーの制定日（`YYYY-MM-DD`）                                               |
| `PUBLIC_PRIVACY_REVISED_AT`      | 必須 | プライバシーポリシーの最終改定日（`YYYY-MM-DD`）。本文を改定したら更新する                 |
| `PUBLIC_GA_MEASUREMENT_ID`       | 任意 | Google アナリティクスの測定 ID（`G-XXXX`）。未登録ならタグを出さず、ポリシーにも記載しない |

プライバシーポリシーの本文（`src/lib/i18n/messages/*/privacy.ts`）は、このリポジトリの実装（Cloudflare での配信と保管、予約投稿の保存期間など）に合わせて書いてある。実装を変えて運用する場合は、本文も見直すこと。lexicon の NSID（`dev.nekono.skyshare.*`）は、運用者が違っても Entry を相互に読めるよう、変えない。

### フォークして動かす

フォークした自分のリポジトリと Cloudflare のアカウントで動かす手順。GitHub への登録は `gh` コマンドで行う。

1. Cloudflare に、公開するドメインのゾーンを追加しておく。
2. Cloudflare の API トークンを作る。テンプレート「Edit Cloudflare Workers」を使い、権限にアカウントの「D1 編集」を加える（D1 を名前で探すことと、マイグレーションに使う）。
3. 下の「予約投稿の初期設定」で、D1・R2・暗号鍵を用意する。
4. `gh` を入れてログインする。

```sh
gh auth login  # GitHub.com → HTTPS → ブラウザで認証
gh auth status # ログインできたか確認する
```

5. 配備に使う設定値を `deploy.env` に書き、GitHub の Variables・Secrets と Worker のシークレットへまとめて登録する（`deploy.env` は `.gitignore` 対象。認証情報もここに置いて管理する）。

```sh
cp deploy.env.template deploy.env
$EDITOR deploy.env
npm run deploy:env -- --dry-run  # 登録先と変数名だけを表示する（値は表示しない）
npm run deploy:env               # gh と wrangler で登録する
gh variable list -R <owner>/<repo>  # 登録できたか確認する
```

| 区分                          | 登録先                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `[github.variables]`          | Actions の Variables（`gh variable set`）                                                                |
| `[github.secrets]`            | Actions の Secrets（`gh secret set`）。Cloudflare の認証は wrangler にも使う                             |
| `[worker.secrets]`            | 本番・develop・プレビューの Worker（`wrangler secret put` と `wrangler preview base-config secret put`） |
| `[worker.secrets.production]` | 本番の Worker                                                                                            |
| `[worker.secrets.develop]`    | develop の Worker とプレビュー                                                                           |

- 値が空の行は登録しない。登録済みの値をそのままにしたいもの（予約投稿の鍵など）は空にしておく。
- 値は標準入力で渡し、コマンドの引数や画面に出さない。値を `@<パス>` にするとファイルの中身を登録する（例: `E2E_ENV=@.env.e2e`）。
- GitHub のリポジトリは git の remote の origin から判定する（SSH の別名でもよい）。判定できないときは `-- --repo <owner>/<repo>` を付ける。
- Worker のシークレットの登録は、Worker が一度配備された後に行う（プレビューは develop の Worker の配備の後）。失敗した登録は、配備の後にもう一度実行すればよい。

7. `main` に push して本番へ、`develop` に push して develop 環境へ配備する（Actions → deploy → Run workflow で `dry_run` を外して実行してもよい）。
8. develop 環境を1回配備した後、もう一度 `npm run deploy:env` を実行して develop とプレビューのシークレットを登録する。以降、`dev/XXXX` への push でプレビューが作られる。

- 仕様書の検査（verify ジョブの `spec-lint`）は、GitHub Packages の `@nekono-dev/spec-lint` を Secret `SPEC_LINT_TOKEN` で取得する。取得できない場合は、`.github/workflows/deploy.yaml` の該当の手順を外す。

### 予約投稿の初期設定（初回のみ）

予約投稿は Cloudflare の D1・R2・Cron Trigger を使う（いずれも無料枠の範囲）。初回のデプロイの前に、次を行う。

本番用と develop 用の D1・R2 を作り、暗号鍵を登録する。dev/\* のプレビューは develop 用の D1・R2 を共用する。

```sh
npx wrangler d1 create skyshare-schedule # database_id の登録は不要（名前で解決する）
npx wrangler d1 create skyshare-schedule-develop
for b in skyshare-schedule-images skyshare-schedule-images-develop; do
  npx wrangler r2 bucket create "$b"
  npx wrangler r2 bucket lifecycle add "$b" expire-15d --expire-days 15 -y # 削除漏れの画像を自動で消す（予約は14日後までのため15日）
done
# 予約用の認証情報の暗号鍵。本番と develop は別の鍵でよい（D1 が別のため）
openssl rand -base64 32 | npx wrangler secret put SCHEDULE_ENC_KEY --name skyshare
# develop とそのプレビューは D1 を共用するため、同じ鍵にする（develop を1回配備した後に実行する）
openssl rand -base64 32 > enc.key
npx wrangler secret put SCHEDULE_ENC_KEY --name skyshare-develop < enc.key
npx wrangler preview base-config secret put SCHEDULE_ENC_KEY --worker-name skyshare-develop < enc.key
rm enc.key
# Bluesky の OAuth（confidential client）の署名鍵。develop とプレビューは同じ鍵にする
node hack/generate-oauth-key.mjs | npx wrangler secret put SCHEDULE_OAUTH_KEY --name skyshare
node hack/generate-oauth-key.mjs > oauth.key
npx wrangler secret put SCHEDULE_OAUTH_KEY --name skyshare-develop < oauth.key
npx wrangler preview base-config secret put SCHEDULE_OAUTH_KEY --worker-name skyshare-develop < oauth.key
rm oauth.key
```

- 予約の許可は Bluesky の OAuth で得る。クライアントの情報は配信元ごとに `/oauth/client-metadata.json`（client_id）と `/oauth/jwks.json`（公開鍵）で公開し、戻り先は `/oauth/callback/` とする（戻りでは cookie が届かないため、完了は設定のページから `/v2/schedules/credential/authorization/completion/` を呼ぶ）。Bluesky の認可サーバーがこれらを取りに来るため、公開された https の配信元でしか許可を得られない（ローカルでは試せない）。
- 許可を得た配信元の client_id は認可の情報と一緒に保管し、Cron の実行はそれでトークンを更新する。プレビューで許可した認可の情報は、そのプレビューが消えると更新できなくなる。
- 鍵を替えるときは `kid` が変わる。古い鍵で得た認可の情報は更新できなくなるため、利用者は設定で許可し直す。

- プレビューの D1 は、`hack/render-deploy-config.mjs --develop` が名前から ID を引いて設定に入れる（`wrangler preview` は `database_id` のない D1 を使えないため）。CI の API トークンに D1 の権限が要る。
- D1 のマイグレーション（`migrations/`）は、`main` と `develop` への配備のときに deploy.yaml が、それぞれの D1 に適用する。プレビューは develop の D1 を使うため、スキーマを変えるブランチは develop へ取り込んでから確認する。ローカルで試すときは `npx wrangler d1 migrations apply DB --local` を実行する（`.dev.vars` の鍵は `npm run dev` が自動で作る）。`migrations/0003_schedule_oauth.sql` は、アプリパスワード方式で登録された認証情報を削除する（利用者は設定で許可し直す）。`0004_schedule_reauth.sql` は、許可の時刻と再度の許可が必要な印の列を加える。

### 不具合の報告・新機能の提案の初期設定（初回のみ）

設定のページの「不具合の報告・新機能の提案」（`/feedback/`）は、送られた内容をソースコードのリポジトリの公開の Issue として登録する。登録先のリポジトリは、ビルドの時点の `GITHUB_REPOSITORY`（手元では `git remote get-url origin`）で決まるため、設定は要らない。GitHub の認証情報だけを Worker のシークレットに登録する。未登録の間は、送信すると「受け付けを停止しています」と表示される。

1. GitHub の Settings → Developer settings → Fine-grained personal access tokens で、トークンを作る。Repository access は登録先のリポジトリだけ、Permissions は Repository permissions の **Issues: Read and write** だけにする。Issue の作成者はトークンの持ち主になる。
2. 登録先のリポジトリに、ラベル `bug` と `enhancement` があることを確かめる（GitHub の既定のラベル）。
3. トークンを `deploy.env` の `[worker.secrets]` の `FEEDBACK_GITHUB_TOKEN` に書き、`npm run deploy:env` で本番・develop・プレビューの Worker に登録する。

- 送信の回数は、Cloudflare の Rate Limiting のバインディング（`wrangler.template.jsonc` の `ratelimits`）で、アカウントごとに60秒に1件に制限する。
- トークンには期限がある。期限が切れると送信が失敗するため、更新したら `deploy.env` を書き換えて `npm run deploy:env` を実行し直す。
- ローカルで試すときは `.dev.vars` に `FEEDBACK_GITHUB_TOKEN` を書く（実際に Issue が作られるため、試験用のリポジトリで試す）。

### E2E（e2e.yaml）

`.github/workflows/e2e.yaml` は deploy.yaml から呼び出され（手動実行も可）、単体テストの後に Playwright の全project（chromium・firefox・webkit・webkit-iphone、およびライブテスト）を実行する。verify と e2e の両方に成功した場合のみデプロイされる。

OS のパッケージ（フォント・ffmpeg・Playwright のブラウザが使うライブラリ）は、初回だけ Ubuntu のミラーから取得し、deb ファイルを Actions のキャッシュに保存して2回目以降はミラーを使わずに入れる（ミラーが遅い日にダウンロードだけでジョブの上限に達したため）。キャッシュはランナーのイメージ・Playwright の版・`e2e.yaml` が変わると作り直される。ブラウザ本体も Playwright の版ごとにキャッシュする。

| 種別     | 名前               | 内容                                                                                                |
| -------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| Secret   | `E2E_ENV`          | `.env.e2e` の中身（`KEY=value` 形式・複数行）をそのまま登録する。未登録ならライブテストを除いて実行 |
| Variable | deploy.yaml と共通 | 運用者ごとの設定を含む（astro dev の起動前に `wrangler.jsonc` を生成するため）                      |

同じ検証用アカウントを同時に操作しないよう、実行は直列化される。検証専用のアカウントとアプリパスワードを使うこと。

## PRブランチの動作確認（プレビュー）

ブランチ運用とプレビューは skill `branch-release-workflow` に従う（宣言は `.claude/branch-release-workflow.json`）。`dev/XXXX` へ push すると `.github/workflows/preview.yaml` が develop 用の Worker の `wrangler preview` を実行し、`https://XXXX.develop.<SITE_HOST>` で確認できる（XXXX は46文字以内。develop の Worker が一度配備済みであること）（同じブランチへ再 push しても URL は変わらない）。URL は `node .claude/skills/branch-release-workflow/scripts/brw.mjs url` でも確認できる。

手元から実行する場合は次のとおり（要 wrangler 4.135.0 以上）。

```sh
npm run prev
```

### develop 環境（Cron を含む確認）

`wrangler preview` では Cron Trigger が動かないため、予約の自動投稿は develop 環境（`https://develop.<SITE_HOST>`）で確認する。`develop` へのマージで deploy.yaml が配備する（`node hack/render-deploy-config.mjs --develop` が、Worker 名・ドメイン・D1・R2 を develop 用に差し替える）。D1・R2 は本番と別なので、本番の予約には触れない。

## 多言語対応（i18n）

表示言語は日本語（`ja`）と英語（`en`）に対応している。設定画面の「表示言語」で「システム設定に従う / 日本語 / English」を選べる。選択は localStorage の `uiLocale` に保存され、未選択時はブラウザの言語（`navigator.languages`）、一致しなければ日本語になる。サーバー描画（SSR）ページの初回HTMLは `Accept-Language` で決まり、保存済みの設定との差は初期描画後に切り替わる。SSG（`prerender = true`）のページはビルド時に日本語で出力し、クライアントで言語を確定して書き換える。

実装は外部ライブラリを使わない型付き辞書（`src/lib/i18n/`）で、設計は `specs/i18n-locale/` と `specs/i18n-messages/` にある。

### 文言の追加手順

1. 辞書に文言を追加する。日本語は `src/lib/i18n/messages/ja/<ドメイン>.ts`、英語は `src/lib/i18n/messages/en/<ドメイン>.ts` に、同じキーで追加する。キーは `<ドメイン>.<要素><用途>`（例: `post.composer.submit`）。値は `{name}` 形式でパラメータを持てる。
   - 英語辞書に日本語辞書と同じキーが無いと、`npx tsc --noEmit` が失敗する。
   - 呼び出し側が渡すパラメータの過不足も、型検査で検出される。
2. コンポーネントから使う。
   - React: `const { t } = useT()` → `t("post.composer.submit")`。`useT` は `@/lib/i18n/react`。
   - `.astro`: `const { t } = createTranslator(Astro.locals.locale)`（`@/lib/i18n/translate`）。SSG ページでは文言をクライアントで書き換えるため、要素に `data-i18n="キー"`（textContent）、`data-i18n-aria-label="キー"`（aria-label）を付ける。ページタイトルは `Baselayout` の `pageTitleKey` にキーを渡す。
   - React を使わない純粋関数が文言を返す場合は、翻訳関数または言語に依存しないキーを返す（`MessageFormatter`・`PlainMessageKey`）。
3. 日時・数値は `useFormat()`（React）または `formatDateTime`/`formatNumber`（`@/lib/i18n/format`）を使い、`toLocaleString("ja-JP")` のようにロケールを固定しない。

### 複数形

件数で単数・複数が変わる文言は、日本語に `<キー>_other`、英語に `<キー>_one` と `<キー>_other` を定義し、`tn("<キー>", count)` で呼ぶ（キーに `_one`/`_other` は付けない）。`count` は文言中の `{count}` にも自動で入る。

### 文中にアイコンやリンクを入れる文言

辞書の値に `{icon}` のようなスロットを書き、`renderSlots(raw("キー"), { icon: <InlineIcon /> })`（`@/lib/i18n/rich`）で描画する。語順が言語で変わっても同じコードで描画できる。

### 状態として保持するメッセージ

エラー表示など、表示後に言語を切り替えても追従させたい文言は、翻訳済みの文字列ではなく、文言キー（`PlainMessageKey`）か `deferMessage(key)` / `{ format }`（`DeferredMessage`）を state に保持し、描画時に `t()` / `format(translator)` で評価する。`useState` に関数を直接渡すと更新関数として実行されるため、`DeferredMessage` のようにオブジェクトで包む。

### APIエラー

APIは利用者向けのエラー文言を返さない。`{ error: "Conflict" }` のように、`errorResponseFromStatus` による言語非依存の固定文字列だけを返す。画面に出す文言は、クライアントが `errorMessageKeyFromStatus(status, context)`（`@/lib/i18n/errorMessage`）でステータスから選ぶ。

### 検証

- `npm run test:unit`: 辞書の整合（キー集合・複数形・プレースホルダ）と、文言の直書き検出（`tests/lib/i18n/noHardcodedText.test.ts`）が走る。例外は同テスト内の許可リストで理由とともに管理する。
- `npm run test:e2e`: `tests/e2e/i18n.spec.ts` が英語環境での表示・切り替え・状態保持・APIエラー表示を確認する。E2E は既定でブラウザのロケールを `ja-JP` に固定している（`playwright.config.ts`）。

### 言語を追加する手順

1. `LOCALES`（`src/lib/i18n/locale.ts`）と `intlLocale`（`translate.ts`・`format.ts`）に言語を追加する。
2. `src/lib/i18n/messages/<言語>/` に、日本語辞書と同じキー集合の辞書を作り、`translate.ts` の辞書表に登録する。複数形のカテゴリは言語ごとに異なるため、`Intl.PluralRules` の返すカテゴリ（`few`/`many` 等）に対応するキーを追加し、`EnglishMessages` に相当する型を言語ごとに用意する。
3. `LocaleSelect` に選択肢（その言語の自称表記）を追加する。

## E2Eテスト

```sh
npm run dev         # 別ターミナルで開発サーバを起動しておく
npx playwright test # ゲスト表示（?guest）で完結するE2E
```

### 実アカウントのE2E（ライブテスト）

検証用アカウントの認証情報を環境変数で与えると、`tests/e2e/live/` のテストが有効になる。未設定のときは実行対象にならない。設計は `specs/e2elive/` にある。

| 環境変数                    | 必須 | 内容                                   |
| --------------------------- | ---- | -------------------------------------- |
| `SKYSHARE_E2E_IDENTIFIER`   | 必須 | 検証用アカウントのハンドル             |
| `SKYSHARE_E2E_APP_PASSWORD` | 必須 | 検証用アカウントのアプリパスワード     |
| `SKYSHARE_E2E_SERVICE`      | 任意 | PDSのURL（既定 `https://bsky.social`） |

第三者の返信のテスト（`peerReply.spec.ts`）には、任意で `SKYSHARE_E2E_PEER_IDENTIFIER`・`SKYSHARE_E2E_PEER_APP_PASSWORD` を設定する（未設定ならスキップ）。

ライブテストが作る投稿は本文が `[e2e <識別子>]` で始まり、テスト終了時に削除される。異常終了で残った分は、次回のライブテスト開始時に回収される。手動で掃除するには `npm run e2e:live:sweep -- --dry-run`（削除予定の確認）、`npm run e2e:live:sweep`（1時間より古いものを削除）を使う。

リポジトリ直下の `.env.e2e`（Git管理対象外）に `KEY=value` 形式で書いてもよい。雛形 `.env.e2e.template` をコピーして使う（`cp .env.e2e.template .env.e2e`）。本番の解析に使う Cloudflare API トークンも、同じ `.env.e2e` に置く。必ず検証専用のアカウントとアプリパスワードを使うこと。

ヘッドレスブラウザで日本語・国旗絵文字を表示するには、OSのフォントが必要（例: `sudo apt-get install fonts-noto-cjk fonts-noto-color-emoji`）。動画のライブテストの素材作成・確認には `ffmpeg` を使う。

他ブラウザでの確認（Firefox・Safari系・iPhoneエミュレーション）には、Playwrightのブラウザを追加で入れる。

```sh
npx playwright install firefox webkit
sudo npx playwright install-deps firefox webkit # OSの依存パッケージ
npx playwright test --project=firefox --project=webkit --project=webkit-iphone
```

これらのprojectが実行するのは、ブラウザ差が出る機能のspec（Dropdown・動画の表示・添付制限）と、iPhoneエミュレーション専用の`*.ios.spec.ts`だけである。

300MB級の動画を実アカウントへ投稿するライブテスト（時間とBlueskyの動画アップロード残量を消費する）は、`SKYSHARE_E2E_LARGE_VIDEO=1`を付けたときだけ実行される。
