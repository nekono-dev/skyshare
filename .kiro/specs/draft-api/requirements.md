# Requirements Document

## Introduction

1件の投稿とスレッドの下書きを、Blueskyの下書き機能に保存・取得・更新・削除できるようにする。

## Boundary Context

- **In scope**:
  - 下書きの一覧取得・作成・更新・削除のAPI。
  - 下書きの本文と自己ラベルの形式。
- **Out of scope**:
  - 画像・動画・リンクカードの下書きへの保存。
  - 投稿フォームでの下書きの表示と復元。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 下書きの形式

**Objective:** As a 利用者, I want 単発の投稿もスレッドも下書きにしたい, so that 書きかけを後で続けられる

#### Acceptance Criteria

1. The 下書き API shall 下書きを1件から100件の投稿の配列とし、1件なら単発投稿、2件以上ならスレッドの下書きとして扱う
2. If 投稿が0件または101件の下書きが作成されるとき, then the 下書き API shall 400 で拒否する
3. The 下書き API shall 下書きの各投稿に本文と任意の自己ラベルを持たせ、画像・動画・リンクカードは持たせない
4. If 自己ラベルが文字列の配列でない投稿があるとき, then the 下書き API shall 拒否する
5. The 下書き API shall 下書きの投稿数の上限100件を、投稿の作成と同じ定数から参照する

### Requirement 2: 下書きの操作

**Objective:** As a 利用者, I want 下書きを一覧・作成・更新・削除したい, so that 下書きを整理できる

#### Acceptance Criteria

1. When 下書きの一覧が要求されたとき、the 下書き API shall 件数の上限と続きを示すカーソルを指定して取得できるようにする
2. If 件数の上限が範囲外、またはカーソルが空文字のとき, then the 下書き API shall 400 で拒否する
3. When 下書きが作成されたとき、the 下書き API shall 200 とその識別子を返す
4. When 識別子を指定して更新が要求されたとき、the 下書き API shall 下書きの投稿の配列を置き換えて 200 を返す
5. When 識別子を指定して削除が要求されたとき、the 下書き API shall 下書きを削除して 200 を返す
6. If 削除に識別子が無いとき, then the 下書き API shall 400 で拒否する
7. If 連携先から取得した下書きの一覧が想定の形式でないとき, then the 下書き API shall 1件でも不正なら一覧全体を失敗とし、500 を返す

### Requirement 3: エラー応答

**Objective:** As a 利用者, I want 失敗の原因が分類されて伝わってほしい, so that 再ログインや再試行などの対処ができる

#### Acceptance Criteria

1. If 未認証のとき, then the 下書き API shall 401 を返す
2. The 下書き API shall エラー応答を400・401・429・500に分類し、連携先の例外を投稿の API と同じ規則で変換する
