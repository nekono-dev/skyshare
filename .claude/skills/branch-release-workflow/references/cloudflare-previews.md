# Cloudflare Previews（provider: cloudflare-previews）

`wrangler preview`（open beta）でブランチ別の Preview を独自ドメインで配信する方式。旧方式の `wrangler versions upload --preview-alias` は `workers.dev` 以外で配信できないため、Previews を使う。

## 前提

- wrangler 4.135.0 以上
- Worker のカスタムドメインに `previews_enabled: true` を付ける。`<名前>.<そのドメイン>` で配信され、ワイルドカード DNS と証明書は Cloudflare が自動で作る
- Preview 名は既定で現在の git ブランチ名。`--name` で指定する（このスキルは `/` を `-` にした alias を使う）
- 削除: `wrangler preview delete --name <名前>`（`brw.mjs cleanup <ブランチ> --execute`）

## 設定上の注意

- `wrangler.jsonc` の `previews` ブロックで設定する。**トップレベルの `vars` は引き継がれない**ため、Preview 用の値を `previews.vars` に明示する
- Secrets は設定ファイルに書けず、`wrangler preview secret put` で投入する
- プレビューを本番データに届かない状態にするには、`previews.vars` と Preview 用バインディングを本番と分ける。本番と同じ値を入れると、外部への書き込みは本番データに届く
- Routes、Cron、Service Binding は本番を向く。Queue consumer は Preview に向けられない
- 独自ドメインの Preview には noindex が付かない。Cloudflare Access か `_headers` で対処する
- Free プランは 100 Preview/Worker で、超過分は古いものから自動削除される

## ハマりどころ

既存の手動ワイルドカード DNS レコードや、同じホスト名のゾーンルートがあると、`previews_enabled` の有効化が `Hostname '*.xxx' already has externally managed DNS records`（コード 100117）で失敗する。先にそれらを削除する。

## API

Workers ドメイン API（`PUT /accounts/{id}/workers/domains`）は `previews_enabled` を扱える。DNS の読み書きには `Zone > DNS` の権限が別途必要。

## このスキルが機械判定できないこと

- workflow が本番向けか（`wrangler deploy` か `wrangler preview` か）の意味
- Cloudflare 側の設定（`previews_enabled` の実際の状態、Pages の本番ブランチなど）
