# Requirements Document

## Introduction

利用者に見える全文言を日本語と英語の辞書で管理し、翻訳漏れと文言の直書きを機械的に防ぐ。

## Boundary Context

- **In scope**:
  - UI文言・ヘルプ記事・ゲストモードのダミー投稿の日本語と英語の辞書。
  - 置換パラメータと単数・複数の扱い。
  - 日時と数値の書式。
  - 辞書の整合性と文言の直書きの検出。
- **Out of scope**:
  - 表示言語の決定と切り替え。
  - APIエラーの文言の決定。
  - 利用者が作成した投稿本文とプロフィールの翻訳。
  - 開発者向けのAPI説明文の翻訳。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 辞書と翻訳

**Objective:** As a 利用者, I want すべての文言を自分の言語で読みたい, so that 未翻訳の文言に戸惑わない

#### Acceptance Criteria

1. The 辞書 shall 利用者に見える文言を日本語と英語の両方に置き、未翻訳のまま表示しない
2. When 件数を含む文言を英語で表示するとき、the 辞書 shall 単数と複数を区別して表示する
3. When 表示言語を切り替えたとき、the 辞書 shall 表示中のエラーや処理結果の文言も切り替え後の言語で表示する
4. The 辞書 shall ヘルプ記事とゲストモードのダミー投稿を表示言語で表示する
5. The 辞書 shall 言語の選択肢の自称表記を翻訳しない

### Requirement 2: 書式

**Objective:** As a 利用者, I want 日時と数値を自分の言語の慣習で読みたい, so that 誤読しない

#### Acceptance Criteria

1. The 書式 shall 日時と数値を、表示言語の慣習に従った書式で表示する（英語では桁区切りなども言語に合わせて変える）
2. The 書式 shall 日本語の日時を、日本語ロケールの標準の書式と同じ表示にする

### Requirement 3: 機械的な検出

**Objective:** As a 開発者, I want 翻訳漏れと直書きを機械的に検出したい, so that 辞書の不整合を出荷前に防げる

#### Acceptance Criteria

1. If 一方の言語の辞書にのみ存在する文言があるとき, then the 辞書 shall 型検査と辞書の整合性テストで検出する
2. If 存在しない文言キーの参照、または置換パラメータの過不足があるとき, then the 辞書 shall 型検査で検出する
3. If ソースコードに日本語・英語の文言が直書きされているとき, then the 辞書 shall テストで検出し、例外を理由付きの許可一覧で管理する
