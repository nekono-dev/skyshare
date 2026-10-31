# 調査ログと設計判断

## Summary

- **Feature**: `src-duplicates`
- **Discovery Scope**: Extension（既存の重複の統合。振る舞いは変えない）
- **Key Findings**:
  - **X の文字数**: `countWeightedTweetLength`（`util/textCount.ts`）は `ceil(xIntentMeasure/2)`、`resolveCounterReserve`（`lib/share/counterReserve.ts`）は `ceil(resolveIntentMeasure(target)/2)`、`countTaittsuuLength` は `ceil(taittsuuIntentMeasure/2)`。計量の関数（`util/share/intentLength.ts`）は 1 つで、「2 で割って切り上げる」が 3 箇所に散っている。
  - **JSON 応答**: 4 関数のヘッダーが異なる。`jsonResponse`（`no-store`・`set-cookie` の配列）、`json200`（`Content-Type` のみ。`no-store` なし）、`respond`（`no-store`・`set-cookie` を 1 件追加。本文は任意）、`errorResponseFromStatus`（`no-store`）。呼び出しは `jsonResponse` が 15 箇所（8 ファイル）、`json200` が 1 箇所、`respond` が 2 箇所、`errorResponseFromStatus` は `util/http.ts` の定義。
  - **ゼロ埋め**: `lib/schedule/runAtInput.ts` の `pad`（`String(n).padStart(2,"0")`）と、`lib/video/formatVideoDuration.ts` の 2 箇所の `padStart(2,"0")`。`util/` に数値の共通関数はない。
  - **旧共有設定**: `lib/settings/legacyShareSettings.ts` は `shareSettings.ts` の `readAutoPopupTargetSetting` 先頭の 1 呼び出しだけに依存する。テストは `tests/unit/lib/settings/legacyShareSettings.test.ts` の 1 件。`autoPopupTarget.ts` の注釈が名前を言及する。
  - **環境変数の直接の読み取り**: `PUBLIC_VERSION` は `src/vars.ts`（`serviceVersion`）と `lib/site/buildInfo.ts`（`version`）の 2 箇所で `import.meta.env` を直接読む。`SITE`（Astro の組み込み値）は `lib/entry/url.ts` の 2 箇所と `lib/timeline/guestDummyPosts.ts` の 1 箇所で読む。`lib/site/buildEnv.ts` と `lib/site/siteEnv.ts` は、`env` を引数で受ける純粋な解決関数であり、直接読まない（重複ではない）。
  - **`env` 系の 8 モジュール**: `cloudflare:workers` の `env` を領域ごとに動的に取る役割（`lib/{feedback,oauth,schedule,survey}/env.ts`）と、ビルド・サイトの解決（`lib/site/*`・`util/clientEnvironment.ts`・`src/env.ts`）。同じ変数を別々に読むものは、上の 2 件（`PUBLIC_VERSION`・`SITE`）だけ。
  - **共有の 5 フォルダ**: 役割が違う（設定の保存・本文の決定・intent の組み立て・投稿先の振り分け・Web Share）。同じ実装の重複ではない。所有の固定は、この spec の要件に含めない。

## Research Log

### X の文字数の計量の一本化

- **Context**: 要件 1.1〜1.3（投稿の表示と共有の切り詰めの結果は変えない）。
- **Findings**: 3 箇所の式は、すべて「計量（`weightedLength` の関数）→ 2 で割って切り上げ」。計量の関数の例外時の挙動も一致する（`countWeightedTweetLength` の `catch` は `rawText.length`、`xIntentMeasure` の `catch` は `text.length * 2` で、2 で割ると同じ `text.length`）。
- **Implications**: `util/share/intentLength.ts` に、計量の関数を受けて「2 で割って切り上げる」共通の関数を置く。3 箇所はそれを使う。

### JSON 応答の 1 関数化

- **Context**: 要件 2.1〜2.3。ヘッダーを引数で渡す（利用者の決定）。
- **Findings**: 4 関数の出力（状態、本文、ヘッダー）は、ヘッダーの集合が異なる。単純に `no-store` を全件に足すと、`json200` のヘッダーが変わる（要件 2.1 違反）。
- **Implications**: `util/http.ts` に 1 つの `jsonResponse(body, init)` を置く。`init.headers` で呼び出し側が指定したヘッダーを付ける。既定は `Content-Type: application/json` のみ。`body` が `undefined` のときは本文なし（`respond` の挙動）。`errorResponseFromStatus` は、この関数で `no-store` を付けて返す。

### ゼロ埋めの一本化

- **Context**: 要件 3.1・3.2。
- **Findings**: 同じ式（`padStart(2,"0")`）。`util/` に置く先がない。
- **Implications**: `util/padTwoDigits.ts` に `padTwoDigits(n: number): string` を置き、3 箇所が使う。`formatVideoDuration` の 2 桁（秒・分）は、同じ関数を使う。

### 旧共有設定の移行の削除

- **Context**: 要件 4.1〜4.3（利用者の決定: 削除する）。
- **Findings**: 依存は `readAutoPopupTargetSetting` 先頭の 1 呼び出し、テスト 1 件、注釈 3 件（`shareSettings.ts` の 2 箇所、`autoPopupTarget.ts` の 1 箇所）。
- **Implications**: モジュール・テストを削除し、呼び出しを消す。注釈を直す。移行済みの利用者（新しいキーを持つ）の値は変わらない。

### 環境変数の読み取りの一本化

- **Context**: 要件 5.1・5.2。
- **Findings**: `src/vars.ts` は `src/` の直下の設定（`lib` から import してよい）。`lib/site/buildInfo.ts` は `lib` の層。`buildInfo` が `vars` を import すると、`vars` が `lib` を import しない限り循環は生じない。`vars.ts` は `import.meta.env` の生の値を読む単一の場所にする。
- **Implications**: `vars.ts` に `buildVersion`（生の `PUBLIC_VERSION`）と `siteOrigin`（`SITE`）を置く。`serviceVersion` は `${buildVersion}`（従来と同じ文字列）。`buildInfo.ts` は `buildVersion || "unknown"`。`SITE` の 3 箇所は `siteOrigin` を使う。値は、従来と完全に同じになる。

## Architecture Pattern Evaluation

| Option                                               | Description                           | Strengths                | Risks / Limitations                                | Notes        |
| ---------------------------------------------------- | ------------------------------------- | ------------------------ | -------------------------------------------------- | ------------ |
| A. 共通の関数を 1 箇所に置き、呼び出しを移す（採用） | 計量・応答・ゼロ埋め・環境の各 1 箇所 | 1 箇所の規則。変更が局所 | 呼び出し側の移行の量（応答 15 + 3 箇所）           | 要件 1〜3・5 |
| B. 既存の関数を残し、薄い互換の関数を置く            | 旧名を残して新しい関数を呼ぶ          | 呼び出しを変えなくてよい | 2 つの名前が残り、要件 2.2 に反する                | 不採用       |
| C. 共有の責務も 1 つのモジュールに統合する           | 5 フォルダを 1 つに                   | 所有が明確               | 役割が違うため、統合すると肥大化する。要件の範囲外 | 不採用       |

## Design Decisions

### Decision: 文字数の「2 で割る」規則は計量の関数の隣に 1 箇所だけ置く

- **Selected Approach**: `util/share/intentLength.ts` に `halfUnitLength(measure, text)`（`Math.ceil(measure(text) / 2)`）を置く。X は `halfUnitLength(xIntentMeasure, text)`、タイッツーは `halfUnitLength(taittsuuIntentMeasure, text)`、共有の予約は `halfUnitLength(resolveIntentMeasure(target), suffixText)`。
- **Rationale**: 規則を 1 箇所に寄せ、3 つの呼び出し側は計量の種類だけを変える。

### Decision: JSON 応答は 1 関数、ヘッダーは呼び出し側が渡す

- **Selected Approach**: `util/http.ts` の `jsonResponse(body: unknown, init?: { status?: number; headers?: HeadersInit }): Response`。`body === undefined` は本文なし。`Content-Type: application/json` は既定で付き、呼び出し側の指定で上書きできる。
- **Rationale**: 応答の形（本文・ヘッダー）を、呼び出しごとに従来どおりに保つ（要件 2.1）。
- **Trade-offs**: 呼び出しの 15 + 3 箇所を書き換える（機械的な変更で、型検査で確かめる）。

### Decision: 環境変数の直接の読み取りは `src/vars.ts` の 1 箇所

- **Selected Approach**: `vars.ts` が `PUBLIC_VERSION` と `SITE` を読む。他は `vars.ts` から import する。
- **Rationale**: 要件 5.1（同じ変数を読むモジュールを 2 つ以上持たない）。値は従来と同じ。
- **Scope note**: `lib/site/buildEnv.ts`・`siteEnv.ts` は `env` の引数を解決する純粋な関数で、直接読まない。`env` 系の 8 モジュールは、領域ごとの役割が違うため統合しない（要件の範囲外）。

## Risks & Mitigations

- **応答のヘッダーの取りこぼし** — 呼び出しの置換の前に、4 つの関数の出力（状態・本文・ヘッダー）を単体テストで固定する。route テストが応答の形を守る。
- **文字数の境界値の変化** — 特性化テストで、X・タイッツー・共有の予約の値を、置換の前に固定する。
- **旧共有設定の削除の影響** — 利用者の決定により受け入れる（要件 4.2）。移行済みの利用者（新しいキーを持つ）の値は変わらないことを、既存のテストで守る。
- **循環 import** — `vars.ts` は `lib` を import しない。`buildInfo.ts` → `vars.ts` の一方向。`npm run test:imports` の循環の規則で検出する。

## References

- `.kiro/specs/src-duplicates/requirements.md`
- `.kiro/specs/src-duplicates/brief.md`
- `.kiro/steering/structure.md`（依存の向き、`util` は上位層を import しない）
