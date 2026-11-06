# 調査ログと設計判断

## Summary

- **Feature**: `src-pages-thin`
- **Discovery Scope**: Extension（既存の API ファイルの業務の移動。振る舞いは変えない）
- **Key Findings**:
  - 対象の直接操作は、予約 API の `env.DB`・`env.SCHEDULE_IMAGES`・`env.SCHEDULE_ENC_KEY`（`schedules.ts`・`[id].ts`・`credential.ts`・`images/[index].ts`）と、フィードバック API の `env.FEEDBACK_GITHUB_TOKEN`・`env.FEEDBACK_RATE_LIMITER`（`feedback.ts`）。
  - フィードバックは `getFeedbackEnv()`（`lib/feedback/env.ts`）でバインディングを取得している。ページが取得した値を直接使うことが残っている点が、brief の記述より狭い範囲の問題である。
  - 予約 API は、取得のための `getScheduleEnv()`（`lib/schedule/env.ts`）を使ったうえで、`env.DB` などを `lib/schedule/store.ts` の関数へ渡している。判断（順序・409 の条件・画像の後始末）もページに残っている。
  - `entry.ts`（582 行）は、Entry の整形（`serializeSkyshareEntry`）だけでなく、埋め込みの作成・facets の検証・返信の所有確認・画像のアップロード・削除の順序も持つ。
  - route テストは `feedback` だけが `pages/v2` を直接テストしている。`entry` と `schedules*` は route テストがなく、e2e（`tests/e2e/flows/entry.spec.ts`・`schedule.spec.ts`）だけが守っている。

## Research Log

### 既存の環境の取得の仕組み

- **Context**: 移動先の lib からバインディングを取得する方法を揃えたい。
- **Sources Consulted**: `src/lib/schedule/env.ts`・`src/lib/feedback/env.ts`（`cloudflare:workers` の `env` を動的 import して型を付けるだけの関数）。`tests/route/pages/feedback.test.ts`（`vi.mock("@/lib/feedback/env")` で差し替えている）。
- **Findings**: 取得の関数は、テストで差し替える単位として既に定まっている。ページは引数でバインディングを受け取らず、`lib` の関数が内部で取得する。
- **Implications**: 移動後も同じ取得の関数を使う。`vi.mock` の対象（`@/lib/feedback/env`・`@/lib/feedback/githubIssue`）が変わらないため、フィードバックのテストは import パス以外を変えずに済む。

### 依存の向きの制約（循環）

- **Context**: 移動先の lib が、api の型・スキーマをどこまで参照してよいか。
- **Sources Consulted**: `structure.md` の「lib の領域の依存の向き」。`src-cycles` の実測（`lib/api → lib/feedback`・`lib/api → lib/atproto` が既にある）。
- **Findings**:
  - `lib/api` は `lib/feedback` と `lib/atproto` を参照する。よって `lib/feedback` と `lib/entry` は `lib/api` を参照できない（循環になる）。
  - `lib/schedule` は既に `lib/api`（`validateSchedule.ts`・`stageSchedule.ts`）を参照している。新たな辺は増えない。
  - `lib/site` は `lib` の他の領域を参照していない。`lib/feedback → lib/site` を足しても循環にならない。
- **Implications**: 入力のスキーマ検証（`RequestHeaderSchema`・`RequestBodySchema`）はページに残す。移動先の関数には、ドメインの型（api 以外で定義した型）を渡す。ページの型とドメインの型の代入可能性は、`typeCompat.ts` の検査で確かめる。

### 許容リストの `pages` 項目

- **Context**: 要件 5.4（許容リストの項目を減らす）の対象を確かめる。
- **Findings**: `pages/v2` に関する許容リストの項目 10 件は、すべて規則 `jsExtension`（`.js` 拡張子の import）で、所有は `src-import-style`。このうち `src/pages/v2/entry.ts` の `@/lib/api/response.js` の 1 件は、このスペックで `entry.ts` を書き換えるときに減らせる。残る 9 件は本スペックの移動と無関係で、所有を変えない。
- **Implications**: 要件 5.4 は「移動で触れたファイルの項目を減らす。残る項目は理由（所有の spec）を記録する」と読む。

### 特性化テストの不足

- **Context**: 移動の前後で、応答の形と状態コードを守る手段があるか。
- **Findings**:
  - 予約 API（`schedules*`）は route テストがない。e2e（`schedule.spec.ts`）は正常系の 1 本だけ。
  - `entry` は route テストがない。e2e（`entry.spec.ts`）は画像付きの from-post の 1 本だけ。
  - `feedback` は route テスト 7 件（400・401・429・500・503・成功）がある。
- **Implications**: 移動の前に、予約 API と entry API の route テスト（特性化）を足す。フィードバックは既存のテストで守る。

## Architecture Pattern Evaluation

| Option                                           | Description                                                                                         | Strengths                            | Risks / Limitations                                        | Notes                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------- | --------------------------------- |
| A. 処理ごとの lib サービス（採用）               | 各 API の判断を `lib` の関数（結果の union を返す）に移し、ページは入力・結果の HTTP 変換だけを持つ | 判断がテストできる。ページは薄くなる | 関数の数が増える                                           | 要件 1.1・2.1・3.1 に直接対応する |
| B. ページに残し、バインディングだけ `lib` に移す | `env.DB` を渡す関数だけ移す                                                                         | 変更が小さい                         | 判断（順序・409）が残り、要件 1.1 を満たさない             | 要件 4.1 だけを満たす             |
| C. 1 API 1 ファイルの大きな lib 関数             | 1 ハンドラーの全体を 1 関数にする                                                                   | 移動が単純                           | `entry.ts` の POST は 300 行以上になり、読みやすさが下がる | 避ける                            |

## Design Decisions

### Decision: 結果は `Outcome<T>`（成功と HTTP の失敗の union）で返す

- **Context**: 要件 1.1・2.2・2.3・3.2 は、応答の状態コードを変えないことを求める。lib の判断と HTTP の応答を分ける必要がある。
- **Alternatives Considered**:
  1. lib が `Response` を返す — HTTP の型を lib に持ち込むため、依存の向きに反する
  2. lib が例外を投げ、ページが `catch` で状態を決める — 順序の判断が例外の種類に隠れ、読みにくい
  3. `Outcome<T>` を返す — 判断の順序が戻り値で見える
- **Selected Approach**: `type Outcome<T> = { ok: true; value: T } | { ok: false; status: FailureStatus; code?: string }`。ページは `status` と `code` を既存の `errorResponseFromStatus` または `codeErrorResponse` に渡す。予期しない例外は lib からそのまま投げ、ページの外側の `catch` で 500 にする（現行の振る舞い）。
- **Rationale**: 現行の応答（`ScheduleRunning` の 409 コードの有無を含む）を、戻り値の `code` の有無で表せる。
- **Trade-offs**: 失敗の型を 1 箇所で定める必要がある。
- **Follow-up**: `FailureStatus` は、現行の応答で使う状態コードの集合（400・401・404・409・429・500・503）に限る。

### Decision: 応答の DTO は lib で組み立て、ページで api の型に代入する

- **Context**: `lib` は `lib/api` を参照できない（循環）。しかし応答の形は api のスキーマに一致させる必要がある。
- **Selected Approach**: lib は応答の形を表すドメインの型（DTO）を返す。ページは `const res: GetSchema.ResponseBody200Type = dto` の形で代入し、型検査で一致を確かめる。
- **Follow-up**: 代入が成立しない場合は、`typeCompat.ts` に検査を足す（api の推論型と DTO の代入可能性）。

### Decision: バインディングは lib の関数の中で取得する

- **Context**: 要件 4.1 は、対象の API ファイルがバインディングを直接読まないことを求める。
- **Selected Approach**: 予約の関数は `getScheduleEnv()`、フィードバックの関数は `getFeedbackEnv()` を内部で呼ぶ。ページは `getScheduleEnv` と `getFeedbackEnv` を import しない。
- **Rationale**: テストの差し替え単位（`vi.mock`）が変わらない。`scheduled-posting` の Cron の処理も同じ取得の関数を使う。

### Decision: 移動の前に特性化テストを足す

- **Context**: 要件 2.2・2.3・1.2 の状態コードと応答の形は、既存の route テストでは守られていない。
- **Selected Approach**: `tests/route/pages/schedules*.test.ts` と `tests/route/pages/entryApi.test.ts` を、現行コードで通る形で先に書く。移動の後も同じテストが通ることを確かめる。
- **Rationale**: 振る舞いを変えない移動であることを、テストの結果で示せる。

### Decision: 4.1 の検査は単体テストの静的な検査で行う

- **Context**: 既存の検査規則（`scripts/architecture`）は、対象のファイルが何を読むかを表せない。
- **Selected Approach**: `tests/unit/scripts/pagesThin.test.ts` が、対象の API ファイルの本文を読み、次を確かめる。`env.` で始まるバインディングの参照がないこと、`getScheduleEnv`・`getFeedbackEnv`・`@/lib/schedule/store`・`@/lib/schedule/imageStaging`・`cloudflare:workers` を import しないこと。
- **Rationale**: 検査規則の追加より小さく、テストの配置（`tests/unit/`）の規約に従う。

## Risks & Mitigations

- **entry.ts の移動の量** — 段階ごとに分け、各段階で route テストと e2e を通す。POST は `postEntry`（from-post・返信・スレッド）と `postEntryMedia`（埋め込み・アップロード）に分ける。
- **route テストで entry の成功系を作る難しさ** — 成功系は e2e（`entry.spec.ts`）で守る。route テストは 400・401・404 と from-post の失敗の系統を守る。
- **応答の順序と文言** — `console.warn`・`console.error` の文言は移動先に残す。順序（検証 → 認証情報 → 件数 → 保管）は戻り値の並びで保つ。
- **`lib/api` の依存の追加** — 移動先に `lib/api` の import を入れない。レビューで `import ... from "@/lib/api` の追加を確認する。

## References

- `.kiro/steering/structure.md`「lib の領域の依存の向き」
- `.kiro/specs/src-cycles/design.md`（Allowed Dependencies の実測）
- `tests/route/pages/feedback.test.ts`（モックの単位）
