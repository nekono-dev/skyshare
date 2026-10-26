# Requirements Document

## Introduction

設定の予約投稿の近くで、予約できる投稿の種類と、より本格的な予約投稿のための外部サービスを案内し、利用者が予約できない投稿を作ってから気づくことを減らす。

## Boundary Context

- **In scope**:
  - 予約できる投稿とできない投稿の、画像と動画のアイコンを使った注。
  - 本格的な予約投稿サービス Chronosky への、ロゴつきの案内とリンク。
- **Out of scope**:
  - 予約投稿の有効化と無効化の操作。
  - Chronosky の機能の説明と、Chronosky との連携。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 予約できる投稿の案内

**Objective:** As a 利用者, I want 予約できる投稿の種類を事前に知りたい, so that 予約できない投稿を作ってから気づかずに済む

#### Acceptance Criteria

1. The 設定の予約投稿の説明文 shall 末尾に、画像つきの投稿を予約できることを、画像のアイコンを単語の代わりに文中に置いて示す（アイコンには代替テキストを付ける）

### Requirement 2: 外部サービスへの案内

**Objective:** As a 利用者, I want 動画の予約や高度な機能の使い先を知りたい, so that 目的に合うサービスを選べる

#### Acceptance Criteria

1. The 設定の予約投稿の説明文 shall 同じ場所に、動画の予約投稿や高度な機能には Chronosky を使うよう、動画のアイコンを単語の代わりに文中に置いて案内する
2. The 設定の予約投稿の説明文 shall Chronosky のロゴと公式サイトを開くリンクを置き、リンクを新しいタブで、参照元を渡さずに開く

### Requirement 3: 多言語対応

**Objective:** As a 利用者, I want 案内を日本語と英語で読みたい, so that 自分の言語で理解できる

#### Acceptance Criteria

1. The 案内 shall 文言を日本語と英語の2言語で持ち、辞書にキーをそろえ、文言の直書きを0件にする
