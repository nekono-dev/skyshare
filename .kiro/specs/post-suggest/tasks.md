# Implementation Plan

- [x] 1. 契機の判定
- [x] 1.1 `suggestTrigger.ts` に `detectSuggestTrigger` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
- [x] 1.2 契機の判定の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/util/textarea/suggestTrigger.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 候補の取得
- [x] 2.1 `suggest.ts` と `suggestHashtags.ts` を実装する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
- [x] 2.2 取得と合成の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/atproto/suggest.test.ts tests/components/post/ThreadComposer/suggestHashtags.test.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. 履歴と設定
- [x] 3.1 `hashtagHistorySettings.ts` と `suggestSettings.ts` を実装する。
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
- [x] 3.2 履歴と設定の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/settings/hashtagHistorySettings.test.ts tests/lib/settings/suggestSettings.test.ts`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. 候補の一覧
- [x] 4.1 `useSuggest.ts` と `SuggestPopover/index.tsx` を実装し、投稿フォームへ組み込む。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/suggestPopover.spec.ts` 本文へ「#al」を入力する → 候補が表示され、矢印キーで選択が移り、クリックで挿入され、Esc で閉じる
  - _Requirements: 4.1, 4.2_
