# 要件書

## 概要

`pages/v2` の API ファイルのうち、業務の判断と Cloudflare のバインディング操作（DB・画像ストレージ・レート制限）と外部トークンの読み取りを持つものを、入口（入力の受け取り・業務の呼び出し・応答の返却）だけにする。判断と直接操作は `lib` の該当領域へ移す。利用者に見える API の振る舞い（URL・状態コード・応答の形・Cookie）は変えない。

2026-11-01 の実測:

- `pages/v2/entry.ts`（583 行）が、Entry の応答の整形（`serializeSkyshareEntry`）と応答の組み立て（`json200`）を持つ。
- `pages/v2/schedules.ts`・`schedules/[id].ts`・`schedules/credential.ts`・`schedules/[id]/images/[index].ts` が、DB（`env.DB`）と画像ストレージ（`env.SCHEDULE_IMAGES`）を直接扱う。
- `pages/v2/feedback.ts` が、GitHub のトークン（`env.FEEDBACK_GITHUB_TOKEN`）とレート制限（`env.FEEDBACK_RATE_LIMITER`）を直接扱う。

用語:

- **入口**: `pages/` の API ファイル。リクエストを受け取り、業務の関数を呼び、応答を返す部分。
- **直接操作**: Cloudflare のバインディング（DB・画像ストレージ・レート制限）と、環境変数に入った外部トークンを読み書きすること。

<!-- Optional when scope could be misread or the feature touches adjacent systems/specs -->

## 境界の文脈（任意）

- **対象内**: `pages/v2/entry.ts` の Entry の応答の整形の移動。`pages/v2/schedules*` のバインディング操作の移動。`pages/v2/feedback.ts` のトークンとレート制限の移動。これらの移動に伴う、テストの import パスの更新。
- **対象外**: API の入出力の形と状態コード（`api-contract` の契約）。認証と Cookie の仕組み（`session-accounts`）。応答の組み立ての重複の統合（`src-duplicates`）。予約の実行と Cron（`scheduled-posting`）。フィードバックの送信の振る舞い（`feedback`）。`pages/` の画面（`.astro`）の構成。
- **隣接する期待**: 対象の API の利用者（画面・外部クライアント）は、変更の前と同じ URL・応答を受け取る。予約・フィードバック・Entry の振る舞いは、それぞれの spec が所有する。`pages/v2` の他の API（`surveys`・`legacy` など）は変えない。

## 要件

### 1. エントリ API の入口化

**目的:** 開発者として、Entry の API ファイルが入口だけを持つようにしたい。Entry の整形の読み方が `lib/entry` に一つに決まるようにするため。

#### 受入基準

1. The エントリ API ファイル shall 入力の受け取り、業務の関数の呼び出し、応答の返却だけを行い、Entry の応答の整形を含まない。
2. When Entry の作成・更新・削除が要求されたとき, the エントリ API shall 変更の前と同じ応答の形と状態コードを返す。

### 2. 予約 API のバインディング操作の移動

**目的:** 開発者として、予約 API のファイルが DB と画像ストレージを直接扱わないようにしたい。予約の保存と画像の後始末を `lib/schedule` で読めるようにするため。

#### 受入基準

1. The 予約 API ファイル shall DB と画像ストレージを直接読み書きせず、業務の関数を通じて行う。
2. When 予約の一覧・取得・作成・更新・取消・資格情報の削除が要求されたとき, the 予約 API shall 変更の前と同じ状態コード・応答の形・Cookie を返す。
3. When 予約の画像が要求されたとき, the 予約 API shall 変更の前と同じ応答（画像の内容・存在しない場合の応答）を返す。
4. When 予約の画像の削除または差し替えに失敗したとき, the 予約 API shall 変更の前と同じく、予約の操作の結果を変えない。

### 3. フィードバック API のトークンとレート制限の移動

**目的:** 開発者として、フィードバック API のファイルが GitHub のトークンとレート制限を直接扱わないようにしたい。送信の判定と秘密情報の扱いを一箇所で確かめられるようにするため。

#### 受入基準

1. The フィードバック API ファイル shall GitHub のトークンとレート制限の仕組みを直接参照せず、業務の関数を通じて行う。
2. When フィードバックが送信されたとき, the フィードバック API shall 変更の前と同じ判定（送信の間隔の制限・GitHub への登録の成否）と同じ応答を返す。
3. The フィードバック API shall 外部トークンの値を応答・エラーの内容に含めない。

### 4. 入口の形の維持

**目的:** 開発者として、対象の API ファイルの形が規則として守られてほしい。移動の後に直接操作が戻らないようにするため。

#### 受入基準

1. The 対象の API ファイル（エントリ・予約・フィードバック） shall Cloudflare のバインディング（DB・画像ストレージ・レート制限）と外部トークンを直接読まない。
2. The 対象の API shall 利用者に見える URL・HTTP メソッド・応答の形・状態コード・Cookie を変えない。

### 5. 振る舞いと既存の検証の不変

**目的:** 利用者として、入口の整理で画面や API の振る舞いが変わらないでほしい。機能が壊れていないと分かるようにするため。

#### 受入基準

1. The 変更 shall 利用者に見える画面と API の振る舞いを変えない。
2. The 既存のテストスイート（type・unit・component・route・render・e2e） shall 変更の前と同じ件数が全て通過する。
3. When 移動に伴いテストの import パスが変わったとき, the 変更 shall テストの期待値と検証の意味を変えない。
4. When 対象の移動が完了したとき, the 許容リスト shall 対象の `pages/v2` のファイルに対する項目を減らす（残る項目は理由を記録する）。
