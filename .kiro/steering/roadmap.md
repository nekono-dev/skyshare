# Roadmap

## Overview

Skyshare の現行実装（`src/`・設定ファイル・D1 のマイグレーション）を根拠に、利用者に見える振る舞いと共有基盤を 18 件の spec に分ける。各 spec は**現行の振る舞いを記録する**。新機能や改善案は含めない。docs・既存 specs・既存テストは根拠にしない。

前回の分割（旧 specs と `_tests/` の退避）は、テストの方針を決めないまま実装された負債を引き継いでいたため、すべて破棄した。今回は `/kiro-steering` の初回実行（実装からの bootstrap）の結果を前提に、分割をやり直している。

## Approach Decision

- **Chosen**: 実装の import 関係（`lib`・`components`・`pages`・API の結合）を実測し、結合の強い塊ごとに spec を置く。共有の塊は基盤 spec として独立させる。画面（`pages`）の単位では分けない。
- **Why**: 実測の結合は、機能ごとの塊と共有の塊をはっきり示す（下の「結合の実測」）。`lib/` が `components/` を import しないため、依存を一方向にできる。
- **Rejected alternatives**:
  - 画面単位（`pages/` ごと）の分割: `components/post/` が投稿・タイムライン・共有・予約の部品を同じフォルダに持つため、画面単位では境界が合わない。
  - 全機能を 1 spec: 20 タスクを大きく超え、設計の境界が崩れる。
  - 旧方式（機能別の `test-*` spec）: テストの方針が決まっていないまま、機能契約と検証を二重に管理することになる。
  - テストの方針を spec として決める: テストの方針は全 spec に効く**プロジェクト横断の規則**なので、spec ではなく steering（`testing.md`）に置く（後述）。

## Scope

- **In**:
  - 利用者に見える画面: `/login`・`/accounts`・`/`・`/post`・`/entries`・`/entries/{slug}`・`/settings`・`/feedback`・`/help`・`/privacy`・`/posts/*`・`/jump`
  - 利用者向け API: `src/pages/v2/**`・`/oauth/*`・`/v1/page`
  - Cron による予約投稿の実行と、1 日 1 回の後片付け（`src/worker.ts` の `scheduled`）
  - 共有基盤: 表示言語、UI 部品、API 契約、OAuth クライアント、Bluesky レコードの組み立て、Worker とビルドの設定
- **Out**:
  - 運用・開発ツール: `scripts/`（アンケート設定の CLI、デプロイ設定の同期、OAuth 鍵の生成、ローカル中継）、デプロイと CI、`DEVELOP.md`
  - 生成物と旧資産: `dist/`・`.astro/`・`.wrangler/`・`src/client/openapi/`（生成物）・`_legacy/`
  - 外部サービスの内部: legacy backend、OGP 抽出サービス、Bluesky の PDS・AppView・認可サーバー。呼び出しの契約だけを扱う
  - 確認用のページ: `src/pages/samples/choice-question.astro`、`src/pages/entries/sample.astro`（**扱いを利用者に確認する**）
  - 文書: `src/components/dead.md`、各 `README.md`

## Constraints

- 言語は日本語。
- **根拠は実装だけ**（`src/`・`package.json`・`astro.config.mjs`・`wrangler.template.jsonc`・`migrations/`）。docs・既存 specs・`_tests/` は根拠にしない。
- `src/` のコメントに含まれる旧 spec 参照（`specs/...`）は根拠にしない。コメントは補助として読むが、動作は必ずコードで確かめる。
- テストの方針（層の定義・置き場所・ツール）は steering で決める（`/kiro-steering-custom testing`）。spec の design はその方針を参照する。
- 実装→spec の網羅は強制しない（`src/` の全ファイルが spec に属する必要はない）。
- 既存の不一致（テストの置き場所、設定の古いパス等）は、spec に現行の振る舞いとして書かず、brief の Constraints に「既知の不一致」として記録する。

## 結合の実測（`src/` の import 集計）

領域をまたぐ import の件数（多い順の抜粋）。spec の境界はこの結合を根拠にする。

| 件数 | 依存元 → 依存先                                                     |
| ---- | ------------------------------------------------------------------- |
| 38   | `pages/v2` → `lib/api`                                              |
| 36   | `components/post` → `components/common`                             |
| 36   | `pages/v2` → `lib/schedule`                                         |
| 28   | `components/post` → `lib/i18n`                                      |
| 22   | `components/post` → `lib/entry`                                     |
| 18   | `lib/entry` → `lib/atproto`                                         |
| 17   | `components/post` → `lib/settings`                                  |
| 14   | `lib/session` → `lib/oauth`                                         |
| 9    | `lib/schedule` → `lib/oauth`                                        |
| 8    | `components/image` → `lib/image`                                    |
| 7    | `pages/v2` → `lib/session`                                          |
| 7    | `pages/v2` → `lib/survey`                                           |
| 4    | `lib/entry` → `lib/video`（entry の画像と見出しに動画の情報を使う） |
| 4    | `lib/survey` → `lib/platform/cfTypes`（D1 の型）                    |

観察された結合の問題（記録のみ。修正は spec の範囲外として扱う）:

- **（解消済み 2026-10-31）共有の型が予約の領域にあった**: `cfTypes.ts` と `cloudflare-workers.d.ts` は `src/lib/platform/` へ移した。
- **（解消済み 2026-10-31）`components/post/` が複数の機能の部品を持っていた**: `composer/`・`timeline/`・`share/` に分け、Entry 操作は `entry/` へ移した。
- **`lib/entry` が `lib/video` に依存する**: entry の画像の合成が動画の処理を直接使う。`media-attachments` を先に確定させる必要がある（未解消）。
- **`lib/atproto` は `lib/api/schema/common` の型を参照する**（型だけ）。`api-contract` を `atproto-records` より先に置く。

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
  8. **配置（ホスト）は依存に含めない**: 画面が他 spec の部品を置く関係（タイムラインのアンケート入口、設定ページの予約切替）は依存にしない。依存は部品と契約の所有者だけ。
- **未決定**: テストの方針（層・置き場所・ツール）。`/kiro-steering-custom testing` で決める。現行の設定はテストを `tests/` に置く前提で、テストは `_tests/` にある（`tech.md` の「ずれ」）。

## Specs (dependency order)

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

## Phase 2: 運用・開発ツールの整備（2026-10-31 discovery）

フェーズ 1 の Out（`scripts/`・デプロイと CI・`DEVELOP.md`）を、運用者向けの別の作業として扱う。利用者に見える振る舞いは変えない。

### Overview

運用ツール（`scripts/`・`.claude/`・`.codex/`・`.agents/`・`.githooks/`・`config/`）は、作られた時期の異なる機構が重なっている。同じ処理が複数の場所で実装され（wrangler の生成、dotenv の解析、JSONC の解析、cc-sdd の導入）、CI が参照するファイルが cc-sdd の再導入（`0ffaa17`）で消えたまま残っている。Phase 2 は、機能ごとに持ち主を 1 つに決め（重複の排除と役割の排他）、ディレクトリと命名を揃え、DEVELOP.md を手順だけの文書にする。

### Approach Decision

- **Chosen**: 機能の領域（agent・config・secrets・survey・e2e・git）ごとに spec を分け、各 spec が「持ち主」を 1 つ定める。前提になる spec（agent・config/secrets）を先に確定し、配置の変更（tooling-layout）と文書（develop-docs）を後に置く。
- **Why**: 配置の変更は他の spec の参照先（パス）を変えるため、中身の整理を先に終えてから動かす。文書は最後に、確定した構成だけを書く。
- **Rejected alternatives**:
  - 1 spec に全部まとめる: 変更の範囲が広すぎ、CI を壊したときに切り分けられない。
  - 配置の変更を先にする: 中身の重複を整理する前に参照先が動き、差分がレビューできなくなる。
  - DEVELOP.md だけ直す: 手順が指す先（スクリプトの場所と責務）が変わるため、文書だけでは揃わない。

### Scope

- **In**: `scripts/`（スクリプトとライブラリの配置・命名・重複）、`.claude/`・`.codex/`・`.agents/` の導入の仕組み、`.githooks/`、`config/` と各種の環境変数ファイル、`package.json` の運用系のスクリプト名、`DEVELOP.md`。
- **Out**: 利用者に見える機能、アプリの src の振る舞い、Cloudflare・GitHub の実際の設定値（値は変えない）、pre-push で GitHub の Variables を登録する挙動（後述の未決定）。

### Constraints

- CI（`.github/workflows/`）が呼ぶスクリプトの名前と引数は、CI と同じ変更で更新する。
- 秘密情報の値は、ログ・リポジトリ・文書に出さない（既存の規則を保つ）。
- cc-sdd の導入物（`.kiro/settings/`・`CLAUDE.md`・`.claude/skills/kiro-*`）は cc-sdd 3.1.0 で固定し、導入で差分が出ない状態をコミットに含める。
- 既存のテスト（`tests/unit/scripts/`）を守る。移動に伴う import の変更は、テストの意味を変えない。

### Boundary Strategy

- **Why this split**: 持ち主（ファイル群）が spec で閉じる。agent の導入は Claude と Codex の両方が使うため、1 つの spec で所有する。
- **Shared seams to watch**:
  1. **wrangler の生成**（`render-wrangler`）: 所有は ops-config-secrets。ops-tooling-layout は移動だけを行う。
  2. **`scripts/lib/`**（dotenv・JSONC・GitHub のリポジトリ判定）: 所有は ops-config-secrets。配置の変更は ops-tooling-layout。
  3. **CI の参照パス**: 変更は ops-tooling-layout が最後にまとめて行う。
  4. **未決定（pre-push の GitHub 登録）**: 挙動は変えない。ops-config-secrets の brief に既知の論点として残す。

### Specs (dependency order)

- [ ] ops-agent-setup -- cc-sdd の導入を 1 つの入口にそろえ、版を固定する。BRW の取得元（`.branch-release-workflow-source.json`）の欠落を戻し、Claude と Codex の BRW の配布を 1 つずつに決める。Dependencies: none
- [ ] ops-config-secrets -- wrangler の生成を 1 つの関数に集約し、子プロセスでの呼び出しをやめる。dotenv・JSONC・wrangler の名前の読み取りを `scripts/lib/` に一本化する。Dependencies: none
- [ ] ops-tooling-layout -- `scripts/` を領域ごとのフォルダに分け、命名を kebab-case にそろえる。運用系の npm スクリプトの重複と誤記（`build:prepare`）を直す。CI と参照のパスを更新する。Dependencies: ops-agent-setup, ops-config-secrets
- [ ] develop-docs -- DEVELOP.md を手順だけの文書に作り直す。steering と spec の責務を分け、確定した構成（配置・スクリプト名・CI の参照）に合わせ、古い記述（E2E の Secret など）を直す。Dependencies: ops-agent-setup, ops-config-secrets, ops-tooling-layout

### 既知の論点（調査で見つかったもの）

- （解消 2026-10-31）`.branch-release-workflow-source.json` が `0ffaa17` で削除され、CI の `setup-brw.mjs` が失敗していた。ops-agent-setup で復元した。
- （解消 2026-10-31）`.claude/settings.json` の cc-sdd の導入が `@latest` だった。`scripts/agent/install-cc-sdd.sh` に集約して 3.1.0 に固定した。導入物は prettier の対象外にした（整形と導入の差分が往復していた）。

## Phase 2 追補（2026-10-31: 利用者の決定）

### Existing Spec Updates

- [ ] ops-agent-setup（Codex と Claude の導入は確認済み。.claude/settings.json・.codex/hooks.json の変更と Claude の実機確認は未了） -- BRW の導入を `npm run setup:brw` の 1 つの入口にし、Claude と Codex を同じ clone の同じ commit から導入する。Codex 用の導入は BRW 本体の `scripts/install-codex.mjs` を使う（BRW 本体は変更しない）。`.claude/settings.json` の marketplace の取得元を外す。Dependencies: none
- [x] ops-config-secrets -- `.githooks/pre-push` をテストだけにする。GitHub の登録は `npm run sync:github` の手動方式に戻す。Dependencies: none
- [x] develop-docs -- デプロイ前の `npm run sync:github` の手順、実アカウントのテストの扱い、BRW の入口を文書に反映する。Dependencies: ops-agent-setup, ops-config-secrets, live-tests

### New Specs

- [x] live-tests -- 実 Bluesky との契約を確かめるオプショナルな live テスト（開発者がローカルで任意に実行。CI と pre-push の対象外）。設定は `config/live.json`（非秘密）と `.dev.vars`（秘密）に分配し、`.env.e2e` を廃止する。Dependencies: test-foundation, ops-config-secrets

### 未決定（記録のみ）

- Claude の marketplace 登録（ユーザースコープ）は、利用者の Claude 設定を変える。この作業の環境では実行の権限が下りなかったため、実機での確認は利用者が行う。

## Phase 3: src の構造整理（2026-11-01 discovery）

### Overview

`src/` は機能の追加で構成の一貫性が崩れている。依存の向き（`lib` → `components`）は守られているが、`lib` の UI 依存、`pages` の DB 直接操作、循環、import の混在、同じ概念の重複が残っている。Phase 3 は**振る舞いを変えず**、実装を steering（`structure.md`）の規約に合わせる。振る舞いの正は既存 18 spec。

### Approach Decision

- **Chosen**: 段階的な是正。規約の機械検査を先に置き、違反を 1 つずつ潰す。ディレクトリの再編と import の統一は最後に行う。
- **Why**: 大きな移動を先にすると差分をレビューできず、テスト失敗の切り分けもできない。機械検査があれば、各段階で違反が増えることを止められる。
- **Rejected alternatives**:
  - ドメイン単位の全面再編: 一度の差分が大きすぎ、失敗の原因を追えない。
  - 分析のみで終える: 計画が次の作業につながらない。

### Scope

- **In**: `src/` の構成、`lib`・`components`・`pages`・`util` の境界、import の規約、循環、重複、フォルダの規約（`structure.md`）。
- **Out**: 利用者に見える振る舞い（既存 18 spec の契約）、API の入出力と DB スキーマ、`scripts/` と運用ツール（Phase 2）、生成物（`src/client/openapi/model/`）、`_legacy/`。

### Constraints

- **検証の基準**: `npm run test:all` が終了コード 0 で通過すること。件数は 2026-11-01 の `src-pages-thin` 完了時点で、type 成功、lexicon 成功、imports 違反 0・許容 77、unit 208、component 6、route 200、render 2、e2e 7。各 spec は、完了時にこの件数以上を保つ。
- 規約の正は steering（`structure.md`）。実装を steering に合わせる。steering に無い領域（`lib/account`・`codegen`・`image`・`privacy`・`site`・`video`、`lib/guestMode.ts`）は、steering 側へ登録する。
- テストの import パスは、実装と同じ変更で更新する。テストの意味は変えない。
- 既存 spec の振る舞いは変えない。変えたくなった場合は Phase 3 の外の論点として記録する。

### Boundary Strategy

- **Why this split**: 違反の種類（規約の検査・循環・pages の責務・lib の UI 依存・大きな部品・重複・フォルダ・import の表記）ごとに、変更と検証が閉じる。
- **Shared seams to watch**:
  1. **規約の検査**（`src-import-rules`）: 許容リストは他の spec が減らす。増やすのは例外として理由を書く場合だけ。
  2. **`lib/i18n` の循環**（`src-cycles`）と **`lib` の UI 依存**（`src-lib-ui-boundary`）: どちらも `i18n` の所有者（`i18n` spec）の振る舞いを変えない。
  3. **共有の文字数と share の責務**（`src-duplicates`）: 振る舞いは `external-sharing` と `post-composition` の契約に従う。
  4. **フォルダと import の表記**（`src-folder-layout`・`src-import-style`）: 最後にまとめて行う。途中で移動すると他の spec の差分が読めなくなる。

### Specs (dependency order)

- [x] src-import-rules -- 三層・`lib` から `components` への依存の禁止・`lib` の UI 依存の禁止・循環の禁止・`@/` の統一を機械で検査する。現状の違反は許容リストに記録し、増加を止める。Dependencies: none
- [x] src-cycles -- 循環を解消する（`lib/i18n/messages/*` と `translate.ts` の型循環 16 ファイル、`lib/settings` の 2 ファイル循環、`lib/atproto` と `lib/entry` の双方向）。Dependencies: src-import-rules
- [x] src-pages-thin -- `pages/v2` が DB・R2・GitHub トークン・レート制限を直接扱う箇所を `lib` へ移し、`pages` を入口だけにする（`pages/v2/entry.ts` 583 行、`schedules*` 4 ファイル、`feedback.ts`）。Dependencies: src-import-rules
- [x] src-lib-ui-boundary -- `lib` 内の React と react-easy-crop の依存 6 ファイルを `components` 側へ移す（`lib/i18n/react.ts`・`rich.tsx` を含む）。Dependencies: src-import-rules, src-cycles
- [x] src-composer-split -- `ThreadComposer`（`index.tsx` 1,511 行）を部品フォルダの規約に沿って分割し、純粋な判断の `.ts` を整理する。Dependencies: src-lib-ui-boundary
- [x] src-duplicates -- X の文字数換算 2 実装、`jsonResponse` 系 4 箇所、2 桁ゼロ埋め 2 箇所、share の責務（5 フォルダ）、`env` 系モジュール 8 件を 1 箇所ずつに統合する。Dependencies: src-pages-thin, src-lib-ui-boundary
- [x] src-folder-layout -- 部品フォルダ外の 13 ファイルを所有する部品のフォルダへ移す（`layout/nav/` を含む）。サンプル画面 `pages/samples/choice-question.astro` と `ChoiceQuestionSample` を削除する。デッドコード `PaginationModeSelect` と `dead.md` を削除する。`guestDummyPosts.ts` をデータと判断に分割する。steering の領域の登録を整える。Dependencies: src-composer-split, src-duplicates
- [x] src-import-style -- 深い相対 import（`../` 3 段以上 39 件、すべて `lib/api/schema`）と相対 import の混在、`.js` 拡張子の混在を `@/` に統一する。Dependencies: src-folder-layout, src-pages-thin（タスク完了 0750ebc。ロードマップの更新は 2026-11-03）

### 論点の決定（2026-11-01）

- **スキーマの表記**: `lib/api/schema/` のフォルダ名を `pages/` と同じ `[param]` 形式に改名する（`_id`→`[id]`、`_did`→`[did]`、`_surveyId`→`[surveyId]`、`_index`→`[index]`、`_dbIndex`→`[dbIndex]`、`_dbKey`→`[dbKey]`）。API の経路は `schema/index.ts` の文字列で決まるため、`npm run apigen` の出力に差分が出ないことを完了条件にする（`src-import-style`）。
- **サンプル画面**: `pages/samples/choice-question.astro` と `ChoiceQuestionSample` を削除する。`pages/entries/sample.astro` は、ゲストモードの「Entryを開く」の遷移先のため残す。`docs/features/choice-question` は存在しないため、参照を消す（`src-folder-layout`）。
- **デッドコード**: `PaginationModeSelect` と `components/dead.md` を削除する。経緯は git 履歴に任せ、コードには残さない（`src-folder-layout`）。
- **部品フォルダ外の 13 ファイル**: 所有する部品のフォルダへ移す。`layout/nav/` は部品フォルダにまとめる。render テストの import を更新する（`src-folder-layout`）。
- **`guestDummyPosts.ts`**: ダミーのデータを `lib/timeline/guest/` へ移し、判断の関数（`resolveGuestDeleteScope` など）は既存の `lib/guestMode.ts` へ移す（`src-folder-layout`）。

### 訂正（2026-11-01 の分析の誤り）

- `ComponentList` は汎用のリスト部品で、カタログ画面ではない（11 ファイルが利用）。717 行の大半はページングと無限スクロールの処理。分割は `src-composer-split` か `src-folder-layout` の design で決める。
- 規約違反は 16 件ではなく、部品フォルダ外の 13 件（うち `layout/nav/` の共有の処理 4 件は例外）。部品フォルダ内の `camelCase.ts` は steering の規約どおり。単一ファイルの部品フォルダ 15 件も違反ではない。
- サンプルページのコメントが指す e2e（`entryThreadDetail.spec.ts` など）は存在しない。コメントは実態に合わせて直す。

## Phase 3 追補（2026-11-01 discovery: ThreadComposer の構成）

### Approach Decision

- **Chosen**: 部品は 1 部品 1 フォルダのまま保ち、ThreadComposer の直下に混ざったフック・判断の `.ts` を `hooks/`・`rules/` の子フォルダにまとめる（案 C）
- **Why**: 直下の 12 ファイルと、2 ファイルだけの子フォルダ 4 つは、読み手にとって見通しが悪い。部品の単位は保ちつつ、ファイルの役割をフォルダ名で示す
- **Rejected alternatives**: 案 B（部品フォルダも役割の子フォルダにまとめる）は、部品の規約と衝突する。案 A（全部を直下に平らに置く）は直下が 20 件を超える

### Existing Spec Updates

- [x] src-folder-layout -- 本追補の規約（`ThreadComposer` の `hooks/`・`rules/`）を、部品フォルダ全体の原則として広げるかを判断する。Dependencies: src-composer-layout（決着: Phase 4 追補の src-component-nesting で扱い、実装・検証済み）

### New Specs

- [x] src-composer-layout -- `ThreadComposer/` のフックを `hooks/`、判断の `.ts` を `rules/` に移し、steering の部品の規約を改訂する。Dependencies: src-composer-split（実装完了）

## Phase 4 追補（2026-11-03 discovery: 部品の入れ子と common の分類）

### Existing Spec Updates

- [x] src-folder-layout -- Phase 3 追補の未決の項目（`hooks/`・`rules/` の規約を部品フォルダ全体へ広げるか）は、本 Phase の `src-component-nesting` で決める。Dependencies: src-composer-layout（決着: src-component-nesting で扱い、実装・検証済み）

### New Specs

- [x] src-component-nesting -- 利用元の内側に部品を置く規則（部品 P の利用元がすべて H の中にあれば H の子フォルダへ）を steering に定め、部品 37 件を入れ子にする。`common/` を役割の分類（dialog・select・input・list・media・section）に分け、Spinner を Loading に統合し、SettingsDialog を削除する。Dependencies: src-folder-layout, src-composer-layout（実装・検証済み。コミット 4e52886）
