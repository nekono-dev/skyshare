# Requirements Document

## Introduction

利用者が不具合の報告と新機能の提案を1つのフォームから送れるようにし、送る内容と自動で添える情報を送信の前に確かめられるようにする。

## Boundary Context

- **In scope**:
  - 報告と提案のページと、設定のページからの導線。
  - 種別の切り替えと、種別ごとの入力欄。
  - 環境の情報の収集と、共有と公開の注記。
  - 送信と、結果の表示。
- **Out of scope**:
  - 入力の検証と Issue の登録。
  - スクリーンショットの添付。
- **Adjacent expectations**:
  - 前提: feedback-api — 送信先の受付と、入力の上限と再現の頻度の値を使うため
  - 前提: counted-text-input — 文字数カウンタ付きの入力欄を使うため

## Requirements

### Requirement 1: ページと導線

**Objective:** As a 利用者, I want 設定のページから報告と提案のページへ移りたい, so that 困ったときにすぐ連絡できる

#### Acceptance Criteria

1. The 報告と提案のページ shall サイドバーとフッターナビのない単独のページとし、設定のページのヘルプへのリンクの下からリンクされる
2. When 表示言語が切り替わったとき、the 報告と提案のページ shall 文言を表示言語に合わせて切り替える
3. If 未ログインのとき, then the 報告と提案のページ shall フォームを出さず、ログインが必要なことと、ログインのページへのリンクを示す

### Requirement 2: 種別ごとの入力欄

**Objective:** As a 利用者, I want 不具合と提案で必要な項目だけを入力したい, so that 迷わずに書ける

#### Acceptance Criteria

1. When 種別がラジオボタンで切り替えられたとき、the フォーム shall 不具合と新機能の提案の入力欄の構成だけを変え、送信の仕組みは共通とする
2. The フォーム shall 件名を1行の入力欄とし、見出しを不具合なら「不具合を端的に説明」、新機能の提案なら「新機能を端的に説明」とする
3. When 不具合が選ばれたとき、the フォーム shall 操作した内容の複数行の欄と再現の頻度の4つの選択肢を示す
4. When 新機能の提案が選ばれたとき、the フォーム shall 機能の内容と任意の技術的な補足の複数行の欄を示す
5. The フォーム shall 文章の入力欄をすべて文字数カウンタ付きとし、件名は100文字、本文の各欄は2000文字を上限として表示する
6. While 必須の項目が空白だけ、または上限を超える、または送信中のとき、the フォーム shall 送信のボタンを押せなくする

### Requirement 3: 送る内容の確認

**Objective:** As a 利用者, I want 自動で添えられる情報を送信の前に知りたい, so that 納得して送信できる

#### Acceptance Criteria

1. The フォーム shall Bluesky のハンドルと環境の情報が自動で収集されて開発者に共有され、GitHub で公開されることを注記し、送る値を一覧で示す
2. The フォーム shall 環境の情報を、OS・ブラウザ・ホーム画面から起動したか・ブラウザの識別文字列・画面の版とコミットとする

### Requirement 4: 送信の結果

**Objective:** As a 利用者, I want 送信の結果が分かるようにしたい, so that 成功の確認や再試行ができる

#### Acceptance Criteria

1. When 送信に成功したとき、the フォーム shall 作成した Issue へのリンクを示して入力を空にする
2. If 送信に失敗したとき, then the フォーム shall 状態に応じた文言を示して入力を残す（429のときは時間を置く旨を示す）
