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
  - クロスポスト先にTaittsuuを追加する
- 想定する挙動
  - ONの場合、インテントの自動ポップアップ対象をTaittsuuに変更する（他の連携先SNSトグルとの複合時の挙動は「複合した際の挙動」セクション参照）。
  - タイッツー投稿ボタンの表示は NoAutoPopupAfterPost が ON の場合に限る。OFFの場合は自動ポップアップがTaittsuuへの投稿を処理するため、ボタンは表示しない。
- 注意
  - WebShareAPIはTaittsuuで使用できないため、PopupIntentInsteadOfWebshareは自動的にONにする

## CrosspostToMastodon

- 概要
  - クロスポスト先にMastodonを追加する
- 想定する挙動
  - ONの場合、インテントの自動ポップアップ対象をMastodonに変更する（他の連携先SNSトグルとの複合時の挙動は「複合した際の挙動」セクション参照）。
  - Mastodon投稿ボタンの表示は NoAutoPopupAfterPost が ON の場合に限る。OFFの場合は自動ポップアップがMastodonへの投稿を処理するため、ボタンは表示しない（CrosspostToTaittsuuと同じ扱い）。
  - ドメインの妥当性に関わらず、いつでもONにできる（トグル自体はドメイン未設定・不正な形式でも操作可能）。ONにする時点でMastodonインスタンスのドメインが未設定（空文字）の場合、既定値 `mastodon.social` を補って保存する。ドメインが既に設定されている場合は、トグルのON/OFFに関わらず値を変更しない（ユーザの設定を尊重する）。
  - ドメイン名の設定はSettingsページでのみ行い、CrosspostToMastodonのON/OFF状態に関わらず常に編集できる。ドメインが無効な形式になった場合、CrosspostToMastodonは強制的にOFFになる。
- 注意
  - WebShareAPIはMastodonで使用できないため、PopupIntentInsteadOfWebshareは自動的にONにする

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

CrosspostToTaittsuu / CrosspostToMastodon は「X.com以外の連携先SNSグループ」を構成する（今後連携先が増えた場合はこのグループに加える）。ShowXIntentButtonはこのグループに含まれない（X.comはデフォルトの投稿先であり、連携先SNSではないため）。

## 挙動における注意点

- 連携先SNSグループ（CrosspostToTaittsuu / CrosspostToMastodon）のうち2つ以上が同時にONの場合
  - 自動ポップアップは単一の宛先しか選べず矛盾するため、自動ポップアップは無効化される（ NoAutoPopupAfterPost を強制的にONに変更する）
- ShowXIntentButton がONの場合
  - 連携先SNSグループの状態に関わらず、単独で自動ポップアップは無効化される（ NoAutoPopupAfterPost を強制的にONに変更する）。X.comはデフォルトの投稿先であり、その手動投稿ボタンを表示する時点で自動ポップアップは不要と判断するため。
- ManualImageAttach がON かつ PopupIntentInsteadOfWebshare がOFFの場合
  - WebShareAPIでは画像データを直接添付できることから、ユーザのオプション設定目的を果たすため、WebShareAPIで送信するデータは画像データを添付する。
- NoAutoPopupAfterPost がOFF かつ 連携先SNSグループがいずれもOFFの場合
  - デフォルトのインテント実行先であるXIntentをターゲットにして自動ポップアップする
- NoAutoPopupAfterPost がOFF かつ CrosspostToTaittsuu がONの場合
  - Taittsuuのインテントを自動ポップアップする
- NoAutoPopupAfterPost がOFF かつ CrosspostToMastodon がONの場合
  - Mastodonのインテントを自動ポップアップする

## トグル間の設定可能値

- NoAutoPopupAfterPost は CrosspostToTaittsuu / CrosspostToMastodon / ShowXIntentButton の状態に関わらず、常にユーザが直接ON/OFFを切り替えられる
  - 他のトグルがOFFであることを理由に操作不能にはしない
- NoAutoPopupAfterPost がONになった場合に、CrosspostToTaittsuu / CrosspostToMastodon / ShowXIntentButton がいずれもOFFである場合
  - 手動投稿ボタンが一つも表示されず操作不能になることを避けるため、デフォルトのインテントである ShowXIntentButton を強制的にONにする。
- ShowXIntentButton がONになった場合
  - 連携先SNSグループの状態によらず NoAutoPopupAfterPost は強制的にONになる
  - Xの手動投稿ボタンを表示する時点で、自動ポップアップは不要と判断する
- CrosspostToTaittsuu / CrosspostToMastodon の一方がONになった場合、もう一方が既にONであれば
  - 連携先SNSグループのON数が2以上になるため NoAutoPopupAfterPost は強制的にONになる
  - もう一方がOFFであれば（グループ内でONなのは1つだけであれば）NoAutoPopupAfterPostは変更しない。そのトグルが唯一の自動ポップアップ対象として機能する。
- NoAutoPopupAfterPost がOFFになった場合に、ShowXIntentButton がONである場合
  - 自動ポップアップを実行するにも関わらず、Xインテントの実行ボタンが表示されてしまうことになるため、 ShowXIntentButton を強制的にOFFにする。
- NoAutoPopupAfterPost がON かつ 連携先SNSグループ/ShowXIntentButton のいずれかがOFFで、どちらかのトグルの操作により連携先SNSグループとShowXIntentButtonがすべてOFFになった場合
  - NoAutoPopupAfterPost は強制的にOFFにする。
  - これは、各インテントのボタン表示がなくなったことにより、自動ポップアップをする挙動に戻さなければ、ユーザがインテントを実行する手段がなくなるためである。
  - PopupIntentInsteadOfWebshare をOFFにした場合も、連動して CrosspostToTaittsuu / CrosspostToMastodon / ShowXIntentButton がすべてOFFになるため、同じ理由で NoAutoPopupAfterPost を強制的にOFFにする。
- NoAutoPopupAfterPost をユーザが直接OFFにする場合、X.comが最も優先されるべきクロスポスト先である
  - 連携先SNSグループ（CrosspostToTaittsuu / CrosspostToMastodon）のうち2つ以上が同時にONの状態でNoAutoPopupAfterPostを直接OFFにすると、自動ポップアップ先を一意に定めるためX.comへ一本化し、連携先SNSグループのトグルは両方ともOFFにする。
  - 連携先SNSグループのON数が1以下の場合は、ユーザがX.comより優先したい投稿先を選んでいると解釈し、そのトグルには一切手を触れず NoAutoPopupAfterPost のみをOFFにする。

## フォールバックのルール

- 自動ポップアップの起動に失敗した場合（ポップアップブロック等）、その旨をユーザに伝えたうえで NoAutoPopupAfterPost を自動的にONへフォールバックする（以降は手動での共有操作に切り替わる）
- 自動ポップアップのターゲット選択の優先順位は タイッツー > Mastodon > X とする（連携先SNSグループが同時に2つ以上ONの間はNoAutoPopupAfterPostが強制ONになるため、原則としてこの優先順位が実際に問われることはないが、防御的に優先順位を明示する）
- Xをターゲットとした自動ポップアップが失敗した場合、上記フォールバックに加えて ShowXIntentButton も強制的にONにする
  - ボタン表示がNoAutoPopupAfterPostに連動するため、これをしないと再試行手段がユーザに提供されない。
  - Taittsuu/Mastodonをターゲットとした場合は CrosspostToTaittsuu/CrosspostToMastodon が既にONであり、上記ルールにより自動的に対応するボタンが表示されるため、追加の強制は不要。

# テストの実装

- オプション間の挙動は複雑であるため、テストを実装すること。
- テストは条件網羅（C2）で実装すること。
