# メンションとハッシュタグの候補 タスク一覧

## Phase 1: 契機の判定

- 対応: D-1
- [x] T-1.1: `suggestTrigger.ts` に `detectSuggestTrigger` を実装する。
- [x] T-1.2: 契機の判定の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/util/textarea/suggestTrigger.test.ts`

## Phase 2: 候補の取得

- 対応: D-2
- [x] T-2.1: `suggest.ts` と `suggestHashtags.ts` を実装する。
- [x] T-2.2: 取得と合成の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/atproto/suggest.test.ts tests/components/post/ThreadComposer/suggestHashtags.test.ts`

## Phase 3: 履歴と設定

- 対応: D-3
- [x] T-3.1: `hashtagHistorySettings.ts` と `suggestSettings.ts` を実装する。
- [x] T-3.2: 履歴と設定の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/settings/hashtagHistorySettings.test.ts tests/lib/settings/suggestSettings.test.ts`

## Phase 4: 候補の一覧

- 対応: D-4
- [x] T-4.1: `useSuggest.ts` と `SuggestPopover/index.tsx` を実装し、投稿フォームへ組み込む。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/suggestPopover.spec.ts` 本文へ「#al」を入力する → 候補が表示され、矢印キーで選択が移り、クリックで挿入され、Esc で閉じる
