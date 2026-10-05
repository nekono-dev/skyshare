# submitButtonの仕様

PostFormから実行される「投稿」ボタンの挙動を以下に示す

## ManualImageAttach

- 概要
  - Skyshare Entryを生成しない設定値
- 想定する挙動
  - ONの場合、Skyshare Entryを生成する工程をスキップする。
  - その後の共有工程において、Skyshare URLを付与する処理を実行しない
  - ManualImageAttachは、Skyshare EntryによるOGP代行が不要なユーザの設定であるが、真にユーザがこのオプションをONにする意図は、インテント後のポストに画像データを添付することにある。
  - ONにした時点で TruncateIntentText は強制的にOFFになる（保存値もOFFへ更新する）。ONの間 TruncateIntentText は操作できない。

## TruncateIntentText

- 概要
  - X・タイッツー向けの共有文について、本文を省略し、140字（twitter-textの重み付き長で280）以内に収める
- 想定する挙動
  - 省略対象は本文のみ。Skyshare Entry URL・リンクカードURLは削らない。省略時は本文末尾に「...」を付け、改行を挟んでURLを続ける。
  - 省略の実行契機は、このオプションがONで、intentを実行するSNSがXまたはタイッツーであること。Skyshare Entry URLの有無（画像以外の投稿を含む）は問わない。Mastodon向け、WebShareAPI向けの共有文は省略しない。（ManualImageAttach ONの間はこのオプション自体がOFFのため省略されない）
  - URLだけで上限近く本文を1文字も残せない場合は省略せず、上限超過のまま共有する。
  - Bluesky投稿本文には影響しない。
  - 投稿フォームでは「詳細オプション」内（AutoPopupTarget の次）に配置する。

## PopupIntentInsteadOfWebshare

- 概要
  - WebShareAPIではなく、インテントポップアップを起動する
- 想定する挙動
  - ONの場合、WebShareAPIの試行工程をスキップし、AutoPopupTargetに従う。
  - OFFの場合、WebShareAPIで共有する。

## AutoPopupTarget

- 概要
  - 投稿成功後に自動でポップアップするSNSを選ぶ。「投稿時に選択する」「X」「タイッツー」「Mastodon」から選び、既定は「X」。
  - PopupIntentInsteadOfWebshare が ON の場合のみ表示する。投稿フォームでは「詳細オプション」内の先頭、設定ページでは PopupIntentInsteadOfWebshare の直下に配置する。この設定値（および表示条件の PopupIntentInsteadOfWebshare）は、詳細オプションを初期状態で開く理由にしない。
- 想定する挙動
  - 「X」「タイッツー」「Mastodon」の場合、そのSNSのインテントを自動ポップアップする。
  - 「投稿時に選択する」の場合、ポップアップを自動では開かず、投稿先選択ダイアログを開く。
  - 「Mastodon」でMastodonのインスタンスドメインが不正な形式の場合も、ポップアップを自動では開かず、投稿先選択ダイアログを開く（選択値は変更しない）。ドメイン未設定の場合は mastodon.social を使う。
  - 自動ポップアップがブロック等で開けなかった場合は、その旨をユーザに伝えたうえで、投稿先選択ダイアログを開き、選択値を「投稿時に選択する」へ変更する。

## 投稿先選択ダイアログ

- 概要
  - 「X」「タイッツー」「Mastodon」「閉じる」を選べるダイアログ。Skyshare Entryの有無に関わらず開く。
- 想定する挙動
  - 投稿フォームのテキストボックスは投稿成功後に常にクリアする。本文・Skyshare Entry URL・リンクカードURLはダイアログが保持し、選択された投稿先ごとにTruncateIntentTextの適用を判定して共有文を組み立てる。
  - 投稿後に開いたダイアログは、投稿先を選択しても閉じない。「閉じる」・背景クリック・Escキーで閉じる。
  - タイムラインの投稿から開いたダイアログは、投稿先を選択するとポップアップを開いて閉じる。
  - Mastodonのインスタンスドメインが不正な形式の場合、Mastodon項目は選択できない。

## PinnedFormDisabled

_submitButtonの挙動に影響しないため省略_

# 複合した際の挙動

- PopupIntentInsteadOfWebshare がOFFの場合
  - AutoPopupTarget は参照しない（プルダウンも表示しない）。WebShareAPIで共有する。ManualImageAttach がON の場合、WebShareAPIで送信するデータには画像データを添付する。
- WebShareAPIが非対応、または対応環境で実際に試行したが失敗した場合（ユーザによる共有シートのキャンセルを除く）
  - その場でXポップアップを即時に試行する。このXポップアップの共有文はTruncateIntentTextに従う。
  - 開けた場合は PopupIntentInsteadOfWebshare を ON、AutoPopupTarget を「X」にする。
  - 開けなかった場合は PopupIntentInsteadOfWebshare を ON、AutoPopupTarget を「投稿時に選択する」にし、投稿先選択ダイアログを開く。

# 文字数カウンタ

- 表示するカウンタは AutoPopupTarget で決まる。Bluesky（上限300）は常に表示する。
  - 「X」: X。「タイッツー」: タイッツー（Xは非表示）。「Mastodon」: Xもタイッツーも非表示。「投稿時に選択する」: XとタイッツーとBlueskyの3つ。
  - PopupIntentInsteadOfWebshare が OFF（WebShareAPI）の場合は、共有先を特定できないため従来どおりXとBlueskyの2つ。
- X・タイッツーの上限（右側の値）と警告開始値は 140 から、共有文の末尾に付く文字列（直前の改行を含む）の換算ぶんを引く。左側の値（本文の実文字数）は変えない。Blueskyは補正しない。補正を受けるのは先頭セグメントのみ。
  - skyshare entry URL: entry が作られる場合（画像/動画を含み、かつ ManualImageAttach が OFF）のみ。URL は投稿前に確定しないため `estimateSkyshareEntryUrl` で長さを予測する。
  - リンクカードURL: 本文に含まれていない場合のみ。
- 換算: Xは URL=23 固定、タイッツーは URL も全文字（全角1・半角0.5、改行0.5）。TruncateIntentText の設定には依らず常に補正する。

# 旧設定の引き継ぎ

公開済みの旧設定（自動ポップアップをOFFにする／タイッツーにクロスポスト／Mastodonにクロスポスト／X投稿ボタンを表示）が保存されている環境では、AutoPopupTarget が未保存の場合に限り、次の規則（上から順に最初に該当したもの）で値を引き継ぎ、旧設定の保存値を削除する。

1. タイッツーにクロスポスト・Mastodonにクロスポスト・X投稿ボタンを表示 のうち2つ以上が ON → 「投稿時に選択する」
2. ちょうど1つだけが ON → そのSNS（タイッツー／Mastodon／X）
3. 上記のいずれでもない（すべて OFF、または 自動ポップアップをOFFにする のみ ON を含む） → 「X」

この引き継ぎは一時的な機能であり、`legacyShareSettings.ts` に分離している。

# テストの実装

- オプション間の挙動は複雑であるため、テストを実装すること。
- テストは条件網羅（C2）で実装すること。
