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
    "PUBLIC_OGP_EXTRACTOR_API": "OGP ExtractorのURLを入力、APIのパスに/v1/extractを含まない場合、openapi/index.yamlでパスを修正すること",
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

## PRブランチの動作確認（部分リリース）

```sh
npm run prev
```
