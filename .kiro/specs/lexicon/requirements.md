# Requirements Document

## Introduction

skyshare entryのレコード定義を管理し、フォークした運用者がコードを修正せずに自ドメインの名前空間識別子（NSID）でレコードを配信できるようにする。

## Boundary Context

- **In scope**:
  - entryレコードとマニフェストのlexicon定義。
  - lexicon定義からのNSIDの導出と、コード中のNSIDの利用。
  - lexicon定義の検証。
- **Out of scope**:
  - lexicon定義を使うAPIの振る舞い。
  - 仕様上固定の外部NSID。
  - 旧NSIDで作成済みのレコードの移行と、DNSによる所有権の公開作業。
  - 複数のNSIDの同時運用。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: entry レコードの定義

**Objective:** As a 開発者, I want entry のレコードの形を定義したい, so that どの実装も同じ形で保存・読み取りできる

#### Acceptance Criteria

1. The lexicon shall entry レコードを、派生元のレコードへの参照・表示用のマニフェスト・作成日時の3項目で構成する
2. The lexicon shall 派生元への参照を、参照先のレコード種別を制約しない汎用の参照とする
3. The lexicon shall マニフェストに代表画像を必須とし、見出しと説明文は省略できるようにする
4. The lexicon shall 代表画像の形式を PNG・JPEG・WebP に限り、見出しを100バイト、説明文を300バイトまでとする
5. The lexicon shall 公開済みの lexicon で、既存フィールドの型変更・必須化・削除を0件とし、追加するフィールドをすべて任意とする

### Requirement 2: NSID の導出

**Objective:** As a 運用者, I want コードを修正せずに自ドメインの NSID へ切り替えたい, so that フォークしてもレコードを自ドメインで配信できる

#### Acceptance Criteria

1. The アプリケーション shall entry とマニフェストの NSID を lexicon 定義の id からのみ導出し、コードに直書きしない
2. When 運用者が lexicon 定義の id と配置ディレクトリを自ドメインに変えたとき、the アプリケーション shall コードを修正せずに、コレクション名・型識別子・URI の扱いへ反映する
3. If entry 定義が存在しない、複数ある、または id が「.entry」で終わらないとき, then the アプリケーション shall ビルド時またはテスト時に原因を示すエラーで失敗する
4. The アプリケーション shall NSID の導出で実行時のファイル読み込みを0回とし、Cloudflare Workers 上で動作させる

### Requirement 3: URI の解析

**Objective:** As a 開発者, I want entry の URI を安全に解析したい, so that 他のコレクションのレコードを誤って扱わない

#### Acceptance Criteria

1. The アプリケーション shall entry の URI の解析で、導出した NSID のコレクションを指す URI だけを受理し、別コレクションの URI と末尾に余分なパスやクエリが付いた URI を受理しない

### Requirement 4: 検証

**Objective:** As a 開発者, I want lexicon の不整合を機械的に検出したい, so that 公開後に壊れた定義を出さない

#### Acceptance Criteria

1. If entry 定義からマニフェスト定義への参照が導出した NSID と一致しないとき, then the テスト shall 失敗する
2. The lexicon の検証 shall 配置ドメインによらず全定義を対象とし、スキーマ構文・参照の解決・パスと id の対応・id の重複を確認する
3. If アプリケーションのコードに NSID の直書きが1件でも混入したとき, then the 自動テスト shall 失敗する
