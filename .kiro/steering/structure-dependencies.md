# Structure: lib の依存の向き

## lib の領域の依存の向き

`lib` の領域どうしの依存は、閉路を作らない（A → B と B → A の両方も、長さ 3 以上の閉路も作らない）。共有の型・定数・スキーマは、参照される側（下位）に置き、上位は再エクスポートで参照を保つ。型のみの import も依存として数える。

層の規則: 基盤の領域（層の表の「基盤」）は業務の領域（「業務」）を import しない（規則 `libLayer`）。業務の領域は基盤を import してよい。層の分類は `structure-lib.md` の「領域の一覧」の層の表のとおり。

許可された依存（2026-11-01 の実測。型のみの辺を含む）。表に無い領域どうしの依存を加える場合は、この節を先に改訂する（規則の変更は、steering の改訂と同じ変更で行う）。

- `lib/api`（API の契約）→ `lib/atproto`・`lib/image`・`lib/oauth`・`lib/video`・`util`・`src/types`（型 `FormDataFieldKind` のみ）。業務の型と制約は `lib/api/contract/` に下ろしてあるため、`lib/feedback`・`lib/survey` を参照しない。`lib/schedule`・`lib/session` も `lib/api` を参照する（下の一覧を参照）。
- `lib/atproto` → `lib/image`・`lib/video`（`util` を参照しない）
- `lib/entry`（Entry）→ `lib/atproto`・`lib/image`・`lib/video`・`util`・`src/types`（`Outcome` の型）。`lib/timeline` を参照しない。
- `lib/timeline`（タイムライン）→ `lib/entry`・`lib/atproto`・`lib/i18n`（型）
- `lib/oauth` → `lib/atproto`
- `lib/schedule` → `lib/api`・`lib/atproto`・`lib/entry`・`lib/oauth`・`util`・`src/types`（`Outcome` の型。`lib/i18n`・`lib/platform` は型のみ）
- `lib/session` → `lib/api`・`lib/atproto`・`lib/oauth`・`util`
- `lib/settings` → `lib/atproto`・`lib/share`。`lib/share` → `lib/atproto`（`lib/settings`・`util` を参照しない）
- `lib/survey` → `lib/api`（契約 `contract/surveyPath`）・`lib/guestMode.ts`・`lib/platform`（型のみ）・`lib/i18n`（型のみ）・`util`（`util/http`）
- `lib/video` → `lib/image`・`util`（`util/padTwoDigits`）（`lib/i18n` は型のみ）
- `lib/feedback`（不具合の報告・提案）→ `lib/api`（契約 `contract/feedbackLimits`・`contract/feedbackSubmission`）・`lib/site`（ビルド情報）・`src/types`（`ClientEnvironment`・`Outcome` の型）。`util` は参照しない。
- `lib/site`（ビルド情報・サイト設定・プライバシーポリシーの文面）→ `lib/i18n`（型のみ）
- `lib/guestMode.ts`（`lib` 直下の業務のファイル）→ `lib/timeline`（ゲストのダミーデータ・削除範囲の型）・`lib/i18n`（型のみ）

上の一覧のうち、`lib/entry`・`lib/schedule`・`lib/feedback`・`lib/atproto`・`lib/settings`・`lib/share` の行は現在の import と一致する。`lib/atproto` は `util` と `src/types` を参照しない。`lib/feedback` は `util` を参照せず、型（`ClientEnvironment`・`Outcome`）を `src/types` から読む。`lib/share` と `lib/settings` の間に循環はなく、`lib/settings` → `lib/share` の一方向だけである。

`src/` 直下（`env.ts`・`vars.ts`）の扱い: `lib` の領域は `@/env`・`@/vars`（設定）を参照してよい。`src/` 直下の `env.ts`・`middleware.ts`・`worker.ts` は組み立ての層で、`lib` を参照する。閉路の確認（`libRegionPairs` テスト）は `lib` の領域どうしだけを対象にするため、`src/` 直下を経由する閉路は対象外である。

`lib` の領域どうしの閉路は、`tests/unit/scripts/libRegionPairs.test.ts` が確かめる。循環（ファイル単位）は `npm run test:imports` が確かめる。

---

_updated_at: 2026-11-08_
