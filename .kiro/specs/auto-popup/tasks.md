# Implementation Plan

- [x] 1. プルダウン
- [x] 1.1 `AutoPopupTargetSelect` を実装する。
  - _Requirements: 1.1, 1.2_
- [x] 1.2 選択肢4つとプルダウンの横幅の変化を確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/intentShare.spec.ts` 投稿フォームでポップアップを開く設定をONにしてプルダウンを開く → 4つの選択肢が表示され、選択に応じて横幅が変わる
  - _Requirements: 1.1, 1.2_

- [x] 2. 共有の分岐
- [x] 2.1 `shareDispatch.ts` に `runShareDispatch` を実装する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_
- [x] 2.2 全分岐の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/components/post/ThreadComposer/shareDispatch.test.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

- [x] 3. 事前オープンと結果の反映
- [x] 3.1 `openIntentPopup.ts` に事前オープンと遷移を実装する。
  - _Requirements: 2.5_
- [x] 3.2 `ThreadComposer` で事前オープンと分岐結果の反映を行う。
  - _Requirements: 2.5_
- [x] 3.3 事前に開いたウィンドウが投稿完了後に共有先へ遷移することを確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/intentShare.spec.ts` 選択値をタイッツーにして投稿する → 事前に開いたウィンドウがタイッツーの投稿画面へ遷移する
  - _Requirements: 2.5_
