# Brief: src-pages-thin

## Problem

steering は「`src/pages/` は入口（画面と API）だけを持ち、業務の判断は `src/lib/` に置く」と定めている。しかし `pages/v2` の一部は DB・R2・GitHub のトークン・レート制限を直接扱い、判断と組み立てが入口に残っている。入口の読みやすさと、テストのしやすさを下げている。

## Current State

- `pages/v2/entry.ts`（583 行）: `serializeSkyshareEntry`（69 行）と `json200` を持つ。`lib/` の import が 14 件、ヘルパ 5 件。
- `pages/v2/schedules.ts`・`schedules/[id].ts`・`schedules/credential.ts`・`schedules/[id]/images/[index].ts`: `env.DB` と `env.SCHEDULE_IMAGES` を直接使う。
- `pages/v2/feedback.ts`: `env.FEEDBACK_GITHUB_TOKEN` と `env.FEEDBACK_RATE_LIMITER` を直接扱う。
- `pages/` のルート 40 件のうち、`lib/` を直接 import しているのは 35 件（業務の呼び出しは `lib` 経由で行っている）。

## Desired Outcome

- `pages/` の API ファイルは、入力の受け取り・`lib` の呼び出し・応答の返却だけを行う。
- Cloudflare のバインディング（`env.DB`・R2・Rate Limiter）と外部トークンの読み取りは `lib` の関数の中に入る。
- 応答の組み立て（`json200`・`jsonResponse`）は、呼び出し側が同じ形で使える 1 箇所にまとまる（重複の統合は `src-duplicates` が行う）。

## Approach

- 業務の判断（serialize・検証・組み立て）を `lib/` の該当領域へ移す（`entry.ts` は `lib/entry/`、`schedules*` は `lib/schedule/`、`feedback.ts` は `lib/feedback/`）。
- バインディングを受け取る関数の引数は、`locals` または `env` を明示的に渡す形にする。design で具体化する。

## Scope

- **In**: `pages/v2/entry.ts`・`pages/v2/schedules*`・`pages/v2/feedback.ts` の判断と直接操作の移動、`pages/v2/entry.ts` の serialize の移動、`pages` の入口としての形の確認。
- **Out**: API の入出力の形と状態コード（`api-contract` の契約）、認証の仕組み（`session-accounts`）、応答の重複の統合（`src-duplicates`）。

## Boundary Candidates

- エントリ API（`pages/v2/entry.ts`）の判断の移動
- 予約 API（`pages/v2/schedules*`）のバインディング操作の移動
- フィードバック API（`pages/v2/feedback.ts`）のトークンとレート制限の移動

## Out of Boundary

- 入出力の契約の変更（`api-contract`）
- 予約の実行と Cron（`scheduled-posting`）、フィードバックの送信の振る舞い（`feedback`）
- `pages/` の画面（`.astro`）の構成

## Upstream / Downstream

- **Upstream**: `src-import-rules`（`pages` の検査）
- **Downstream**: `src-duplicates`（応答の組み立ての統合は、移動の後に行う）、`src-import-style`

## Existing Spec Touchpoints

- **Extends**: なし（振る舞いは変えない）
- **Adjacent**: `api-contract`（入出力の形）、`scheduled-posting`（予約 API）、`feedback`（フィードバック API）、`entry-sharing`（entry API）、`surveys`・`legacy-posts`（別の API）

## Constraints

- API の応答（状態コード・応答の形・Cookie）は変えない。route テスト（135 件）で守る。
- 検証の基準 272 件が全通過すること。
- `pages/` の変更は、移動した関数の route テストの import パスを更新するだけにする（テストの意味は変えない）。
