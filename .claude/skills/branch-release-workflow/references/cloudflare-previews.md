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

## workers.dev の設定

`workers_dev` と `preview_urls` は、省略せず明示する（独自ドメインが有効なら両方 `false`、無効なら両方 `true`）。`brw wrangler-config` が設定する。独自ドメインの有効判定は、`routes` の `custom_domain: true` で `enabled: false` でないもの。

実機の確認結果（wrangler 4.147.0、`routes` に独自ドメインがある使い捨て Worker）:

| 操作                                              | 結果                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 両キー省略で初回 `wrangler deploy`                 | workers.dev・Preview URL とも無効                                                                 |
| 両方 `true` で deploy                              | workers.dev・Preview URL とも有効                                                                 |
| 有効な状態から両キー省略で deploy                  | 両方無効になる。`'workers_dev' is not in your Wrangler file, it will be disabled` の警告が毎回出る |
| 両方 `false` で deploy                             | 両方無効。警告なし                                                                                |
| `wrangler versions upload`                         | 省略・`false` のどちらでも状態を変えない（有効なままなら Version Preview URL が workers.dev に出る） |
| `wrangler preview`                                 | 状態を変えない。workers.dev が有効なままだと Preview URL が workers.dev に出る                    |

省略しても deploy の結果は `false` と同じだが、警告が出て wrangler の既定値に依存するため、明示する。また `wrangler preview` に `previews: {}` と、ルートの `previews_enabled: true`（と一度の deploy）が必要である。

## ハマりどころ

既存の手動ワイルドカード DNS レコードや、同じホスト名のゾーンルートがあると、`previews_enabled` の有効化が `Hostname '*.xxx' already has externally managed DNS records`（コード 100117）で失敗する。先にそれらを削除する。

## API

Workers ドメイン API（`PUT /accounts/{id}/workers/domains`）は `previews_enabled` を扱える。DNS の読み書きには `Zone > DNS` の権限が別途必要。

## このスキルが機械判定できないこと

- workflow が本番向けか（`wrangler deploy` か `wrangler preview` か）の意味
- Cloudflare 側の設定（`previews_enabled` の実際の状態、Pages の本番ブランチなど）
