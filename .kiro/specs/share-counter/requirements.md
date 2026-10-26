# Requirements Document

## Introduction

投稿フォームの文字数カウンタで、共有先SNSの上限から共有文の末尾に付くURLの分を差し引き、上限超過を投稿前に知らせる。

## Boundary Context

- **In scope**:
  - 投稿フォームの先頭の投稿に表示するX・タイッツーの文字数カウンタの上限。
  - 自動ポップアップするSNSに応じたカウンタの表示切り替え。
- **Out of scope**:
  - Blueskyの文字数カウンタの上限。
  - 共有文そのものの省略。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 上限の補正

**Objective:** As a 利用者, I want 共有文に付く URL の分を差し引いた上限を知りたい, so that 共有先で上限を超えないか投稿前に分かる

#### Acceptance Criteria

1. The 文字数カウンタ shall X・タイッツーのカウンタの上限を、共有文の末尾に付く文字列の分だけ減らし、本文の文字数表示は変えない
2. While 投稿が画像または動画を含み、画像を自分で添付が OFF のとき、the 文字数カウンタ shall skyshare entry の URL と直前の改行を減算対象にする
3. While 画像を自分で添付が ON のとき、the 文字数カウンタ shall X のカウンタの上限を140に戻す
4. The 文字数カウンタ shall skyshare entry の URL の長さを、投稿者の DID と記録キーと同じ長さの疑似値から組み立てた URL で予測し、実際の URL と同じ長さと構造にする
5. The 文字数カウンタ shall 本文に含まれないリンクカードの URL と直前の改行を減算対象にし、本文に含まれるリンクカードの URL は減算しない
6. The 文字数カウンタ shall 減算量を、末尾文字列を宛先別の半角単位で数え、2で割って切り上げた値とする（X は改行1と URL 23の合計24の半分の12、タイッツーは URL の全文字を数えた値）
7. The 文字数カウンタ shall 上限の補正を共有文に使う先頭の投稿にのみ行い（2件目以降の上限は140のまま）、長文を省略して共有の設定によらず常に行う

### Requirement 2: カウンタの表示切り替え

**Objective:** As a 利用者, I want 共有先に関係するカウンタだけを見たい, so that 不要なカウンタで混乱しない

#### Acceptance Criteria

1. While ポップアップを開く設定が ON のとき、the 文字数カウンタ shall 自動ポップアップする SNS が X なら X、タイッツーならタイッツー、投稿時に選択するなら両方のカウンタを表示する
2. While 自動ポップアップする SNS が Mastodon または Misskey のとき、the 文字数カウンタ shall X・タイッツーのカウンタを表示しない
3. While ポップアップを開く設定が OFF のとき、the 文字数カウンタ shall X のカウンタを表示する
4. The 文字数カウンタ shall Bluesky のカウンタを常に表示し、上限（300）を補正しない
