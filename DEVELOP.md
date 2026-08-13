# デバッグ方法

## コード生成

AT Proto および　OpenAPI の自動生成コードはリポジトリから除外している。
以下のコマンドによりコードを生成すること。

```sh
npm install
npm run codegen
```

## フロントエンドの実行

frontend/README.md を参照すること。

# Lexiconについて

2026年2月時点で、GPT-5 miniはすでにほぼ生成可能な状態になっている。
ただし、lexiconを書いたあともDNSへのレコード追加など、手続きが存在する。
lexicons ディレクトリの README を参照すること。

# OAuth Scopeの作成

以下で作成する
https://lexicon.garden/scope-builder

OAuth Scopeの例:

```txt
atproto include:dev.nekono.skyshare repo?collection=app.bsky.feed.post&collection=dev.nekono.skyshare.entry&action=create&action=delete blob:image/* blob:video/*
```
