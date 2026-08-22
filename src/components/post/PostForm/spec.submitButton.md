# submitButtonの仕様

PostFormから実行される「投稿」ボタンの挙動を以下に示す

## ManualImageAttach

- 概要
  - Skyshare Entryを生成しない設定値
- 想定する挙動
  - ONの場合、Skyshare Entryを生成する工程をスキップする。
  - その後の共有工程において、Skyshare URLを付与する処理を実行しない
  - ManualImageAttachは、Skyshare EntryによるOGP代行が不要なユーザの設定であるが、真にユーザがこのオプションをONにする意図は、インテント後のポストに画像データを添付することにある。

## PopupIntentInsteadOfWebshare

- 概要
  - WebShareAPIではなく、インテントポップアップを起動する
- 想定する挙動
  - ONの場合、WebShareAPIの試行工程をスキップする

## NoAutoPopupAfterPost

- 概要
  - ポスト後のインテントポップアップ操作をユーザに実行させる。
- 想定する挙動
  - ONの場合、インテントポップアップを抑制し、ポスト後もテキストボックスに文字列を保持する
  - ONの場合、ユーザによるインテントポップアップ時にSkyshare URLが含まれる必要があるため、Skyshare Entryが作成された場合にテキストボックスへURLを追加する。
  - ONの場合、インテントの自動実行用ボタンを表示する
  - OFFの場合、インテントの自動ポップアップを実行する。ただし、実行に失敗した場合はその旨をユーザに伝えたうえで、このオプションをONにするフォールバックを行う。

## CrosspostToTaittsuu

- 概要
  - クロスポスト先をTaittsuに変更する
- 想定する挙動
  - ONの場合、インテントの自動ポップアップ対象をTaittsuに変更する。
  - タイッツー投稿ボタンの表示は NoAutoPopupAfterPost が ON の場合に限る。OFFの場合は自動ポップアップがTaittsuへの投稿を処理するため、ボタンは表示しない。
- 注意
  - WebShareAPIはTaittsuで使用できないため、PopupIntentInsteadOfWebshareは自動的にONにする

## ShowXIntentButton

- 概要
  - Xの投稿ボタンを表示する
- 想定する挙動
  - ONの場合、Xのインテントのポップアップボタンを表示する。
  - ただし実際の表示可否は NoAutoPopupAfterPost の状態にも依存する（詳細は複合挙動セクション参照）。

## PinnedFormDisabled

_submitButtonの挙動に影響しないため省略_

# 複合した際の挙動

各トグルの複合条件に応じた挙動について、誤解が発生しそうな内容について定義する。

## 挙動における注意点

- CrosspostToTaittsuu がON かつ ShowXIntentButton がONの場合
  - ユーザは両方のサービスのインテントポップアップを実行したい意図であると解釈し、自動ポップアップは無効化される（ NoAutoPopupAfterPost を強制的にONに変更する）
- ManualImageAttach がON かつ PopupIntentInsteadOfWebshare がOFFの場合
  - WebShareAPIでは画像データを直接添付できることから、ユーザのオプション設定目的を果たすため、WebShareAPIで送信するデータは画像データを添付する。
- NoAutoPopupAfterPost がOFF かつ CrosspostToTaittsuu がOFFの場合
  - デフォルトのインテント実行先であるXIntentをターゲットにして自動ポップアップする
- NoAutoPopupAfterPost がOFF かつ CrosspostToTaittsuu がONの場合
  - Taittsuのインテントを自動ポップアップする

## トグル間の設定可能値

- NoAutoPopupAfterPost は CrosspostToTaittsuu / ShowXIntentButton の状態に関わらず、常にユーザが直接ON/OFFを切り替えられる
  - 他の2トグルがOFFであることを理由に操作不能にはしない
- NoAutoPopupAfterPost がONになった場合に、CrosspostToTaittsuu / ShowXIntentButton がいずれもOFFである場合
  - 手動投稿ボタンが一つも表示されず操作不能になることを避けるため、デフォルトのインテントである ShowXIntentButton を強制的にONにする。
- ShowXIntentButton がONになった場合
  - CrosspostToTaittsuuの状態によらず NoAutoPopupAfterPost は強制的にONになる
  - Xの手動投稿ボタンを表示する時点で、自動ポップアップは不要と判断する
- NoAutoPopupAfterPost がOFFになった場合に、ShowXIntentButton がONである場合
  - 自動ポップアップを実行するにも関わらず、Xインテントの実行ボタンが表示されてしまうことになるため、 ShowXIntentButton を強制的にOFFにする。
- NoAutoPopupAfterPost がON かつ CrosspostToTaittsuu / ShowXIntentButton いずれかがOFFで、どちらかのトグルの操作により CrosspostToTaittsuu / ShowXIntentButton がともにOFFになった場合
  - NoAutoPopupAfterPost は強制的にOFFにする。
  - これは、各インテントのボタン表示がなくなったことにより、自動ポップアップをする挙動に戻さなければ、ユーザがインテントを実行する手段がなくなるためである。
  - PopupIntentInsteadOfWebshare をOFFにした場合も、連動して CrosspostToTaittsuu / ShowXIntentButton がともにOFFになるため、同じ理由で NoAutoPopupAfterPost を強制的にOFFにする。

## フォールバックのルール

- 自動ポップアップの起動に失敗した場合（ポップアップブロック等）、その旨をユーザに伝えたうえで NoAutoPopupAfterPost を自動的にONへフォールバックする（以降は手動での共有操作に切り替わる）
- Xをターゲットとした自動ポップアップが失敗した場合、上記フォールバックに加えて ShowXIntentButton も強制的にONにする
  - ボタン表示がNoAutoPopupAfterPostに連動するため、これをしないと再試行手段がユーザに提供されない。
  - Taittsuをターゲットとした場合は CrosspostToTaittsuu が既にONであり、上記ルールにより自動的にタイッツーボタンが表示されるため、追加の強制は不要。

# テストの実装

- オプション間の挙動は複雑であるため、テストを実装すること。
- テストは条件網羅（C2）で実装すること。
