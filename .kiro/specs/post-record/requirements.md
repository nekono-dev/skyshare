# Requirements Document

## Introduction

Blueskyの投稿レコードを一定の規則で組み立て、壊れたレコードがPDSへ書き込まれることを防ぎ、投稿の本文から取り出したリンクとハッシュタグを他の機能が再利用できるようにする。

## Boundary Context

- **In scope**:
  - 投稿レコードの組み立てと、返信先の所有者の検証。
  - facetの範囲の検証。
  - facetからのリンクとハッシュタグの抽出、ハッシュタグの使用数の集計。
  - 送信用のfacetの検出。
- **Out of scope**:
  - 複数レコードの原子的な書き込み。
  - 本文の編集中の強調表示。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 投稿レコードの組み立て

**Objective:** As a 実装者, I want 投稿レコードを一定の規則で組み立てたい, so that 壊れたレコードが PDS へ書き込まれない

#### Acceptance Criteria

1. When 投稿レコードが組み立てられるとき、the 投稿レコードの組み立て shall 種別・本文・facet・言語・埋め込み・作成日時・投稿元のサービス名を含める
2. Where 自己ラベルが指定されている場合, the 投稿レコードの組み立て shall ラベルを自己ラベルの形式に変換して含め、未指定のときはラベルを含めない
3. Where 返信先が指定されている場合, the 投稿レコードの組み立て shall 返信先をそのまま含め、未指定のときは含めない
4. When 返信先が検証されるとき、the 投稿レコードの組み立て shall 返信先の起点と直前の投稿がどちらも自分の投稿であるとき、または返信先の指定が無いときだけ許可する

### Requirement 2: facet の範囲

**Objective:** As a 実装者, I want facet の範囲を検証したい, so that 本文とずれた注釈を書き込まない

#### Acceptance Criteria

1. If facet の範囲が本文のバイト長に収まらない、または開始位置が終了位置以上のとき, then the facet の検証 shall 不正として扱う
2. The facet の検証 shall 範囲を文字数ではなく UTF-8 のバイト数で判定する（マルチバイト文字を含む本文でも収まる範囲を正しく判定する）

### Requirement 3: 抽出・集計・検出

**Objective:** As a 実装者, I want 本文からリンクとタグを取り出し集計したい, so that 他の機能が再利用できる

#### Acceptance Criteria

1. When facet または feature の入力が渡されたとき、the 抽出 shall リンクの URI を重複なく抽出し、リンク以外の feature を無視する
2. When facet または feature の入力が渡されたとき、the 抽出 shall タグを記号なしで重複なく抽出し、タグ以外の feature を無視する
3. When 複数の投稿本文が渡されたとき、the 集計 shall ハッシュタグの使用数を、同一投稿内の重複を1件として数え、大文字小文字を区別せず、使用数の多い順に返す（表記は最初の出現を採用する）
4. When 送信用の facet が検出されるとき、the 検出 shall 本文から URL・ハッシュタグ・メンションを検出して作り、メンションは公開の AppView で DID へ解決する
