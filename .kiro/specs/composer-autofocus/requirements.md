# Requirements Document

## Introduction

投稿ボタンを押して投稿フォームを開いたとき、そのまま本文を入力し始められるようにして、入力欄を押す手間をなくす。

## Boundary Context

- **In scope**:
  - 投稿ボタン（フローティングボタンとサイドバーのボタン）で開く投稿フォームの、本文の入力欄へのフォーカス。
- **Out of scope**:
  - 投稿ページ（住所が /post/ のページ）と、タイムライン先頭の常時表示の投稿フォームの、表示時のフォーカス。
  - 下書き・予約の画面や、そのほかのダイアログを開いたときのフォーカス。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 開いた直後の入力

**Objective:** As a 利用者, I want 投稿フォームを開いたらそのまま本文を入力したい, so that 入力欄を押す手間が省ける

#### Acceptance Criteria

1. When 投稿ボタンを押して投稿フォームを開いたとき、the 投稿フォーム shall 先頭のセグメントの本文の入力欄にフォーカスを移し、そのまま入力できる状態にする
2. When 投稿フォームを閉じてもう一度開いたとき、the 投稿フォーム shall 再び本文の入力欄にフォーカスを移す

### Requirement 2: スクロール位置の保持

**Objective:** As a 利用者, I want フォーカスの移動で画面がずれないでほしい, so that 開く前の位置を見失わない

#### Acceptance Criteria

1. When フォーカスを移すとき、the 投稿フォーム shall 画面のスクロール位置の変化を0にする
