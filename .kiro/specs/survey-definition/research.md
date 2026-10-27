# Research & Design Decisions

## Summary

- **Feature**: `survey-definition`
- **Discovery Scope**: Extension（既存のビルド定数・CI・i18n の流儀に沿う小さな追加）
- **Key Findings**:
  - 運用者ごとの値は `astro.config.mjs` の `vite.define` でビルド定数にする流儀が既にある。設定ファイルの有無も同じ形で旗にできる。
  - `ASSETS` バインディングが既にあり、サーバーは静的ファイルをネットワークを介さずに読める（無料）。
  - 対応言語は `LOCALES` が単一の源。`satisfies Record<Locale, …>` で言語の追加を型で検知できる。

## Research Log

### 設定の存在をどう知るか

- **Context**: 要件 4.1 は、設定が無い環境で通信もエラー表示も起こさないことを求める。実行時に取得して 404 を受けると、通信とコンソールのエラーが発生する。
- **Findings**: ビルド時にファイルの有無は確定する。`PUBLIC_COMMIT_SHA` と同じく `vite.define` で旗を埋め込めば、画面は旗が偽のとき一切通信しない。
- **Implications**: 旗はビルドの成果物に固定される。設定を変えるには再ビルド（再配備）が要る。設計の前提（設定の変更は再デプロイ）と一致する。

### 生成処理の実行方式

- **Context**: スキーマは TypeScript（`@/` エイリアスと `LOCALES`）。既存の `hack/*.mjs` は TS を読めない。
- **Findings**: `tsx` が devDependency にあり、`apigen:doc` が同じ流儀で使っている。
- **Implications**: 生成処理は `hack/render-survey-config.ts` とし、`tsx` で実行する。スキーマを複製せずに済む。

### 入力の断片の漏洩

- **Context**: 要件 5.6 は、検証の失敗で設定の値そのものを出さないことを求める。
- **Findings**: `JSON.parse` の例外メッセージは、入力の断片を含みうる。Zod の `received` も値を含みうる。
- **Implications**: JSON の不正は固定の文言だけを出す。検証の報告はパスと固定の理由だけで組み立てる。

## Design Decisions

### 保持期限の「1 か月」

- **Decision**: 日本標準時の暦で月を 1 つ進め、同じ日がなければ月末とする。
- **Rationale**: 運営者・利用者に説明しやすく、夏時間のない固定オフセットで曖昧さがない。
- **Trade-offs**: 30 日固定より実装がやや複雑だが、テストで境界を押さえる。

### 期間の終端

- **Decision**: `closesAt` を含まない。隣り合うアンケート（`closesAt === 次の opensAt`）は重複としない。
- **Rationale**: 時刻の境界で「どちらにも属さない」「両方に属する」瞬間をなくす。

### 説明（description）の扱い

- **Decision**: 任意。ただし指定する場合は全言語を必須にする。
