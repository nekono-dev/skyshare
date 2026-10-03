# 多言語対応（日本語・英語） タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

凡例: `[FE]` フロントエンド / `[BE]` バックエンド / `[TEST]` テスト / `[DOC]` ドキュメント

各Phaseの共通完了条件: `npx tsc --noEmit` と `npm test`（vitest）が通る。UIに関わるPhaseは Playwright の確認を完了条件に含める。

## Phase 0: E2E前提の固定

- [x] `[TEST]` `playwright.config.ts` の `use` に `locale: "ja-JP"` を設定し、既存E2Eが日本語環境で動くようにする（design.md §14）。
- [x] 検証: `npm run test:e2e` の既存spec全件が、変更前と同じ結果で通る。

## Phase 1: 翻訳エンジン（純粋関数）

- [x] `[FE]` `src/lib/i18n/locale.ts`（`LOCALES`/`Locale`/`isLocale`/`parseAcceptLanguage`/`pickLocaleFromLanguages`/`resolveLocale`）を新設する（§3）。
- [x] `[FE]` `src/lib/i18n/localeSetting.ts`（localStorage の読み取り・書き込み・削除）を新設する（§4）。
- [x] `[FE]` `src/lib/i18n/messages/ja`・`en` の骨組み（`index.ts` と `common.ts` のみ。代表キー数個）を作る。
- [x] `[FE]` `src/lib/i18n/translate.ts`（`MessageKey`/`MessageParams`/`createTranslator`/`interpolate`/複数形）を新設する（§5）。
- [x] `[FE]` `src/lib/i18n/format.ts`（`formatDateTime`/`formatNumber`）を新設する（§6）。
- [x] `[TEST]` `tests/lib/i18n/{locale,translate,format,messages}.test.ts` と `tests/lib/i18n/types.check.ts`（design.md §14）。
- [x] 検証: 上記テストと `tsc --noEmit` が通る。en の代表キーを1つ消すと `tsc` が失敗することを確認する。

## Phase 2: サーバー側とレイアウト基盤

- [x] `[BE]` `src/lib/i18n/middleware.ts`（`localeMiddleware`）を新設し、`src/middleware.ts` を `sequence(localeMiddleware, refreshBskySession)` に変更、`env.d.ts` の `App.Locals` に `locale` を追加する（§7.1）。
- [x] `[FE]` `Baselayout.astro` の `<html lang>` を `Astro.locals.locale` にし、`pageTitle` を `pageTitleKey` へ変更して全ページの呼び出しを更新する。`Metadatas.astro` の文言も translator 経由にする（§7.2）。
- [x] `[FE]` `src/lib/i18n/store.ts`・`react.ts`・`applyDom.ts` を新設する（§8）。
- [x] `[FE]` `Baselayout.astro` に、初回ペイント前の `lang` 設定、`astro:page-load` での `initLocaleFromBrowser()`、`astro:before-swap` での `lang` コピーを追加する（§8.3）。
- [x] `[FE]` `navItems.ts`・`Sidebar`・`FooterNav` を `MessageKey` ＋ `data-i18n` 属性方式へ移行する（§7.3）。`nav` 辞書を作る。
- [x] 検証: `npm run build` が通り、SSGページのHTMLが言語設定に依存しない。`curl -H 'Accept-Language: en' /entries/<slug>/` の `<html lang>` が `en` になる。
- [x] `[TEST]` Playwright（`tests/e2e/i18n.spec.ts` を新設、`test.use({ locale: "en-US" })`）:
  1. `/entries/` を開く → 初期描画後にサイドバーのナビラベルが英語になり、`<html lang>` が `en`、`document.title` が英語になる。
  2. サイドバーから別ページへ遷移 → 遷移後も `<html lang>` が `en` のまま、ナビが英語のまま。

## Phase 3: 言語設定UI

- [x] `[FE]` `src/components/common/LocaleSelect/`（`index.tsx`、CSSが不要なら作らない）を新設し、`Settings` の表示設定に「表示言語」を追加する（§12）。`settings` 辞書を作る。
- [x] `[FE]` `src/components/common/README.md` に `LocaleSelect` を追記する。
- [x] `[TEST]` Playwright（`tests/e2e/i18n.spec.ts`、`ja-JP` コンテキスト）:
  1. `/settings/` を開く → 日本語で表示され、表示言語のトリガーに「システム設定に従う」が表示される。
  2. トリガーをクリックして「English」を選ぶ → 再読み込みなしで、設定画面の見出し・各設定ラベル・サイドバーが英語になり、`<html lang>` が `en`、localStorage の `uiLocale` が `en` になる。
  3. `page.reload()` → 英語が維持される。
  4. 別ページへ遷移して戻る → 英語が維持される。
  5. 「システム設定に従う」を選ぶ → localStorage の `uiLocale` が削除され、日本語（ブラウザ言語）に戻る。
- [x] 検証: 上記シナリオが通る。

## Phase 3.1: ログイン画面の言語選択

- [x] `[FE]` `LocaleSelect` を設定の読み書きまで行う自己完結の部品に変更し（`Settings` の状態管理を削除）、`login.astro` のフォーム上部（右寄せ）にも同じ部品を配置する（§12）。
- [x] `[TEST]` Playwright（`tests/e2e/i18n.spec.ts`、`ja-JP`）: `/login/` を開く → プルダウンは「システム設定に従う」。「English」を選ぶ → 再読み込みなしで `<html lang>` が `en`、フォームのラベル・ボタンが英語になる。`page.reload()` 後も英語が維持される。
- [x] 検証: 上記が通る。

## Phase 4: UI文言の移行

方針は design.md §9。1サブフェーズごとに、辞書（ja/en）作成・コンポーネント書き換え・`tsc`・既存E2Eの順で進める。ja の辞書値は現行の文言と完全一致させる（NFR-5）。

- [x] `[FE]` 4-1 `common`（Dropdown・LanguageSelect の placeholder・ConfirmDialog・ChoiceDialog・NavigationBar・PageSizeSelect・PaginationModeSelect・ThemeModeSelect・Loading 等）。
- [x] `[FE]` 4-2 `account`（LoginForm・AccountSwitcher・AccountSwitchPanel）。API失敗時の表示は Phase 6 で扱う。
- [x] `[FE]` 4-3 `post`（ThreadComposer 配下・PostGateDialog・PostLauncher・PostCard 系・ThreadCard・Timeline・SelfLabelsSelect・SuggestPopover・SkyshareShareDialog）。`ThreadCard` の返信件数などは `tn()` を使う。
- [x] `[FE]` 4-4 `entry`（EntryCard・EntryList・EntryEditForm・EntryDetailView・Draft 系・Delete 系ダイアログ・LegacyPageDeleteButton の `window.confirm`）。
- [x] `[FE]` 4-5 `image`（ImagePicker・ImageAltDialog・ImageCropDialog・ImageLightbox・OgpFetchButton・OgpPreview・CropSlot）。
- [x] `[FE]` 4-6 `settings` とページ（`Settings`・`SettingList`・`SettingsDialog`・`settings.astro` は Phase 3 で移行済み。残り: `pages/*.astro` のタイトル・見出し・本文・`help.astro`・`login.astro`・`jump.astro`・`accounts.astro`）。
- [x] `[FE]` 4-7 ヘルプ記事: `helpEntries.tsx` を `buildHelpEntries(t)` に変更し、`Help`・`HelpItem` の呼び出しを更新する（§10）。
- [x] `[FE]` 4-8 ゲストダミー: `guestDummyPosts.ts` を translator を受け取る関数へ変更し、呼び出し元を更新する。
- [x] `[FE]` 各 `README.md`（`components/*/README.md`）に i18n の使い方の参照を追記する。
- [x] 検証（各サブフェーズ末）: `tsc --noEmit`、`npm test`、`npm run test:e2e`（既存spec全件、日本語環境）が通る。
- [x] `[TEST]` Playwright（`tests/e2e/i18n.spec.ts`、`en-US` コンテキスト、サブフェーズごとに追加）:
  1. `/post/?guest` を開く → 投稿ボタン・各フォームラベル・placeholder が英語で表示され、日本語の文字（ひらがな・カタカナ・漢字）がページ内のテキスト・`placeholder`・`aria-label` から検出されない（投稿言語の自称表記・ゲストの投稿本文として設定した固有名を除く）。
  2. 本文欄に「hello」と入力し、別タブでの言語設定の変更を再現して（`localStorage` の `uiLocale` を `en` にして `storage` イベントを発火）同一ページ内で言語を切り替える → 本文欄の「hello」が保持され、ラベルが英語に変わる（AC-4）。投稿ページには言語設定のUIが無いため、イベント経由で切り替える。設定画面では、入力中のMastodonドメイン欄の値が言語切り替えで失われないことも確認する。
  3. `/?guest` を開く → ダミー投稿が英語で表示され、スレッドの展開ボタンが返信数に応じて単数形（`Expand thread (1 reply)`）・複数形（`Expand thread (2 replies)`）になる（AC-5）。`/login/`・`/help/` の案内文も英語になる。
  4. `/entries/?guest` を開く → 一覧・削除確認ダイアログ（最終確認を含む）が英語になり、日本語文字が検出されない。下書き一覧ダイアログの英語表示は、自動テストでは確認していない（辞書の整合テストと直書き検出テストでのみ担保）。

## Phase 5: 日時・数値の書式

- [x] `[FE]` `toLocaleString("ja-JP", …)` の6箇所（`PostBody`・`DraftListPanel`・`EntryCard`・`DeletePostListItem`・`entries/[slug].astro`・`entries/sample.astro`）を `formatDateTime` / `useFormat()` に置換する（§6）。`.astro` は `Astro.locals.locale`、React は `useFormat()`。
- [x] `[TEST]` `tests/lib/i18n/format.test.ts` に、置換対象の全 options で ja の出力が従来の `toLocaleString("ja-JP", …)` と一致する検証を含める。
- [x] `[TEST]` Playwright: `/entries/?guest` のEntryカードの作成日時が、`en-US` では英語書式（`Sep 6, 2026`）、`ja-JP` では従来どおりの日本語書式（`2026/09/06`）で表示される。`entries/sample.astro` は SSG で固定されるデモデータのため対象外。
- [x] 検証: 上記が通る。

## Phase 6: APIエラーの統一

- [x] `[BE]` `src/pages/v2/bsky/session.ts` のローカル関数 `errorResponse` を削除し、アカウント数上限を `errorResponseFromStatus(409)` に置き換える（§11）。
- [x] `[BE]` `lib/api/schema/v2/bsky/session/post.ts` の `Common.errorResponses` に `"409"` を追加し、`npm run codegen` で `src/client/openapi` を再生成する。
- [x] `[FE]` `src/lib/i18n/errorMessage.ts`（`errorMessageKeyFromStatus`）を新設し、`messages/*/error.ts` に `error.*` を追加する。
- [x] `[FE]` `LoginForm`・`Timeline` ほか、サーバーの `error` 文字列や固定の日本語メッセージを失敗表示に使っている箇所を、`res.status` からの文言に置き換える。
- [x] `[TEST]` `tests/pages` 配下（既存のAPIテストの置き場）に、アカウント数上限で `409` と `{ error: "Conflict" }` が返ることのテストを追加する。`tests/lib/i18n/errorMessage.test.ts` でステータス→キー対応を検証する。
- [x] `[TEST]` Playwright（`page.route` で `POST /v2/bsky/session` をモックして `409` を返す。`ja-JP` と `en-US` の両方）:
  1. `/login/` で資格情報を入力して送信 → 日本語では「上限に達した」旨、英語では英語の同旨のメッセージが表示される。
  2. 同APIを `500` でモック → 汎用の失敗メッセージが各言語で表示される。
- [x] 検証: 上記が通り、`grep -n "errorResponse(" src/pages` に `errorResponseFromStatus` 以外のヒットが無い。

## Phase 7: ハードコード検出とドキュメント

- [x] `[TEST]` `tests/lib/i18n/noHardcodedText.test.ts` を新設する（§13）。許可一覧を定義し、`src/**/*.{ts,tsx,astro}` を走査する。
- [x] 検証: Phase 4〜6 完了後に通る。コンポーネントへ日本語リテラルを1つ書くと失敗することを一時的に確認し、元に戻す。
- [x] `[DOC]` `DEVELOP.md` に i18n の追加手順（辞書へのキー追加、複数形、`.astro` と React の使い分け、新言語追加手順）を日本語で追記する。`README.md` / `README-jp.md` に表示言語切り替えを追記する。
- [x] 検証（最終）: `npx tsc --noEmit`、`npm test`、`npm run build`、`npm run test:e2e` が全て通り、requirements.md の AC-1〜AC-10 を、対応するテストまたは手動確認で全て確認する。
- [x] 手動確認: スマホ幅（390px）のヘッドレスブラウザで英語表示にし、投稿フォーム・設定・Entry一覧・タイムラインの文字あふれ・横スクロールがないことをスクリーンショットで確認する（NFR-4）。実機での確認は行っていない。
