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
PUBLIC_IS_NOT_PRODUCTION="True_or_False" # if not deploy to prod, set flag true. if prod, need not to set or set false
```

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
