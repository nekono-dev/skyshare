# Requirements Document

## Introduction

skyshare entryの詳細ページで、entryの情報と派生元の投稿を、タイムラインと同じ投稿カードの形式で表示する。

## Boundary Context

- **In scope**:
  - entry詳細ページのヘッダーカードと投稿カードの構成。
  - 派生元から自分が続けて投稿したスレッドの表示。
  - 投稿ごとのリアクション数とページ下部の余白。
- **Out of scope**:
  - 画像のサムネイルと拡大表示の内部の動作。
  - entryの編集と削除の操作。
  - タイムラインでの投稿の表示。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: ページの構成

**Objective:** As a 閲覧者, I want entry の情報と投稿を見やすく読みたい, so that 共有された内容が分かる

#### Acceptance Criteria

1. The 詳細ページ shall entry の情報を表示するヘッダーカードと、1件以上の投稿カードで構成する
2. The ヘッダーカード shall 代表画像・説明文・entry の作成日時を表示し、見出しはページのタイトルとメタ情報にだけ使う
3. The 投稿カード shall 作者のアバター・表示名・ハンドル・投稿日時・本文・画像を表示し、投稿日時から Bluesky の投稿ページを新しいタブで開けるようにする
4. When 隣り合う投稿カードがあるとき、the 詳細ページ shall 間を線でつなぎ、連続した投稿であることを示す
5. The 詳細ページ shall ページの最下部に、端末のセーフエリアを含めた余白を、エラー表示の場合も含めて設ける

### Requirement 2: スレッドとリアクション

**Objective:** As a 閲覧者, I want 派生元から続く投稿を順に読みたい, so that 一連の内容を追える

#### Acceptance Criteria

1. When 派生元から自分が続けて投稿したスレッドがあるとき、the 詳細ページ shall 投稿をそれぞれ独立した投稿カードとして古い順に並べ、すべて展開して表示する
2. The 詳細ページ shall スレッドとして表示する投稿を自分の投稿の直線的な連鎖に限り、第三者の返信とその先の投稿を含めない
3. The 投稿カード shall その投稿自身のリアクション数を表示し、ヘッダーカードには表示しない
4. If 派生元の投稿が削除済みのとき, then the 詳細ページ shall 保存済みの内容と案内文だけを表示し、投稿カードとリアクション数を表示しない

### Requirement 3: 埋め込みの表示

**Objective:** As a 閲覧者, I want リンクや引用を含む投稿を元の形で読みたい, so that 投稿の文脈が失われない

#### Acceptance Criteria

1. When 投稿が外部リンクの埋め込みを持つとき、the 投稿カード shall 題名・説明・ドメイン・サムネイルのカードを本文の下に表示し、押すとリンク先を新しいタブで開く
2. When 投稿が画像や動画との併用を含めて引用を持つとき、the 投稿カード shall 引用元の作者・本文・画像を枠で表示し、押すと Bluesky の引用元を新しいタブで開く

### Requirement 4: エラー表示

**Objective:** As a 閲覧者, I want 表示できない理由が分かるようにしたい, so that 再試行や別の操作を選べる

#### Acceptance Criteria

1. If entry が存在しない、または取得に失敗したとき, then the 詳細ページ shall 404・500・503の状態ごとのエラー表示を行う

### Requirement 5: 描画の性質と再利用

**Objective:** As a 閲覧者, I want 速く確実に表示してほしい, so that 端末や回線を選ばずに読める

#### Acceptance Criteria

1. While JavaScript の実行回数が0回のとき、the 詳細ページ shall 投稿カードと画像のサムネイルを表示する
2. While 幅が360pxの画面のとき、the 詳細ページ shall ページ全体に横スクロールを発生させない
3. When 同じ表示言語で同じ entry が続けて開かれたとき、the 詳細ページ shall 保存済みのページを再利用して描画と API 呼び出しを省き、保存したページが古くなる時間を最大5分にする
4. When 表示言語が異なるとき、the 詳細ページ shall 別に描画する
