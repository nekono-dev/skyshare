# Research & Design Decisions

## Summary

- **Feature**: `survey-definition`
- **Discovery Scope**: Extension（既存のビルド定数・CI・i18n の流儀に沿う小さな追加。軽い調査）
- **Key Findings**:
  - 運用者ごとの値は `astro.config.mjs` の `vite.define` でビルド定数にする流儀が既にある。設定ファイルの有無も同じ形で旗にできる。
  - `ASSETS` バインディングが既にあり、サーバーは静的ファイルをネットワークを介さずに読める（無料）。
  - 対応言語は `LOCALES` が単一の源。`satisfies Record<Locale, …>` で言語の追加を型で検知できる。
  - スキーマを共有するため、TypeScript を直接実行できる `tsx`（既存の devDependency）で生成処理を書く。

## Research Log

### 設定の存在をどう知るか

- **Context**: 要件 4.1 は、設定が無い環境で通信もエラー表示も起こさないことを求める。実行時に取得して 404 を受けると、通信とコンソールのエラーが発生する。
- **Sources Consulted**: `astro.config.mjs`、`src/lib/site/buildInfo.ts`（`PUBLIC_COMMIT_SHA` の埋め込み）。
- **Findings**: ビルド時にファイルの有無は確定する。同じ流儀で旗を埋め込めば、画面は旗が偽のとき一切通信しない。
- **Implications**: 旗はビルドの成果物に固定される。設定を変えるには再ビルド（再配備）が要る。設計の前提（設定の変更は再デプロイ）と一致する。

### 生成処理の実行方式

- **Context**: スキーマは TypeScript（`@/` のエイリアスと `LOCALES`）。既存の `hack/*.mjs` は TypeScript を読めない。
- **Sources Consulted**: `package.json`（`apigen:doc` が `tsx` を使う）、`hack/render-deploy-config.mjs`。
- **Findings**: `tsx` が devDependency にあり、同じ流儀で使われている。
- **Implications**: 生成処理は TypeScript で書き、`tsx` で実行する。スキーマを複製せずに済む。

### 入力の断片の漏洩

- **Context**: 要件 5.6 は、検証の失敗で設定の値そのものを出さないことを求める。
- **Findings**: パーサーの例外メッセージは入力の断片を含みうる。Zod の `received` も値を含みうる。
- **Implications**: 設定として読めない値には固定の文言だけを出す。検証の報告は位置と固定の理由だけで組み立てる。

### Workers の制約

- **Context**: `tech.md` は `src/middleware.ts` から静的に辿れる範囲で `@atproto/*` を読み込まないことを求める（`tests/lib/coldStart.test.ts`）。
- **Findings**: 本 spec の部品は Zod と `LOCALES` だけに依存する。
- **Implications**: 検証の最後に `coldStart` の検査を通す。

## Architecture Pattern Evaluation

| Option                            | Description                               | Strengths                              | Risks / Limitations                                        | Notes                              |
| --------------------------------- | ----------------------------------------- | -------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| 実行時に取得して 404 で不在を知る | 旗を持たず、毎回取得する                  | ビルドの旗が要らない                   | 設定の無い環境で通信とコンソールのエラーが出る（4.1 違反） | 不採用                             |
| ビルドの旗 + 静的ファイル（採用） | 生成物の有無をビルド定数にする            | 設定が無い環境で通信しない。既存の流儀 | 設定の変更に再ビルドが要る                                 | 設計の前提と一致                   |
| Worker の環境変数で配信           | 変数を Worker の `vars` に載せ API で返す | 再ビルドなしで反映できる               | ビルドの成果物と変数がずれる。公開の API が 1 本増える     | 不採用（静的アセットは課金対象外） |

## Design Decisions

### Decision: 設定の存在を旗で表す

- **Context**: 設定が無い環境で通信とエラー表示を起こさない（4.1）。
- **Alternatives Considered**:
  1. 実行時に取得して 404 を「なし」とする
  2. ビルド時に旗を埋め込む
- **Selected Approach**: 2。生成物の有無を `vite.define` で埋め込む。
- **Rationale**: フォークの環境に何も起こさない要件を、通信の有無で満たせる。
- **Trade-offs**: 設定の変更に再ビルドが要る。
- **Follow-up**: ビルドの実測で、変数あり・なしの両方の旗を確認する。

### Decision: 保持期限の「1 か月」

- **Context**: 回答の保持期限を終了の 1 か月後とする（3.6）。
- **Alternatives Considered**:
  1. 30 日固定
  2. 日本標準時の暦で月を進め、月末は末日に丸める
- **Selected Approach**: 2。
- **Rationale**: 運営者・利用者に説明しやすく、夏時間のない固定オフセットで曖昧さがない。
- **Trade-offs**: 30 日固定より実装がやや複雑。境界をテストで押さえる。

### Decision: 期間の終端

- **Context**: 現在のアンケートの判定の境界（3.4, 3.5）。
- **Selected Approach**: `closesAt` を含まない。隣り合うアンケート（`closesAt` と次の `opensAt` が等しい）は重複としない。
- **Rationale**: 時刻の境界で「どちらにも属さない」「両方に属する」瞬間をなくす。

### Decision: 説明（description）

- **Selected Approach**: 任意。ただし指定する場合は全言語を必須にする。
- **Rationale**: 言語ごとに有無が違うと、表示が言語で食い違う。

### Synthesis（generalization / build-vs-adopt / simplification）

- **Generalization**: 「変数 → 検証 → 静的ファイル → 旗」の経路は、アンケートに固有でない。ただし現在の要件はアンケートだけなので、経路を一般化せず、スキーマ・生成・取得を `survey` の名前の下に置く。インターフェースを純粋関数にして、別の用途に切り出せる余地だけを残す。
- **Build vs. adopt**: 検証は既存の Zod を採用。日時は標準の `Date` で足りる（夏時間のない固定オフセットの月の加算は数行）ため、日付ライブラリを追加しない。生成の実行は既存の `tsx` を採用。
- **Simplification**: 表示言語のフォールバックは持たない（全言語が必須で、型の上で欠けない）。サーバーのキャッシュは設定の内容だけに限り、時刻に関わる判定をキャッシュしない。

## Risks & Mitigations

- `LOCALES` を増やすと登録済みの設定が不正になる — Revalidation Triggers に記載し、検証が足りない言語を指摘する。
- 旗が真でも古い成果物の設定が残る — 設定を変えるときは再デプロイが要ることを `DEVELOP.md` に明記する。
- 設定の値が CI のログに出る — 生成の失敗報告は位置と理由だけにする。パーサーの例外メッセージは出さない。

## References

- `docs/architecture.md` — 分割と依存の順序。
- `docs/features/survey-definition/brief.md` — 問題と範囲。
- `src/lib/site/buildInfo.ts`、`astro.config.mjs` — ビルド定数の既存の流儀。
