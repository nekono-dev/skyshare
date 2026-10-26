# Implementation Plan

- [x] 1. レコードの組み立て
- [x] 1.1 `gate.ts` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_
- [x] 1.2 レコードの組み立ての単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/atproto/gate.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_

- [x] 2. 既定値の保存
- [x] 2.1 `postGateSettings.ts` を実装する。
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
- [x] 2.2 保存と読み取りの単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/settings/postGateSettings.test.ts`
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. ダイアログ
- [x] 3.1 `PostGateDialog/index.tsx` を実装し、設定ページと投稿フォームから使えるようにする。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/postGateDialog.spec.ts` ゲスト表示の設定ページでダイアログを開き、返信不可を選んで適用またはキャンセルする → 適用では既定値が保存され、キャンセルでは保存されない
  - _Requirements: 4.1, 4.2_
