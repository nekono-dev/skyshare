# lexicon NSID の可変化 タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

本機能に UI の追加・変更はなく、Playwright での確認対象は無い。

## Phase 1: NSID モジュールと単体テスト

- [x] `src/lib/atproto/nsid.ts` を新設し、設計 2.1・2.2 の導出・`entryAtUri`・`parseEntryAtUri` を実装する。
- [x] `tests/lib/atproto/nsid.test.ts` を設計 5.1 のとおり作成する。
- [x] テスト: `npx vitest run tests/lib/atproto/nsid.test.ts` が成功する。`entry.json` を2つ置いた場合・`id` が `.entry` で終わらない場合に例外となることを一時的な差し替えで確認する。

## Phase 2: アプリケーションコードの置換

- [x] `ENTRY_COLLECTION` の定義を `src/lib/entry/entry.ts` から削除し、全 import 元を `@/lib/atproto/nsid` へ変更する（`src/pages/v2/entries.ts`・`src/pages/v2/entry.ts`・`src/pages/v2/entries/skyshare.ts`・`src/pages/entries/[slug].astro`・`src/lib/entry/skyshareRecord.ts` ほか）。
- [x] `parseSourceLocator` の `at://` 解析を `parseEntryAtUri` に置き換える。
- [x] `skyshareRecord.ts`・`createBskyThread.ts` の NSID リテラルを `ENTRY_COLLECTION` / `MANIFEST_TYPE` に置き換える。
- [x] `guestDummyPosts.ts` の URI を `entryAtUri` に置き換える。
- [x] `put.ts`・`delete.ts` の説明文から NSID を除き（設計 3）、`npm run apigen` で `openapi/` と `src/client/openapi/client.ts` を再生成する。
- [x] `tests/lib/atproto/nsidLiteral.test.ts` を設計 5.2 のとおり作成する。
- [x] テスト: `npx tsc --noEmit` と `npx vitest run` が成功し、`nsidLiteral.test.ts` が成功する（テストコード側のリテラルは Phase 3 で置換するため、このテストは `src/` のみを対象にする）。

## Phase 3: 既存テストの置換

- [x] `tests/pages/v2/**`・`tests/lib/atproto/repo.test.ts` の NSID リテラルを `ENTRY_COLLECTION` / `entryAtUri` に置き換える（設計 5.3）。
- [x] テスト: `npx vitest run` が全件成功し、置換前と成功件数が変わらない。

## Phase 4: コード生成手順と手順書

- [x] `src/client/atproto/` に手書きファイルが無いことを `git status`・差分で確認する。
- [x] `hack/gen-client.sh` を設計 4 のとおり改修する。（後に廃止。下記 Phase 6）
- [x] `lexicons/README.md` に設計 6 のドメイン変更手順を追記する。
- [x] テスト: `npm run lexgen` を実行し、生成物が現行 NSID のまま再現される（差分が出ない、または機械的な差分のみ）ことを確認する。`entry.json` が0個・複数個の場合にスクリプトがエラー終了することを確認する。

## Phase 5: 別ドメインでの受け入れ確認

- [x] 作業ディレクトリにリポジトリのコピーを作り、設計 6 の手順 1〜3 で別ドメイン（例: `com.example.myapp`）に変更する。
- [x] コピー上で `npm run lexgen`・`npx tsc --noEmit`・`npx vitest run`・`npx astro build`（`_legacy` のビルドは NSID と無関係のため除く）を実行し、アプリケーションコードの編集なしで全て成功することを確認する。
- [x] 旧 NSID のディレクトリが `src/client/atproto/types/` に残存しないことを確認する。
- [x] テスト: 上記の実行結果をもって受け入れ条件を満たすことを確認する。確認用コピーは削除する。

## Phase 6: クライアント生成の廃止と lexicon 検証テスト

- [x] `hack/gen-client.sh` と `npm run lexgen` を廃止し、`codegen` から外す。
- [x] `@atproto/lexicon` を devDependencies に追加する。
- [x] `tests/lexicons/lexicons.test.ts` を設計 4 のとおり作成する。
- [x] `lexicons/README.md`・`openapi/README.md`・`src/client/README.md` を更新する。
- [x] `hack/lint-lexicon.sh`（`npm run lint:lexicon`）を追加し、CI の verify ジョブに goat の導入と実行を加える。
- [x] テスト: クリーンな clone で `npm run codegen`・`npx tsc --noEmit`・`npx vitest run` が成功し、lexicon を壊した場合（`$ref` 不正・`id` 不一致）に `tests/lexicons` が失敗することを確認する。
