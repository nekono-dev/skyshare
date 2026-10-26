# Requirements Document

## Introduction

Blueskyの投稿とSkyshare entryのURLを、一貫した形式で生成し、AT URIを安全に分解できるようにする。

## Boundary Context

- **In scope**:
  - Bluesky投稿のURLと画像のURLの生成。
  - entryのパスとURLの生成。
  - AT URIの分解と、所有者の検証。
- **Out of scope**:
  - entryのNSIDの導出。
  - URLの短縮。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: URL の生成

**Objective:** As a 実装者, I want 投稿と entry の URL を一貫した形式で生成したい, so that 画面ごとに URL の形式がばらつかない

#### Acceptance Criteria

1. When 投稿者の識別子と投稿のキーが渡されたとき、the URL 生成 shall Bluesky の投稿ページの URL を生成する
2. When リポジトリの DID と参照が渡されたとき、the URL 生成 shall DID と参照を符号化して Bluesky の画像の URL を生成する
3. When 投稿者の識別子と投稿のキーが渡されたとき、the URL 生成 shall entry の相対パスを生成する
4. When entry の URL が要求されたとき、the URL 生成 shall サイトの URL を前置した絶対 URL を生成する

### Requirement 2: AT URI の分解と検証

**Objective:** As a 実装者, I want AT URI を安全に分解したい, so that 他人のレコードを誤って扱わない

#### Acceptance Criteria

1. When 正しい AT URI が渡されたとき、the URL 生成 shall リポジトリ・コレクション・キーに分解する
2. If 形式が不正な文字列が渡されたとき, then the URL 生成 shall 分解しない
3. When AT URI の所有者が検証されるとき、the URL 生成 shall コレクションとリポジトリがどちらも期待どおりのときだけ分解結果を返す
4. If リポジトリが期待と異なる（他人の）URI のとき, then the URL 生成 shall 分解しない
