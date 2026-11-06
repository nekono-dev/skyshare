# 調査ログと設計判断

## Summary

- **Feature**: `src-composer-split`
- **Discovery Scope**: Extension（既存の `components/composer/ThreadComposer/` の内部構造の整理）
- **Key Findings**:
  - `ThreadComposer/index.tsx`（1,511 行）は、`forwardRef` の 1 つの関数（223〜1073 行目）と JSX（1074〜1510 行目）からなる。state は 30 を超え、ハンドラーは下書き・予約・送信に分かれるが、どれも同じ state と ref を読み書きする。
  - 判断の `.ts` 4 件（`segments.ts`・`submitThread.ts`・`shareDispatch.ts`・`suggestHashtags.ts`）は React を import していない。ただし `segments.ts` と `shareDispatch.ts` は、型だけを `components/image`・`components/video`・`lib/video` から import している（型のみ）。
  - **テストの空白**: 区切り・提出の組み立て・候補・共有の分岐の単体テストは無い。composer を通る e2e は 2 件（`thread-posting`（単一の投稿）と `schedule`）だけで、複数区切り・画像・候補・共有の分岐は、どのテストも通らない。
  - 参照元は 3 件（`PostLauncher`・`PostPage`・`Timeline`）。`ThreadComposerHandle` と `Props` の形を変えなければ、参照元の変更は要らない。
  - 許容リスト（`uiInLib`・`layer`・`cycle` を含む）に composer の項目は無い。

## Research Log

### index.tsx の内部の区分

- **Context**: 分割の境界を決める。
- **Findings**（行番号は現行）:
  - 1〜222: import、`Props`・`ThreadComposerHandle`・`LoadedDraft` の型、`recordUsedHashtagsToHistory`。
  - 223〜390: 状態の宣言（言語・区切り・ポスト設定・予約の状態・下書きの状態）と初期化の effect。
  - 391〜410: 派生値（`rootSegment`・`hasTextInput`・`isThread`）。
  - 411〜688: 下書きの選択・適用・保存・破棄、閉じる・離脱の確認（`requestNavigation`・`requestClose`）。
  - 689〜860: 予約の取り消し・日時の変更・予約の適用、区切りの追加・削除、送信可否の派生値。
  - 861〜1073: 予約の送信（`handleScheduleSubmit`）と投稿の送信（`handleSubmit`）。
  - 1074〜1510: JSX。下書き一覧・予約一覧・確認・認証・共有のダイアログ（1077〜1260、1501）、本文の入力と区切りの並び（1262〜1395）、投稿の操作（1396〜1415）、オプションのトグル（1416〜1490）。
- **Implications**: 4 つの責務（下書き・予約・送信・描画の一部）に分けられる。送信と予約は、同じ区切りと同じ `setStatus` を使うため、同じフックの中で扱う。

### 判断の `.ts` の React 依存

- **Context**: 要件 3.2（判断の `.ts` は React を import しない）。
- **Findings**: `segments.ts`・`submitThread.ts`・`shareDispatch.ts`・`suggestHashtags.ts` は、`react` を import していない。型のみの import は次の 3 種。`components/image/ImagePicker`（`ImageEntry`）・`components/image/OgpFetchButton`（`OgpResult`）・`components/image/...`（`SlotCropState` は `lib/image/postImageProcessing` から）・`lib/video/videoUploader`。
- **Implications**: 要件 3.2 は、既存の 4 件で満たされている。新しく作る判断の `.ts` にも同じ規則を課す。型だけの import は `components/` の内側（同じ領域内、または `components/` の他の領域）に限り、判断の `.ts` から `index.tsx` や部品の `index.tsx` を import しない。

### 作業の順序と検査

- **Context**: テストが無いまま分割すると、振る舞いの変化を検出できない。
- **Findings**: `lib-ui-boundary` と同じく、移動の前に特性化テストを用意する。`tests/component/support/harness-dom.test.tsx` の harness（happy-dom）が使える。
- **Implications**: 単体テスト（判断の `.ts`）と、component テスト（`ThreadComposer` の描画・区切りの追加と削除）を、分割の前に通す。分割の後は、同じテストの期待値を変えない。

## Architecture Pattern Evaluation

| Option                                    | Description                                               | Strengths                                                               | Risks / Limitations                                              | Notes                 |
| ----------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------- |
| A. 責務ごとのフックと部品に分ける（採用） | 下書き・予約・送信のフック、オプションとダイアログの部品  | `index.tsx` が配線と並びだけになる。既存の判断の `.ts` を変えずに使える | フックへの引数が多い（state と setter を渡す）                   | 要件 1・3 に対応      |
| B. JSX だけ分ける                         | 描画の部品だけを切り出し、ハンドラーは `index.tsx` に残す | 変更が少ない                                                            | `index.tsx` が 750 行以下にならない（ハンドラーだけで約 660 行） | 要件 3.1 を満たさない |
| C. 状態を `useReducer` に集約する         | 30 を超える state を 1 つの reducer に寄せる              | 状態遷移が一箇所になる                                                  | 振る舞いの変化の危険が大きい。特性化テストが無い段階では採らない | 不採用（将来の論点）  |

## Design Decisions

### Decision: フックは、引数の型を明示した params オブジェクトで受け取り、JSX を返さない

- **Context**: 要件 1（振る舞いの不変）と 3.2（判断の分離）。
- **Selected Approach**: `useDraftFlow(params)`・`useScheduleFlow(params)`・`useThreadSubmit(params)` は、必要な state の値と setter を `params` で受け取り、ハンドラーと派生値を返す。params の型は、各フックのファイルで `type` として定義する（`any` は使わない）。
- **Rationale**: 同じ setter を渡すので、state の所有者は変わらない。JSX を返さないので、描画の差分は部品の側だけに出る。
- **Trade-offs**: 引数が多い（10 個前後）。これは `index.tsx` の配線の行数として残る。

### Decision: 状態の所有者は、移動の前と同じにする

- **Context**: 振る舞いの変化を避ける。
- **Selected Approach**:
  - `index.tsx` が持つ state: 言語（`languageCode`）・区切り（`segments`・`activeIndex`）・状態の表示（`status`・`statusColor`）・共有の要求（`shareRequest`）・固定表示の設定（`pinnedFormDisabled`・`timelineHidden`）・投稿の設定（`syncGateDefaultAfterPost`）・ハッシュタグ候補（`hashtagSuggestEnabled`・`mentionSuggestEnabled`）・`formRef`・`entryFormRef`。
  - `useDraftFlow.ts` が持つ state: 下書きの一覧（`draftModalOpen`・`draftItems`・`draftListLoading`・`draftListError`）・読み込んだ下書き（`loadedDraft`）・保存の確認（`draftSaveConfirmOpen`・`isSavingDraft`）・離脱の保留（`pendingNavigation`）・`requestNavigationRef`・`hasUnsavedRef`。
  - `useScheduleFlow.ts` が持つ state: 予約の状態（`scheduleMode`・`runAtPickerOpen`・`pendingCount`・`scheduleLoading`）・予約の編集選択（`editChoiceOpen`・`editChoiceBusy`）・再認証（`reauthOpen`）・`restoredFailedId`。
  - `useThreadSubmit.ts` が持つ state: 送信中（`isSubmitting`）と `submittingRef`。
- **Rationale**: 共有する state（`status`・`segments`）は `index.tsx` に残し、フックは setter を受け取るだけにする。所有の境界が、フックの名前と一致する。

### Decision: 部品は 2 つだけ作り、入力行（`ThreadSegmentForm`）と本文（`PostBodyEditor`）は変えない

- **Context**: 要件 3.4（描画の部品）と、このスペックの範囲。
- **Selected Approach**:
  - `ComposerOptions/index.tsx`（投稿のオプションのトグル群）と、その `index.module.css`（`auto-popup-target-row` のクラスを移す）。
  - `ComposerDialogs/index.tsx`（下書き一覧・予約一覧・確認・認証・共有のダイアログ）。
  - `ThreadSegmentForm`（688 行）と `PostBodyEditor`（379 行）は、この spec では変えない（別の論点として残す）。
- **Rationale**: 状態を持たない描画の塊を切り出すと、振る舞いの差分が出にくい。入力行は `ThreadSegmentForm` が既に部品として独立している。

### Decision: `index.tsx` の行数の上限は 750 行とする（改定）

- **Context**: 要件 3.1（750 行以下）。当初は 500 行としたが、見積もりが誤りだった。
- **Finding**: 2.1 の完了時点で `index.tsx` は 1,253 行。残りの移動（予約のフック・送信のフック・オプションとダイアログの部品）で約 750 行になる。予約の取り消しと適用は、下書きの閉じる処理と相互に依存するため、フックへ移すと循環する。
- **Decision（追補）**: 利用者の承認により、ダイアログ群だけを部品に移し、上限を 750 行に改める。フォーム本体（本文の入力行とツールバー、約 215 行）は投稿フォームの本体に残す（約 35 個の props を要するため）。

## Risks & Mitigations

- **状態の所有者の取り違え（stale closure）**: 離脱の確認は `requestNavigationRef` と `hasUnsavedRef` で、最新の関数を読む。移動の際も、ref の読み書きの順序を変えない。
- **effect の順序の変化**: 同じ effect を同じ順序で、フックの中に移す。特性化テストで、下書きの読み込みと予約の状態の初期化を確かめる。
- **テストの空白**: 単体テスト（判断の `.ts`）と component テスト（描画と区切り）を、分割の前に追加する。複数区切りの提出は、単体テスト（`buildThreadRequestBody`）で固定する。
- **循環 import**: フックと部品は `index.tsx` を import しない。`npm run test:imports` の cycle 規則で検出する。

## References

- `.kiro/steering/structure.md`（「部品」の規約、「依存規則の検査」）
- `.kiro/specs/src-composer-split/requirements.md`
- `.kiro/specs/src-lib-ui-boundary/design.md`（特性化テストを先に置く方式）
