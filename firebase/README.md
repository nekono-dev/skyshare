# backendディレクトリにすべての機能を移譲したため、outdatedになりました。次バージョンアップで削除予定です。

# Firestore Functions

## Setup Developper tools

Install firebase develp tool
```sh
sudo npm install -g firebase-tools
```

Setup repository
```sh
npm install
```

## Build and Deploy

Setup environment `.env` following to `.env.template`
```bash
UPSTASH_REDIS_REST_URL="upstash_redis_rest_url"
UPSTASH_REDIS_REST_TOKEN="upstash_redis_rest_token"
DEV_UPSTASH_REDIS_REST_URL="dev_upstash_redis_rest_url"
DEV_UPSTASH_REDIS_REST_TOKEN="dev_upstash_redis_rest_token"
```

Debug in local(extract to private network)
```sh
cd functions
## Because firebase cannot read Typescript, you need to transpile.
npm run build
## ...or run as daemon. it works functions autoload if typescript changed.
npm run build:watch
## serve local
firebase serve -o 192.168.3.151 -p 5000
```

Deploy staging and prod.
```sh
firebase deploy
```
