# Roadmap

## Overview

Skyshare の現行実装（`src/`・設定ファイル・D1 のマイグレーション）を根拠に、利用者に見える振る舞いと共有基盤を 18 件の spec に分ける（フェーズ 1）。各 spec は**現行の振る舞いを記録する**。新機能や改善案は含めない。docs・既存 specs・既存テストは根拠にしない。

現在の状態（2026-11-08）: 残りは、フェーズ 1 の 18 spec の要件作成（brief のみ）、フェーズ 6 の接頭辞の改名（`naming-*`）、および cc-sdd の検証（`/kiro-validate-impl`）が未実施の完了済み作業（下の「確認済み・phase 未更新」）。

現在の状態（2026-11-10 追補）: Phase 8 の `ops-agent-setup`（Codex 側の導入の取り消し）と `codex-mcp-subagent` は、`spec.json` の phase が `implementation-complete` になった。`docs/DEVELOP.md` も改訂後の導入に合わせてある。Phase 7 は 6 件とも実装が未完了（phase は `tasks-generated`）。ただし基準の文書（`comments.md`）と検査（`scripts/architecture/commentRules.ts`）は既にある。

現在の状態（2026-11-10 追補 2）: 「確認済み・phase 未更新」だった 16 件は、feature 検証を終えて `implementation-complete` になった（下の「検証（kiro-validate-impl, 2026-11-10 追補）」）。残りは、フェーズ 1 の 18 spec、Phase 7（コメントの整理）、フェーズ 6 の `naming-*`。

現在の状態（2026-11-10 追補 3）: Phase 7 の `comment-policy` は feature 検証の判定が `GO` で、`implementation-complete` になった（根拠は同 spec の tasks.md の Implementation Notes）。Phase 7 の残りは `comments-*` の 5 件。

現在の状態（2026-11-11 追補）: Phase 7 の `comments-lib` は feature 検証の判定が `GO` で、`implementation-complete` になった（`src/lib` の 222 ファイルのコメントを基準に合わせ、許容リストの `comments-lib` の項目 167 件を 0 件にした。根拠は同 spec の tasks.md の Implementation Notes）。Phase 7 の `comments-components-pages` も `implementation-complete` になった（`src/components`・`src/pages`・`src/` 直下・`types`・`util`・`styles` のコメントを基準に合わせ、許容リストの項目 203 件を 0 件にした）。Phase 7 の `comments-tests` も `implementation-complete` になった（`tests`・`config/test` のコメントを基準に合わせ、日本語を含む題名 439 件を英語にし、許容リストの項目 197 件を 0 件にした）。Phase 7 の `comments-scripts-config` も `implementation-complete` になった（許容リストの項目 42 件のうち 41 件を消し、`kiro-gate.mjs` の 1 件を許容する例外として理由付きで残した）。Phase 7 の `comments-api-schema` も `implementation-complete` になった（説明文を 1 行にし、数値の上限の文章を取り除き、再生成の比較で API の形が変わらないことを確かめた。e2e は全 comments-* の完了後に一度だけ実行し、通過した）。Phase 7 は全 6 spec が完了した。許容リストの項目は 1 件（`kiro-gate.mjs` の許容する例外）だけが残る。

## Completion の定義

- `[x]` は、`spec.json` の phase が `implementation-complete` のものに限る（cc-sdd の検証を通過した状態）。
- `[ ]` でも、本セッション（2026-11-08）で実装とテストを確認した項目は「確認済み・phase 未更新」に記す。この場合の完了は、`/kiro-validate-impl` で spec.json を進めて確定する。

## Approach Decision

- **Chosen**: 実装の import 関係（`lib`・`components`・`pages`・API の結合）を実測し、結合の強い塊ごとに spec を置く。共有の塊は基盤 spec として独立させる。画面（`pages`）の単位では分けない。
- **Why**: 実測の結合は、機能ごとの塊と共有の塊をはっきり示す。`lib/` が `components/` を import しないため、依存を一方向にできる。
- **Rejected alternatives**:
  - 画面単位（`pages/` ごと）の分割: `components/post/` が投稿・タイムライン・共有・予約の部品を同じフォルダに持つため、画面単位では境界が合わない。
  - 全機能を 1 spec: 20 タスクを大きく超え、設計の境界が崩れる。
  - 旧方式（機能別の `test-*` spec）: テストの方針が決まっていないまま、機能契約と検証を二重に管理することになる。
  - テストの方針を spec として決める: テストの方針は全 spec に効く**プロジェクト横断の規則**なので、spec ではなく steering（`testing.md`）に置く。

## Scope

- **In**:
  - 利用者に見える画面: `/login`・`/accounts`・`/`・`/post`・`/entries`・`/entries/{slug}`・`/settings`・`/feedback`・`/help`・`/privacy`・`/posts/*`・`/jump`
  - 利用者向け API: `src/pages/v2/**`・`/oauth/*`・`/v1/page`
  - Cron による予約投稿の実行と、1 日 1 回の後片付け（`src/worker.ts` の `scheduled`）
  - 共有基盤: 表示言語、UI 部品、API 契約、OAuth クライアント、Bluesky レコードの組み立て、Worker とビルドの設定
- **Out**:
  - 運用・開発ツール: `scripts/`（アンケート設定の CLI、デプロイ設定の同期、OAuth 鍵の生成、ローカル中継）、デプロイと CI、`docs/DEVELOP.md`
  - 生成物と旧資産: `dist/`・`.astro/`・`.wrangler/`・`src/client/openapi/`（生成物）・`_legacy/`
  - 外部サービスの内部: legacy backend、OGP 抽出サービス、Bluesky の PDS・AppView・認可サーバー。呼び出しの契約だけを扱う
  - 確認用のページ: `src/pages/entries/sample.astro`（v2 リリース後に削除する予定）
  - 文書: 各 `README.md`

## Constraints

- 言語は日本語。
- **根拠は実装だけ**（`src/`・`package.json`・`astro.config.mjs`・`wrangler.template.jsonc`・`migrations/`）。docs・既存 specs・旧テストは根拠にしない。
- `src/` のコメントに含まれる旧 spec 参照（`specs/...`）は根拠にしない。コメントは補助として読むが、動作は必ずコードで確かめる。
- テストの方針の正本は `.kiro/steering/testing.md`（承認済み）。spec の design はその方針を参照する。
- 実装→spec の網羅は強制しない（`src/` の全ファイルが spec に属する必要はない）。
- 既存の不一致は、spec に現行の振る舞いとして書かず、brief の Constraints に「既知の不一致」として記録する。

## Boundary Strategy

- **Why this split**: 結合の強い塊ごとに変更と検証が閉じる。共有の塊（i18n・API 契約・UI 部品・Bluesky レコード・OAuth・基盤）は、利用側の spec が再定義しない。
- **Shared seams to watch**（所有者は 1 つ）:
  1. **セッションと Cookie**（`session-accounts`）。API と画面は `locals.session` を読むだけ。
  2. **OAuth クライアント**（`oauth-client`）。ログイン（`session-accounts`）と予約の認可（`scheduled-posting`）が使う。
  3. **Bluesky レコードの組み立て**（`atproto-records`）。投稿・threadgate・postgate・下書き・Entry のレコードの形を決める。
  4. **投稿の書き込み**（`post-composition`）と **Entry の書き込み**（`entry-sharing`）。`createBskyThread` は両方を 1 回の原子的な書き込みにまとめるため、所有は `post-composition` とし、Entry のレコード形は `entry-sharing` から得る。
  5. **投稿カード `PostCard`**: 表示は `timeline-browsing`、Entry 操作は `entry-sharing`、共有は `external-sharing`。
  6. **予約の UI**: 部品とロジックは `scheduled-posting`。投稿フォームの状態は `post-composition`。
  7. **Cron の入口**（`src/worker.ts`）: 入口は `platform-runtime`。予約の実行は `scheduled-posting`、アンケートの削除は `surveys`。
  8. **配置（ホスト）は依存に含めない**: 画面が他 spec の部品を置く関係は依存にしない。依存は部品と契約の所有者だけ。

## Specs (dependency order)

フェーズ 1 の 18 spec（brief のみ。要件の作成は `/kiro-spec-batch` で行う）と、フェーズ 6 の改名（brief あり、未実装）。

- [ ] i18n -- 表示言語の判定と保存、辞書（ja・en）、表示への適用。Dependencies: none
- [ ] api-contract -- API の入出力スキーマ、標準エラー応答、OpenAPI 生成とクライアント、外部サービスへの転送規則。Dependencies: none
- [ ] ui-primitives -- 共通 UI 部品（ダイアログ・入力・リスト・トグル・ローディング等）、スタイルトークン、リストボックスの操作。Dependencies: i18n
- [ ] platform-runtime -- Worker の入口（fetch と scheduled）、ミドルウェアの合成、ビルド時のサイト設定、Cloudflare の型と環境変数の読み取り、ゲストモード。Dependencies: i18n, api-contract
- [ ] oauth-client -- Bluesky OAuth クライアントの識別子・メタデータ・JWKS、PAR・トークン・DPoP、開発用のループバッククライアント。Dependencies: platform-runtime
- [ ] atproto-records -- Bluesky レコード（投稿・threadgate・postgate・embed・facet・下書き）の組み立てと読み取り、公開 AppView の候補取得、スレッドの直線的な抽出規則。Dependencies: api-contract
- [ ] help-privacy -- ヘルプの FAQ、プライバシーポリシーの組み立てと表示。Dependencies: i18n, ui-primitives, platform-runtime
- [ ] session-accounts -- Bluesky ログイン（OAuth・アプリパスワード）、複数アカウントの切り替えとログアウト、セッションの再開と更新、Cookie の配置。Dependencies: oauth-client, api-contract, atproto-records, platform-runtime, i18n, ui-primitives
- [ ] settings -- 設定ページと、表示・投稿の既定値（テーマ・タイムライン表示・返信/引用・候補・ハッシュタグ履歴・共有先）の保存と表示。Dependencies: session-accounts, i18n, ui-primitives, platform-runtime
- [ ] feedback -- 不具合の報告と機能の提案のフォーム、GitHub Issue への登録、送信の間隔制限。Dependencies: session-accounts, api-contract, i18n, ui-primitives, platform-runtime
- [ ] surveys -- ログイン時アンケートの判定・提示・回答・辞退、匿名の保存、保持期限を過ぎたデータの削除。Dependencies: session-accounts, api-contract, i18n, ui-primitives, platform-runtime
- [ ] legacy-posts -- 旧 pageDB 投稿の表示ページと、旧投稿の削除（v1 プロキシ経由）。Dependencies: session-accounts, api-contract, i18n, ui-primitives
- [ ] media-attachments -- 画像・動画の選択と加工、枚数と容量の制限、代替テキスト、動画の Bluesky へのアップロード、画像・動画の配信。Dependencies: session-accounts, api-contract, atproto-records, i18n, ui-primitives
- [ ] entry-sharing -- Skyshare Entry の作成（投稿から）・更新・削除、一覧、詳細ページ、Entry の画像。Dependencies: media-attachments, atproto-records, session-accounts, api-contract, i18n, ui-primitives
- [ ] external-sharing -- 他 SNS への共有（intent・ポップアップ・WebShare）、共有文と文字数、投稿後の共有の分岐、`/jump`。Dependencies: entry-sharing, settings, i18n, ui-primitives, platform-runtime
- [ ] post-composition -- 投稿フォーム（スレッド・本文の検証・文字数・下書き・返信/引用の制限・候補）、投稿の原子的な書き込み、リンクカードの取得。Dependencies: entry-sharing, external-sharing, media-attachments, atproto-records, settings, session-accounts, api-contract, i18n, ui-primitives, platform-runtime
- [ ] timeline-browsing -- 自分の投稿のタイムライン（スレッド化・無限スクロール・ゲスト表示）、投稿カードの表示。Dependencies: entry-sharing, external-sharing, media-attachments, atproto-records, settings, session-accounts, api-contract, i18n, ui-primitives, platform-runtime
- [ ] scheduled-posting -- 予約投稿（日時指定・編集・取消・認可・Cron による実行・失敗と復帰・後片付け）。Dependencies: post-composition, entry-sharing, media-attachments, atproto-records, oauth-client, session-accounts, api-contract, platform-runtime, i18n, ui-primitives
- [ ] naming-rule -- 接頭辞の規則（`build`・`resolve`・`create`・`load`）を steering の命名の節に書き、規則に合わない既存の名前の一覧を作る。名前は変えない。Dependencies: none
- [ ] naming-atproto -- `lib/atproto` の接頭辞（14 件）を規則に合わせて改名する。Dependencies: naming-rule
- [ ] naming-timeline-entry -- `lib/timeline`（10 件）と `lib/entry`（7 件）を改名する。Dependencies: naming-atproto
- [ ] naming-share-image -- `lib/share`（9 件）と `lib/image`（5 件）を改名する。Dependencies: naming-timeline-entry
- [ ] naming-oauth-site-survey -- `lib/oauth`（4 件）・`lib/site`（4 件）・`lib/survey`（4 件）を改名する。Dependencies: naming-share-image
- [ ] naming-settings-misc -- `lib/settings`（3 件）・`lib/feedback`・`lib/i18n`・`lib/schedule`（各 2 件）と、`api`・`platform`・`session`・`video`（各 1 件）を改名する。Dependencies: naming-oauth-site-survey

## Existing Spec Updates

- [x] ops-agent-setup（2026-11-10 追補: Phase 8 の改訂を含めて `implementation-complete`。以下は当時の記述で、現在は当てはまらない: 「Codex と Claude の導入は確認済み。Claude の実機確認は未了。Phase 8 で Codex 側の導入を取り消す改訂が必要」。Claude の実機確認と Codex 側の取り消しは、Phase 8 の改訂の実装と検証で済んでいる） -- BRW の導入を `npm run setup:brw` の 1 つの入口にし、Claude と Codex を同じ clone の同じ commit から導入する。Dependencies: none

## 検証（kiro-validate-impl, 2026-11-10 追補）: 16 件を `implementation-complete` にした

下の「2026-11-08」の節は当時の記録で、現在は次のとおり。

- 対象の 16 spec（components-small-areas・develop-docs・layout-home・lib-large-files・lib-layers・live-tests・ops-config-secrets・ops-tooling-layout・src-component-nesting・src-composer-layout・src-duplicates・src-folder-layout・src-import-style・structure-checks・test-foundation・util-placement）は、feature 検証の判定が `GO` で、`spec.json` の phase を `implementation-complete` にした。判定の根拠は各 spec の tasks.md の「feature 検証（kiro-validate-impl, 2026-11-10）」にある。
- 全試験（`npm run test:all`）は終了コード 0（unit 700 件通過・2 件スキップ、component 13、route 212、render 2、e2e 10）。
- 受入基準の未参照: 2026-11-08 の「113 件」は、その後のタスクの改訂で減っており、2026-11-10 の突き合わせでは 4 件（structure-checks の 1.1〜1.3、util-placement の 7.4）だった。いずれも他のタスクが実体を持つため、参照を加えて 0 件にした。
- `ops-agent-setup` の「Claude の実機確認が未了」は、Phase 8 の改訂と検証で解消済み（phase は `implementation-complete`）。
- 要件と現状の食い違い（layout-home 2.1、develop-docs 1.1・2.1・3.3・4.2、ops-config-secrets 3.5、ops-tooling-layout 1.1）は、利用者の決定（2026-11-10: 要件を現状に合わせる）に従い、各 requirements.md に追補を書いた。実装は変えていない。
- 設計の File Structure Plan と実装の不一致は、利用者の決定（現状に合わせて直す）に従い、各 design.md に「現況との対応（2026-11-10 追補）」を加えた。
- `scripts/` のファイル名を kebab-case にそろえた（`agent/brw-source.mjs`、`architecture/{comment-rules,import-graph,lib-layers,types-only,util-sharing}.ts`、`lib/live-config.mjs`）。この文書の古い記述にある `commentRules.ts` などは、改名前の名前である。
- GitHub の main のルールセットに、必須の検査 `e2e` を加えた（test-foundation の要件 9.1。利用者の承認を得て実施）。develop のルールセットは変えていない。
- 実アカウントのテスト（`npm run test:live`）は、利用者の承認を得て実行し、3 件が通過した（live-tests の要件 4.1〜4.3）。
- 手元の未取り込みのブランチ（cc-sdd の運用が安定する前の残骸）は、利用者の指示で削除した: `dev/cc-sdd-coexist-trial`・`dev/cc-sdd-trial`・`dev/creatormode`・`dev/spec-template-linter`・`dev/structure-docs-cleanup`。リモートのブランチは削除していない。
- 整形の時機を変えた（利用者の決定 2026-11-10）: `build:prepare` から `format`（`prettier --write .`）を外し、`.githooks/pre-commit` がコミットの前にリポジトリ全体を整形する。`npm run dev`・`npm run build`・`npm run test:e2e` は作業ツリーを整形しなくなった。comments-* の spec にある「e2e は `prettier --write` を含む」という前提は、これで当てはまらなくなる。
- 残る作業: フェーズ 1 の 18 spec（brief のみ）、Phase 7（コメントの整理）、フェーズ 6 の `naming-*`。いずれも未着手（利用者の指示で、まだ着手しない）。

## 検証（kiro-validate-impl, 2026-11-08）: 当時の記録

全テスト（`npm run test:all`）は終了コード 0 で通過した（unit 494・component 13・route 212・render 2・e2e 10）。TODO と秘密情報の検出は、識別子（`MASTODON` の一部）とテストの fixture だけで、実際のものは無い。

要件の受入基準（404 件）のうち、タスクの `_Requirements` で参照されていないものが 113 件ある。このため、下の spec は phase を進められない。spec.json は変更していない。

- MANUAL_VERIFY_REQUIRED（実機・認証情報が必要）:
  - ops-agent-setup: Claude の実機確認が未了。未参照 8 件。
  - live-tests: live の実行に実アカウントの認証情報が要る。未参照 5 件。
- NO-GO（受入基準にタスクの参照が無い）:
  - components-small-areas 5 件、develop-docs 6 件、layout-home 4 件、lib-large-files 3 件、lib-layers 5 件、ops-config-secrets 9 件、ops-tooling-layout 8 件、src-component-nesting 12 件、src-composer-layout 4 件、src-duplicates 1 件、src-folder-layout 7 件、src-import-style 4 件、structure-checks 11 件、test-foundation 16 件、util-placement 5 件。
- 設計の File Structure Plan と実装の不一致: ops-tooling-layout（設計は移動前の `scripts/` 直下のパスを残す）、lib-large-files・src-folder-layout（分割・削除前のパス）など。

未実施の判断（E・G・G.5）: 未参照の受入基準の内容を 1 件ずつ判断していない。実装の確認は、前段の成果物の確認（有無・行数・export）に基づく。

## 完了した作業（履歴）

`spec.json` が `implementation-complete` のもの、および直接実装のもの。

- [x] src-composer-split -- `ThreadComposer` を部品フォルダの規約に沿って分割（`index.tsx` は 1,511 行から 725 行）
- [x] src-cycles -- 循環 import を解消（`test:imports` の循環の違反は 0）
- [x] src-import-rules -- 三層・循環・`lib` の UI 依存・`@/` の統一を機械で検査
- [x] src-lib-ui-boundary -- `lib` 内の React 依存を `components` 側へ移した
- [x] src-pages-thin -- `pages/v2` の DB・R2・トークン操作を `lib` へ移し、`pages` を入口だけにした
- [x] repo-root-layout -- ルートの設定・文書・生成物を役割ごとに整理（根に残るのはツールの規約で必要なもの）
- [x] entryCandidate（直接実装） -- `lib/timeline/entryCandidate.ts` へ移動（旧位置は無い）
- [x] ops-agent-setup -- cc-sdd と BRW の導入を Claude 向けの一つの入口にまとめ、Codex 側の導入を取り消した（Phase 8）
- [x] codex-mcp-subagent -- Codex を MCP の子エージェント（`codex_exec`）として Claude から呼ぶ（Phase 8）
- [x] develop-docs-agents（直接実装） -- `docs/DEVELOP.md` の導入の説明を改訂後の導入に合わせた（Phase 8）
- [x] port-trial-fixes（直接実装、2026-11-10） -- 取り込まれていなかった旧ブランチ（コミット 1e9879af）の修正 3 件を移植した: 詳細ページの検証の失敗を例外で扱う（`src/pages/entries/[slug].astro`）、`GET /v2/entries` の応答の定義に動画の項目を加える、候補の取得で呼び出し元の中断信号とタイムアウトを合成する（`src/lib/atproto/suggest.ts`）。旧ブランチの他の内容（アンケート・D1 の改名・運用スクリプト）は、機能の単位で develop に入っていることを確かめた
- [x] src-folder-layout・src-import-style・src-duplicates・src-composer-layout・src-component-nesting -- `src/` の配置・import の書き方・重複・部品の入れ子を整理（2026-11-10 に検証し `implementation-complete`）
- [x] util-placement・lib-layers・lib-large-files・components-small-areas・layout-home・structure-checks -- `util`・`lib`・`components` の配置と層を整理し、機械の検査で固定（同上）
- [x] ops-config-secrets・ops-tooling-layout・develop-docs -- 運用のスクリプト・設定・手順書を整理（同上）
- [x] test-foundation・live-tests -- テストの基盤（層・E2E・必須の検査）と、任意の実アカウントのテスト（同上）

## Phase 7: ソースコードのコメントの整理（2026-11-08 discovery）

### Overview

ソースのコメントに、cc-sdd 導入前の自前の仕様駆動開発の名残と、過去の経緯が多く残っている。既に無い spec（`specs/...`）を指す参照、要件番号、AC タグ、日付入りの経緯がある。コメントは現在の振る舞いと理由を述べるものに直す。振る舞いは変えない。

### Approach Decision

- **Chosen**: 基準を先に steering（`comments.md`）に書き、その後、領域ごとに spec を分けて書き換える。生成物（`src/client`）は生成元（`src/lib/api/schema`）を直して作り直す。テストの題名も直す（確認済み）。
- **Why**: 判別（残す・削る）は領域をまたいでばらつくため、基準を先に決める。領域ごとに分けると、差分をレビューできる単位になる。
- **Rejected alternatives**:
  - 1 spec にまとめる: 対象が 1,000 ファイル規模で、レビューの単位が大きくなりすぎる。
  - 機械的な一括置換: 「最小要件」など正当な用法を誤って消すため、判別が要る。

### Scope

- **In**: `src/`・`tests/`・`scripts/`・`hack/`・`config/`・`.githooks/` のコメント（`//`・`/* */`・JSDoc・HTML コメント）。テストの題名。生成物は生成元の変更として扱う。
- **Out**: 文字列リテラル（UI 文言・エラー文言）、振る舞い、API の形、CI の挙動。

### Constraints

- 振る舞いを変えない。
- 各 spec は、自分の領域の検証（型・imports・unit・component・route・render）を完了条件にする。e2e は全 comments-* の実装の後に、comments-api-schema が最終の統合として 1 回だけ実行する。e2e は `build:prepare`（`prettier --write .` を含む）を経由するため、単位の外の整形差分は戻す。

### Boundary Strategy

- **Why this split**: 領域（`lib`・`components`・`pages`・`tests`・運用の資材・生成物）ごとに、差分と検証が閉じる。
- **Shared seams to watch**:
  1. **基準（comment-policy）**: 他の spec の判断の正本。基準を変えたら、この phase を改訂する。
  2. **生成物（comments-api-schema）**: `src/lib/api/schema` を直した後に再生成する。comments-lib の後に行う。

### Specs (dependency order)

（2026-11-08 batch: 6 件とも spec の作成（requirements・design・tasks）と承認を済ませた。`[ ]` は実装が未着手であることを表す。実装は依存の順（comment-policy → comments-lib → comments-api-schema の 1 → 残り 3 件 → comments-api-schema の残り）で `/kiro-impl` により行う。）

- [x] comment-policy -- コメントの基準（残す・削る・判別）を `.kiro/steering/comments.md` に書く。Dependencies: none
- [x] comments-lib -- `src/lib`（`api/schema` を除く）のコメントを基準に従って書き換える。Dependencies: comment-policy
- [x] comments-components-pages -- `src/components`・`src/pages`・`src/` 直下・`src/types`・`src/util`・`src/styles` のコメントを書き換える。Dependencies: comment-policy
- [x] comments-tests -- `tests/`・`config/test/` のコメントを書き換え、日本語を含むテストの題名（362 件）を英語にする（要件番号・spec 名を含むものは振る舞いの英語の題名へ）。Dependencies: comment-policy
- [x] comments-scripts-config -- `scripts`・`hack`・`config`・`.githooks` のコメントを書き換える。Dependencies: comment-policy
- [x] comments-api-schema -- `src/lib/api/schema` の説明を直し（説明文の文章の上限は削り、zod の制約だけで表す）、`npm run codegen` で生成物を作り直す。説明文以外の差分が無いことを確かめる。Dependencies: comment-policy, comments-lib

実行の順序（共有の許容リストのため直列）: comment-policy → comments-lib → comments-api-schema の「1 の基準の保存」→ comments-components-pages・comments-tests・comments-scripts-config → comments-api-schema の残りの作業（生成と最終の e2e）。`scripts/build/build-openapi-document.ts` と `config/orval.config.ts` の変更は、comments-api-schema の基準の保存の後に行う。

## 未着手（フェーズ外）

- 作業ブランチと本番向けブランチの運用の強制（`branch-release-workflow`）: 判定スクリプトと、commit・push の前に動くフックが残っている。skill 本体は別リポジトリで作成中。現在の運用は DEVELOP.md 5.3 に従う。
  - 2026-11-10 追補（観察）: 宣言ファイル（`.branch-release-workflow.json`）と取得元（`.branch-release-workflow-source.json`）はリポジトリにあり、skill はプラグインとして導入される（DEVELOP.md 5.3）。下の (3) は済んでいる。リポジトリ内のフックは `.githooks/pre-push`（テストの実行）だけで、commit・push を止める判定はプラグインの側が持つ。
  - 残りの作業: (1) `remote-preview` の現状を棚卸しする。(2) 直接作業禁止（`main`・`develop`）と `dev/XXXX` 運用を skill に明記する。(3) 宣言ファイルの形式と置き場所を決める。(4) 判定スクリプト（宣言と workflows の走査）を作り、selftest を付ける。(5) フックを承認を得て導入する。(6) 他のリポジトリでも使えるように一般化する。

## Phase 8: 開発システムの Codex 連携（2026-11-08 discovery）

### Overview

cc-sdd に Codex 対応を持たせる設計（`install-cc-sdd.sh --codex`・`.agents/skills/kiro-*`・`.codex/agents/`・AGENTS.md・`.codex/hooks.json` の導入）を取り消す。代わりに Codex を MCP の子エージェントとして使う。Claude が作業中に `codex_exec` を積極的に呼ぶ。MCP が使えない環境（クラウドセッションなど）は、Claude だけで従来どおり完結する。方式は vpngateway-gui の `scripts/codex-mcp-server.mjs` を取り込むが、codex 0.167.0 で動かないため直して使う。

### Approach Decision

- **Chosen**: Codex を MCP サーバー `codex` として登録し、`codex_exec` ツールを Claude に見せる。方針は CLAUDE.md の節に書く。`codex` が無い環境では、サーバーがツールを出さない。
- **Why**: kiro-* スキルは cc-sdd が毎回上書きするため、方針を置けるのは CLAUDE.md だけ。MCP は Claude のツールとして呼べ、承認の指定をサーバー 1 箇所に固定できる。
- **Rejected alternatives**:
  - Codex 側も cc-sdd で導入する（現状）: Claude と Codex で手順が二重になり、`$kiro-*` と `/kiro-*` の表記が食い違う。Codex を子エージェントとして呼ぶ経路にもならない。
  - Bash から `codex exec` を直接呼ぶ: 承認と権限の制御が Claude の許可設定に散らばる。
  - `.codex/agents/` の子エージェント定義: Claude のツールからは呼べない。

### Scope

- **In**:
  - Codex の cc-sdd 導入の取り消し（`--codex`・`.agents/skills`・`.codex/agents`・AGENTS.md・`.codex/hooks.json` の導入、BRW の Codex 側） → `ops-agent-setup` の改訂
  - MCP サーバーと `.mcp.json`・Codex 設定の取り込み、CLAUDE.md の方針 → `codex-mcp-subagent`
  - `docs/DEVELOP.md` の導入の説明（4 項・5.3 項）
- **Out**:
  - kiro-* スキルの中身（cc-sdd の生成物）。書き換えない。
  - BRW スキル本体（別リポジトリ）
  - Codex のモデルの性能評価

### Constraints

- Codex にコミット・push・承認状態の変更を任せない（CLAUDE.md の規則）。
- `codex exec` は `--ask-for-approval` を受け付けない。承認は `-c approval_policy="never"` で渡す。
- `.mcp.json` のパス展開（`${CLAUDE_PROJECT_DIR:-.}`）は未確認のため、実機で確かめてから決める。
- 順序: `ops-agent-setup` の改訂が先。その後に `codex-mcp-subagent` を実装する。

### Boundary Strategy

- **Why this split**: cc-sdd・BRW・SessionStart の取り消し（既存 spec の改訂）と、MCP の新規の導入（新 spec）は、変更する資材が違う。分けると、取り消しの確認と新しい導入の確認を別々に行える。
- **Shared seams to watch**:
  1. **SessionStart と `.codex/hooks.json`**（`ops-agent-setup`）。`codex-mcp-subagent` は触らない。
  2. **CLAUDE.md の Codex 節**（`codex-mcp-subagent`）。AGENTS.md の削除は `ops-agent-setup`。
  3. **`docs/DEVELOP.md` の 4 項・5.3 項**: 両 spec の完了後に直接直す。

### Existing Spec Updates

- [x] ops-agent-setup -- Codex の cc-sdd 導入（`--codex`・`.agents/skills/kiro-*`・`.codex/agents/`・AGENTS.md・`.codex/hooks.json` の SessionStart）と BRW の Codex 側（`.agents/skills/branch-release-workflow` の symlink・`--codex` の導入・`.gitignore` の 2 行）を取り消す。Claude 側は残す。requirements・design・tasks を改訂し、再承認を得る。（2026-11-08: 改訂の草案を作成済み。承認待ち。コードの取り消しは未実施。→ 2026-11-10 追補: 再承認と取り消しを終え、`implementation-complete`。`install-cc-sdd.sh` は `--claude` だけを受け付け、AGENTS.md は無い。）Dependencies: none

### Direct Implementation Candidates

- [x] develop-docs-agents -- `docs/DEVELOP.md` の 4 項（cc-sdd・BRW の導入）と 5.3 項（BRW の入口）を、改訂後の導入に合わせて直す。Dependencies: ops-agent-setup, codex-mcp-subagent

### Specs (dependency order)

- [x] codex-mcp-subagent -- Codex の MCP サーバー（`scripts/agent/codex-mcp-server.mjs`）、`.mcp.json`・`.codex/config.toml` の取り込み、CLAUDE.md の方針節、MCP が使えない環境での扱い。Dependencies: ops-agent-setup（改訂後）

（新しい spec は 1 件だけのため、`/kiro-spec-batch` ではなく `/kiro-spec-init codex-mcp-subagent` で作る。）

## Phase 9: アンケート結果の公表（2026-11-12 discovery）

### Overview

アンケート機能は **D1 と R2 を前提とする**（R2 バインディングが無い環境ではアンケート機能全体が無効）。アンケートの実施期間が終わったら、Worker が自動で回答を集計して R2 へ統計ファイル（割合だけ）を書き、保存の成功後にだけ D1 の回答を削除する（「終了の 1 か月後」の保持期限は廃止）。集計時は常に非表示で作り、運用者が CLI（`npm run survey`）の `publish` で公開に切り替える。結果ページ `/surveys` は、**ビルド時に R2 から統計ファイルを取得して静的ドキュメントとして生成**し（実行時の API は無い）、公開のものだけを実施時期の新しい順に表示する。`publish`・`unpublish` は、可視フラグの書き換えに続いて `gh workflow run` で再配備を起動する。ページへは login 画面の文中の小リンクからだけ入る。公開済みが 0 件ならページもリンクも出さず、ビルドが R2 の取得・検証に失敗したら配備を止める。あわせて、CLI のコマンド体系と運用の手順を見直す。

### Approach Decision

- **Chosen**: 集計・保存・削除（`survey-results-aggregation`）、ビルド時の取得・静的な画面（`survey-results-public`）、CLI と運用の手順（`survey-operations`）の 3 つに分ける。統計ファイルの形式は共有の部品に置き、`survey-results-aggregation` が所有する。
- **Why**: 日次の枠で動く処理、実行時の API と画面、運用者の道具で、変更の時機と検証の方法が違う。Worker が R2 を書くため、手元の CLI での集計はやめた（利用者の決定）。R2 を前提にすることで、「R2 が無い環境の保持期限」という二重の規則をなくした。
- **Rejected alternatives**:
  - 手元の CLI で集計・保存: 回答の削除までに運用者が実行する必要があり、取りこぼす。
  - R2 が無い環境では従来の保持期限で動かす: 規則が二重になる。利用者の決定で R2 を必須にした。
  - 公開の切り替えを `SURVEY_CONFIG` に置く: 設定から期限切れ項目を除去した後に切り替えられない。
  - 件数の表示・しきい値による伏せ字: 利用者の決定で撤回（割合だけを出す）。
  - Worker が実行時に R2 を読んで API（`GET /v2/surveys`）で返す案: 空の状態・取得失敗の画面と API・キャッシュの設計が要る。結果は公開の切り替えのときだけ変わるため、静的生成と再配備で足りる（利用者の決定 2026-11-12）。
  - `prune` を D1 の行の確認のまま残す: 回答の削除は Worker の担当になり、意味を失う。

### Scope

- **In**: 統計ファイルの形式、集計（割合・複数選択は回答者数を分母）、集計後の削除、R2 の必須化（アンケート機能の無効化の判定）、ビルド時の取得、`/surveys` ページ（静的生成）と結果のコンポーネント、login のリンク、CLI のコマンド体系（add・status・publish・unpublish・prune・remove。`--env` は status・publish・unpublish で必須。prune・remove は設定の変数が両環境で共有されるため `--env` を取らず、両環境の目録を確認する（利用者の決定 2026-11-13）。publish・unpublish は再配備を起動する）、`survey-run` skill と DEVELOP.md の更新、プライバシーポリシーの更新の要否の判断。
- **Out**: R2 バケットの作成、`surveys` の提示・回答の仕様の変更（保持期限と有効・無効の判定を除く）、ダッシュボードからの導線。

### Constraints

- 件数・回答者数は出さない（割合だけ）。回答が 0 件のアンケートは公表しない。
- 統計ファイルに個別の回答・回答日・回答者の値を入れない。
- 保存の成功後にだけ D1 を削除する。失敗したら削除せず、翌日に再試行する。
- R2 のバケットは用途ごとに分ける（規則は `.kiro/steering/r2-buckets.md`。統計ファイルは `skyshare-survey-results`）。PoC のブランチ `dev/survey-r2-poc` とその worktree は、この作業の完了後に `brw finish` で片付ける。
- 利用者の決定（2026-11-13）: アンケートの識別子は登録側 CLI が UUID で発行する（月ごとの連番と、新規登録時の任意指定は廃止）。アンケートは同時に 1 つだけで、設定内のすべてのアンケートが本番・develop 両方の目録に記録されるまで、次の新規登録は拒否する（開始前も対象。開始前は `remove`、開催中は締切の前倒し・両環境への配備・集計待ちで取り下げる）。締切は日付だけを入力し、その日の日本時間 0 時とする。集計は現在の日次の枠のままにする。
- D1 の読み取り・削除はまとめて送り、アンケートの日次処理だけで最大 16 回以内に収める。予約投稿の実装と呼び出し数の管理は変えず、共有の枠は作らない（利用者の決定 2026-11-13）。
- 既存結果は、本体の形式・識別子・実施期間を検証して使う。回答済みの集合は、正常な設定を読めれば R2 の読み取りより前に削除し、回答は結果の保存確認後だけ削除する。設定なしでも目録に基づく残存回答の掃除は行い、設定が読めないときは何も削除しない。
- 画面のデザインは利用者と合意済み（`survey-results-public` の brief の「合意の結果」）。最大の選択肢はプライマリ色、そのほかは灰色の共通トークン（`--color-gray-hover` が候補。muted は背景と混ざるため使わない）。色は既存の共通トークン・共通コンポーネントを使う。アンケート全体の題・説明と、複数選択の注記は出さない。

### Boundary Strategy

- **Why this split**: 書き込み（日次の処理）・読み出し（API・画面）・運用の道具（CLI・手順書）で、変更と検証が閉じる。
- **Shared seams to watch**:
  1. **統計ファイルの形式**（`survey-results-aggregation` が所有。`survey-results-public` は読み、`survey-operations` は可視フラグを書く）。
  2. **機能の有効・無効の判定**（D1・R2 の両方があるか。`survey-results-aggregation` が所有し、`surveys`・`survey-results-public` が使う）。
  3. **公開の反映**（`survey-operations` の `publish` が可視フラグを書き、再配備を起動する。`survey-results-public` のビルドがそれを読む）。
  4. **削除の契機**（`surveys` の保持期限の規則を、`survey-results-aggregation` の集計後の削除に置き換える）。

### Existing Spec Updates

- [ ] surveys(a) 設定の形式の変更 -- アンケート全体の題（`title`）と説明（`description`）を設定の形式から廃止する（質問ごとの題だけにする。利用者の決定 2026-11-12）。影響: `definition.ts`・回答ダイアログ（`SurveyDialog`）・辞書・テストの設定の例（`tests/fixtures/survey/`）。アンケート機能は本番へ未公開のため破壊的変更を許し、既存の `SURVEY_CONFIG` と D1 は初期状態として扱う（移行は作らない。D1 の構造の変更は `migrations/0001_initial.sql` に直接反映してよい）。運用中の設定の作り直し（質問の題を「UIデザインはどちらが好みですか？」にする）は `survey-operations` のタスク 4.2（運用者の作業）が担当する。フェーズ 1 の brief のみで要件は未作成のため、要件の作成時にも記録する。Dependencies: none（`survey-operations` の 2.1 の前提。他の 2 つの spec と並行または先行してよい）
- [ ] surveys(b) 保持期限の規則の記録 -- 保持期限の規則を「集計の保存の成功後の削除」に置き換え、アンケート機能が D1 と R2 を前提とすること（R2 が無ければ無効）を要件に記録する。Dependencies: survey-results-aggregation
- [ ] help-privacy -- アンケート結果を公表すること・公表する範囲をプライバシーポリシーに書くかの判断と追記（`survey-results-public` の設計で判断する）。Dependencies: survey-results-public
- [ ] develop-docs -- DEVELOP.md の 3.x・main への取り込み前の手順（5.x）・環境変数の表（6.x）を、新しい体系に合わせる（`survey-operations` の実装で行う）。`survey-results-public` も、CI の認証情報・R2・プレビューの更新・本番バケットの先行作成の節と、6.5 の `SURVEY_RESULTS` の行を編集する（節の見出しで分担し、競合を避ける）。Dependencies: survey-operations, survey-results-public

### Direct Implementation Candidates

- [x] survey-form-incomplete-message（2026-11-12 実装済み: `dev/survey-results-publishing`） -- 回答ダイアログの「すべての質問に答えると送信できます。」（`survey.incomplete`。`src/lib/i18n/messages/{ja,en}/survey.ts` と `SurveyDialog`）を消す。自明な文言の削除で、spec の境界を変えない（利用者の決定 2026-11-12）。

### Specs (dependency order)

- [ ] survey-results-aggregation -- 統計ファイルの形式と検証スキーマ、日次の枠での集計と保存成功後の削除、保持期限の廃止、R2 必須（アンケート機能の無効化の判定）。Dependencies: surveys
- [ ] survey-results-public -- ビルド時の R2 の取得と検証、`/surveys` ページ（静的生成）と結果のコンポーネント、login のリンク、読み取りの情報が無いときのオプトアウト。Dependencies: survey-results-aggregation, platform-runtime, i18n, ui-primitives
- [ ] survey-operations -- CLI のコマンド体系（add・status・publish・unpublish・prune・remove）、R2 の読み書き、`--env`、公開の切り替え後の再配備の起動（`gh workflow run`）、`survey-run` skill と DEVELOP.md の手順。Dependencies: survey-results-aggregation, surveys(a)

**実装順**: surveys(a) → survey-results-aggregation の 1〜3.4 → survey-operations の 3.1 まで → survey-results-aggregation の 3.5・4.1（survey-operations の 3.2 以降は自身の依存に従って進める）（3.5・4.1 は、`survey-operations` が `hack/survey-cli/lifecycle.ts` から保持期限の判定を除くのを待つ）。`survey-results-public` は aggregation の後に着手する。プライバシーポリシーの文言（`survey-results-public` 2.5）と、本番のバケットの作成（運用者の作業）は、aggregation を本番へ出す前に済ませる。

（2026-11-13: 3 spec の要件・設計・タスクを作成し、横断レビュー（2 回）の指摘を反映した。phase は `tasks-generated`。実装は未着手のため `[ ]` のまま。実装は `/kiro-impl <feature>` で上の実装順に行う。）

（画面デザインは合意済み。空の状態・取得失敗の画面は、静的生成にしたため作らない。`/kiro-spec-batch` で 3 件を作れる。）
