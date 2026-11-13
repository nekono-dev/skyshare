# Research & Design Decisions

## Summary

- **Feature**: `survey-results-public`
- **Discovery Scope**: Extension（既存のビルド・ログイン画面・辞書・wrangler 生成の拡張。統計ファイルの形式は上流 `survey-results-aggregation` が所有）
- **Key Findings**:
  - 結果の保管先のバインディング `SURVEY_RESULTS` は、Astro の静的生成（workerd 内で動く）から `cloudflare:workers` の `env` で読める（brief の PoC）。Node 側の前処理（`build:prepare`）では読めないため、取得はページの生成の中で行う。
  - `remote: true` は認証情報が無い環境で起動を失敗させるため、`scripts/config/render-wrangler.mjs` が認証情報の有無で付ける。ビルドの旗はその生成物（`wrangler.jsonc`）から導けば、「情報の有無」の判定が 1 か所になる。
  - ログイン画面（静的）と結果ページ（静的）は別々のページで、同じビルドの判定を共有する必要がある。ページ間の共有はモジュールの記憶に頼れる保証が無いため、ビルド後の検査で整合を確かめる。
  - 既存のプライバシーポリシーの記述「回答は終了から 1 か月後に削除」は、`survey-results-aggregation` の実装後に事実と合わなくなる。

## Research Log

### 取得の段階（brief が設計に残した判断）

- **Context**: 結果を静的データに変える段階を決める必要がある。
- **Sources Consulted**: brief の PoC の結果、`package.json` の `build:prepare`、`astro.config.mjs`、`scripts/config/render-wrangler.mjs`。
- **Findings**: `build:prepare` は Node で動き、R2 のバインディングを持たない。ページの生成は workerd で動き、実行時の Worker と同じバインディングを読める。
- **Implications**: 取得はページ側（`getStaticPaths` とログイン画面のフロントマター）から呼ぶ共通の関数で行う。`build:prepare` には取得を置かない。

### 依存規則との整合

- **Findings**: `src/pages/` は `cloudflare:workers` を直接 import しない規約（`pagesThin` の検査対象は一部の API だけだが、方針は同じ）。`lib/*/env.ts` が動的 import で包む前例がある。結果の読み取りは `lib/survey`（業務の層）に置き、`lib/i18n`・`lib/site`（基盤の層）だけに依存する。
- **Implications**: 新しい領域は作らず `lib/survey/publicResults/` に置く。部品は新しい領域 `components/survey/` を作る（利用元が `pages/` のため、親の子にできない）。

### ログイン画面のリンクの色・グラフの色

- **Findings**: ブランドのプライマリ色は `--color-bluesky`（リンク・青いボタンが使う）。灰色は `--color-gray`（下地）と `--color-gray-hover`（棒）。ダーク表示でも同名のトークンが上書きされている。
- **Implications**: 新しい色の定義は不要。下地と棒の差は小さい（ライトで約 1.1 対 1）ため、数字を棒の中に置く合意の画面が前提になる。

## Architecture Pattern Evaluation

| Option                                      | Description                                                   | Strengths                                              | Risks / Limitations                                                              | Notes          |
| ------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------- |
| A: ページの生成の中で取得（採用）           | `getStaticPaths` とログインのフロントマターが共通の関数を呼ぶ | バインディングをそのまま使える。実行時の経路と同じ設定 | 2 ページが別々に呼ぶ（整合は検査で守る）                                         | PoC で検証済み |
| B: `build:prepare` で取得してファイルに書く | Node で R2 を読み、JSON を生成                                | 1 回の取得で両ページが同じ入力                         | Node から R2 を読む別の経路と認証が要る。生成物が Git 管理外のファイルとして残る | 不採用         |
| C: ビルド後に別のスクリプトでページを足す   | 静的ページを後から生成                                        | —                                                      | Astro のルーティングと分離し、二重管理になる                                     | 不採用         |

## Design Decisions

### Decision: 結果を静的データに変える段階

- **Selected Approach**: A。共通の関数 `getPublishedSurveys` を 1 つ置き、ページ側から呼ぶ。
- **Rationale**: バインディングはページ生成の環境にだけある。
- **Trade-offs**: ログイン画面と結果ページが 2 回取得する可能性がある。モジュール内の記憶（同じ約束の共有）と、ビルド後の整合検査で守る。

### Decision: ローカルの固定のサンプル

- **Selected Approach**: 置かない。
- **Rationale**: 本番のコードに偽のデータの分岐を入れると、オプトアウトの規則（情報が無ければ無効）が二重になる。表示はテストの部品データ（`tests/fixtures`）で確かめ、実物の確認は認証情報を付けた開発サーバー（develop の保管先）で行う。

### Decision: 最大の選択肢の色と同率・全て 0 の扱い

- **Selected Approach**: プライマリ色は `--color-bluesky`。同率の最大はすべてプライマリ色。最大が 0（すべて 0%）なら誰も強調しない。
- **Rationale**: 「最大」に当たる複数を区別する根拠が無い。0% だけの質問で 0 を強調すると誤読される。

### Decision: 目録が無いとき・可視フラグが不正なとき

- **Selected Approach**: 目録が無い＝集計済みが 0 件（失敗しない）。可視フラグが無い＝非表示、不正＝ビルド失敗。
- **Rationale**: 運用の初期（まだ 1 件も集計されていない）で配備が止まるのを避ける。一方、不正な旗を黙って非表示にすると「公開したはずが出ない」を見落とすため、`survey-results-aggregation` の「読み手が通らないことを知らせる」責務に従い失敗にする。

## Risks & Mitigations

- 2 つの静的ページが別々の判定をする — 記憶の共有に加え、ビルド後の検査でページとリンクの有無の不一致を失敗にする。
- `getStaticPaths` が `slug` の未指定で `/surveys/` を作らない — 実装のはじめにビルド結果で確かめ、作れない場合は設計へ戻す。
- `remote: true` を含む設定での `wrangler deploy` の挙動 — CI の既存の `wrangler deploy --dry-run` と develop の配備で確かめる。
- 棒と下地の灰色の差が小さい — 合意済みの配色を保つ。プレビューで読めないと分かった場合は、色を変えず利用者へ戻す。
- 2 回の取得の間の更新で内容が食い違う（件数は同じ）— 残余のリスクとして design.md に明記する。
- 過去のプレビューは次のプッシュまで古い — 手順書に書く。

## References

- `.kiro/specs/survey-results-public/brief.md` — 合意した画面と PoC の結果。
- `.kiro/specs/survey-results-aggregation/design.md` — 統計ファイルの形式とキー。
- `.kiro/steering/r2-buckets.md` — バケットと `remote: true` の規則。
