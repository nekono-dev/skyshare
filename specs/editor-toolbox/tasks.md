# EditorToolbox タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

凡例: `[FE]` フロントエンド / `[TEST]` テスト

本タスク一覧は `specs/creator-mode` の実装に先行して完了させる（creator-modeのタスク一覧はEditorToolboxが実装済みであることを前提としている）。

## Phase 1: 状態遷移ロジックの実装

- [ ] `[FE]` `src/components/common/EditorToolbox/toolboxReducer.ts`: `ToolboxState`/`ToolboxAction`/`toolboxReducer`/`initialToolboxState` を実装する。
- [ ] `[TEST]` `tests/components/common/EditorToolbox/toolboxReducer.test.ts`: `TOGGLE_PANEL`（同一ツール再押下で閉じる、別ツール押下で切り替わる）、`CLOSE`（常に閉じる）の分岐を網羅する。

## Phase 2: 型定義・本体コンポーネントの実装

依存: Phase 1

- [ ] `[FE]` `src/components/common/EditorToolbox/index.tsx`: `EditorToolboxPanelTool`/`EditorToolboxActionTool`/`EditorToolboxTool` 型を定義する。
- [ ] `[FE]` ボタン列のレンダリング（`role="toolbar"`、`tools` の順序通り表示、`disabled` の反映）を実装する。
- [ ] `[FE]` 即時実行型ツール（`kind: "action"`）のクリックハンドリング（`onClick` 直接呼び出し、`isActive` による `aria-pressed` 表示）を実装する。
- [ ] `[FE]` パネル型ツール（`kind: "panel"`）のクリックハンドリング（`toolboxReducer` 経由での開閉切り替え）を実装する。
- [ ] `[FE]` `index.module.css`: ボタン列のスタイル（`display: flex; flex-wrap: wrap` による折り返しレイアウト）を実装する。

## Phase 3: パネル表示（FloatingBox連携）

依存: Phase 2

- [ ] `[FE]` 既存の `src/components/common/FloatingBox` のAPI（`open`/`position`/`onDismiss`/`children`等）を確認し、パネル内部要素への `ref` 取得方法（外側クリック判定に必要）を決定する。ref取得の口が無い場合は `FloatingBox` へ軽微なAPI追加（例: `panelRef` prop）を行う。
- [ ] `[FE]` パネル型ツールのボタン押下時、`button.getBoundingClientRect()` から `FloatingBox` へ渡すアンカー位置を算出する処理を実装する。
- [ ] `[FE]` 開いているパネルを `FloatingBox` 経由で描画し、`renderPanel({ close })` の戻り値を中身として渡す。
- [ ] `[FE]` パネル外側クリック（`pointerdown`）でパネルを閉じる処理を実装する（ツールボタン自身のクリックは既存のtoggleロジックと二重発火しないようにガードする）。
- [ ] `[FE]` Escapeキー押下でパネルを閉じる処理を実装する。
- [ ] 手動確認: パネルを開いた状態で別のツールボタンを押すと前のパネルが閉じて新しいパネルが開くこと、外側クリック・Escapeで閉じること、スクロール/ウィンドウリサイズで閉じること（`FloatingBox`の既定挙動）を確認する。

## Phase 4: アクセシビリティ・キーボード操作

依存: Phase 3

- [ ] `[FE]` roving tabindexパターン（フォーカス中のボタンのみ`tabIndex=0`、他は`-1`）を実装する。
- [ ] `[FE]` 左右矢印キーでの隣接ボタンへのフォーカス移動（`disabled`なボタンをスキップ）を実装する。
- [ ] `[FE]` パネルを閉じた際、そのパネルを開いていたボタンへフォーカスを戻す処理を実装する。
- [ ] `[FE]` `aria-expanded`（パネル型）、`aria-haspopup="dialog"`（パネル型）、`aria-pressed`（即時実行型でisActive指定時）を実装する。
- [ ] 手動確認: キーボードのみで全ボタンへの到達・操作ができること、スクリーンリーダー（VoiceOver等）でボタンの状態が読み上げられることを確認する。

## Phase 5: 統合確認

依存: Phase 1〜4

- [ ] ダミーのパネル型ツール（簡易な入力フォーム）・即時実行型ツール（トグルボタン）を仮実装し、EditorToolbox単体での動作を確認する（`specs/creator-mode`側の実装が始まる前に、EditorToolbox単体としての完成度を検証する）。
- [ ] 4〜8個程度のツールを登録し、狭い画面幅（モバイル幅を想定）で折り返し表示され、ボタンが画面外にはみ出さないことを確認する。
- [ ] `npx vitest run` で `toolboxReducer.test.ts` を含む全体テストがパスすることを確認する。
- [ ] ダミーツールを削除し、`specs/creator-mode` 側からの利用（Phase 2以降のツール定義フックの実装）へ引き渡す。
