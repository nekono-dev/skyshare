# 返信と引用の制限 タスク一覧

## Phase 1: レコードの組み立て

- 対応: D-1
- [x] T-1.1: `gate.ts` を実装する。
- [x] T-1.2: レコードの組み立ての単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/atproto/gate.test.ts`

## Phase 2: 既定値の保存

- 対応: D-2
- [x] T-2.1: `postGateSettings.ts` を実装する。
- [x] T-2.2: 保存と読み取りの単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/settings/postGateSettings.test.ts`

## Phase 3: ダイアログ

- 対応: D-3
- [x] T-3.1: `PostGateDialog/index.tsx` を実装し、設定ページと投稿フォームから使えるようにする。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/postGateDialog.spec.ts` ゲスト表示の設定ページでダイアログを開き、返信不可を選んで適用またはキャンセルする → 適用では既定値が保存され、キャンセルでは保存されない
