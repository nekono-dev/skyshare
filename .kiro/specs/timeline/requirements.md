# Requirements Document

## Introduction

自分の投稿の一覧で、スレッドをまとめて折りたたんで表示し、entryの無い画像・動画の投稿から後からentryを作成できるようにする。

## Boundary Context

- **In scope**:
  - スレッドグループの折りたたみと展開の表示。
  - 後からのentryの作成のボタンと、代表画像と派生元の決定。
  - 削除の後の一覧の更新。
- **Out of scope**:
  - スレッドの構造の判定。
  - 投稿カードの画像の表示と、entryの削除の確認の内部の動作。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: スレッドグループの表示

**Objective:** As a 利用者, I want 長いスレッドを折りたたんで一覧したい, so that タイムラインを見通せる

#### Acceptance Criteria

1. The 一覧 shall 2件以上のスレッドグループを、既定で起点の投稿と後続の件数だけを表示する折りたたみ表示にする
2. When 折りたたみが展開されたとき、the 一覧 shall グループの全投稿を古い順に表示し、返信のカードは幅を縮めて左に段を設ける
3. The 一覧 shall 1件のスレッドグループを折りたたまずに1枚の投稿カードとして表示する
4. The 一覧 shall スレッドのバッジを表示せず、entry を開くリンクをカード下部の操作の列の右端に置き、残りの幅が足りない場合は表示しない
5. The 一覧 shall 後続の投稿のカードに下部のツールバー（Bluesky で開く・共有・Entry 関連の操作・entry を開くリンク）を表示せず、起点のカードにだけ表示する
6. The 一覧 shall 単独の投稿のカードの表示と entry の作成・編集・削除の操作を、スレッドの表示の追加によって1件も変えない

### Requirement 2: 後からの entry の作成

**Objective:** As a 利用者, I want entry の無い投稿から後で entry を作りたい, so that 過去の投稿も共有用のページにできる

#### Acceptance Criteria

1. The 一覧 shall entry を作成のボタンを、起点の投稿に entry が無く、起点か後続が画像か動画を持つグループの、起点のカードにだけ表示する
2. The 一覧 shall 後続の投稿の entry の有無を、起点の entry を作成のボタンの表示に影響させない
3. When 代表画像の素材が決められるとき、the 一覧 shall 起点が画像か動画を持てば起点を、持たなければ後続のうち起点に最も近い画像か動画の投稿を素材とする
4. When entry が作成されるとき、the 一覧 shall 代表画像の素材の投稿によらず、常に起点の投稿を派生元として指定する

### Requirement 3: 削除の後の一覧

**Objective:** As a 利用者, I want 削除の結果が一覧に正しく反映されてほしい, so that 消えた投稿が残って見えない

#### Acceptance Criteria

1. When Bluesky 投稿を含む削除が成功したとき、the 一覧 shall そのスレッドグループ全体を一覧から取り除く
2. When entry だけの削除が成功したとき、the 一覧 shall グループを残す

### Requirement 4: コントラストの調整

**Objective:** As a 利用者, I want 共有できる内容が無いスレッドを見分けたい, so that entry を作れるスレッドに注目できる

#### Acceptance Criteria

1. When グループのどの投稿も画像・動画・entry を持たないとき、the 一覧 shall 起点と返信のすべてのカードの中身のコントラストを下げる
2. While カードの中身のコントラストを下げているとき、the 一覧 shall 操作のボタンのアイコンと本文のリンクの色も、本文と同じくコントラストを下げる
