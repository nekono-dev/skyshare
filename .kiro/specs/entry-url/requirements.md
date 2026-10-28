# Requirements Document

## Project Description (Input)

Bluesky の投稿ページ・画像、Skyshare の entry ページの URL を画面や API ごとに組み立てると、形式がばらつき、共有済みのリンクとの互換が崩れる。また、クライアントから渡された AT URI をそのまま信用すると、他人のレコードや想定外の種別のレコードを扱ってしまう。

投稿・画像・entry の URL を常に同じ形式で生成し、AT URI は形式が正しく、かつ期待する種別・所有者のものだけを分解結果として得られるようにする（`.kiro/specs/entry-url/brief.md` に従う）。

## Introduction

Bluesky の投稿と Skyshare の entry の URL を一貫した形式で生成し、AT URI を安全に分解できるようにする。呼び出し側は、形式不正や他人の URI を「結果なし」として区別できる。blob 参照から画像の識別子を取り出し、画像の URL に変換することも扱う。

## Boundary Context

- **In scope**:
  - Bluesky の投稿ページと画像の URL の生成。
  - entry のパスと絶対 URL の生成。
  - AT URI の分解と、種別・所有者の検証。
  - blob 参照からの識別子の取り出しと、画像 URL への変換。
- **Out of scope**:
  - entry の NSID の導出。
  - URL の短縮。
- **Adjacent expectations**:
  - 絶対 URL の前置に使うサイトの URL は、ビルド時の公開 URL（site-config）に従う。
  - 生成する URL の形式は共有されたリンクとして外部に残るため、変えると既存のリンクが開けなくなる。
  - 所有者の検証は、呼び出し側（entry-api など）が他人のレコードを扱わないための判定の根拠になる。

## Requirements

### Requirement 1: Bluesky の投稿と画像の URL

**Objective:** As a 実装者, I want 投稿ページと画像の URL を一貫した形式で得たい, so that 画面ごとに URL の形式がばらつかない

#### Acceptance Criteria

1. When 投稿者の識別子と投稿のキーが渡されたとき, the URL Utility shall Bluesky の投稿ページの URL を返す
2. When リポジトリの DID と参照が渡されたとき, the URL Utility shall DID と参照を URL のセグメントとして符号化した Bluesky の画像の URL を返す

### Requirement 2: entry のパスと URL

**Objective:** As a 実装者, I want entry ページへのパスと絶対 URL を得たい, so that サイト内リンクと外部への共有の双方で一貫したリンクを使える

#### Acceptance Criteria

1. When 投稿者の識別子と投稿のキーが渡されたとき, the URL Utility shall 現在のオリジンに対する相対パスとして entry ページのパスを返す
2. When entry の絶対 URL が要求されたとき, the URL Utility shall サイトの URL を前置した、entry ページの絶対 URL を返す

### Requirement 3: AT URI の分解

**Objective:** As a 実装者, I want AT URI をリポジトリ・コレクション・キーに安全に分解したい, so that 不正な文字列を誤って扱わない

#### Acceptance Criteria

1. When 正しい形式の AT URI が渡されたとき, the URL Utility shall リポジトリ・コレクション・キーに分解して返す
2. If 形式が不正な文字列が渡されたとき, then the URL Utility shall 分解結果を返さない
3. If AT URI のキーに `?` または `#` が含まれるとき, then the URL Utility shall 分解結果を返さない

### Requirement 4: AT URI の所有者の検証

**Objective:** As a 実装者, I want 期待するコレクションと所有者の AT URI だけを受け付けたい, so that 他人のレコードや想定外の種別のレコードを誤って扱わない

#### Acceptance Criteria

1. When AT URI のコレクションとリポジトリがどちらも期待どおりのとき, the URL Utility shall 分解結果を返す
2. If AT URI のコレクションが期待と異なるとき, then the URL Utility shall 分解結果を返さない
3. If AT URI のリポジトリが期待と異なる（他人の URI）とき, then the URL Utility shall 分解結果を返さない
4. If AT URI 自体の形式が不正なとき, then the URL Utility shall 分解結果を返さない

### Requirement 5: blob 参照からの画像 URL

**Objective:** As a 実装者, I want blob 参照から画像の識別子を取り出し、画像の URL にしたい, so that 参照の表現の違いを意識せずに画像を表示できる

#### Acceptance Criteria

1. When 識別子が文字列として渡されたとき, the URL Utility shall その文字列を識別子として返す
2. When 識別子が `$link` を持つオブジェクトとして渡されたとき, the URL Utility shall `$link` の値を識別子として返す
3. If 参照が空、または識別子を取り出せない値のとき, then the URL Utility shall 識別子を返さない
4. When リポジトリの DID と、識別子を取り出せる参照を持つ blob が渡されたとき, the URL Utility shall Bluesky の画像の URL を返す
5. If blob が渡されない、または blob の参照から識別子を取り出せないとき, then the URL Utility shall 画像の URL を返さない
