# 運用者ごとの設定 設計書

## 1. 構成

| パス                                       | 責務                                                       |
| ------------------------------------------ | ---------------------------------------------------------- |
| `src/lib/site/siteEnv.ts`                  | 環境変数の検査と、サイトの URL・運営者情報・測定 ID の解決 |
| `src/lib/site/siteConfig.ts`               | ビルドに埋め込まれた値を解決した、アプリ全体が参照する設定 |
| `src/components/layout/AnalyticsTag.astro` | 測定 ID があるときだけ GA のタグを出す                     |
| `src/components/layout/Metadatas.astro`    | ページ共通のメタタグに GA のタグを加える                   |

## 2. 関係図・ワークフロー

値の流れを示す。

```mermaid
flowchart LR
  ext_vars["GitHub の Variables"] --> ext_astro["ビルドの設定"]
  ext_vars --> ext_render["配備設定の生成"]
  ext_astro --> siteEnv
  siteConfig --> siteEnv
  Metadatas --> siteConfig
  Metadatas --> AnalyticsTag
  ext_render --> ext_wrangler["wrangler.jsonc"]
```

本番ビルドの前の検査と、サイトの URL の決定を示す。

```mermaid
sequenceDiagram
  participant ext_astro as ビルドの設定
  participant siteEnv
  participant ext_build as ビルド
  ext_astro->>siteEnv: siteUrl
  ext_astro->>siteEnv: checkSiteEnv
  alt 問題あり
    siteEnv-->>ext_astro: 問題の一覧
    ext_astro-->>ext_build: 異常終了
  else 問題なし
    siteEnv-->>ext_astro: 空の一覧
    ext_astro->>ext_build: ビルドを続ける
  end
```

ページの描画での測定 ID の受け渡しを示す。

```mermaid
sequenceDiagram
  participant Metadatas
  participant siteConfig
  participant siteEnv
  participant AnalyticsTag
  siteConfig->>siteEnv: resolveSiteConfig
  siteEnv-->>siteConfig: 解決した値
  Metadatas->>siteConfig: 測定 ID の取得
  Metadatas->>AnalyticsTag: 測定 ID
  alt 測定 ID あり
    AnalyticsTag-->>Metadatas: GA のタグ
  else なし
    AnalyticsTag-->>Metadatas: 出力なし
  end
```

## 3. 設計項目

### D-1: 運営者情報と測定 ID (FR-1, FR-2, FR-3, FR-4, NFR-1)

```ts
export type SiteConfig = {
  operator: { name: string; email: string; blueskyHandle: string | null }
  privacy: { enactedAt: string; revisedAt: string }
  analyticsId: string | null
}
export const checkSiteEnv = (env: Env): string[]
export const resolveSiteConfig = (env: Env, dev: boolean): SiteConfig
export const siteUrl = (env: Env): string
export const siteConfig: SiteConfig
```

| 変数                             | 必須 | 形式           |
| -------------------------------- | ---- | -------------- |
| `SITE_HOST`                      | 必須 | ドメイン名     |
| `PUBLIC_OPERATOR_NAME`           | 必須 | 任意の文字列   |
| `PUBLIC_OPERATOR_EMAIL`          | 必須 | メールアドレス |
| `PUBLIC_OPERATOR_BLUESKY_HANDLE` | 任意 | ドメイン形式   |
| `PUBLIC_PRIVACY_ENACTED_AT`      | 必須 | `YYYY-MM-DD`   |
| `PUBLIC_PRIVACY_REVISED_AT`      | 必須 | `YYYY-MM-DD`   |
| `PUBLIC_GA_MEASUREMENT_ID`       | 任意 | `G-` と英数字  |

- `siteEnv.ts` は `import.meta.env` に依存せず、`astro.config.mjs` から読み込める。
- 測定 ID は形式を検査した値だけを使うため、`AnalyticsTag` は GA の初期化スクリプトにそのまま埋め込める。
- コード・テンプレート・ワークフローに運用者固有の値を書かない。直書きの検出をテストで行う（lexicon の NSID は対象外）。

### D-2: サイトの URL と配備設定 (FR-5, FR-6, FR-7, FR-8)

- `astro.config.mjs` の検査は `astro build` のときだけ行い、開発サーバーでは行わない。
- `hack/render-deploy-config.mjs` は次の値でテンプレートを置き換え、`hack/apply-d1-migrations.mjs` はビルド結果の設定から対象の D1 を読む。

| 変数                      | 必須 | 既定値                             |
| ------------------------- | ---- | ---------------------------------- |
| `SITE_HOST`               | 必須 | なし                               |
| `ZONE_NAME`               | 必須 | なし                               |
| `WORKER_NAME`             | 任意 | `skyshare`                         |
| `SCHEDULE_D1_DATABASE_ID` | 必須 | なし                               |
| `SCHEDULE_D1_NAME`        | 任意 | `skyshare-schedule`                |
| `SCHEDULE_R2_BUCKET`      | 任意 | `skyshare-schedule-images`         |
| `PREVIEW_D1_DATABASE_ID`  | 必須 | なし                               |
| `PREVIEW_D1_NAME`         | 任意 | `skyshare-schedule-preview`        |
| `PREVIEW_R2_BUCKET`       | 任意 | `skyshare-schedule-images-preview` |
| `STAGING_HOST`            | 任意 | なし（未設定ならステージングなし） |

- テンプレートは変数名と同じ文字列（`"WORKER_NAME"` のような値）を持ち、生成のときに置き換える。見つからない値があれば、テンプレートの変更として異常終了する。
- ステージングでは、Worker 名に `-staging` を付け、ドメインを `STAGING_HOST` に、D1・R2 をプレビュー用に差し替え、ブランチ別のプレビューを無効にする。
- プレビュー用 D1 へのマイグレーションは、ビルド結果の設定の `previews` から対象を読む。

## 4. エラー処理

| 事象                         | 処理                                           |
| ---------------------------- | ---------------------------------------------- |
| 本番ビルドで必須の値が欠ける | 欠けた変数名と形式の違いを挙げてビルドを止める |
| 配備設定の必須の値が欠ける   | 変数名を示して異常終了する                     |
| D1 の ID が UUID でない      | 変数名を示して異常終了する                     |
