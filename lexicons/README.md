# 注意

lexiconではPDSに認められるため、実在するドメインを下にした逆順FQDNを使うことが推奨されている
以下に検証ツールの使用方法を示す

# GoAT

GoATは、ATProto Lexiconの検証を補助するツール
https://github.com/bluesky-social/goat

## インストール

GoATの最新リリースは以下のリンクからダウンロードできる。
https://github.com/bluesky-social/goat/releases

マシンのアーキテクチャを確認し、適切なバイナリをダウンロードする。

```sh
ARCH=$(uname)_$(uname -p)
curl -LO https://github.com/bluesky-social/goat/releases/download/v0.2.2/goat_${ARCH}.tar.gz
sudo tar -xf goat_${ARCH}.tar.gz goat -C /usr/local/bin/
goat --version
```

成功例:

```log
goat version v0.2.2-rev-83684f7
```

## Lintの実行

```sh
npm run lint:lexicon
```

`hack/lint-lexicon.sh`が`entry.json`の位置から独自lexiconを特定して`goat lex lint`を実行する。`npm test`（`tests/lexicons/`）とは別の検証で、CIの`verify`ジョブでは両方を実行する。

## LexiconのDNSチェック

```sh
goat lex check-dns
```

次のように、リゾルブするための情報を得られるため、DNSへTXTレコードを登録する。
didにはドメインを持つユーザのDIDを指定する。

```log
Some lexicon NSIDs did not resolve via DNS:

    dev.nekono.skyshare.*

To make these resolve, add DNS TXT entries like:

    _lexicon.skyshare.nekono.dev        TXT     "did=did:web:skyshare.nekono.dev"

(substituting your account DID for the example value)

Note that DNS management interfaces commonly require only the sub-domain parts of a name, not the full registered domain.
```

登録後、再度チェックを実行すると、Resolveされることが確認できる。

```sh
$ goat lex check-dns ./lexicons/dev/nekono/skyshare/
all lexicon schema NSIDs resolved successfully
```

## Lexiconの公開

GoATを使って、LexiconをPDSに公開することができる。

GoATでアカウントにログインする。

```sh
goat account login --username <HANDLE> --password <PASSWORD>
goat account status <HANDLE>
```

成功例（nekono.dev）

```log
DID: did:plc:arvsmkkcflx2hdfum5jk54n3
Active: true
Repo Rev: 3me24x4vhdk2m
```

```sh
goat lex publish ./lexicons/dev/
```

```log
 🟢 dev.nekono.skyshare.defs
 🟢 dev.nekono.skyshare.entry
```

# 自ドメインへのNSID変更手順

本アプリはlexicon JSONの`id`を唯一の定義元として、アプリケーションコードがNSIDを導出する。フォークして自ドメインで運用する場合は、アプリケーションコードを編集せず、次の手順でlexiconだけを変更する。

1. `lexicons/` 配下のディレクトリを、新ドメインの逆順構造へ移動する（例: `lexicons/dev/nekono/skyshare/` → `lexicons/com/example/myapp/`）。
2. `entry.json`・`defs.json`の`id`を新NSIDへ書き換える（`entry`は`<prefix>.entry`、`defs`は`<prefix>.defs`の形を守る）。
3. `entry.json`内の`manifest`の`ref`（`<prefix>.defs#manifest`）を新NSIDへ書き換える。
4. `npm test`でlexiconを検証する（`tests/lexicons/lexicons.test.ts`が、スキーマ構文・`$ref`の解決・ファイルパスとidの対応・entryレコードのバリデーションを確認する）。
5. `npm run lint:lexicon`で検証し、DNS TXTレコード（`_lexicon.<authority>`）の設定と`goat lex publish`によるPDSへの公開を行う。

注意:

- `lexicons/`配下の`entry.json`は1つだけでなければならない（複数・0件の場合はアプリの起動・ビルドおよびテストがエラーになる）。
- 旧NSIDで作成済みのレコードは自動では移行されない。
