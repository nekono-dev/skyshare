# 画面の共通基盤 アーキテクチャ

## 1. 目的と範囲

画面の共通基盤は、各画面が共通で使う部品・表示言語・設定画面・他 SNS への共有を提供する。
投稿の作成や一覧の表示は、別の機能のくくりの対象である。

## 2. 構成要素

| 構成要素           | 種別 | 責務                                                                              | 実装spec                                                    |
| ------------------ | ---- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 利用者             | 外部 | ブラウザで設定ページを操作し、共有の操作を行う                                    | -                                                           |
| 共有先SNS          | 外部 | X・タイッツー・Mastodon の共有の投稿画面を開き、共有された URL のカードを生成する | -                                                           |
| 共通UI部品         | 内部 | プルダウンと選択肢の見た目・操作・絞り込みを共通にする                            | dropdown、dropdown-search、listbox-option、language-select  |
| 表示言語           | 内部 | 表示言語を選び、日本語と英語の文言を切り替える                                    | i18n-locale、i18n-messages                                  |
| アプリシェルと設定 | 内部 | ナビゲーション・ヘルプ・端末の設定画面を提供する                                  | app-navigation、help-page、app-settings                     |
| 他SNS共有          | 内部 | 共有先の選択・共有文の組み立て・WebShare API の呼び出し・共有設定の保持を行う     | auto-popup、intent-share-dialog、share-text、share-settings |

## 3. システム構成

アプリシェルは、共通の部品と表示言語と他 SNS 共有を呼ぶ。

```mermaid
flowchart LR
  shell["アプリシェルと設定"] --> ui["共通UI部品"]
  shell --> i18n["表示言語"]
  shell --> share["他SNS共有"]
```

## 4. 外部インターフェース

| IF             | 方向 | 外部の要素 | 内部の要素         | 方式                               | 認証 |
| -------------- | ---- | ---------- | ------------------ | ---------------------------------- | ---- |
| 端末設定の操作 | 提供 | 利用者     | アプリシェルと設定 | HTTPS の画面（HTML と JavaScript） | なし |
| 共有画面の起動 | 利用 | 共有先SNS  | 他SNS共有          | ブラウザのポップアップ（URL）      | なし |

利用者は端末設定の操作で設定へ入り、他 SNS 共有は共有画面の起動で共有先へ出る。

```mermaid
flowchart LR
  subgraph システム境界
    shell["アプリシェルと設定"]
    share["他SNS共有"]
  end
  ext_user["利用者"] -->|端末設定の操作| shell
  share -->|共有画面の起動| ext_sns["共有先SNS"]
```

## 5. 機能

### 表示言語の決定

- 関与: 利用者, アプリシェルと設定, 表示言語

表示言語の決定は、保存された設定とブラウザの言語設定で結果が分岐する。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant shell as アプリシェルと設定
  participant i18n as 表示言語
  ext_user->>shell: ページを開く
  shell->>i18n: 表示言語の問い合わせ
  alt 保存された設定がある
    i18n-->>shell: 保存された言語
  else ブラウザの言語に対応する
    i18n-->>shell: 一致した言語
  else どちらにも該当しない
    i18n-->>shell: 英語
  end
```

### 端末設定の変更

- 関与: 利用者, アプリシェルと設定, 他SNS共有

端末設定の変更は、保存領域が使えるかどうかで保存の可否が分岐する。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant shell as アプリシェルと設定
  participant share as 他SNS共有
  ext_user->>shell: 設定ページを開く
  shell->>share: 共有設定の読み出し
  share-->>shell: 保存値か既定値
  ext_user->>shell: 共有先を変更
  alt 保存領域が使える
    shell->>share: 共有設定の保存
  else 保存領域が使えない
    share-->>shell: 既定値を返す
  end
```

### 他SNSへの共有

- 関与: 利用者, 他SNS共有, 共有先SNS

他 SNS への共有は、自動ポップアップの設定とブラウザの WebShare API の成否で開き方が分岐する。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant share as 他SNS共有
  participant ext_sns as 共有先SNS
  ext_user->>share: 投稿の成功後に共有を始める
  alt 自動ポップアップが有効
    share->>ext_sns: 選んだSNSの画面を開く
  else 自動ポップアップが無効
    share->>share: WebShare API で共有
    opt WebShare が非対応か失敗
      share->>ext_sns: Xの画面を開く
    end
  end
```

## 6. データ

| データ         | 保管場所                   | 書き込み主体       |
| -------------- | -------------------------- | ------------------ |
| 表示言語の設定 | ブラウザのローカル保存領域 | 表示言語           |
| 共有設定       | ブラウザのローカル保存領域 | 他SNS共有          |
| 表示テーマ     | ブラウザのローカル保存領域 | アプリシェルと設定 |

## 7. 信頼と検証

- なし

## 8. 技術基盤

| 領域       | 採用                       | 理由                                                     | 根拠                        |
| ---------- | -------------------------- | -------------------------------------------------------- | --------------------------- |
| 実行基盤   | Cloudflare Workers         | 並行する複数のリクエストの間で表示言語を混ぜずに処理する | i18n-locale                 |
| 端末の設定 | ブラウザのローカル保存領域 | 設定をサーバーへ送らず、端末ごとに保持する               | share-settings、i18n-locale |
| 多言語     | 自前の辞書と翻訳関数       | 追加の実行時依存を増やさず、翻訳漏れを機械的に防ぐ       | i18n-messages、i18n-locale  |

## 9. 横断的制約

- なし
