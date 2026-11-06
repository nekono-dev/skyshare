# Research & Design Decisions

## Summary

- **Feature**: `test-foundation`
- **Discovery Scope**: Complex Integration（テスト基盤。実行環境、CI、フック、外部サービスの偽装にまたがる）
- **Key Findings**:
  - route 層の workerd 実行は spike で成立を確認済み（D1 マイグレーションと Astro の API ルートの直接呼び出し）。
  - `@cloudflare/vitest-pool-workers` は `@cloudflare/vitest-plugin` に改名済み（後継 1.4.11、peer は vitest ^4.1 系）。
  - **E2E で Bluesky を偽装する方式に、要件上の前提の欠落がある**。Playwright の route はブラウザからの通信しか横取りできず、ログイン・投稿・予約などの多くの流れはサーバー側が Bluesky に通信する。接続先は一部しか設定で差し替えられない（後述）。
  - 既存の SessionStart フックは、クラウド実行（`CLAUDE_CODE_REMOTE`）以外では何もせず終了する。core.hooksPath の設定は、その前に置く必要がある。
  - 既存の `e2e.yaml` は `deploy.yaml` からだけ呼ばれ、PR では動かない。live 項目（実アカウント）も含んでいる。

## Research Log

### route 層: @cloudflare/vitest-plugin（旧 pool-workers）

- **Context**: 要件 1.7・11 の workerd 実行方式の確認。
- **Sources Consulted**: Cloudflare Workers の Vitest 統合ドキュメント（configuration）、npm の `@cloudflare/vitest-plugin`（1.4.11、2026-10-29 公開）、ローカルの spike（`vitest.route.config.ts`、`tests/route/`）。
- **Findings**:
  - `cloudflareTest({ wrangler: { configPath }, miniflare: { bindings } })` を vitest の `plugins` に入れる。wrangler の設定（binding、compatibility）は読み込まれ、`miniflare` の値が優先される。
  - `readD1Migrations` は `migrations/` を読み、テスト用の binding（`TEST_MIGRATIONS`）として渡す。setup ファイルで `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` を呼ぶ。
  - 互換日付: 同梱の workerd は `2026-08-22` までしか対応しない（本番は `2026-10-08`）。日付を省略すると「ローカルで利用可能な最新」になる。
  - カスタムの Vitest 環境（jsdom など）は Workers 統合では使えない。
- **Implications**: route 層の設定は独立したファイルに置き、他の層と混ぜない。component 層は Node の環境で動かす。

### component 層: Vitest 4 と DOM 環境

- **Sources Consulted**: Vitest 4 の projects と環境に関する二次情報（WebSearch。公式の確認は実装時に行う）。
- **Findings**: Vitest 4 は `workspace` の代わりに `projects` を使う。`happy-dom`（高速・API が少ない）と `jsdom` の二択。ファイル先頭の `// @vitest-environment happy-dom` で環境を指定できる。
- **Implications**: component 層の環境は happy-dom を採用する（利用者が RTL と happy-dom を決定済み）。ファイル単位の指定を使うと、node 環境の他の層と分離できる。

### フック: core.hooksPath の設定

- **Sources Consulted**: Husky のドキュメントの二次情報（WebSearch）。
- **Findings**: `core.hooksPath` は各 clone の local 設定で、リポジトリには入らない。npm の `prepare` は、ローカルの install（`npm install`、`npm ci` を含む）で走る。`postinstall` は既存の `patch-package` が使っている。
- **Implications**: 要件 8.1 は `prepare` に設定を書く。既存の `postinstall` は変えない。git リポジトリでない環境（パッケージとしての利用）では何もしないよう、ガードを置く。

### 既存フック `.claude/hooks/session-start.sh` の制約

- **Context**: 要件 8.2（エージェントのセッション開始で hooksPath を設定）。
- **Findings**: 先頭で `CLAUDE_CODE_REMOTE` が `true` でなければ終了する。作業ツリーで利用者が変更中のファイル（`M` 状態）でもある。
- **Implications**: hooksPath の設定は、このガードより前に書く必要がある。利用者の未コミット変更と衝突しないよう、既存行は変えず、追加のみにする。

### E2E: CI と既存ワークフロー

- **Findings**: `e2e.yaml` は `workflow_call` と `workflow_dispatch` だけで、PR のトリガーがない。`E2E_ENV` があれば live 項目も実行する。`concurrency` は実アカウントの直列化のため。
- **Implications**: 要件 9.1 を満たすには、PR のトリガーを追加する。live 項目は要件 10 と分離（live 層は別 spec）するため、e2e から外す。

### E2E: Bluesky の偽装（**前提の欠落**）

- **Context**: 要件 10.3 と 10.5。Playwright の `page.route` は、ブラウザ由来の通信だけを横取りできる。
- **Sources Consulted**: Playwright の network mocking（WebSearch）。ローカルの参照箇所（`grep` の結果）。
- **Findings**:
  - ブラウザ由来（クライアントの `publicAgent`、候補の取得）は `page.route` で偽装できる。
  - サーバー由来の通信は dev サーバー（workerd）から出るため、`page.route` の対象外。
  - 接続先の直書き: `bsky.social`（`agentFactory.ts`、`oauth/client.ts`、`oauth/discovery.ts`、`did.ts`、`videoAuth.ts`）。PDS は `oauth/discovery.ts` が DID から解決する（例: `morel.us-east.host.bsky.network`）。
  - 環境変数で差し替え可能: `PUBLIC_DEFAULT_ATP_SERVICE`（`api.bsky.app`）、`PUBLIC_PLC_DIRECTORY_BASE_URL`（`plc.directory`）。
- **Implications**: 偽装の方式を決める必要がある。候補は次の三つ。
  1. **テスト用の接続先の上書きを製品コードに設ける**（Bluesky のサービス基底 URL をすべて設定で差し替え、偽のサーバーを立てる）。製品コードの変更を伴い、要件の追加が必要。
  2. **E2E のサーバー由来の流れを外す**: ログインや投稿などの大半が対象になり、6 本の流れを満たせない。
  3. **実アカウント（live）を使う**: 利用者が決めた「偽の Bluesky」と矛盾する。
- **Status**: 利用者の判断が必要（design を確定できない）。

### カバレッジ: 層ごとの計測

- **Findings**: P0 の分岐 80% を計測する方法は未検証。Vitest の v8 coverage は Node の層で動くと見込まれるが、workerd（route 層）での計測が使えるかは不明。
- **Implications**: 計測の方法は design で確定する。route 層の計測ができない場合は、P0 の計測対象を unit 層と component 層に限り、route 層の分は別の検証で補うか、要件を見直す。
- **PoC 結果（route 層の分岐カバレッジ、成立）**:
  - 対象: `src/pages/v2/schedules/limits.ts`（分岐 1 件: session 無しで 401）。
  - coverage provider は **istanbul**（`@vitest/coverage-istanbul@4.1.11`）。v8 は workerd で使わない。
  - 200 の経路のみ: 分岐 1/2（50%）、未通過の 12 行目を報告。401 の経路を追加: 分岐 2/2（100%）。
  - `--coverage.thresholds.branches=80` を下回ると、route 層の実行は exit 1 で失敗する（ゲートとして機能する）。
  - **P0 モジュールごとの閾値（PoC、成立）**: 対象は `src/lib/survey/respondentHash.ts`（P0・アンケートの鍵付きハッシュ、分岐 2 件）。
    - `thresholds` のキーに**ファイルのパス**または**ディレクトリの glob**（`src/lib/survey/**`）を書くと、該当ファイルごとに判定される。
    - 正常な鍵だけを通すと分岐 1/2（50%）。`src/pages/v2/schedules/limits.ts` は未実行で 0%。両方とも閾値を下回り、それぞれのキーで ERROR が出た。
    - 各ファイルが自分の閾値を満たす（respondentHash ≥ 50、limits = 100）と exit 0。閾値を下回るファイルがあると exit 1。
    - ディレクトリ glob `src/lib/survey/**`（閾値 80）で 50% を下回ると、`does not meet "src/lib/survey/**" threshold` で exit 1。
    - 注意: 閾値を満たす run の表示では、100% のファイル（limits.ts）が表から省かれた。集計（全体の分岐 3/4）には含まれているため、表示の仕様と判断する。
    - 未確認: 不正な鍵（atob 失敗・長さ不正）の経路を加えた場合の 100% 化、実行時間の増分。
  - 依存: 採用する場合は `@vitest/coverage-istanbul` を devDependencies に追加する（PoC では `--no-save`、package.json は未変更）。

## Architecture Pattern Evaluation

| Option                       | Description                                                                                        | Strengths                                                    | Risks / Limitations                        | Notes    |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ | -------- |
| 層ごとに設定ファイルを分ける | route・component・unit・render・e2e をそれぞれ `vitest.*.config.ts` にし、npm スクリプトで順に実行 | 環境の混在がない。既存の `vitest.astro.config.ts` と同じ流儀 | 実行スクリプトの管理が必要                 | 採用候補 |
| vitest projects に統合       | 一つの設定に projects を並べる                                                                     | 一回の実行で済む                                             | workerd プラグインと他の環境の混在が不安定 | 見送り   |

## Design Decisions

### Decision: 層ごとの設定ファイル

- **Context**: 要件 1.7（環境の分離）。
- **Selected Approach**: `vitest.unit.config.ts`、`vitest.component.config.ts`、`vitest.route.config.ts`、`vitest.render.config.ts`（既存の `vitest.astro.config.ts` を流用）、e2e は Playwright。
- **Trade-offs**: 設定ファイルは増えるが、各層の環境が独立する。

### 変異テスト（案 3・PoC、unit 層）

- **ツール**: Stryker 10.1.1（`@stryker-mutator/core` と `@stryker-mutator/vitest-runner`、vitest 4 の peer に一致）。`--no-save` で導入（package.json 未変更）。
- **設定の注意**: 作業ツリー全体をサンドボックスへコピーするため、`.agents` 内のシンボリックリンクで失敗した。`ignorePatterns` で `.agents`・`.claude`・`.kiro`・`.git` などを除外すると成立。
- **対象 1**: `src/lib/survey/respondentHash.ts`（26 変異体）
  - 正常系 1 件のテスト: スコア 61.54%、生き残り 7（選択行 28 の `if` を含む）。
  - 4.4 に沿って 3 件追加（既知の HMAC 値、別の調査の値が変わる、不正な Base64 と 16 バイトの鍵が固定メッセージで失敗）: スコア 92.31%、生き残り 2。
  - 残り 2 件: `i <= raw.length`（等価な変異体。範囲外の書き込みは無視される）、`extractable: false → true`（戻り値にしか現れず、テストから観測できない）。
- **対象 2**: `src/lib/schedule/credentialCrypto.ts`（暗号化、P0）
  - 往復のみのテスト（1 件）: スコア 79.41%、未到達 4（すべてエラー経路の発生点。4.4 の対象）、生き残り 3（等価 1、`extractable` 1、長さの検査 1）。
- **所見**: 変異テストの生き残りは、4.4（エラー経路）の未達と重なる。等価な変異体と、観測できない性質（`extractable`）は、テストだけでは殺せない。1 モジュールの実行は約 5 秒。
- **未確認**: route 層（workerd）での実行、大きなモジュール（D1 を使う P0）での実行時間と件数。

### P0 モジュールの調査（tasks の前に確定）

- **方法**: 要件 2.1 の九つの振る舞いに対応するファイルを、実装から選んだ。各ファイルの先頭コメント（責務）を読み、失敗の発生点（`throw`、`return null`、判別共用体の失敗値、HTTP のエラー応答）を `grep` で数えた。`grep` は失敗の表し方を網羅しないため、件数は目安。確定は各タスクで発生点を列挙して行う。
- **判定の基準**: 要件 2.1 の振る舞いの失敗が、利用者・運用者の情報、資金に近い操作、データの整合性に関わるか。
- **確定した 23 ファイル**（要件 2.1 の対応）:
  - セッション: `session/oauthSession.ts`、`session/bskySessionRefresh.ts`、`session/oauthLogin.ts`、`session/cookies.ts`
  - 予約の実行: `schedule/executor.ts`（発生点 約 17）、`schedule/runner.ts`、`schedule/stageSchedule.ts`（約 7）、`schedule/imageStaging.ts`、`schedule/credentialCrypto.ts`
  - アンケートの匿名性: `survey/respondentHash.ts`、`survey/store.ts`、`survey/retention.ts`、`survey/request.ts`
  - 投稿の原子的な作成: `entry/createBskyThread.ts`
  - Entry の削除範囲: `entry/resolveEntryDeleteScope.ts`、`entry/resolveDeleteTargets.ts`、`pages/v1/page.ts`（約 10。旧投稿の OAuth 拒否）
  - フィードバック: `feedback/issueContent.ts`（本文の無害化）、`feedback/githubIssue.ts`（約 4）、`pages/v2/feedback.ts`（間隔制限は `FEEDBACK_RATE_LIMITER`）
  - 表示言語: `i18n/locale.ts`
  - 共有: `share/shareBody.ts`、`share/counterReserve.ts`
- **除外（P0 としない理由）**:
  - `session/oauthAgent.ts`: エージェントの生成のみで、失敗の発生点がない。
  - `schedule/tid.ts`、`schedule/credentialExpiry.ts`、`schedule/validateSchedule.ts`、`schedule/store.ts`、`schedule/scheduleResponse.ts`、`schedule/scheduleLimits.ts`: 予約の作成・一覧・表示の規則。失敗の分類は受け付けの段（`stageSchedule.ts`）と実行の段に含まれる。
  - `feedback/limits.ts`、`feedback/feedbackDraft.ts`: 定数と入力の状態。送信の本文の無害化は `issueContent.ts` にある。
  - `legacy/pagedb.ts`: 要件 2.1 の九つの振る舞いに該当しない。
- **未分類（要件 2.5 により、テストの前に spec で優先度を定める）**: `survey/loadConfig.ts`（失敗を区別せず `undefined` にする。要件 4.2 のコメント）、`survey/launchCheck.ts`、`survey/gate.ts`、`survey/definition.ts`、`survey/client.ts`、`survey/answers.ts`、`survey/answerDraft.ts`、`survey/period.ts`、`survey/deviceRecord.ts`、`survey/env.ts`。`loadConfig.ts` は、失敗の扱いが匿名性と無関係であるかを、アンケートの spec で判断する必要がある。
- **担当層の暫定の判断**: D1・R2・API ルートに触れるものは route、純粋な規則と外部通信の注入で足りるものは unit とした。各タスクで確定する。

## 発生点の一覧（タスク 6.3）

各 P0 ファイルの失敗の発生点の候補。行番号つきで機械的に列挙した（`throw`、失敗の戻り値、エラー応答、`catch`）。各モジュールのタスク（7.x・8.x）で、発生点ごとの検証を確認する。0 件のファイルは、失敗を値で返さない（変換や描画だけを行う）。

合計 160 件

### src/lib/session/cookies.ts（10 件）

- 59: } catch {
- 115: } catch (e) {
- 116: throw new Error("invalid session cookie")
- 194: if (!isRecord(value)) return undefined
- 210: return undefined
- 214: if (value.kind !== undefined && value.kind !== "password") return undefined
- 221: return undefined
- 250: if (!raw) return undefined
- 324: } catch {
- 440: if (rest.length >= MAX_POOLED_ACCOUNTS) return null

### src/lib/schedule/credentialCrypto.ts（3 件）

- 32: } catch {
- 33: throw new Error("encryption key is not valid Base64")
- 36: throw new Error("encryption key must be 32 bytes")

### src/lib/survey/respondentHash.ts（3 件）

- 25: } catch {
- 26: throw new Error(INVALID_KEY_MESSAGE)
- 28: if (raw.length !== KEY_BYTES) throw new Error(INVALID_KEY_MESSAGE)

### src/lib/entry/createBskyThread.ts（1 件）

- 231: throw new Error(

### src/lib/entry/resolveEntryDeleteScope.ts（8 件）

- 35: | { kind: "legacy" }
- 37: | { kind: "unknown" }
- 52: if (!parsedSourceUri) return { kind: "unknown" }
- 62: return { kind: "unknown" }
- 64: if (!isThreadRootPost(thread.post)) return { kind: "legacy" }
- 76: if (!normalized) return { kind: "unknown" }
- 80: } catch (err) {
- 82: return { kind: "unknown" }

### src/lib/entry/resolveDeleteTargets.ts（8 件）

- 22: | { kind: "sourceGone" }
- 23: | { kind: "notThreadRoot" }
- 54: } catch (err) {
- 55: if (isNotFoundError(err)) return { kind: "sourceGone" }
- 56: throw err
- 62: return { kind: "sourceGone" }
- 64: throw new Error("unexpected thread view")
- 66: if (!isThreadRootPost(thread.post)) return { kind: "notThreadRoot" }

### src/lib/feedback/issueContent.ts（0 件）

### src/lib/feedback/githubIssue.ts（6 件）

- 57: if (res.status !== 201) {
- 61: await res.text().catch(() => ""),
- 63: return null
- 74: return null
- 77: } catch (err) {
- 79: return null

### src/lib/i18n/locale.ts（1 件）

- 99: return undefined

### src/lib/share/shareBody.ts（0 件）

### src/lib/share/counterReserve.ts（0 件）

### src/lib/session/oauthSession.ts（10 件）

- 54: if (!raw) return null
- 56: if (sep <= 0) return null
- 100: | { ok: false; status: ResumeFailureStatus }
- 125: return { ok: false, status: 401 }
- 127: return { ok: false, status: 429 }
- 129: return { ok: false, status: 500 }
- 131: return { ok: false, status: 502 }
- 135: if (result.tokens.sub !== s.did) return { ok: false, status: 401 }
- 180: | { ok: false; status: ResumeFailureStatus }
- 246: } catch {

### src/lib/session/bskySessionRefresh.ts（6 件）

- 35: errorResponseFromStatus,
- 82: } catch {
- 86: return errorResponseFromStatus(401)
- 103: } catch (err) {
- 105: return errorResponseFromStatus(resolveXrpcStatus(err))
- 148: return errorResponseFromStatus(resumed.status)

### src/lib/session/oauthLogin.ts（19 件）

- 117: if (!raw) return null
- 129: } catch {
- 130: return null
- 155: | { ok: false; status: 500 | 502 }
- 162: return { ok: false, status: 500 }
- 167: if (!as) return { ok: false, status: 502 }
- 189: return { ok: false, status: par.kind === "NotConfigured" ? 500 : 502 }
- 231: { ok: true; session: OAuthSession } | { ok: false; code: LoginFailure }
- 234: if (query.error) return { ok: false, code: "Denied" }
- 236: return { ok: false, code: "StateInvalid" }
- 239: return { ok: false, code: "IssuerMismatch" }
- 263: ok: false,
- 274: if (!pds) return { ok: false, code: "AccountUnverified" }
- 280: return { ok: false, code: "AccountUnverified" }
- 296: return { ok: false, code: "AccountUnverified" }
- 300: return { ok: false, code: "AccountUnverified" }
- 302: } catch {
- 304: return { ok: false, code: "AccountUnverified" }
- 307: return { ok: false, code: "AccountUnverified" }

### src/lib/schedule/executor.ts（23 件）

- 75: } catch {
- 112: if (!ok) throw new Stop({ type: "abandon" })
- 132: if (!result.ok) throw stopFor(result.kind)
- 141: } catch {
- 142: throw fail("CredentialInvalid")
- 147: throw fail(
- 155: if (!credential) throw fail("CredentialInvalid")
- 175: throw fail("CredentialExpired")
- 178: throw release(false)
- 180: throw release(false)
- 182: throw release(true)
- 184: throw fail("CredentialInvalid")
- 198: } catch {
- 199: throw release(true)
- 227: if (!object) throw fail("ImageMissing")
- 233: if (!json?.blob) throw release(true)
- 280: throw release(true)
- 319: if (!visual) throw fail("InvalidRecord")
- 341: await removeImages(env.SCHEDULE_IMAGES, imageKeys).catch(() => {})
- 345: if (payload.posts.length === 0) throw fail("InvalidRecord")
- 347: } catch (err) {
- 348: if (!(err instanceof Stop)) throw err
- 389: return undefined

### src/lib/schedule/runner.ts（5 件）

- 56: } catch {
- 71: } catch {
- 74: await releaseSchedule(env.DB, row.id, true, now).catch(() => {})
- 111: ).catch(() => {})
- 116: } catch {

### src/lib/schedule/stageSchedule.ts（16 件）

- 46: if (!isMultipartFormData(request.headers.get("content-type"))) return null
- 50: } catch {
- 51: return null
- 66: if (!body.success) return null
- 69: if (!isReplyRefOwnedBySelf(body.data.reply, did)) return null
- 70: if (body.data.createEntry === true && !body.data.visual) return null
- 77: } catch {
- 78: return null
- 86: | { ok: false; status: 400 | 409 | 429 | 500; error?: ScheduleErrorCode }
- 114: if (!runAt.ok) return { ok: false, status: 400 }
- 118: return { ok: false, status: 409, error: "ScheduleCredentialRequired" }
- 121: return { ok: false, status: 409, error: "ScheduleReauthRequired" }
- 128: return { ok: false, status: 429 }
- 133: if (total > MAX_IMAGE_BYTES_PER_SCHEDULE) return { ok: false, status: 400 }
- 144: } catch (err) {
- 146: return { ok: false, status: 500 }

### src/lib/schedule/imageStaging.ts（6 件）

- 44: throw new Error("total image size exceeds the limit")
- 55: } catch (err) {
- 56: await removeImages(bucket, keys).catch(() => {})
- 57: throw err
- 97: return null
- 100: if (!object) return null

### src/lib/survey/store.ts（2 件）

- 117: } catch (error) {
- 121: throw error

### src/lib/survey/retention.ts（2 件）

- 42: } catch {
- 78: } catch {

### src/lib/survey/request.ts（4 件）

- 12: import { errorResponseFromStatus } from "@/lib/api/response"
- 32: | { ok: false; response: Response }
- 77: ok: false,
- 78: response: errorResponseFromStatus(status),

### src/pages/v1/page.ts（16 件）

- 19: import { errorResponseFromStatus } from "@/lib/api/response.js"
- 40: return undefined
- 48: return undefined
- 52: return undefined
- 56: return undefined
- 79: return errorResponseFromStatus(401)
- 85: } catch (err) {
- 87: return errorResponseFromStatus(400)
- 92: return errorResponseFromStatus(400)
- 100: status: 403,
- 110: return errorResponseFromStatus(401)
- 123: return errorResponseFromStatus(400)
- 125: return errorResponseFromStatus(429)
- 127: return errorResponseFromStatus(500)
- 132: } catch (error) {
- 134: return errorResponseFromStatus(500)

### src/pages/v2/feedback.ts（11 件）

- 16: import { errorResponseFromStatus } from "@/lib/api/response.js"
- 33: } catch {
- 34: return undefined
- 61: if (!head.success) return errorResponseFromStatus(400)
- 64: if (!session) return errorResponseFromStatus(401)
- 69: if (!body.success) return errorResponseFromStatus(400)
- 79: return errorResponseFromStatus(503)
- 85: if (!success) return errorResponseFromStatus(429)
- 97: if (!created) return errorResponseFromStatus(500)
- 107: } catch (err) {
- 109: return errorResponseFromStatus(500)

### 設定の源の一本化（最終の決定。以下の旧節を置き換える）

- **実測**: ビルド時の `import.meta.env` と Worker の実行時の vars は、どちらも `wrangler.jsonc` の `vars` から入る。プロセスの環境変数は、どちらにも入らない。`.env` は、`wrangler.jsonc` と同じキーがあると負ける（衝突の実測）。
- **決定**: 非秘密の設定は `wrangler.jsonc` の vars に一本化し、`config/<名前>.json` から生成する。`.dev.vars` は秘密情報だけ。`.env`・`/v2/endpoints/`・`.dev.vars` への接続先の上書き・実行時の接続先の読み取り（`blueskyEnv`）は廃止した。
- **E2E**: `config/e2e.json`（偽の Bluesky の URL）で `wrangler.jsonc` を生成して `astro dev` を起動し、終了後に開発の設定から生成し直す。CI の E2E も同じ経路（`npm run test:e2e`）。
- **訂正**: 前節の「`.env` の値が優先される」は誤りだった（PLC の値を決めていたのは `wrangler.jsonc` の vars）。CI でも `render-deploy-config` が `wrangler.jsonc` を生成するため、同じ優先順位になる。
- **検証**: 最終の構成で、login（アプリパスワード・OAuth）と投稿の E2E が通った（`.env` が無い状態）。production の生成とビルドも確認した。

### 接続先の上書きの根本原因（案 1 の検証） （旧方式。上の最終の決定により廃止）

- **症状**: E2E の OAuth ログインで、PLC の解決が偽の Bluesky に届かず、`AccountUnverified` になった。
- **検証 1（起動時の環境変数）**: 起動スクリプトが `PUBLIC_PLC_DIRECTORY_BASE_URL` を開発サーバーのプロセスに渡しても、サーバーの値は `https://plc.directory` のままだった。
- **検証 2（モード別の環境ファイル）**: `astro dev --mode <名前>` で `.env.<名前>` を置いても上書きされなかった。
- **検証 3（vite.envDir）**: 別のディレクトリの `.env` を指定しても上書きされなかった（Astro は別経路で `.env` を読む）。
- **検証 4（実行時の環境）**: `.dev.vars` に値を足すと、実行時の環境（`cloudflare:workers` の env）と、サーバーのビルド時の値の両方が偽の値になった。`.dev.vars` を変えないときは、実行時の環境は `wrangler.jsonc` の vars（12 件）の値（`plc.directory`）だった。
- **検証 5（`.env` の関与）**: `.env` から `PUBLIC_PLC_DIRECTORY_BASE_URL` の行を消し、プロセスの環境変数に偽の値を渡しても、サーバーの値は `https://plc.directory` のままだった（`/v2/endpoints/` の一時的な応答で確認）。よって、この値を決めていたのは `.env` ではない。
- **訂正**: 本節の初期の結論（「`.env` の値が実行時の値より優先される」）は誤りだった。検証 1 と 5 の結果から、値を決めていたのは `wrangler.jsonc` の vars である（`.env` は関係しない）。
- **結論**: 開発の優先順位は `.dev.vars` > `wrangler.jsonc` の vars > 既定値。プロセスの環境変数と `.env` は、接続先の値には効かない。CI でも `render-deploy-config` が `wrangler.jsonc` を生成してから E2E を実行するため（`e2e.yaml`）、同じ優先順位になる。本番は `wrangler.jsonc` の vars のみ。
- **対応（案 1）**: 接続先の読み取りを実行時の環境だけに集約し、ブラウザには `GET /v2/endpoints/` で配る。E2E は `.dev.vars` の区切られた部分に上書きを書く（`scripts/e2eDevVars.mjs`）。
- **検証結果**: `.env` に本番の値を残した状態で、ログイン（アプリパスワード・OAuth）の E2E が通った。`.dev.vars` は実行後に元の内容へ戻った。本番ビルドのクライアントの chunk に、サーバー専用の読み取り（`cloudflare:workers`）が含まれないことを確認した。
- **注意として見つけた点**: `resolveEntryDeleteScope` はブラウザの部品から使われていたため、サーバー用の読み取りを使うと、ブラウザでは既定値に戻ってしまう。ブラウザ側の公開 agent に変更した。

## Risks & Mitigations

- Bluesky の偽装方式が未決定 — 利用者の判断を待つ（上記の候補）。
- route 層の計測可否が未検証 — spike の追加で確認する。
- 互換日付の差（本番との差） — 要件 11 で記録する。
- 利用者の未コミット変更（`session-start.sh`、`package.json`）と衝突する可能性 — 追加のみで変更する。

## References

- [Cloudflare Workers Vitest 統合（configuration）](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/) — cloudflareTest の設定、互換日付、カスタム環境の制約
- [Playwright: Mock APIs](https://playwright.dev/docs/mock) — `page.route` の対象はブラウザ由来の通信
- [Husky の二次情報（WebSearch）](https://github.com/ChoTotOSS/husky) — core.hooksPath の扱いと prepare の使い方
