# Requirements Document

## Introduction

利用者が、画面の幅に合ったナビゲーションで主要なページへ移動でき、現在地とゲスト表示の状態を見失わないようにする。

## Boundary Context

- **In scope**:
  - 主要なページへのリンクの一覧と並び順。
  - デスクトップ幅のサイドバーと、モバイル幅のフッターのナビゲーション。
  - 現在地の表示と、ゲスト表示の引き継ぎ。
  - ログイン中のアカウントのアイコンの表示。
- **Out of scope**:
  - 新規投稿のボタンの描画。
  - ページ自体の内容。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: ゲスト表示の引き継ぎ

**Objective:** As a 開発者, I want ゲスト表示のままページを行き来したい, so that ログインせずに画面の動作を確認できる

#### Acceptance Criteria

1. When URL にゲスト表示を示すクエリがあるとき、the ゲスト表示の判定 shall ゲスト表示が要求されたと判定する
2. If URL にゲスト表示のクエリが無い、またはブラウザが無いとき, then the ゲスト表示の判定 shall ゲスト表示が要求されていないと判定する
3. While ゲスト表示中のとき、the ナビゲーション shall リンクにゲスト表示のクエリを付ける
4. While ゲスト表示でないとき、the ナビゲーション shall リンクを変えない
5. While ゲスト表示のとき、the ナビゲーション shall ページの読み込みと遷移のたびに、リンクへゲスト表示のクエリを引き継ぐ

### Requirement 2: 項目と現在地

**Objective:** As a 利用者, I want 現在どのページにいるかが分かるナビゲーションを使いたい, so that 迷わず移動できる

#### Acceptance Criteria

1. The ナビゲーション shall サイドバーとフッターで同じ項目を別々の並び順で持つ
2. When 現在地を判定するとき、the ナビゲーション shall 末尾のスラッシュを除いて比べる
3. When 現在地を判定するとき、the ナビゲーション shall 配下のパスも現在地とし、トップページは完全に一致するときだけ現在地とする
4. The ナビゲーション shall 現在のページに対応するリンクにだけ、現在地を示す印を付ける

### Requirement 3: 画面幅に応じた表示

**Objective:** As a 利用者, I want 画面の幅に合ったナビゲーションを使いたい, so that どの端末でも操作しやすい

#### Acceptance Criteria

1. While デスクトップ幅のとき、the ナビゲーション shall サイドバーを決まった順に表示し、フッターを隠す
2. While モバイル幅のとき、the ナビゲーション shall フッターを表示し、サイドバーを隠す

### Requirement 4: アカウントのアイコン

**Objective:** As a 利用者, I want ログイン中のアカウントが分かるようにしたい, so that どのアカウントで操作しているか確認できる

#### Acceptance Criteria

1. While ログイン中のアカウントがあるとき、the ナビゲーション shall アカウントのリンクのアイコンをそのアカウントの画像に差し替える
