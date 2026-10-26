# Requirements Document

## Introduction

タイムライン・entry詳細ページ・entry一覧の文章で、メンション・ハッシュタグ・URLをリンクとして表示し、押すとBlueskyのプロフィール・ハッシュタグの検索・リンク先を開けるようにする。

## Boundary Context

- **In scope**:
  - 投稿の本文の注釈からのリンクの区間の切り出し。
  - タイムライン・entry詳細ページ・entry一覧の文章のリンクの表示。
  - 一覧APIの応答への本文の注釈の追加。
- **Out of scope**:
  - 投稿フォームでの注釈の検出。
  - 引用とリンクカードの埋め込みの表示。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 注釈に基づくリンクの表示

**Objective:** As a 閲覧者, I want 文章中のメンション・ハッシュタグ・URL からリンク先へ移りたい, so that 投稿の関連情報をたどれる

#### Acceptance Criteria

1. When 文章にメンション・ハッシュタグ・URL の注釈があるとき、the リンク表示 shall メンションを Bluesky のそのアカウントのプロフィール、ハッシュタグを Bluesky のそのタグの検索、URL をそのリンク先を開くリンクとして表示する
2. The リンク表示 shall リンクを新しいタブで開き、リンク以外の本文を元の文字のまま表示する
3. If 注釈の範囲が本文の外にはみ出す、他の注釈と重なる、または文字の途中で切れるとき, then the リンク表示 shall その注釈を無視し、その範囲を文字のまま表示する
4. If URL の注釈のリンク先が http と https 以外の形式のとき, then the リンク表示 shall リンクにせず、文字のまま表示する
5. While 本文が4バイトの絵文字を含むとき、the リンク表示 shall リンクの範囲を1文字もずらさない

### Requirement 2: 注釈の受け渡し

**Objective:** As a 閲覧者, I want 一覧や詳細でも同じ注釈でリンクを見たい, so that どの画面でも同じ投稿が同じ表示になる

#### Acceptance Criteria

1. When 一覧 API が投稿を返すとき、the 一覧 API shall 投稿ごとに本文の注釈を応答に含める
2. While JavaScript の実行回数が0回の entry 詳細ページのとき、the リンク表示 shall 本文のリンクを表示する

### Requirement 3: 注釈の無い部分のリンク

**Objective:** As a 閲覧者, I want 注釈のない投稿の URL やタグもリンクで開きたい, so that 古い投稿や説明文でも操作できる

#### Acceptance Criteria

1. When 注釈の無い部分に URL が書かれているとき、the リンク表示 shall スキームを省略したものや日本語の文字に空白なしで続くものを含めてリンクとして表示し、リンク先に https を補う
2. If 注釈の無い部分のメールアドレスと版の表記のとき, then the リンク表示 shall リンクにしない
3. When entry 詳細ページの説明文に URL が含まれるとき、the リンク表示 shall スキームを省略したものを含めてリンクとして表示する
4. When entry 一覧のカードのキャプションに URL が含まれるとき、the リンク表示 shall スキームを省略したものを含めてリンクとして表示する
5. When 注釈の無い部分にハッシュタグが書かれているとき、the リンク表示 shall Bluesky のそのタグの検索を開くリンクとして表示する
6. If URL の一部のフラグメント、数字だけのもの、または直前が空白や括弧でないものであるとき, then the リンク表示 shall ハッシュタグのリンクにしない
