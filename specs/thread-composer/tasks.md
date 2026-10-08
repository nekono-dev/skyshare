# 投稿フォーム タスク一覧

## Phase 1: セグメントと表示

- 対応: D-1, D-2
- [x] T-1.1: `segments.ts` にセグメントの状態と追加・削除を実装し、単体テストを追加する。
- [x] T-1.2: `ThreadSegmentForm` に編集表示と簡略表示の切り替え・アバターの縦線を実装する。
- [ ] T-1.3: 2件目の画像の投稿とアバターの縦線を確認するE2Eテストを追加する。
- 検証: `npx vitest run tests/components/post/ThreadComposer/segments.test.ts`
- E2E: `tests/e2e/threadComposer.spec.ts` 1件目に画像を添付してセグメントを追加し編集先を切り替える → 1件目に簡略表示とサムネイルが出て、選び直すと本文が残っている

## Phase 2: 送信と下書き

- 対応: D-3, D-4
- [x] T-2.1: `submitThread.ts` でスレッド全体の送信とentryの要求を実装し、単体テストを追加する。
- [x] T-2.2: 下書きの保存と復元をセグメント配列に対応させる。
- [ ] T-2.3: 共有文が先頭のセグメントの本文だけを含むことを確認するテストを追加する。
- 検証: `npx vitest run tests/components/post/ThreadComposer/submitThread.test.ts`

## Phase 3: 設定の配置

- 対応: D-5
- [x] T-3.1: 主トグルと詳細オプションを配置し、初期の開閉を判定する。
- 検証: `npm run build`
- E2E: `tests/e2e/intentShare.spec.ts` 長文を省略して共有をONにして投稿フォームを開く → 詳細オプションが開いた状態で表示される
