# Requirements Document

## Introduction

過去に寄せられた問い合わせと対処を、利用者が自分で確認できるようにする。

## Boundary Context

- **In scope**:
  - 問い合わせと対処の記事の定義と、表示言語での組み立て。
  - 記事を並べて表示するヘルプのページ。
- **Out of scope**:
  - 問い合わせの受付。
  - 記事の外部への配信。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 記事の定義

**Objective:** As a 利用者, I want ヘルプの記事を自分の表示言語で読みたい, so that 問い合わせなしに解決できる

#### Acceptance Criteria

1. The ヘルプ shall 記事に、重複しない識別子と、空でない見出しと本文を持たせる
2. When 表示言語が変わったとき、the ヘルプ shall 記事を表示言語に合わせて組み立て、記事の並びと識別子を変えない

### Requirement 2: ヘルプのページ

**Objective:** As a 利用者, I want 記事を一覧で読みたい, so that 目的の対処を探せる

#### Acceptance Criteria

1. The ヘルプのページ shall 記事を見出し付きのカードとして並べて表示する
2. The ヘルプのページ shall サイドバーとフッターナビのない単独のページとし、設定のページへ戻るリンクを置く
