# Requirements Document

## Introduction

Bluesky投稿の作成と、投稿に紐づくskyshare entryの作成・編集・削除を、1つのAPIで所有権と整合性を保って行えるようにする。

## Boundary Context

- **In scope**:
  - 1件またはスレッドのBluesky投稿の作成と、同時のentryの作成。
  - 既存の投稿からのentryの作成。
  - entryの見出しと説明文の編集。
  - entryの削除と、紐づくBluesky投稿の削除。
- **Out of scope**:
  - entryの一覧の取得。
  - entryの作成対象とする投稿の選び方と、代表画像・見出し・説明文の生成。
  - 本文中のリンク・メンション・ハッシュタグの自動検出。
  - 動画の投稿。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 投稿の作成

**Objective:** As a 利用者, I want 1件またはスレッドの投稿を1回のリクエストで作成したい, so that 途中で失敗しても中途半端な投稿が残らない

#### Acceptance Criteria

1. When 投稿の作成が要求されたとき、the entry API shall 1回のリクエストで1件または複数件のスレッドの投稿を作成し、各投稿にテキスト・リンクカード・最大10枚の画像を持たせられるようにする
2. When 画像が4枚以下の投稿が作成されるとき、the entry API shall 画像形式で投稿し、5枚以上ではギャラリー形式で投稿する
3. If 画像が11枚の投稿が指定されたとき, then the entry API shall 400 で拒否する
4. When 画像とリンクカードを同時に指定した投稿が作成されるとき、the entry API shall 画像を採用する
5. Where スレッドが自分の既存の投稿への返信として指定されている場合, the entry API shall スレッドを返信として接続し、返信可否と引用可否を投稿ごとに設定できるようにする
6. If 返信先に他人の投稿が指定されたとき, then the entry API shall 400 で拒否する
7. The entry API shall 見出しを100バイト、説明文を300バイトまでとし、lexicon の上限と同じ UTF-8 のバイト数で判定する

### Requirement 2: entry の作成

**Objective:** As a 利用者, I want 投稿に対応する entry を作成したい, so that 共有用のページを持てる

#### Acceptance Criteria

1. The entry API shall entry の作成要否と代表画像をリクエスト全体で1組だけ指定できるようにし、代表画像があれば投稿の内容によらず entry を作成する
2. When 新規投稿で entry が作成されるとき、the entry API shall 派生元を常にスレッドの先頭の投稿とする
3. When 自分の既存の投稿が指定されたとき、the entry API shall 新規投稿を作らずに、その投稿自身を派生元とする entry を作成する
4. If 他人の投稿が指定されたとき, then the entry API shall 400 で拒否する
5. When 複数の投稿・gate・entry が作成されるとき、the entry API shall それぞれ1回の原子的な書き込みで全件成功か全件失敗にし、検証に失敗した場合は書き込みを1件も行わず 400 を返す
6. The entry API shall スレッドの投稿数の上限100件を、投稿の作成と下書きで同じ定数から参照する

### Requirement 3: entry の編集

**Objective:** As a 利用者, I want 自分の entry の見出しと説明文を直したい, so that 共有カードの内容を整えられる

#### Acceptance Criteria

1. When 自分の entry の見出しと説明文の更新が要求されたとき、the entry API shall 更新して 200 を返し、代表画像と派生元は変えない
2. If 他人の entry の更新が要求されたとき, then the entry API shall 400 で拒否する
3. When entry が更新されるとき、the entry API shall 読み取り時のレコードの識別子を照合条件として書き込み、同時編集による更新の消失を0件にする

### Requirement 4: entry と投稿の削除

**Objective:** As a 利用者, I want entry を削除し、必要なら紐づく投稿も削除したい, so that 公開したものを取り下げられる

#### Acceptance Criteria

1. When 自分の entry の削除が要求されたとき、the entry API shall entry を削除し、指定された場合は派生元から自分が続けて投稿した Bluesky 投稿もすべて1回の書き込みで削除する
2. The entry API shall 第三者の返信の先を削除しない
3. If 派生元が返信の投稿である entry に投稿の削除が指定されたとき, then the entry API shall entry も Bluesky 投稿も削除せず 409 で拒否する
4. If 削除範囲の判定に必要な情報を取得できないとき, then the entry API shall 何も削除せず 500 を返す
5. If 派生元が既に存在しないとき, then the entry API shall entry だけを削除する
6. If Bluesky 投稿の削除に失敗したとき, then the entry API shall entry の削除を成功として扱い 200 を返す
7. If 他人の entry の削除が要求されたとき, then the entry API shall 400 で拒否する

### Requirement 5: 共通の検証とエラー

**Objective:** As a 開発者, I want 入力の検証とエラー応答を一貫させたい, so that クライアントが失敗の原因を判断できる

#### Acceptance Criteria

1. The entry API shall 自分以外の投稿と entry への操作を0件とし、クライアントが送る URI はコレクションと所有者を検証してから使う
2. The entry API shall エラー応答を400・401・404・409・429・500に分類し、キャッシュさせない
3. If ヘッダが欠けているとき, then the entry API shall 400 を、未認証のとき 401 を、対象の entry が無いとき 404 を返す
4. The entry API shall 入力の検証と API ドキュメントを、1つのスキーマ定義から導出する
5. If 連携先がレート制限を返したとき, then the entry API shall 429 を返し、アプリ独自の投稿頻度の制限を設けない
