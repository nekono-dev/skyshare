# アプリシェル アーキテクチャ

## 1. 目的と範囲

アプリシェルは、ナビゲーション・ヘルプ・プライバシーポリシーの画面と、端末と機能の設定画面を提供する。
各画面が使う部品と表示言語と他 SNS への共有は、画面の共通基盤のくくりの対象である。

## 2. 構成要素

| 構成要素             | 種別   | 責務                                                               | 実装spec                                  |
| -------------------- | ------ | ------------------------------------------------------------------ | ----------------------------------------- |
| 利用者               | 外部   | ブラウザで設定ページを操作し、ヘルプとポリシーを読む               | -                                         |
| ナビゲーションと案内 | 内部   | ナビゲーション・ヘルプ・プライバシーポリシーの画面を提供する       | app-navigation、help-page、privacy-policy |
| 設定画面             | 内部   | 端末の設定と予約投稿の有効化を、設定ページとダイアログで操作させる | app-settings、timeline-hidden             |
| 共通UI部品           | 他機能 | プルダウンと選択肢の見た目と操作を共通にする                       | -                                         |
| 表示言語             | 他機能 | 表示言語を選び、日本語と英語の文言を切り替える                     | -                                         |
| 運用者ごとの設定     | 他機能 | 運営者情報と測定 ID を環境変数から受け取って検査する               | -                                         |
| 共有設定             | 他機能 | 共有の設定を端末に保持し、共有文へ適用する                         | -                                         |
| 予約フォーム         | 他機能 | 設定に置く予約投稿のスイッチと、予約用の認証情報の入力を提供する   | -                                         |

## 3. システム構成

設定画面は、共通の部品と共有の設定と予約投稿のスイッチを束ねて表示する。

```mermaid
flowchart LR
  nav["ナビゲーションと案内"] --> settings["設定画面"]
  nav --> i18n["表示言語"]
  nav --> site["運用者ごとの設定"]
  settings --> ui["共通UI部品"]
  settings --> i18n
  settings --> share["共有設定"]
  settings --> schedule["予約フォーム"]
```

## 4. 外部インターフェース

| IF             | 方向 | 外部の要素 | 内部の要素 | 方式                               | 認証 |
| -------------- | ---- | ---------- | ---------- | ---------------------------------- | ---- |
| 端末設定の操作 | 提供 | 利用者     | 設定画面   | HTTPS の画面（HTML と JavaScript） | なし |

利用者は、端末設定の操作で設定画面へ入る。

```mermaid
flowchart LR
  subgraph システム境界
    settings["設定画面"]
  end
  ext_user["利用者"] -->|端末設定の操作| settings
```

## 5. 機能

### 表示言語の決定

- 関与: 利用者, ナビゲーションと案内, 表示言語

表示言語の決定は、保存された設定とブラウザの言語設定で結果が分岐する。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant nav as ナビゲーションと案内
  participant i18n as 表示言語
  ext_user->>nav: ページを開く
  nav->>i18n: 表示言語の問い合わせ
  alt 保存された設定がある
    i18n-->>nav: 保存された言語
  else ブラウザの言語に対応する
    i18n-->>nav: 一致した言語
  else どちらにも該当しない
    i18n-->>nav: 英語
  end
```

### 端末設定の変更

- 関与: 利用者, 設定画面, 共有設定

端末設定の変更は、保存領域が使えるかどうかで保存の可否が分岐する。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant settings as 設定画面
  participant share as 共有設定
  ext_user->>settings: 設定ページを開く
  settings->>share: 共有設定の読み出し
  share-->>settings: 保存値か既定値
  ext_user->>settings: 共有先を変更
  alt 保存領域が使える
    settings->>share: 共有設定の保存
  else 保存領域が使えない
    share-->>settings: 既定値を返す
  end
```

### 予約投稿の切り替え

- 関与: 利用者, 設定画面, 予約フォーム

予約投稿の切り替えは、認証情報の登録の成否と取消の確認で結果が分岐する。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant settings as 設定画面
  participant schedule as 予約フォーム
  ext_user->>settings: 予約投稿のスイッチを押す
  settings->>schedule: 切り替えの操作を渡す
  alt オンにして登録に成功
    schedule-->>settings: オンの表示
  else オフにして取消を承諾
    schedule-->>settings: オフの表示
  else 入力か確認を取りやめた
    schedule-->>settings: 元の表示
  end
```

## 6. データ

| データ     | 保管場所                   | 書き込み主体 |
| ---------- | -------------------------- | ------------ |
| 表示テーマ | ブラウザのローカル保存領域 | 設定画面     |

## 7. 信頼と検証

- なし

## 8. 技術基盤

- なし

## 9. 横断的制約

- なし
