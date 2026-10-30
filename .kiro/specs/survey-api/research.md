# Research & Design Decisions

## Summary

- **Feature**: `survey-api`
- **Discovery Scope**: Extension（既存の D1・定期実行・API の流儀に沿う追加。新しい外部依存はない）
- **Key Findings**:
  - 予約投稿は D1 のバインディング `DB` と `cloudflare:workers` の動的 import（`getScheduleEnv`）、毎分の定期実行と 1 日 1 回の後片付け枠（`isHousekeepingTime`、JST 3:00）を持つ。回答の保存と削除は、この枠と同じ流儀に乗せられる。
  - 既存の D1 の型（`cfTypes.ts`）とテスト用のフェイク（`tests/helpers/fakeD1.ts`）には `batch` が無い。回答の保存を 1 回の呼び出しで行うには、両方を拡張する必要がある。
  - 秘密値の自動登録（`ensure-worker-secrets.mjs`）と、ローカルの生成（`prepare-local-env.mjs`）は、同じ `GENERATORS` を共有する。`SURVEY_HASH_KEY` を `GENERATORS` に足すだけで、本番・develop・プレビューの基本設定・ローカルに載る。
  - develop の Worker とそのプレビューは同じ `-develop` の D1 を使い、本番は別の D1 を使う（`render-deploy-config.mjs`）。ハッシュ鍵を同じ値にそろえる必要があるのは、D1 を共用する develop とプレビューの間であり、本番は独立でよい。
  - 定期実行のエントリ（`src/worker.ts`）にはリクエストが無く、`vite.define` のビルド定数が効くかは確認できていない。削除の側は、ビルドの旗に頼らず静的アセットを直接読む。

## Research Log

### 回答の保存を 1 回の呼び出しで原子的に行う

- **Context**: 要件 6.7・7.5・9.3 は、回答済みの記録と回答の保存を 1 回の操作で行い、重複の判定に事前の読み取りをしないことを求める。
- **Sources Consulted**: Cloudflare D1 の Worker API（`batch`）の記載、`src/lib/schedule/cfTypes.ts`、`tests/helpers/fakeD1.ts`。
- **Findings**:
  - `DB.batch()` は複数の文を 1 回のネットワーク往復で送り、トランザクションとして実行する。どれか 1 文が失敗すると全体が取り消される。
  - 主キー違反は例外（メッセージに `UNIQUE constraint failed: survey_respondents.…` を含む）として現れる。別の失敗（接続・構文）と区別するには、メッセージにテーブル名つきの制約違反を含むかで判定する。
  - 既存の型とフェイクは `batch` を持たない。
- **Implications**: `D1Database` の型に `batch` を足し、フェイクは `BEGIN`／`COMMIT`／`ROLLBACK` で再現する。主キー違反の文言は、実装時にローカルの D1 で実測する（フェイクの文言と実機の文言の差を確認する）。

### 匿名性を保つデータの形

- **Context**: 回答と did を結びつけない（要件 6.2–6.5）。
- **Sources Consulted**: ブリーフ・ロードマップの確定事項、D1 の `WITHOUT ROWID` の挙動。
- **Findings**:
  - 通常のテーブルは行の挿入順（rowid）を持つため、回答と回答済みの集合の挿入順が一致すると、突き合わせの手がかりになる。`WITHOUT ROWID` の表は主キー順に並び、挿入順を持たない。
  - 回答の識別子は乱数にする（時刻つきの識別子だと時刻が漏れる）。
  - 複数選択の選択順は端末ごとの癖を含みうるため、保存時に設定の選択肢の順へ正規化する。
  - 日より細かい時刻は持たない。回答した日は日本標準時の暦で数える（保持期限の暦と同じ）。
  - D1 の Time Travel（時点復元）は一定期間、削除前の状態を保持する。削除は即座に物理的な消去とは限らない。
- **Implications**: 2 テーブルとも `WITHOUT ROWID`。識別子は `crypto.randomUUID()`。保存時に正規化する。Time Travel の保持はプライバシーポリシーの記載（別 spec）で扱う事実として、Risks に残す。

### 回答者のハッシュ

- **Context**: 要件 6.4・6.6 は、アンケートごとに異なる一方向の値を、鍵を知らない者が再計算できない方法で求めることを求める。
- **Sources Consulted**: Web Crypto の HMAC（Workers で利用可能）、`credentialCrypto.ts` の鍵の扱い（Base64 の 32 バイト）。
- **Findings**: `HMAC-SHA256(鍵, surveyId + did)` は、Web Crypto だけで書け、依存の追加が要らない。1 回の計算は 1ms 未満で、無料枠の CPU に収まる。`surveyId` は `[a-z0-9-]` だけで `did` は常に `did:` で始まるため、連結の境界は曖昧にならない。
- **Implications**: 確定済みの方式（`survey_id + did` の連結）に従う。鍵は Base64 の 32 バイトで、`SCHEDULE_ENC_KEY` と同じ生成方法・別の値にする。

### 定期実行の枠への相乗り

- **Context**: 要件 8.3 は、既存の毎分の定期実行の日次の 1 枠だけで削除を行うことを求める。
- **Sources Consulted**: `src/worker.ts`、`src/lib/schedule/runner.ts`（`isHousekeepingTime`、`runHousekeeping`）。
- **Findings**: `scheduled` は `isHousekeepingTime` が真のときだけ `runHousekeeping` を `ctx.waitUntil` で呼ぶ。後片付けは期限での絞り込みだけで状態を持たず、失敗しても翌日の同じ枠で回収される。
- **Implications**: 同じ条件の分岐に、アンケートの削除を別の `waitUntil` として足す。互いの失敗が影響しないよう、削除は内部で例外を捕らえる。

### 定期実行からの設定の読み出し

- **Context**: 削除は設定（survey-definition）を読む必要があるが、定期実行にはリクエストも原点（origin）も無い。
- **Sources Consulted**: survey-definition の design（`readSurveyConfig(assets, origin, options)`）、`wrangler.template.jsonc` の `ASSETS` バインディング。
- **Findings**: `ASSETS.fetch` は URL のホストを使わず、パスで静的ファイルを引く。固定の仮の原点で足りる。ビルドの旗（`PUBLIC_SURVEY_CONFIG_PRESENT`）は `vite.define` で埋め込まれるが、`src/worker.ts` のエントリに同じ置換が効くかは未確認である。
- **Implications**: 削除は `present: true` を明示して読む（静的アセットが無ければ `readSurveyConfig` が「なし」を返し、サーバー側は通信の異常を画面に出さないため支障がない）。旗に依存せず、エントリへの置換の有無に左右されない。

### 秘密値の自動登録の適合

- **Context**: 要件 10 は、`SURVEY_HASH_KEY` を各環境に自動で用意し、D1 を共用する環境で同じ値にそろえることを求める。
- **Sources Consulted**: `hack/ensure-worker-secrets.mjs`、`hack/prepare-local-env.mjs`、`hack/render-deploy-config.mjs`、`DEVELOP.md`。
- **Findings**:
  - `GENERATORS` の全キーが、本番では Worker に、`--develop` では Worker とプレビューの基本設定の両方に、未登録のものだけ登録される。
  - 片方にだけ登録済みのとき、`REGENERATABLE` に無いキーは失敗で終わる（`SCHEDULE_ENC_KEY` と同じ）。鍵を作り直すと、既存の回答済みの記録と一致しなくなり、重複を防げなくなるため、同じ扱いが正しい。
  - develop とプレビューは `-develop` の D1 を共用し、本番は別の D1 である。本番と develop の鍵が異なっても、互いのデータには触れない。
- **Implications**: `GENERATORS` に追加するだけで足りる。`REGENERATABLE` には入れない。確定事項の「全環境で同じ値」は、D1 を共用する環境の間で満たせば目的（重複の判定の一貫性）を達成する。本番まで同じ値にそろえるには、環境をまたぐ値の受け渡し（GitHub のシークレット経由など）が要り、既存の仕組みを超える。この差は利用者に報告する。

### 既存の API の流儀

- **Context**: セッションからの did の取得、`no-store`、エラー応答、パス設計をそろえる。
- **Sources Consulted**: `src/pages/v2/feedback.ts`、`src/pages/v2/schedules/[id].ts`、`src/lib/api/response.ts`、`src/lib/api/schema/index.ts`、`.kiro/steering/api-design.md`。
- **Findings**:
  - 認証は `locals.session` の有無で 401。did は `session.did` だけを使う。
  - エラーは `errorResponseFromStatus(status)` が `cache-control: no-store` つきで返す。対応するステータスは 400／401／403／404／409／429／503 で、422 は既定の 500 になる。
  - 成功の JSON も `no-store` を付ける。例外は `try/catch` で受けて 500。
  - スキーマは `src/lib/api/schema/v2/<リソース>/…/<メソッド>.ts` に `operation` を置き、`index.ts` でパスに割り当てる。パスの変数のディレクトリは `_id` の形。
- **Implications**: 422 を `errorResponseFromStatus` と `Common.errorResponses` の説明に加える。パスは `/v2/surveys/{surveyId}/respondent/`（GET・PUT）と `/v2/surveys/{surveyId}/answers/`（POST）。動詞を含めず、操作は HTTP メソッドで表す。

## Architecture Pattern Evaluation

| Option                                                   | Description                                                             | Strengths                                                | Risks / Limitations                                          | Notes                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| 薄いルート＋共通の入口（Gate）＋純粋な検証＋保管（採用） | 認証・対象の判定・鍵の確認を 1 か所にまとめ、検証と保管を別の部品にする | 3 つの操作で前処理が重複しない。検証が純粋で試験しやすい | 部品が増える                                                 | 既存の schedules／feedback の分担に近い |
| ルートごとに前処理を書く                                 | 各ハンドラが認証・設定・鍵を個別に扱う                                  | 部品が少ない                                             | 3 か所で重複し、判定の順序がずれる危険                       | 却下                                    |
| 回答の保存を Durable Objects で直列化                    | アンケートごとに単一のオブジェクトで重複を防ぐ                          | 強い直列化                                               | 無料枠・新しい基盤・構成の複雑化。主キー違反で足りる         | 却下                                    |
| 重複を SELECT で事前に確認                               | 回答の前に集合を引く                                                    | 409 を明示しやすい                                       | 読み取りが増え、競合で二重に通る余地がある。確定事項に反する | 却下                                    |

## Design Decisions

### Decision: 3 つの操作の前処理を 1 つの入口にまとめる

- **Context**: 3 つの操作は、認証・パスの検証・設定の取得・期間の判定・鍵の確認を同じ順序で行う必要がある。
- **Alternatives Considered**:
  1. ルートごとに書く — 重複し、順序がずれうる。
  2. ミドルウェアにする — 全リクエストに載り、無料枠の CPU を圧迫する。
- **Selected Approach**: `SurveyRequestGate` が、認証 → パス → 設定と期間 → 鍵の順で判定し、通れば文脈を、通らなければ応答を返す。
- **Rationale**: 判定の順序（特に、期間外は D1 に触れずに 404）を 1 か所で保証できる。
- **Trade-offs**: 部品が 1 つ増える。
- **Follow-up**: 判定の順序を単体テストで固定する。

### Decision: 期間外・未定義の判定は 3 つの操作すべてに適用する

- **Context**: 確定事項は回答の保存について 404 を定める。回答済みの確認と登録については明記がない。
- **Alternatives Considered**:
  1. 回答の保存だけ期間を見る — 期間外の確認・登録が D1 に触れ、削除済みのデータに書き込む余地ができる。
  2. 3 つとも期間を見る — 期間外は常に D1 に触れず、終了後に集合を作り直す書き込みもできない。
- **Selected Approach**: 3 つとも開催期間内のアンケートに限る。
- **Rationale**: 終了時刻に集合を削除するため、その後に集合へ書き込めると、削除後にデータが残る（保持期限の逸脱）。
- **Trade-offs**: 端末が期間外に確認を呼んだ場合は 404 になる。画面側は設定で期間を判定してから呼ぶため、通常は起きない。

### Decision: 回答の検証は、構造の不正を先に、未完了を後に判定する

- **Context**: 「回答しない」を含む回答は 422、設定と合わない回答は 400 とする。
- **Selected Approach**: 質問の過不足・選択の個数・選択肢の存在を先に検証して 400 とし、すべて妥当なうえで「回答しない」を含むときだけ 422 とする。
- **Rationale**: 422 は「妥当だが完了していない」という意味に限り、攻撃や不具合の入力（400）と区別する。
- **Trade-offs**: 「回答しない」だけを送り他の質問を省いた入力は 400 になる。画面は「回答しない」を含む回答を送らないため影響がない。

### Decision: 回答の保存は事前の読み取りをせず、主キー違反を重複とする

- **Context**: 要件 7.5・9.3。
- **Selected Approach**: `batch` で「集合への通常の INSERT → 回答の INSERT」を送り、`survey_respondents` の主キー違反のメッセージを重複（409）に、それ以外の失敗は 500 にする。
- **Rationale**: 事前の SELECT は競合で二重に通る余地があり、読み取りも増える。トランザクションの失敗で回答も残らない。
- **Trade-offs**: 例外メッセージの文言に依存する。実機の文言を実装時に実測し、テストで固定する。

### Decision: 削除は設定を読み、期限を過ぎたものだけに DELETE を発行する

- **Context**: 要件 8。削除の実行は設定に依存し、設定から消えたアンケートのデータは削除できない。
- **Selected Approach**: 設定を読み、`retentionExpired` が真の項目ごとに `DELETE ... WHERE survey_id = ?` を発行する。削除済みなら 0 行で、読み取りの課金も実質ない。
- **Rationale**: 設定に残る限り繰り返し安全で、状態を持たない。
- **Trade-offs**: 設定から先に消されたデータは残る。運用（survey-operation の prune）が、データの削除を確認してから設定を除く。

### Decision: ハッシュ鍵は `GENERATORS` に追加し、D1 を共用する環境の間でそろえる

- **Context**: 確定事項は「全環境で同じ値」。実際の構成では、本番は独立した D1 を持つ。
- **Selected Approach**: 既存の仕組みに乗せる。develop とそのプレビューは同じ値になり、本番は独立した値になる。
- **Rationale**: 重複の判定は D1 の内側で完結するため、D1 を共用する環境の間で値がそろえば足りる。環境をまたぐ受け渡しの新機構を足さない。
- **Trade-offs**: 本番と develop で値が異なる。データが別なので支障はない。
- **Follow-up**: 利用者に、確定事項との差（本番は独立した値）を報告する。

## Design Synthesis

- **Generalization**: 3 つの操作は「現在のアンケートに対する、現在のアカウントの回答状況の操作」という同じ前処理を共有する。この共通部を `SurveyRequestGate` に一般化した。回答の内容の検証は回答の保存だけのものなので一般化しない。
- **Build vs Adopt**: HMAC は Web Crypto（プラットフォーム標準）を採用し、ライブラリを足さない。原子的な保存は D1 の `batch` を採用する。レート制限の部品（`FEEDBACK_RATE_LIMITER` の型）は、重複を主キーで防ぐため不要と判断し採用しない。定期実行・秘密値の登録・エラー応答・スキーマの登録は既存の仕組みを採用する。
- **Simplification**: アンケートごとのテーブル・回答の取り消しや訂正・集計用の API・Durable Objects・事前の SELECT・独自の削除状態の管理を設けない。削除は設定と時刻だけから決め、状態を持たない。

## Risks & Mitigations

- 主キー違反の例外メッセージの文言が実機とフェイクで異なる — 実装時にローカルの D1 で実測し、判定を実機の文言に合わせ、テストで固定する。
- `src/worker.ts` で `vite.define` が効かない可能性 — 削除側は `present: true` を明示して旗に依存しない。
- 設定から先にアンケートを消すとデータが残る — 運用側（survey-operation）が、データの削除の確認後に設定から除く。この spec は設定に残る間の削除だけを保証する。
- D1 の Time Travel により、削除後も一定期間は復元可能な状態が残る — 保持の説明は privacy-policy の更新で事実どおりに扱う。
- 開発ブランチのプレビューは、develop への配備前は新しい表がない D1 を使う — 既存の予約投稿と同じ運用上の制約。表が無いと API は 500 になるだけで、データは作られない。
- 鍵を片方にだけ登録したまま放置すると配備が失敗する — 意図した動作（`SCHEDULE_ENC_KEY` と同じ手動の対処）。

## References

- [Cloudflare D1 Worker API](https://developers.cloudflare.com/d1/worker-api/) — `batch` の挙動（トランザクション・失敗時の取り消し）。
- [Cloudflare D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) — 時点復元の保持期間。
- `.kiro/specs/survey-definition/design.md` — 設定の型・期間と保持期限の判定・設定の取得の契約。
- `src/pages/v2/feedback.ts`・`src/pages/v2/schedules/[id].ts` — 既存の API の流儀。
- `hack/ensure-worker-secrets.mjs`・`hack/prepare-local-env.mjs` — 秘密値の自動登録。

## 実機での検証結果（タスク 4.1）

- **重複の文言**: wrangler 4.147 の `getPlatformProxy`（workerd 上の D1、永続先は一時ディレクトリ）に `migrations/` の全移行を適用し、`survey_respondents` への重複 INSERT を含む `db.batch([...])` を実行した。`batch()` が投げる `Error.message` は `D1_ERROR: UNIQUE constraint failed: survey_respondents.survey_id, survey_respondents.did_hash: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_PRIMARYKEY)`。`node:sqlite` の文言（接頭辞なし）を含む部分一致の `UNIQUE constraint failed: survey_respondents` で両方に当たるため、判定は変更不要で、実測の文言をテストに固定した。
- **原子性**: 重複したバッチの後、`survey_answers` には最初の 1 行だけが残り、2 回目の回答は残らなかった（ロールバックを確認）。
- **定期実行と旗**: `src/worker.ts` の `scheduled` は `runSurveyRetention` を呼び、そこで `readSurveyConfig(env.ASSETS, 仮の原点, { present: true })` を明示している。`readSurveyConfig` は `options.present ?? 旗` なので、明示指定があれば旗の置換の有無に依存しない（コードで確認）。
