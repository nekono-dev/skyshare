# Skyshare独自lexicon タスク一覧

## Phase 1: レコード定義

- 対応: D-1
- [x] T-1.1: `entry.json` と `defs.json` を定義し、`goat lex publish` で公開する。
- [ ] T-1.2: 投稿以外を指す派生元・代表画像の欠落・見出しと説明文の省略のテストを追加する。
- [ ] T-1.3: 公開済みのlexiconと比べて既存フィールドが変わっていないことを確認するテストを追加する。
- 検証: `npm run lint:lexicon`

## Phase 2: NSIDの導出と利用

- 対応: D-2, D-3
- [x] T-2.1: `nsid.ts` を実装し、NSIDの直書きを置き換える。
- [x] T-2.2: 導出・異常系・URIの単体テストを受け入れ条件のタグ付きで追加する。
- [ ] T-2.3: 別ドメインのNSIDに変えたコピーで型検査・単体テスト・ビルドを行うテストを追加する。
- [ ] T-2.4: NSIDの導出が実行時にファイルを読まないことを確認するテストを追加する。
- 検証: `npx vitest run tests/lib/atproto/nsid.test.ts`

## Phase 3: 検証

- 対応: D-4
- [x] T-3.1: lexicon定義の検証テストとNSIDの直書き検出テストを追加する。
- 検証: `npx vitest run tests/lexicons/lexicons.test.ts tests/lib/atproto/nsidLiteral.test.ts`
