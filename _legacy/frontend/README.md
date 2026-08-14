# Legacy Frontend

このディレクトリ配下は、Skyshare v1.X.X のフロントエンドのコードです。  
移行のために残置しますが、今後の開発は v2.X.X のコードに追従します。

# Build Frontend

## Setup

Setup node_modules:

```sh
docker run --rm -v $PWD:/src -w /src -u `id -u`:`id -g` -p 80:4321 -it node:18.17.1 npm install
```

Into node container:

```sh
docker run --rm -v $PWD:/src -w /src -u `id -u`:`id -g` -p 80:4321 -it node:18.17.1 /bin/bash
```

setup .env:

```sh
PUBLIC_BACKEND_ENDPOINT="backend_endpoint" # set firebase fucntion endpoint
PUBLIC_V2_BACKEND_ENDPOINT="" # v2 backend(skyshare v2, /v1/*)のオリジン。本番は空文字(同一オリジン配信)前提
```

## v2バックエンドとの連携について

ログイン(`POST /v1/session`)と投稿(画像投稿・テキストのみ投稿、`POST /v1/entry`)は、
v2バックエンド(このリポジトリのルートにある Astro/Cloudflare Workers 実装)へ委譲している。

- v2は `atp_session` を `HttpOnly; SameSite=Strict; Path=/` の Cookie で発行するため、
  **legacyとv2は同一オリジンで配信されていることが前提**(例: v2が `https://skyshare.nekono.dev/`、
  legacyが `https://skyshare.nekono.dev/legacy/` のように同一ドメイン配下)。別オリジンで配信する場合、
  v2側にCORS対応(`Access-Control-Allow-Origin`/`Access-Control-Allow-Credentials`)を追加しない限り
  ログイン・投稿は失敗する。
- OGP共有ページ生成(`POST/GET/DELETE {PUBLIC_BACKEND_ENDPOINT}/page` および `ogp/meta`,`ogp/blob`)は
  **移行対象外**であり、従来どおりFirebase Functionsバックエンドを直接呼び出す。これらの呼び出しには
  legacy自身のBluesky直接ログイン(`createSession`)で取得した `accessJwt` を引き続き利用するため、
  ログイン処理はBluesky直接ログインとv2ログインを**並行して両方実行**している(`LoginForm.tsx`)。
- 外部リンク埋め込み投稿(OGPリンクカード付き投稿、`mediaData.type === "external"`)は、
  Firebaseの `ogp/meta`,`ogp/blob` から得たサムネイルに依存しているため、**従来どおり直接Bluesky APIを
  呼び出す実装のまま**としている(`PostButton.tsx`)。
- v2の `POST /v1/entry` は画像投稿時に `ogImage`(OGPサムネイル)を必須とするが、legacyには専用の
  クロップUIがないため、先頭画像をそのまま `ogImage` として送信して契約を満たしている。

## Debug

```sh
# astro develop server
npm run dev
```

### How to fix `UnhandledRejection`

when error occurd while develop code

```log
22:39:52 [ERROR] [UnhandledRejection] Astro detected an unhandled rejection. Here's the stack trace:
Error: ENOSPC: System limit for number of file watchers reached, watch '/home/ubuntu/git/skyshare/astro/tests/detectFacets.test.ts'
    at FSWatcher.<computed> (node:internal/fs/watchers:247:19)
    at Object.watch (node:fs:2473:36)
    at createFsWatchInstance (file:///home/ubuntu/git/skyshare/astro/node_modules/vite/dist/node/chunks/dep-jvB8WLp9.js:44166:17)
    at setFsWatchListener (file:///home/ubuntu/git/skyshare/astro/node_modules/vite/dist/node/chunks/dep-jvB8WLp9.js:44213:15)
    at NodeFsHandler._watchWithNodeFs (file:///home/ubuntu/git/skyshare/astro/node_modules/vite/dist/node/chunks/dep-jvB8WLp9.js:44368:14)
    at NodeFsHandler._handleFile (file:///home/ubuntu/git/skyshare/astro/node_modules/vite/dist/node/chunks/dep-jvB8WLp9.js:44432:23)
    at NodeFsHandler._addToNodeFs (file:///home/ubuntu/git/skyshare/astro/node_modules/vite/dist/node/chunks/dep-jvB8WLp9.js:44674:21)
  Hint:
    Make sure your promises all have an `await` or a `.catch()` handler.
  Error reference:
    https://docs.astro.build/en/reference/errors/unhandled-rejection/
  Stack trace:
    at FSWatcher.<computed> (node:internal/fs/watchers:247:19)
    [...] See full stack trace in the browser, or rerun with --verbose.
```

Setup `sysctl.conf`  
https://code.visualstudio.com/docs/setup/linux#_visual-studio-code-is-unable-to-watch-for-file-changes-in-this-large-workspace-error-enospc

```
fs.inotify.max_user_watches=524288
```

And reload sysctl `sudo sysctl -p`

## Deploy

This application works as SSR mode in cloudflare, no support by SSG.
