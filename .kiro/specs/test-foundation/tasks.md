# Implementation Plan

- [x] 1. 基盤と配置

- [x] 1.1 (P) 必要な開発依存を package.json に固定する
  - `@vitest/coverage-istanbul` 4.1.11、`@stryker-mutator/core` 10.1.1、`@stryker-mutator/vitest-runner` 10.1.1 を devDependencies に追加する（PoC は `--no-save` だった）
  - 変異テストと分岐計測のパッケージが、`npm ci` の後にそのまま使える状態になる
  - 完了の確認: 一時的な clone で `npm ci` した後、`npx stryker --version` と分岐計測の実行が動く
  - _Boundary: package.json_
  - _Requirements: 4.1, 4.6_

- [x] 1.2 (P) tests/ の配置と PoC の成果物を整理する
  - `tests/unit`・`tests/component`・`tests/route`・`tests/render`・`tests/e2e/flows`・`tests/support`・`tests/fixtures` を作る
  - PoC 用の `tests/route/spike/`、`tests/unit/`、`vitest.route.config.ts` の spike 用の値を、本番用の内容に置き換える
  - 完了の確認: `tests/` 配下のすべてのテストが層のディレクトリに入り、ルート直下に spike の設定が残らない
  - _Boundary: tests layout_
  - _Requirements: 6.1, 6.2_

- [x] 1.3 (P) 固定のデータと鍵を fixtures に置く
  - テスト用の DID、ハンドル、32 バイトの鍵を `tests/fixtures/` に置く。本番の鍵や実アカウントの識別子は含めない
  - 完了の確認: fixtures の全ファイルを検索し、実在の DID・ハンドル・Base64 の鍵が含まれない
  - _Boundary: fixtures_
  - _Requirements: 5.3, 6.3_

- [x] 2. 検証層の設定

- [x] 2.1 unit 層の設定を作る
  - `vitest.unit.config.ts` を作り、`tests/unit` を対象に Node で動かす。`@` の alias を `src` に向ける
  - 既存の `vitest.config.ts` を置き換え、`scripts/`・`_legacy/`・外部を include に含めない
  - 完了の確認: 設定が読み込まれ、`tests/unit` にテストがあれば実行される。テストが 0 件のときは非ゼロで終わる（何も実行されないまま成功する事故を防ぐため。タスク実装中に修正）
  - _Requirements: 1.1, 1.2, 1.7, 2.4_

- [x] 2.2 (P) component 層の設定を作る
  - `vitest.component.config.ts` を作り、`tests/component` を Node で動かす。DOM の環境は各ファイルの `// @vitest-environment happy-dom` で指定する
  - `@testing-library/react` の自動クリーンアップを有効にする
  - 完了の確認: happy-dom を指定したテストファイルが DOM を使え、指定のないファイルは Node で動く
  - _Boundary: component config_
  - _Requirements: 1.4, 1.7, 5.5_

- [x] 2.3 (P) render 層の設定を既存の設定から移す
  - `vitest.astro.config.ts` の対象を `tests/render` に変え、`test:astro` を `test:render` に改名する
  - 完了の確認: `tests/render` の描画テストが `getViteConfig` の設定で動く
  - _Boundary: render config_
  - _Requirements: 1.5_

- [x] 2.4 route 層の設定を本番用に整える
  - `vitest.route.config.ts` の対象を `tests/route` に限り、`tests/route/wrangler.jsonc` に D1（`DB`）と R2（`SCHEDULE_IMAGES`）の binding を置く
  - `readD1Migrations("migrations")` を `TEST_MIGRATIONS` として渡し、各テストファイルの前に `applyD1Migrations` を適用する
  - 完了の確認: 2 つのテストファイルが、互いのレコードを見ずに、空の D1 から始まる
  - _Depends: 1.2_
  - _Requirements: 1.3, 1.7, 5.4, 5.5, 11.1_

- [x] 2.5 route 層の互換日付の差を報告する
  - route 層の互換日付は、同梱の workerd が対応する最新の日付にする（現在は 2026-08-22）
  - 本番の `wrangler.template.jsonc`（2026-10-08）との差を、設定の読み込み時に警告として出す
  - 完了の確認: 設定を読み込むと、差の警告が標準の出力に出る
  - _Depends: 2.4_
  - _Requirements: 11.1, 11.3_

- [x] 2.6 (P) 時刻と乱数をテストから注入する
  - 製品の関数が時刻と乱数を引数で受けられるかを確認し、受けられない箇所はテストから差し替えられる形にする（既存の挙動は変えない）
  - 完了の確認: 時刻と乱数に依存するテストが、実行時刻に関係なく同じ結果になる
  - _Boundary: product time and random inputs_
  - _Requirements: 5.2_

- [x] 3. Bluesky の接続先の解決（製品の変更）

- [x] 3.1 接続先を解決する純粋な関数を作る
  - `src/lib/platform/blueskyEndpoints.ts` に `resolveBlueskyEndpoints` を作る。入力は環境変数の値だけとする
  - 既定値は本番と同じ（認可サーバー `https://bsky.social`、PLC `https://plc.directory`、AppView `https://api.bsky.app`、PDS は未設定）
  - 空文字の環境変数は未指定と同じに扱う
  - 完了の確認: `tests/unit/lib/platform/blueskyEndpoints.test.ts` が、既定値と上書きの組み合わせを検査して通る
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 3.2 直書きの接続先を解決結果に置き換える
  - `src/lib/atproto/agentFactory.ts`、`src/lib/oauth/client.ts`、`src/lib/oauth/discovery.ts`、`src/lib/atproto/did.ts`、`src/lib/atproto/videoAuth.ts`、`src/env.ts` の直書きを置き換える
  - OAuth の検証規則（発行元の一致、PDS の認可サーバーの一致）は変えない
  - 完了の確認: 既定値のとき、置き換え前と同じ URL になる。対象ファイルに `bsky.social` の直書きが残らない
  - _Depends: 3.1_
  - _Requirements: 12.1, 12.2, 12.4, 10.5_

- [x] 3.3 本番と dev サーバーで環境変数を読む経路を確認する
  - 本番の Worker（`cloudflare:workers` の `env`）と dev サーバー（`process.env`）が、同じ解決関数に値を渡すことを確認する
  - 未設定のとき、本番の挙動が変わらないことを確認する
  - 完了の確認: 両経路で同じ入力から同じ解決結果になる。未設定の本番で既定値が使われる
  - _Depends: 3.2_
  - _Requirements: 12.3, 12.4_

- [x] 4. 偽の Bluesky と route の外部通信

- [x] 4.1 偽の Bluesky サーバーを作る
  - `tests/support/fakeBluesky/` に、認可サーバー、PDS、AppView、PLC の固定応答を作る。対象は六つの流れが呼ぶ endpoint に限る
  - 定義されていない経路は 404 を返し、実サービスへ転送しない。呼ばれた経路を `requests` に記録する
  - 完了の確認: 単体のテストで、定義済みの経路が応答し、未定義の経路が 404 を返す
  - _Requirements: 5.1, 10.3, 10.4, 10.5_

- [x] 4.2 route 層の外部通信を偽のサービスへ向ける
  - miniflare の `outboundService` を試し、route 層の `fetch` が偽の Bluesky の応答を受けることを確認する
  - 動かない場合は、接続先の環境変数をテスト用の origin に置き換える方式に切り替え、その理由を research.md に記録する
  - 完了の確認: route のテストが、実 Bluesky へ接続せずに外部通信の応答を得る
  - _Depends: 4.1_
  - _Requirements: 5.1, 10.5_

- [x] 5. 実行の入口とゲート

- [x] 5.1 層ごとと全体の npm スクリプトを作る
  - `test:unit`・`test:component`・`test:route`・`test:render`・`test:e2e` を作る
  - `test:all` は、`test:type`、`test:lexicon`、各層を直列に実行し、いずれかが失敗すれば全体を失敗にする
  - 既存の `test` は `test:all` と同じ内容にする
  - 完了の確認: 一つの層を失敗させると、`test:all` が非ゼロで終わる
  - _Depends: 2.1, 2.2, 2.3, 2.4_
  - _Requirements: 7.1, 7.2_

- [x] 5.2 開発サーバーを起動して E2E を実行する入口を作る
  - `scripts/run-e2e.mjs` が、偽の Bluesky の起動と接続先の環境変数の設定を行い、dev サーバーを起動する
  - 既存の dev サーバーの後始末（シグナルの扱い）は維持する
  - 完了の確認: 開発者が dev サーバーを手で起動せず、`test:e2e` が実行できる
  - _Depends: 3.3, 4.1, 5.1_
  - _Requirements: 7.3, 12.5_

- [x] 5.3 (P) git の hooks パスを設定する
  - `scripts/setup-git-hooks.mjs` を作る。git の作業ツリーでなければ何もせず終わる。作業ツリーなら `core.hooksPath` を `.githooks` に設定する（冪等）
  - `package.json` の `prepare` で実行する（`npm install` と `npm ci` の両方）
  - 完了の確認: 一時的な clone で `npm install` 後に `git config core.hooksPath` が `.githooks` になる
  - _Boundary: git hooks_
  - _Requirements: 8.1_

- [x] 5.4 エージェントのセッション開始で hooks パスを設定する
  - `.claude/hooks/session-start.sh` の `CLAUDE_CODE_REMOTE` のガードより前に、`node scripts/setup-git-hooks.mjs` の行を追加する。既存の行は変えない
  - 利用者の未コミットの変更と衝突しないよう、追加のみにする
  - 完了の確認: ガードの前の行で hooks パスが設定される
  - _Depends: 5.3_
  - _Requirements: 8.2_

- [x] 5.5 push の前に全層を実行する
  - `.githooks/pre-push` を作り、`npm run test:all` を実行する。非ゼロの終了コードで push を止める
  - 人間とエージェントは同じ hooks パスと同じスクリプトを使う
  - 完了の確認: 失敗するテストを入れた状態で push の hook が止まる
  - _Depends: 5.1, 5.3_
  - _Requirements: 8.3, 8.4, 8.5_

- [x] 5.6 (P) PR の必須ゲートを E2E に限定する
  - `.github/workflows/e2e.yaml` に `pull_request` のトリガーを追加する
  - unit・astro の段と live の項目を削除する。`deploy.yaml` からの `workflow_call` は維持する
  - 完了の確認: PR で E2E だけが実行され、live の項目が含まれない
  - _Boundary: CI workflow_
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 6. カバレッジと変異テストの基準

- [x] 6.1 P0 の 23 ファイルに分岐 80% の閾値を置く
  - unit の設定に 11 ファイル、route の設定に 12 ファイルの閾値（ファイルパス単位、80%）を置く。istanbul を使う
  - `src/` 全体の閾値と、P1・P2 の閾値は置かない
  - 完了の確認: 一覧のファイルが 80% を下回ると、その層の実行が非ゼロで終わる
  - _Depends: 1.1, 2.1, 2.4_
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 6.2 P0 の unit 層モジュールに変異テストの報告を作る
  - Stryker の設定を作り、unit 層の P0 の 11 ファイルを対象にする。`ignorePatterns` で `.agents`・`.claude`・`.kiro`・`.git` などを除外する
  - 生き残った変異体の一覧を報告する。数値の下限は置かず、ゲートにしない
  - 完了の確認: 実行すると、生き残りの一覧が出力され、終了コードが 0 になる
  - _Depends: 1.1, 2.1_
  - _Requirements: 4.6_

- [x] 6.3 P0 の発生点の一覧を記録する
  - 23 ファイルそれぞれについて、失敗の発生点（`throw`、`return null`、判別共用体の失敗値、HTTP のエラー応答）を列挙し、research.md に記録する
  - 記録は、担当する機能の spec が作られるまで本 spec の research.md に置く
  - 完了の確認: 23 ファイルすべてに発生点の一覧があり、件数の目安が research.md の数値と食い違わない
  - _Requirements: 4.5_

- [x] 7. P0 の unit 層のテスト（P）

- [x] 7.1 (P) セッションの Cookie の規則を検査する
  - `src/lib/session/cookies.ts` の受け付けと拒否を検査する。不正な Cookie の値は固定の失敗として扱われる
  - 完了の確認: 正常系と、各失敗の発生点に失敗の種類を検査するテストがある
  - _Boundary: cookies_
  - _Requirements: 2.1, 3.1, 4.4_

- [x] 7.2 (P) 予約の認証情報の暗号化を検査する
  - `src/lib/schedule/credentialCrypto.ts` の往復、別の鍵での失敗、別の DID（AAD）での失敗、鍵の長さ不正と Base64 不正の失敗を検査する
  - 完了の確認: 失敗の発生点（鍵の長さ、Base64、AAD、改ざん）のそれぞれに、失敗の種類を検査するテストがある
  - _Boundary: credentialCrypto_
  - _Requirements: 2.1, 3.1, 4.4_

- [x] 7.3 (P) アンケートの鍵付きハッシュを検査する
  - `src/lib/survey/respondentHash.ts` の既知の値、アンケートごとに異なる値、不正な Base64 と鍵の長さ不正の失敗を検査する（PoC のテストを本番用に整える）
  - 完了の確認: 失敗の発生点 2 件のそれぞれに、固定メッセージを検査するテストがある
  - _Boundary: respondentHash_
  - _Requirements: 2.1, 3.1, 4.4_

- [x] 7.4 (P) 表示言語の判定を検査する
  - `src/lib/i18n/locale.ts` の判定の規則を、対応する言語と未対応の言語の両方で検査する
  - 完了の確認: 未対応の言語の失敗の発生点に、失敗の種類を検査するテストがある
  - _Boundary: locale_
  - _Requirements: 2.1, 3.1, 4.4_

- [x] 7.5 (P) 共有の文字数と URL の規則を検査する
  - `src/lib/share/shareBody.ts` と `src/lib/share/counterReserve.ts` の文字数の上限、URL の補正、リンクカードの URL の選び方を検査する
  - 完了の確認: 上限ちょうど、上限超え、URL を含む場合のテストがある
  - _Boundary: shareBody, counterReserve_
  - _Requirements: 2.1, 3.1, 4.4_

- [x] 7.6 (P) フィードバックの本文の無害化と送信の失敗を検査する
  - `src/lib/feedback/issueContent.ts` で、本文が Issue の構造を壊さないこと（囲みと改行の扱い）を検査する
  - `src/lib/feedback/githubIssue.ts` で、201 以外の応答が失敗（`null`）になることを検査する。fetch は注入する
  - 完了の確認: 無害化の発生点と、githubIssue の失敗の発生点（応答の種類）のそれぞれに、失敗の種類を検査するテストがある
  - _Boundary: issueContent, githubIssue_
  - _Requirements: 2.1, 3.1, 4.4_

- [x] 7.7 (P) 投稿の原子的な作成を検査する
  - `src/lib/entry/createBskyThread.ts` の全件成功と全件失敗、件数の上限を、偽の agent で検査する
  - 完了の確認: 途中の一件が失敗したとき、一件も作られないことを検査するテストがある
  - _Boundary: createBskyThread_
  - _Requirements: 2.1, 3.1, 4.4_

- [x] 7.8 (P) Entry の削除の範囲を検査する
  - `src/lib/entry/resolveEntryDeleteScope.ts` と `src/lib/entry/resolveDeleteTargets.ts` で、関係のない投稿が含まれないこと、判別できないときは `unknown` になることを検査する
  - 完了の確認: `unknown`・`legacy`・`deletable` のそれぞれに、対象の範囲を検査するテストがある
  - _Boundary: resolveEntryDeleteScope, resolveDeleteTargets_
  - _Requirements: 2.1, 3.1, 4.4_

- [x] 8. P0 の route 層のテスト（P）

- [x] 8.1 (P) セッションの更新と書き戻しを検査する
  - `src/lib/session/oauthSession.ts`、`bskySessionRefresh.ts`、`oauthLogin.ts` の Cookie、トークンの更新、書き戻しを、D1 と偽の Bluesky で検査する
  - 完了の確認: 並行したリクエストでセッションが失効しないことと、各失敗の発生点に失敗の種類を検査するテストがある
  - _Boundary: oauthSession, bskySessionRefresh, oauthLogin_
  - _Requirements: 2.1, 3.1, 4.4_

- [x] 8.2 (P) 予約の実行の冪等性と失敗の分類を検査する
  - `src/lib/schedule/executor.ts`、`runner.ts`、`stageSchedule.ts` を、D1 の状態で検査する。二重の実行にならないこと、失敗が分類されることを確認する
  - 完了の確認: 同じ予約を二度実行しても投稿が一度だけになり、失敗の分類ごとにテストがある
  - _Boundary: executor, runner, stageSchedule_
  - _Requirements: 2.1, 3.1, 4.4, 5.4_

- [x] 8.3 (P) 予約の画像の後片付けを検査する
  - `src/lib/schedule/imageStaging.ts` の R2 への保管と削除を検査する。完了後と失敗後の両方で後片付けされることを確認する
  - 完了の確認: 失敗の発生点（削除の失敗を含む）のそれぞれに、後片付けを検査するテストがある
  - _Boundary: imageStaging_
  - _Requirements: 2.1, 3.1, 4.4, 5.4_

- [x] 8.4 (P) アンケートの匿名性と保持期限を検査する
  - `src/lib/survey/store.ts`、`retention.ts`、`request.ts` を D1 の状態で検査する。回答者を特定できる値が保存されないこと、保持期限を過ぎたデータが削除されることを確認する
  - 完了の確認: 匿名の 2 表の分離と、保持期限の境界の前後のテストがある
  - _Boundary: survey store, retention, request_
  - _Requirements: 2.1, 3.1, 4.4, 5.4_

- [x] 8.5 (P) 旧投稿の削除の OAuth 拒否を検査する
  - `src/pages/v1/page.ts` で、OAuth のセッションによる旧投稿の削除が拒否されることを、拒否の種類ごとに検査する
  - 完了の確認: 旧バックエンドで使えないトークンの削除要求が、各失敗の発生点（約 10）で固定の応答を返すことを検査するテストがある
  - _Boundary: v1 page_
  - _Requirements: 2.1, 3.1, 4.4_

- [x] 8.6 (P) フィードバックの送信の間隔制限を検査する
  - `src/pages/v2/feedback.ts` で、間隔制限の超過が 429 を返すこと、不正な入力が 400 を返すことを検査する。レート制限は偽の値で置き換える
  - 完了の確認: 失敗の発生点（制限超過、入力の不正、Issue の作成の失敗）のそれぞれに、応答の種類を検査するテストがある
  - _Boundary: v2 feedback route_
  - _Requirements: 2.1, 3.1, 4.4_

- [x] 9. 基盤の確認と E2E の流れ

- [x] 9.1 (P) component 層の基盤を確認する
  - 対話する部品を一つ選び（候補: `src/components/common/CountedTextInput`）、キー操作と表示の状態を検査する
  - 完了の確認: `tests/component` のテストが happy-dom で通り、テスト間で DOM が残らない
  - _Boundary: component harness_
  - _Requirements: 1.4, 1.6_

- [x] 9.2 (P) render 層の基盤を確認する
  - `tests/render` に、一つの `.astro` ページのサーバー描画の属性を検査するテストを置く
  - 完了の確認: `npm run test:render` が通る
  - _Boundary: render harness_
  - _Requirements: 1.5_

- [x] 9.3 E2E の偽の Bluesky と接続先の設定を結ぶ
  - `playwright.config.ts` の `testDir` を `tests/e2e/flows` にし、live の project を削除する
  - 偽の Bluesky は起動スクリプト（`scripts/run-e2e.mjs`）が立て、接続先は実行時の環境（`.dev.vars` の区切られた部分）に書く。`globalSetup` は使わない（dev サーバーは Playwright より前に起動するため。根本原因の検証は research.md）
  - 完了の確認: E2E の起動で偽の Bluesky が立ち、実 Bluesky へ接続せずに dev サーバーが起動する
  - _Depends: 4.1, 5.2_
  - _Requirements: 1.6, 10.3, 10.4, 12.5_

- [x] 9.4 ログインと投稿の流れを検査する
  - `tests/e2e/flows/login.spec.ts` と `thread-posting.spec.ts` で、ログインと、スレッドの投稿を検査する。実アカウントは使わない
  - 完了の確認: 両方の流れで、偽の Bluesky の経路（`requests`）が呼ばれたことを確認する
  - _Depends: 9.3_
  - _Requirements: 10.1, 10.3, 10.4_

- [x] 9.5 Entry と予約の流れを検査する
  - `tests/e2e/flows/entry.spec.ts` で Entry の作成と閲覧を、`schedule.spec.ts` で予約の作成と一覧を検査する。予約の実行は検査しない
  - 完了の確認: 予約の一覧に作成した予約が表示され、実行の経路は呼ばれない
  - _Depends: 9.4_
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 9.6 アンケートとフィードバックの流れを検査する
  - `tests/e2e/flows/survey.spec.ts` で回答を、`feedback.spec.ts` で送信を検査する
  - 完了の確認: 回答が保存され（API が保存を返し、再読み込み後は入口が出ない）、フィードバックは送信の API（`/v2/feedback/`）まで届き、画面が API の応答（E2E では GitHub の認証情報が無いため受け付けの停止）を示す。GitHub の Issue の作成は検査しない（実際の Issue を作らないため）
  - _Depends: 9.5_
  - _Requirements: 10.1, 10.3_

- [x] 10. 文書と最終確認

- [x] 10.1 steering の testing.md を本 spec の決定に合わせる
  - `.kiro/steering/testing.md` に、P0 の 23 ファイル、P1・P2、未分類の扱い、変異テストの位置づけ、route 層の互換日付の差を記録する
  - 完了の確認: steering の内容と design の一覧が一致する
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.2, 3.3, 3.4, 11.2_

- [x] 10.2 全体の実行と要件の対応を確認する
  - `npm run test:all` を実行し、すべての層が通ることを確認する。要件 1.1〜12.5 のそれぞれが、このタスク表の少なくとも一つに対応することを確認する
  - 完了の確認: `test:all` が通り、要件の対応に漏れがない
  - _Depends: 5.5, 6.1, 6.2, 9.6, 10.1_
  - _Requirements: 7.2, 4.6_
