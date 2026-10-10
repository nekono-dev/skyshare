# 開発者ガイド

## デプロイ環境

Skyshare v2 は Cloudflare Worker上で動作します。
v1と異なり、他サービスとの依存関係はありませんが、v1の機能を使う場合はv1のバックエンド、および設定値が必要です。

## 準備

1. wrangler.template.jsonc をコピー。以下の環境変数を設定する

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

```sh
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

`develop` ブランチへの push で `.github/workflows/deploy.yaml` が起動し、テスト・型検査を通過した場合のみ Cloudflare Workers へデプロイする。`wrangler.jsonc` と `_legacy/frontend/.env.production` は `.gitignore` 対象のため、CI では `hack/render-deploy-config.mjs` が GitHub の Variables から生成する。

| 種別     | 名前                             | 内容                                         |
| -------- | -------------------------------- | -------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`           | Workers のデプロイ権限を持つ API トークン    |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`          | Cloudflare のアカウントID                    |
| Variable | `PUBLIC_LEGACY_BACKEND_ENDPOINT` | _legacy版backendのエンドポイント             |
| Variable | `PUBLIC_DEFAULT_ATP_SERVICE`     | ATPサービスのURL                             |
| Variable | `PUBLIC_NODE_ENV`                | `production`（Cookieに Secure 属性を付ける） |
| Variable | `PUBLIC_OGP_EXTRACTOR_API`       | OGP ExtractorのURL                           |
| Variable | `PUBLIC_PLC_DIRECTORY_BASE_URL`  | PLCディレクトリサービスのURL                 |

手動実行（Actions → deploy → Run workflow）では、既定で `dry_run` が有効になり、ビルドと `wrangler deploy --dry-run` のみ行って公開しない。

### E2E（e2e.yaml）

`develop` への push で `.github/workflows/e2e.yaml` が起動し、単体テストの後に Playwright の全project（chromium・firefox・webkit・webkit-iphone、およびライブテスト）を実行する。

| 種別     | 名前              | 内容                                                                                                |
| -------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| Secret   | `E2E_ENV`         | `.env.e2e` の中身（`KEY=value` 形式・複数行）をそのまま登録する。未登録ならライブテストを除いて実行 |
| Variable | `PUBLIC_*`（5件） | deploy.yaml と共通                                                                                  |

同じ検証用アカウントを同時に操作しないよう、実行は直列化される。検証専用のアカウントとアプリパスワードを使うこと。

## PRブランチの動作確認（部分リリース）

```sh
npm run prev
```

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

- `npm test`: 辞書の整合（キー集合・複数形・プレースホルダ）と、文言の直書き検出（`tests/lib/i18n/noHardcodedText.test.ts`）が走る。例外は同テスト内の許可リストで理由とともに管理する。
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

リポジトリ直下の `.env.e2e`（Git管理対象外）に `KEY=value` 形式で書いてもよい。必ず検証専用のアカウントとアプリパスワードを使うこと。

ヘッドレスブラウザで日本語・国旗絵文字を表示するには、OSのフォントが必要（例: `sudo apt-get install fonts-noto-cjk fonts-noto-color-emoji`）。動画のライブテストの素材作成・確認には `ffmpeg` を使う。

他ブラウザでの確認（Firefox・Safari系・iPhoneエミュレーション）には、Playwrightのブラウザを追加で入れる。

```sh
npx playwright install firefox webkit
sudo npx playwright install-deps firefox webkit # OSの依存パッケージ
npx playwright test --project=firefox --project=webkit --project=webkit-iphone
```

これらのprojectが実行するのは、ブラウザ差が出る機能のspec（Dropdown・動画の表示・添付制限）と、iPhoneエミュレーション専用の`*.ios.spec.ts`だけである。

300MB級の動画を実アカウントへ投稿するライブテスト（時間とBlueskyの動画アップロード残量を消費する）は、`SKYSHARE_E2E_LARGE_VIDEO=1`を付けたときだけ実行される。
