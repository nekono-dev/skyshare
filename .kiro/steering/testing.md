# Testing Standards

**状態: 承認済み（test-foundation spec で決定。実装中。未決定・未検証の項目は末尾に記す）**

テストは `src/` の現行の実装から作り直す。旧テストは根拠にしない。テストの置き場所は `tests/`。

## Philosophy

- テストは**振る舞い（受入基準）**を検証する。関数ごとのテストは作らない。
- 外部の実サービスに依存させない。通常のテストは毎回同じ結果になる。
- 実装の内部（非公開の関数の呼び出し順など）には依存させない。
- 網羅は目標にしない。P0 の振る舞いを確実に押さえることを優先する。

## Layers（検証層）

| 層        | 対象                                          | 実行環境と設定ファイル                                                            | 検証すること                                                            |
| --------- | --------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| unit      | `src/lib/` の純粋な規則、zod スキーマ         | Node。`config/test/vitest.unit.config.ts`                                         | 規則の分岐、境界値、失敗の種類                                          |
| route     | `src/pages/**/*.ts` の API、D1・R2 を使う処理 | workerd（`@cloudflare/vitest-plugin`）。`config/test/vitest.route.config.ts`      | 認証、状態コード、Cookie、応答の形、D1・R2 への副作用                   |
| component | 対話のある React 部品                         | Node ＋ happy-dom（ファイル先頭で指定）。`config/test/vitest.component.config.ts` | 操作に対する表示状態、キー操作                                          |
| render    | `.astro` のサーバー描画                       | Astro の container。`config/test/vitest.astro.config.ts`                          | サーバー描画の出力（属性、条件による出力の有無）                        |
| e2e       | 利用者の六つの流れ・移動した部品の操作        | Playwright（`tests/e2e/flows`）。`npm run test:e2e` が起動する                    | 画面 → API → 保存の結線。Bluesky は偽のサーバーに置き換える             |
| live      | 実際の Bluesky（PDS）                         | 開発者がローカルで任意に実行（`npm run test:live`）。spec: live-tests             | 外部との契約の実証（読み取り専用）。CI・pre-push・test:all には含めない |

- **route 層は workerd で実行する**。Node の代用ではなく、実行環境の差を検出するため。
- **component 層と unit 層は別の設定ファイルで実行する**。workerd の環境はカスタムの環境と併用できないため、route 層の設定は独立させる。
- **route 層の外部通信**（Bluesky など）は miniflare の `outboundService` で、偽の Bluesky の応答へ向ける。実ネットワークへは出ない。

## Bluesky の接続先（偽の Bluesky）と設定の源

- 接続先の解決の規則は `src/lib/platform/blueskyEndpoints.ts`（`resolveBlueskyEndpoints`）。既定値は本番と同じ。`src/lib/platform/publicEndpoints.ts` が、ビルド時の `import.meta.env` からそれを作る。
- 非秘密の設定（接続先・運営者の情報など）の源は `wrangler.jsonc` の `vars` だけ。開発・ビルド・実行時（Worker の env）が同じ値を使う。`wrangler.jsonc` は `config/<名前>.json` から `scripts/config/render-wrangler.mjs` が毎回生成する（Git 管理外）。`.env` は使わない。
- 秘密情報（`SCHEDULE_ENC_KEY`・`OAUTH_CLIENT_KEY`・`SURVEY_HASH_KEY`）は `.dev.vars`（ローカル）と Worker のシークレット（本番）に置く。
- E2E は `config/e2e.json`（`config/develop.example.json` から、接続先だけ偽の Bluesky の URL にして、実行のたびに作り直す）で `wrangler.jsonc` を生成して `astro dev` を起動する。終了後は開発の設定から生成し直す。
- 上書きは開発とテストの環境だけで使う。本番の設定（`config/production.json`）には偽の値を入れない。

## Priority（P0 は必ず契約テストを置く）

- **P0**（要件 2.1 の九つの振る舞い）: セッション（Cookie・トークン更新・書き戻し）、予約の実行（冪等性・失敗の分類・後片付け・暗号化）、アンケートの匿名性（鍵付きハッシュ・結果と目録の記録を確認した後に回答を削除）、投稿の原子的な作成、Entry 削除の範囲、フィードバック送信（本文の無害化・間隔制限）、旧投稿削除の OAuth 拒否、表示言語の判定、共有の文字数と URL の規則。
- **P1**: 投稿フォームの状態遷移、タイムラインのスレッド化、設定の保存。
- **P2**: 静的ページの描画。
- **未分類**: 優先度のない振る舞いは、テストを書く前に機能の spec で優先度を定める（例: アンケートの `survey/loadConfig.ts` など）。
- **対象外**: `scripts/`（運用ツール）、`_legacy/`、外部サービスの内部。

### P0 のモジュール（24 ファイル。閾値とテストの対応）

- unit（11）: `src/lib/session/cookies/`（フォルダ。分岐のカバレッジはファイルごとに 80%）、`src/lib/schedule/credentialCrypto.ts`、`src/lib/survey/respondentHash.ts`、`src/lib/entry/createBskyThread.ts`、`src/lib/timeline/resolveEntryDeleteScope.ts`、`src/lib/entry/resolveDeleteTargets.ts`、`src/lib/feedback/issueContent.ts`、`src/lib/feedback/githubIssue.ts`、`src/lib/i18n/locale.ts`、`src/lib/share/shareBody.ts`、`src/lib/share/counterReserve.ts`
- route（13）: `src/lib/session/oauthSession.ts`、`src/lib/session/bskySessionRefresh.ts`、`src/lib/session/oauthLogin.ts`、`src/lib/schedule/executor.ts`、`src/lib/schedule/runner.ts`、`src/lib/schedule/stageSchedule.ts`、`src/lib/schedule/imageStaging.ts`、`src/lib/survey/store.ts`、`src/lib/survey/daily.ts`、`src/lib/survey/results/store.ts`、`src/lib/survey/request.ts`、`src/pages/v1/page.ts`、`src/pages/v2/feedback.ts`

## Coverage（P0 だけ、ファイル単位の分岐 80%）

- 閾値は上の 24 ファイルのパスに置く（glob は使わない）。判定は該当ファイルごとに行い、下回ると層の実行が非ゼロで終わる。
- 計測は istanbul を使う（workerd では v8 が使えない。route 層でも計測できることを確認済み）。
- `src/` 全体の率と、P1・P2 の下限は置かない。
- **失敗の発生点**（P0 モジュールの `throw`、失敗の戻り値、エラー応答）は、すべて失敗の種類を検証するテストを持つ。発生点の一覧は `.kiro/specs/test-foundation/research.md` の「発生点の一覧」に記録する。

## Mutation（変異テスト、報告のみ）

- P0 の unit 層の 11 ファイルに、`config/test/stryker.config.mjs` で変異テストを行う（`npm run test:mutation`）。
- 数値の下限は置かず、ゲートにしない。生き残った変異体の一覧を報告し、等価な変異体と観測できない性質は人が注釈する。
- 実行はローカルか定期に行う。PR と push のゲートには入れない。

## Requirements for tests

- 外部の接続、実時間、乱数に依存させない。時刻は fake timers で固定する（`vi.useFakeTimers({ toFake: ["Date"] })`）。乱数に依存する検査は、固定の値を注入する。
- 秘密情報をテストに置かない。鍵・DID・ハンドルは `tests/fixtures/` の架空の値を使う。
- テストは互いに独立させる。D1 は各テストファイルの前にマイグレーションを適用し、空の状態から始める（isolated storage）。
- テストの題名は英語。題名に受入基準の識別子（要件番号・AC/FR/NFR のタグ）は含めない。対応は設計の追跡表で示す。

## Layout（`tests/`）

```
tests/
  unit/        src/lib/ などの対応するパス（例: tests/unit/lib/share/counterReserve.test.ts）
  component/   src/components/ の対応するパス。support/setup.ts で後片付けを行う
  route/       src/pages/ と src/lib/ の対応するパス。support/ は D1 のマイグレーションと外部通信
  render/      .astro の描画テスト
  e2e/
    flows/     利用者の六つの流れ（login・thread-posting・entry・schedule・survey・feedback）と、移動した部品の操作（util-placement: 表示言語のドロップダウン・下書きのスクロール制御・投稿後の共有画面）
  support/
    fakeBluesky/   偽の Bluesky（認可サーバー・PLC・PDS・AppView の固定応答。HTTP 版と route 用の定義）
    fakeOutbound.ts route 層の外部通信（outboundService）
  fixtures/    固定の識別子（identities.ts）と設定（survey/config.ts）
  live/        実際の Bluesky への契約テスト（`npm run test:live`。ゲートには入れない）
```

## リファクタと単体テスト（移動・分割の規則）

- 移動・分割・改名で、`src/lib/` の純粋な規則（unit 層の対象）の所在を変えるときは、その変更と同じコミットで、規則の単体テストを置く。既に同じ規則を覆うテストがあれば、それを使う。
- 振る舞いを変えない移動でも、テストで規則の分岐と境界値を固定する。移動の前後で同じ入力に同じ結果が出ることを、テストの期待値で確かめる。
- 施行（2026-11-05）より前に移動した規則の既存のテスト不足は、この規則では追加しない。必要になった変更の中で、その規則に限って足す。
- 対象は `src/lib/` の純粋な規則。部品（`components/`）の判断は、component 層で操作の結果を確かめる（従来どおり）。

## Gates（いつ何を実行するか）

- **CI（PR）**: E2E（`e2e.yaml`）だけを必須にする。`npm run test:e2e` を実行する。unit・component・route・render は必須にしない。live は実行しない。
- **push の前（ローカル）**: `npm run test:all` を実行する。E2E を含むすべての層が対象。`.githooks/pre-push` が失敗時に push を止める。
- **強制**: `prepare`（npm install・npm ci の後）と `session-start.sh` で `core.hooksPath` を `.githooks` に設定する。人間とエージェントは同じ hook を使う。
- **`test:all` の順序**: codegen → 型検査 → lexicon → imports（依存規則） → unit → component → route → render → e2e。いずれかが失敗すれば全体を失敗にする。

## route 層の互換日付の差（要件 11.2）

- route 層の互換日付は `2026-08-22`（同梱の workerd が対応する最新）。本番（`config/wrangler.template.jsonc`）は `2026-10-08`。
- 差は設定の読み込み時に警告として出す（`config/test/vitest.route.config.ts`）。本番の挙動との差は、この日付の差に限る。

## 未決定・未検証

1. **E2E の六つの流れ**: 操作と期待する表示は tasks で定める（9.4〜9.6）。偽の Bluesky の endpoint は流れが呼ぶものだけを追加する。
2. **dev サーバーの起動**: `npm run test:e2e` は `build:prepare`（`scripts/e2e/run-e2e.mjs` が呼ぶ）の `prettier --write .` を含むため、リポジトリ全体を書き換える副作用がある。見直しが必要。
3. **変異テストの採否の再評価**: unit 層の PoC（2 モジュール）と、P0 の 11 ファイルでの報告は実施済み。route 層への適用は未検証。
4. **`test:type`・`test:lexicon` の扱い**: `test:all` に含める（設計どおり）。

2026-11-10 追補: 1 と 4 は実装で決着している（E2E の流れは `tests/e2e/flows/` にあり、`test:all` は `test:type`・`test:lexicon` を含む）。2 も決着した（利用者の決定 2026-11-10: リポジトリ全体の整形は意図どおり。ただしテストやビルドの時ではなく、コミットの前に行う。`build:prepare` から `format` を外し、`.githooks/pre-commit` が整形する）。残る未決定は 3（積み残し）。PR の必須の検査は、GitHub の main のルールセットで `e2e` だけを必須にしている。

---

## `hack/` の CLI テスト

`hack/` の CLI のテストは `tests/unit/hack/survey-cli/` に置く。P0 ではなく、被覆率の閾値は設けない。

_Testing policy is project-wide. Each spec's design `Testing Strategy` chooses layers for its acceptance criteria within this policy._
_updated_at: 2026-11-10_
