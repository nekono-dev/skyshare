# Research & Design Decisions

## Summary

- **Feature**: `survey-results-aggregation`
- **Discovery Scope**: Extension（既存の `src/lib/survey/`・Worker の日次の枠・wrangler テンプレートへの拡張。外部の新規ライブラリは使わない）
- **Key Findings**:
  - 現行の後片付け `runSurveyRetention`（`src/lib/survey/retention.ts`）は、設定を静的アセットから読み、期限だけで削除を決める。集計の概念は無い。回答の削除の契機を「保存の成功後」に変えるには、この入口を置き換えるのが最も小さい。
  - 回答は `saveAnswer` が「回答済みの集合」と「回答」を同じ D1 の `batch` で入れる。「回答しない」を含む回答は保存されない。そのため回答者数は `survey_answers` の行数（読める行だけ）で求められ、回答済みの集合は集計に要らない。
  - R2 の条件付き書き込み（`onlyIf`）は、ローカルの miniflare の実装に `etagMatches`・`etagDoesNotMatch`（`*` を含む）がある。上書き禁止の作成と、目録の比較交換の両方に使える。
  - `astro.config.mjs` は既に生成済みの `wrangler.jsonc` を読んでいる。ビルドの旗の判定に、バインディングの宣言の有無を加えるのに追加の入口は要らない。
  - `render-wrangler.mjs` は、テンプレートの `r2_buckets` をすべて develop 化（`-develop`）し、プレビューの `r2_buckets` も作る。テンプレートに 1 件足すだけで、develop・プレビューの規則が適用される。

## Research Log

### 現行の保持期限の処理

- **Context**: 置き換え対象の範囲を確定する。
- **Sources Consulted**: `src/lib/survey/retention.ts`、`period.ts`、`store.ts`、`src/worker.ts`、`tests/route/survey/retention.test.ts`、`config/test/vitest.route.config.ts`（P0 の被覆率の対象）。
- **Findings**:
  - 集合は終了時刻以後、回答は終了の 1 か月後以後に削除。1 項目の失敗は記録して続行し、ログは項目名と識別子だけ。
  - `period.ts` の `retentionDeadlines`・`retentionExpired`・`addOneMonthInJst` は、保持期限の判定専用。`hack/survey-cli/lifecycle.ts` も `retentionExpired` を使っている（`survey-operations` の作り直しの対象）。
- **Implications**: `retention.ts` と、`period.ts` の保持の判定を削除する。`hack/survey-cli/lifecycle.ts` の参照は `survey-operations` が置き換える。両 spec の実装順に注意が要る（`survey-operations` が先に着手しない限り、本 spec で `retentionExpired` を消すと CLI のビルドが壊れる）。後述の「リスク」に記録した。

### R2 の条件付き書き込み

- **Context**: 同時実行の防止（上書き禁止の作成・目録の比較交換）。
- **Sources Consulted**: `node_modules/miniflare/dist/src/workers/r2/bucket.worker.js`（`onlyIf` の検証）。
- **Findings**: `etagMatches`・`etagDoesNotMatch` を受け、`*`（wildcard）を認める。条件に合わないときの `put` は `null` を返す。
- **Implications**: 結果の作成は `etagDoesNotMatch: "*"`、目録の更新は読んだ ETag との `etagMatches`（目録が無いときは `etagDoesNotMatch: "*"`）。実際の R2 でも同じ意味であることは、route テストの実行（workerd）で確かめる。

### 可視フラグの置き場の比較

- **Context**: CLI が小さく独立して書き換えられ、かつ集計の処理と競合しない置き場を選ぶ。
- **Findings / 比較**: 下の表。

## Architecture Pattern Evaluation

| Option                                | Description                               | Strengths                                                               | Risks / Limitations                                                  | Notes  |
| ------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- | ------ |
| A. 結果の本体の中に旗を持つ           | `surveys/<id>.json` に `visible` を入れる | 読む側は 1 ファイルで足りる                                             | 旗の切り替えが本体の書き換えになり、本体の破損や比較交換が要る       | 不採用 |
| B. 目録の各項目に旗を持つ             | `index.json` の項目に `visible`           | 1 ファイルで一覧と可視が分かる                                          | 目録は Worker も書く。CLI と Worker が同じファイルを書く競合が生じる | 不採用 |
| C. 旗だけの小さなオブジェクト（採用） | `visibility/<id>.json`                    | 書き手が CLI だけ。本体・目録と競合しない。無ければ非表示になり、安全側 | 読む側がアンケートごとに 1 回多く読む（公開候補ぶんだけ）            | 採用   |

## Design Decisions

### Decision: R2 のオブジェクトの構成

- **Context**: `r2-buckets.md` は用途ごとにバケットを分け、接頭辞は 1 用途の中の整理に使うと定める。
- **Selected Approach**: バケット `skyshare-survey-results`、バインディング `SURVEY_RESULTS`。`index.json`（目録）・`surveys/<id>.json`（結果）・`visibility/<id>.json`（可視フラグ）。
- **Rationale**: 3 種は寿命・書き手が違う（目録＝Worker が追記、結果＝Worker が 1 回作成、旗＝CLI だけ）。書き手ごとにオブジェクトを分けると、競合する書き手が目録だけになり、目録は比較交換で守れる。
- **Trade-offs**: オブジェクトが増える。1 バケット内の接頭辞は同じ機微さ・寿命・公開範囲（運用者だけが読む）なので、規則の「例外」ではなく「接頭辞での整理」の範囲に収まる。

### Decision: 回答済みの集合の削除は終了時刻以後のまま

- **Selected Approach**: 現行どおり、終了時刻を過ぎた時点（日次の枠）で、集計の成否と無関係に削除する。
- **Rationale**: 集計に集合は要らない（回答者数は回答の行数）。匿名性の面で、早く消す現行の規則のほうが安全。R2 の障害が長引いても、集合の保持が延びない。
- **Trade-offs**: 回答の削除と集合の削除の時機が分かれるが、どちらも日次の枠の同じ入口で行い、独立した失敗として扱う。

### Decision: ビルドの旗は、バインディングの宣言も条件にする

- **Selected Approach**: `PUBLIC_SURVEY_CONFIG_PRESENT` を「設定がある、かつ、生成済みの `wrangler.jsonc` に D1 と `SURVEY_RESULTS` の宣言がある」ときだけ `"true"` にする。
- **Rationale**: 静的な画面と提示の入口は、実行時のバインディングを見られない。ビルド時に宣言を見れば、テンプレートから R2 を外した運用者の環境でアンケートが出ない。
- **Trade-offs**: 標準のテンプレートでは常に真で、効果はテンプレートを変えた環境に限る。実行時の判定（機能の有効判定）が最終の砦で、ビルドの旗は入口を出さないための前段である。

### Decision: 日次の枠の入口の名前

- **Selected Approach**: `runSurveyRetention` を削除し、`runSurveyDaily` を新設する（`src/lib/survey/daily.ts`）。
- **Rationale**: 内容が「保持」ではなく「集計と後片付け」になるため。v2 は未公開で、名前の整合を優先する（互換用の別名は置かない）。

### Decision: 結果を作る処理の順序

- **Selected Approach**: 結果の作成（上書き禁止）→ 目録への追記（比較交換）→ 回答の削除。目録を「完了の印」とする。
- **Rationale**: 目録に記録があるなら、結果（または回答 0 件の記録）は保存済みで、回答を消してよい。結果だけあって目録に無い状態（途中で失敗）は、翌日に目録へ足すだけで直る。

### Decision: 割合の丸めと合計

- **Selected Approach**: `Math.round(選んだ人数 * 1000 / 回答者数) / 10`。単一選択でも合計を 100 に合わせる補正はしない。
- **Rationale**: 補正は、割合から件数を逆算しにくくする効果も無く、規則を複雑にする。利用者の決定（小数点 1 桁）に従う。

## Risks & Mitigations

- Cron の CPU の上限（無料枠 10 ms）に、回答の JSON の解析が収まらない可能性 — 回答は小さい JSON で、対象は終了直後の 1 件。収まらなくなったら、D1 の側で `json_each` による集計に置き換える（インターフェースは変えずに済む）。
- `retentionExpired` を `hack/survey-cli/lifecycle.ts` が使っている — `survey-operations` が CLI を作り直すため、実装順は「CLI の参照を除いてから、`period.ts` の保持の判定を削除」とする。tasks で、削除は参照が無いことを確かめてから行う。
- 設定から集計前に消されたアンケートの回答は、保持期限の廃止により D1 に残り続ける — 除去の規則（集計済みだけを除去）を `survey-operations` が守る。本 spec は「設定に無いアンケートは集計しない」までを持ち、孤立した行を探して消すことはしない（要件 2.4）。
- 実際の R2 で `etagDoesNotMatch: "*"` の挙動が miniflare と違う可能性 — 実装の初期に、route テスト（workerd）と、検証用バケットでの手動確認の両方で確かめる。

## References

- `.kiro/steering/r2-buckets.md` — バケットの規則。
- `.kiro/specs/survey-results-public/brief.md` — PoC の結果（`remote: true`、ビルド時の取得）。
- `.kiro/steering/testing.md` — テストの層。
