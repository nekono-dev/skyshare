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
goat lex lint ./lexicons/dev/nekono/skyshare/*
```

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

    _lexicon.skyshare.nekono.dev        TXT     "did=did:web:lex.example.com"

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
goat lex publish --did did:web:lex.example.com ./lexicons/dev/nekono/skyshare/
```
