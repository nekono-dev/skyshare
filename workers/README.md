# backendディレクトリにすべての機能を移譲したため、outdatedになりました。次バージョンアップで削除予定です。

# Cloudflare Worker 

## Setup Developper tools

Install wrangler **environment have X window system(Not works on CLI server!)**
```sh
sudo npm install -g wrangler
```

Setup repository
```sh
npm install
```

## Build & Debug

Setup environment `.dev.vars` following to `.dev.vars.template`
```bash
UPSTASH_REDIS_REST_URL="upstash_redis_rest_url"
UPSTASH_REDIS_REST_TOKEN="upstash_redis_rest_token"
DEV_UPSTASH_REDIS_REST_URL="dev_upstash_redis_rest_url"
DEV_UPSTASH_REDIS_REST_TOKEN="dev_upstash_redis_rest_token"
```

Seutp local server, build & debug
```sh
## when wrangler stop in some Error, It will prevent next statup as same port.
## To avoid it, Kill Application port using.
kill -9 $(lsof -t -i:8087)
## serve backend ot local server
wrangler --port 8087 dev 
```

## Deploy

Deploy as staging environment
```sh
wrangler deploy 
```

Deploy as production environment
```sh
wrangler --env prod deploy 
```
