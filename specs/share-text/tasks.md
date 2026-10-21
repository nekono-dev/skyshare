# 共有文の組み立てと省略 タスク一覧

## Phase 1: 文字数と省略

- 対応: D-1, D-2
- [x] T-1.1: `intentLength.ts` に宛先別の文字数関数を実装する。
- [x] T-1.2: `truncateText.ts` に `truncateBodyWithSuffix` を実装する。
- [x] T-1.3: 文字数と省略の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/util/share/intentLength.test.ts tests/util/share/truncateText.test.ts`

## Phase 2: 共有文の組み立て

- 対応: D-3
- [x] T-2.1: `intent.ts` に `buildIntentSuffix`・`buildIntentText`・`resolveTruncateLimit` を実装する。
- [x] T-2.2: 組み立てと省略上限の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/util/share/intent.test.ts`
