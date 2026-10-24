# 投稿フォーム タスク一覧

## Phase 1: セグメントと表示

- 対応: D-1, D-2
- [x] T-1.1: `segments.ts` にセグメントの状態と追加・削除を実装し、単体テストを追加する。
- [x] T-1.2: `ThreadSegmentForm` に編集表示と簡略表示の切り替え・アバターの縦線を実装する。
- [x] T-1.3: 2件目の画像の投稿とアバターの縦線を確認するE2Eテストを追加する。
- 検証: `npx vitest run tests/components/post/ThreadComposer/segments.test.ts`
- E2E: `tests/e2e/threadComposer.spec.ts` 1件目に画像を添付してセグメントを追加し編集先を切り替える → 1件目に簡略表示とサムネイルが出て、選び直すと本文が残っている

## Phase 2: 送信と下書き

- 対応: D-3, D-4
- [x] T-2.1: `submitThread.ts` でスレッド全体の送信とentryの要求を実装し、単体テストを追加する。
- [x] T-2.2: 下書きの保存と復元をセグメント配列に対応させる。
- [x] T-2.3: 共有文が先頭のセグメントの本文だけを含むことと、送信内容の組み立てが予約の操作の可否と本文の一致を満たすことを確認するテストを追加する。
- [x] T-2.4: 予約の状態による送信先とボタンの文言とキャンセルの分岐を `ThreadComposer` に組み込む。
- [x] T-2.5: `segments.ts` に `scheduleDetailToSegments` を実装し、AC-16 の単体テストをタグ付きで追加する。
- [x] T-2.6: 下書きのボタンを下書き・予約に改め、タブで下書きと予約を切り替え、AC-15 のテストを追加する。
- [x] T-2.7: 下書き・予約の画面の背景をスマホ幅で上端に固定し、`DraftListPanel` の読み込み中表示をスピナーに改め、投稿フォーム上部のボタンの文字と余白をスマホ幅で小さくする。
- [x] T-2.8: 受け入れ条件 AC-17 から AC-20 の E2E をタグ付きで追加し、添付の追加操作を別の行に分け、下書き・予約の見出し行の高さを確保する。
- 検証: `npx vitest run tests/components/post/ThreadComposer/submitThread.test.ts tests/components/post/ThreadComposer/segments.test.ts`
- E2E: `tests/e2e/tabButtons.spec.ts` 下書き・予約のボタンを押して予約のタブに切り替える → 下書きのタブが初めに選ばれ、予約のタブで予約の一覧が表示される

## Phase 3: 設定の配置

- 対応: D-5
- [x] T-3.1: 主トグルと詳細オプションを配置し、初期の開閉を判定する。
- [x] T-3.2: ポップアップを開く設定を詳細オプションへ移し、詳細オプションを常に閉じた状態で表示する。
- 検証: `npm run build`
- E2E: `tests/e2e/intentShare.spec.ts` 長文を省略して共有をONにして投稿フォームを開く → 詳細オプションが閉じた状態で表示される
