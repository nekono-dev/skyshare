# Requirements Document

## Introduction

タイムラインとentry詳細ページで動画の投稿をそれと分かる形で表示し、詳細ページでは利用者の操作で動画を再生できるようにする。

## Boundary Context

- **In scope**:
  - タイムラインでの動画のサムネイルの表示。
  - entry詳細ページでの動画の再生。
  - 再生できない動画の表示。
  - ゲスト表示とサンプルページの動画の例。
- **Out of scope**:
  - タイムラインでの動画の再生。
  - 字幕の表示。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 動画の投稿の表示

**Objective:** As a 閲覧者, I want 動画の投稿を動画と分かる形で見たい, so that 静止画の投稿と見分けられる

#### Acceptance Criteria

1. The タイムライン shall 動画の投稿を poster に再生ボタンを重ねて表示し、再生しない
2. The entry 詳細ページ shall 動画の投稿を poster に再生ボタンを重ねて表示する
3. The 動画の表示 shall 動画の縦横比の表示領域を確保し、縦横比が不明なら16:9とし、再生の前後で配置を変えない
4. The 再生ボタン shall 直径59pxの半透明の暗い円に白い再生記号を重ねて、表示領域の中央に置く
5. Where 動画に代替テキストがある場合, the 動画の表示 shall poster の代替テキストとして使う
6. The 動画の表示 shall skyshare 以外のクライアントで作成した動画の投稿も、同じ規則で表示する
7. The ゲスト表示のタイムラインとサンプルの entry ページ shall 動画の投稿の例を表示する

### Requirement 2: 再生

**Objective:** As a 閲覧者, I want 詳細ページで動画を再生したい, so that 投稿の内容を動画で確認できる

#### Acceptance Criteria

1. When entry 詳細ページで再生ボタンが操作されたとき、the 動画の再生 shall 再生を始める
2. The 動画の再生 shall 再生ボタンを操作するまで、動画のデータと再生用のライブラリを取得しない
3. If 再生に失敗したとき, then the 動画の再生 shall 失敗した旨と元の Bluesky 投稿へのリンクを表示する（再生用のプレイリストが404のときも同じ）
4. The 動画の再生 shall 再生ボタンへの到達と再生の開始を、キーボードの Tab キーと Enter キーの2操作で行えるようにする
5. The 動画の再生 shall Chromium 系・Firefox・Safari の3種類のブラウザで動画を再生できるようにする

### Requirement 3: 再生できない動画

**Objective:** As a 閲覧者, I want 引用された動画が再生できない理由を知りたい, so that 元の投稿で見ればよいと分かる

#### Acceptance Criteria

1. Where 引用投稿に動画が添付されている場合, the 動画の表示 shall 動画を再生できないものとし、poster を暗くして再生できない旨と Bluesky へのリンクを重ね、再生ボタンを置かない（タイムラインと entry 詳細ページの両方）
