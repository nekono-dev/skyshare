# 予約投稿 アーキテクチャ

## 1. 目的と範囲

予約投稿は、投稿に実行日時を指定して予約し、時刻が来ると利用者の Bluesky へ自動で投稿する。
予約の内容と実行に必要な認証情報の保管と、予約の一覧での編集と取消も扱う。
投稿フォームの入力部品と、ログインやセッションの保持は、別の機能のくくりの対象である。

## 2. 構成要素

| 構成要素             | 種別   | 責務                                                                                                    | 実装spec        |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------- | --------------- |
| 利用者               | 外部   | 予約の日時を指定し、予約の一覧で編集や取消や確認を行う                                                  | -               |
| 定期実行トリガー     | 外部   | 1分ごとに予約の実行を起動する                                                                           | -               |
| Bluesky PDS          | 外部   | DPoP つきのトークンで、予約された投稿とレコードを受けて保管する                                         | -               |
| Bluesky 認可サーバー | 外部   | 利用者に予約投稿の許可を求め、トークンを発行・更新・取消する                                            | -               |
| PLC Directory        | 外部   | DID から、アカウントの実際の PDS を記した DID ドキュメントを返す                                        | -               |
| 予約フォーム         | 内部   | 予約投稿の有効化と実行日時の指定を受け、予約の一覧で編集と取消を行わせる                                | schedule-form   |
| 予約の案内           | 内部   | 予約できる投稿の種類と、外部の予約投稿サービスを案内する                                                | schedule-guide  |
| 予約API              | 内部   | 予約と OAuth の認可を検証して受け付け、自分の予約だけを返して置き換え、登録状態のヒントを cookie に残す | schedule-api    |
| 予約ストア           | 内部   | 予約と進捗と暗号化した認証情報と添付画像を保管し、到来した予約を取り出す                                | schedule-store  |
| 予約実行器           | 内部   | 到来した予約を通信の予算内で順に投稿し、中断しても続きから完了させる                                    | schedule-runner |
| 投稿フォーム         | 他機能 | 投稿の内容を組み立て、予約の操作を開く                                                                  | -               |
| セッション管理       | 他機能 | セッションを cookie に保持し、API ごとに再開と更新を行う                                                | -               |
| API契約と生成        | 他機能 | API の入出力の定義からクライアントを生成して提供する                                                    | -               |

## 3. システム構成

呼び出しの依存は、画面から保管の基盤へ一方向に進む。

```mermaid
flowchart LR
  composer["投稿フォーム"] --> form["予約フォーム"]
  form --> guide["予約の案内"]
  form --> api["予約API"]
  form --> contract["API契約と生成"]
  api --> store["予約ストア"]
  api --> session["セッション管理"]
  api --> contract
  runner["予約実行器"] --> store
```

## 4. 外部インターフェース

| IF             | 方向 | 外部の要素           | 内部の要素   | 方式                                                    | 認証                              |
| -------------- | ---- | -------------------- | ------------ | ------------------------------------------------------- | --------------------------------- |
| 予約の操作     | 提供 | 利用者               | 予約フォーム | HTTPS の画面（HTML と JavaScript）                      | セッション cookie                 |
| 定期起動       | 提供 | 定期実行トリガー     | 予約実行器   | Cloudflare の Cron Trigger（1分間隔、後片付けは1日1回） | プラットフォームによる起動        |
| 予約の許可     | 利用 | Bluesky 認可サーバー | 予約フォーム | ブラウザの遷移（OAuth の認可の画面と戻り）              | 利用者の Bluesky のログイン       |
| トークンの取得 | 利用 | Bluesky 認可サーバー | 予約API      | HTTPS（PAR・トークン・取消の端点）                      | クライアントの秘密鍵の証明と DPoP |
| トークンの更新 | 利用 | Bluesky 認可サーバー | 予約実行器   | HTTPS（トークンの端点）                                 | クライアントの秘密鍵の証明と DPoP |
| 予約のDID解決  | 利用 | PLC Directory        | 予約API      | HTTPS（JSON）                                           | なし                              |
| 予約の投稿     | 利用 | Bluesky PDS          | 予約実行器   | HTTPS（XRPC）                                           | DPoP に結び付いたアクセストークン |

予約投稿の外部との出入りは、利用者の操作と許可と定期起動と、認可サーバーと PDS への通信である。

```mermaid
flowchart LR
  subgraph システム境界
    form["予約フォーム"]
    api["予約API"]
    runner["予約実行器"]
  end
  ext_user["利用者"] -->|予約の操作| form
  ext_cron["定期実行トリガー"] -->|定期起動| runner
  form -->|予約の許可| ext_auth["Bluesky 認可サーバー"]
  api -->|トークンの取得| ext_auth
  runner -->|トークンの更新| ext_auth
  api -->|予約のDID解決| ext_plc["PLC Directory"]
  runner -->|予約の投稿| ext_pds["Bluesky PDS"]
```

## 5. 機能

### 予約の作成

- 関与: 利用者, 予約フォーム, 予約API, 予約ストア

予約の作成は、実行時刻の範囲と認証情報の登録の有無で、保存と拒否に分岐する。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant form as 予約フォーム
  participant api as 予約API
  participant store as 予約ストア
  ext_user->>form: 実行日時を指定して予約
  form->>api: 投稿と画像と実行時刻を送信
  alt 実行時刻が範囲外
    api-->>form: 拒否
  else 認証情報が未登録
    api-->>form: 登録の要求
  else 受け付けられる
    api->>store: 画像と予約を保存
    api-->>form: 予約の識別子
  end
```

### 予約の編集

- 関与: 利用者, 予約フォーム, 予約API, 予約ストア

予約の編集は、書き戻した内容を置き換えるときに、予約が実行中になっていないかで分岐する。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant form as 予約フォーム
  participant api as 予約API
  participant store as 予約ストア
  ext_user->>form: 待機中の予約を選ぶ
  form->>api: 内容と画像の取得
  api->>store: 待機中の予約の読み出し
  api-->>form: 内容と画像
  ext_user->>form: 内容を変えて予約する
  form->>api: 置き換えを依頼
  alt 実行中になっていた
    api-->>form: 競合
  else 待機中のまま
    api->>store: 内容と画像を置き換え
    api-->>form: 置き換えの完了
  end
```

### 予約用認証の登録

- 関与: 利用者, 予約フォーム, 予約API, 予約ストア, Bluesky 認可サーバー

予約用認証の登録は、OAuth の認可の戻りを予約フォーム経由で完了し、照合の結果で保管と拒否に分岐する。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant form as 予約フォーム
  participant api as 予約API
  participant store as 予約ストア
  participant ext_auth as Bluesky 認可サーバー
  ext_user->>form: 予約投稿をオンにして許可を押す
  form->>api: 認可の開始
  api->>ext_auth: ログイン中のアカウントを指定した認可の要求
  api->>store: 認可の途中の状態を保管
  api-->>form: 認可の画面の URL
  form->>ext_auth: 認可の画面へ移る
  ext_user->>ext_auth: 予約投稿を許可
  ext_auth->>api: 認可コードを持って戻る
  api-->>form: 許可を始めたページへ戻りの項目をフラグメントで渡す
  form->>api: 認可の完了
  alt 戻りまたはトークンの持ち主が違う
    api-->>form: 失敗の結果を表示
  else 照合に成功
    api->>ext_auth: 認可コードをトークンに替える
    api->>store: 暗号化した更新用トークンと鍵を保管
    api-->>form: 有効にした結果を表示
  end
```

### 予約投稿の登録状態の確認

- 関与: 利用者, 予約フォーム, 予約API, 予約ストア

登録状態の確認は、ヒントの cookie があれば D1 を読まず、無いときだけ問い合わせる。

```mermaid
sequenceDiagram
  participant ext_user as 利用者
  participant form as 予約フォーム
  participant api as 予約API
  participant store as 予約ストア
  ext_user->>form: ページを開く
  alt ヒントの cookie がある
    form->>form: cookie の登録状態を表示に使う
  else ヒントの cookie が無い
    form->>api: 登録状態の取得
    api->>store: 登録と最も遅い実行時刻の読み出し
    api-->>form: 登録状態とヒントの cookie
  end
  ext_user->>form: 日時の指定や予約のタブを開く
  form->>api: 登録状態の取得（cookie を使わない）
  api->>store: 登録と最も遅い実行時刻の読み出し
  api-->>form: 登録状態とヒントの cookie
```

### 予約の自動投稿

- 関与: 定期実行トリガー, 予約実行器, 予約ストア, Bluesky 認可サーバー, Bluesky PDS

予約の自動投稿は、トークンを更新してから投稿し、通信の予算が尽きたときに進捗を保って次回へ持ち越す。

```mermaid
sequenceDiagram
  participant ext_cron as 定期実行トリガー
  participant runner as 予約実行器
  participant store as 予約ストア
  participant ext_auth as Bluesky 認可サーバー
  participant ext_pds as Bluesky PDS
  ext_cron->>runner: 毎分の起動
  runner->>store: 到来した予約の取り出し
  runner->>ext_auth: 更新用トークンでトークンを更新
  runner->>store: 回転した更新用トークンを保管
  runner->>ext_pds: DPoP の証明つきで投稿の作成
  alt 通信の予算が尽きた
    runner->>store: 進捗を保って待機へ戻す
  else すべて作成できた
    runner->>store: 予約の削除と画像の削除
  end
  opt 1日1回の後片付けの時刻
    runner->>store: 期限を過ぎた予約と不要な認証情報の削除
  end
```

## 6. データ

| データ                     | 保管場所                  | 書き込み主体            |
| -------------------------- | ------------------------- | ----------------------- |
| 予約の内容と実行の進捗     | D1 の予約テーブル         | 予約API、予約実行器     |
| 暗号化した予約用のトークン | D1 の認証情報テーブル     | 予約API、予約実行器     |
| 暗号化した認可の途中の状態 | D1 の認可の状態テーブル   | 予約API                 |
| 予約に添付した画像         | R2 のバケット             | 予約API                 |
| 登録状態のヒント           | 利用者のブラウザの cookie | 予約API、セッション管理 |

## 7. 信頼と検証

| 対象                 | 信頼する前提                                       | 検証手段                                                                     | 根拠                         |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| 予約用のトークン     | D1 の内容が外部へ漏れうる                          | Worker のシークレットの鍵で暗号化し、アカウントを認証データに束縛する        | schedule-store               |
| 認可の戻り           | 戻りの URL は第三者が作りうる                      | 1回限りの state をアカウントに束縛し、発行元とトークンの持ち主を照合する     | schedule-api                 |
| 戻り先のページ       | 別のオリジンへ転送させられうる                     | 同じオリジンのパスだけを受け付け、不正なら設定のページへ転送する             | schedule-api                 |
| クライアントの秘密鍵 | 漏れるとクライアントになりすまされうる             | Worker のシークレットにだけ置き、公開部分だけを JWKS で出す                  | schedule-api                 |
| 予約の所有者         | クライアントが指定する識別子は本人のものと限らない | すべての問い合わせにセッションのアカウントを条件に含める                     | schedule-store、schedule-api |
| 定期起動の呼び出し   | 外部から実行を起動されうる                         | 定期実行のハンドラを HTTP の経路から到達させない                             | schedule-runner              |
| 登録状態のヒント     | cookie は利用者が書き換えられる                    | 表示の仮の値にだけ使い、予約の作成と置き換えはサーバーで認証情報を再検証する | schedule-api、schedule-form  |

## 8. 技術基盤

| 領域             | 採用                                                        | 理由                                                            | 根拠            |
| ---------------- | ----------------------------------------------------------- | --------------------------------------------------------------- | --------------- |
| 予約の保管       | Cloudflare D1                                               | 無料枠で、実行時刻と状態による検索と条件つきの更新ができる      | schedule-store  |
| 画像の一時保管   | Cloudflare R2                                               | 無料枠で、保管した画像をライフサイクルで自動削除できる          | schedule-store  |
| 認証情報の暗号化 | Web Crypto の AES-GCM                                       | 標準の機能だけで、追加のパッケージなしに暗号化できる            | schedule-store  |
| 定期実行         | Cloudflare Cron Trigger                                     | 無料枠で、1分間隔の起動ができる                                 | schedule-runner |
| 投稿の通信       | 標準の fetch による XRPC                                    | 無料枠の CPU 時間を守るため、atproto のライブラリを読み込まない | schedule-runner |
| 予約用の認可     | OAuth の confidential client と DPoP（Web Crypto の ES256） | 長く有効な更新用トークンを、パスワードを預からずに得られる      | schedule-api    |

## 9. 横断的制約

| 制約                            | 値                 | 根拠            |
| ------------------------------- | ------------------ | --------------- |
| アカウントごとの待機中の予約    | 5 件               | schedule-api    |
| 予約できる実行時刻              | 5 分後から 14 日後 | schedule-api    |
| 1回の定期実行で取り出す予約     | 5 件               | schedule-store  |
| 1予約が保管する画像の合計       | 10 メガバイト      | schedule-store  |
| 終了した予約の保持期間          | 7 日               | schedule-store  |
| 使われない認証情報の保持期間    | 30 日              | schedule-store  |
| 再度の許可が必要な印の保持期間  | 180 日             | schedule-store  |
| 削除漏れの画像の保持期間        | 15 日              | schedule-store  |
| 1回の定期実行で行う外部への通信 | 40 回              | schedule-runner |
| 後片付けの頻度                  | 1 日に 1 回        | schedule-runner |
| 登録状態のヒントの保持期間      | 7 日               | schedule-api    |
