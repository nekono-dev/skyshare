# Requirements Document

## Introduction

他SNSへ渡す共有文を本文とURLから組み立て、X・タイッツーの文字数上限に収まるよう本文だけを省略できるようにする。

## Boundary Context

- **In scope**:
  - 本文・skyshare entryのURL・リンクカードのURLからの共有文の組み立て。
  - X・タイッツー向け共有文の本文の省略。
  - 宛先ごとの文字数の数え方。
- **Out of scope**:
  - Blueskyへの投稿本文。
  - 省略するかどうかの設定の保持。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 共有文の組み立て

**Objective:** As a 利用者, I want 本文と URL を共有先に渡したい, so that 共有先で内容とリンクが伝わる

#### Acceptance Criteria

1. The 共有文の組み立て shall 本文の後に改行区切りで skyshare entry の URL とリンクカードの URL を続ける
2. When 本文にリンクカードの URL が含まれるとき、the 共有文の組み立て shall 共有文の末尾にそのURLを重複して付けず、共有文に1回だけ現れるようにする

### Requirement 2: 文字数の数え方

**Objective:** As a 利用者, I want 共有先の数え方で上限を判定したい, so that 共有先で切れない

#### Acceptance Criteria

1. The 文字数の数え方 shall X 向けの文字数を、全角2・半角1・改行1・URL は長さによらず23として数える
2. The 文字数の数え方 shall タイッツー向けの文字数を、全角2・半角1・改行1の単純加算とし、URL も全文字を数える

### Requirement 3: 本文の省略

**Objective:** As a 利用者, I want 長文でも URL を残して共有したい, so that 共有先でリンクが失われない

#### Acceptance Criteria

1. While 長文を省略して共有が ON のとき、when X・タイッツー向けの共有文が組み立てられるとき、the 共有文の組み立て shall 本文を省略して上限以内に収める
2. The 共有文の組み立て shall 省略の上限を、半角単位の280から共有先が末尾に付け足す空白1文字分を引いた279とし、宛先が X・タイッツーで省略が ON のときだけ上限を返す
3. The 共有文の組み立て shall 省略の対象を本文のみとし、skyshare entry の URL とリンクカードの URL を削らない
4. When 本文を省略するとき、the 共有文の組み立て shall 本文の末尾に半角ピリオド3つを付け、URL がある場合は改行を挟んで URL を続ける
5. If 本文と URL を合わせて上限以内に収まるとき, then the 共有文の組み立て shall 本文を加工しない
6. If URL だけで上限に達して本文を1文字も残せないとき, then the 共有文の組み立て shall 省略せずに本文を元のまま渡す
7. When 省略の切り取り位置が決まるとき、the 共有文の組み立て shall 結合文字を含む1つの書記素を分断しない
