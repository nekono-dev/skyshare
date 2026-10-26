# Requirements Document

## Introduction

投稿の本文に含まれるURLから、ページの題名・説明・画像を取得して投稿に添えられるようにし、共有の直後に相手側でカードが速やかに生成されるようにする。

## Boundary Context

- **In scope**:
  - 本文からのURLの検出と、リンクカードの取得操作。
  - 取得状況とプレビューの表示。
  - OGP抽出APIの契約。
  - entryの作成直後のOGPのキャッシュの事前取得。
- **Out of scope**:
  - リンクカードの埋め込みを投稿レコードへ組み立てること。
  - OGP抽出サービスの実装。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: リンクカードの取得

**Objective:** As a 利用者, I want 本文の URL からリンクカードを取得したい, so that 投稿にページの内容を添えられる

#### Acceptance Criteria

1. While 本文にリンクの URL があるとき、the リンクカードの取得 shall 取得ボタンを表示し、URL が無いときは表示しない
2. When 取得に成功したとき、the リンクカードの取得 shall 取得済みの表示と画像のプレビューを表示する
3. If 取得に失敗したとき, then the リンクカードの取得 shall 失敗の表示を出し、プレビューを表示しない

### Requirement 2: OGP 抽出 API

**Objective:** As a 実装者, I want 抽出 API の契約を固定したい, so that 呼び出し側が応答の形を信頼できる

#### Acceptance Criteria

1. The OGP 抽出 API shall クエリに URL だけを受け付け、他のキーが含まれると拒否する
2. The OGP 抽出 API shall 題名・説明・取得元の URL と、省略できる画像を応答し、画像を省略した OGP のメタ情報も受け付ける

### Requirement 3: OGP のキャッシュの事前取得

**Objective:** As a 利用者, I want 共有の直後に相手側でカードが速やかに生成されてほしい, so that 共有先でカードが空のまま表示されない

#### Acceptance Criteria

1. When entry が作成された直後、the entry の作成 shall 発行された URL を OGP 抽出サービスへ渡し、3秒で打ち切る
2. If 呼び出しが失敗したとき, then the entry の作成 shall 例外を投げず、呼び出し元の処理を妨げない
3. If URL が空のとき, then the entry の作成 shall OGP 抽出サービスを呼ばない
