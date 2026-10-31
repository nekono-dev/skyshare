# 調査ログと設計判断

## Summary

- **Feature**: `src-lib-ui-boundary`
- **Discovery Scope**: Extension（既存の `lib/` の 6 ファイルを、UI に依存しない形へ直す）
- **Key Findings**:
  - `lib/` の UI 依存は、React のフック（`lib/i18n/react.ts`・`lib/schedule/useScheduleAvailability.ts`・`lib/settings/useShareToggles.ts`）、描画（`lib/i18n/rich.tsx`・`lib/image/croppedImageStyle.ts`）、react-easy-crop の型（`lib/image/croppedImageStyle.ts`・`lib/image/postImageProcessing.ts`）の 3 種。
  - `postImageProcessing.ts` の react-easy-crop への依存は `Area` 型だけである。`Area` は `{ x, y, width, height }` の形で、lib 側に同じ形の型を定義すれば依存を外せる。残りの処理は DOM の canvas を使うが、React には依存しない。
  - `useScheduleAvailability.ts` の通知関数（`notifyScheduleCredentialChange`）と、イベント名（`SCHEDULE_CREDENTIAL_EVENT`）の利用者は、すべて `components/schedule/` にある。`lib/` の他の場所は使っていない。
  - `lib/i18n/react.ts` のフックは約 70 件の部品から使われ、`rich.tsx` は 6 件から使われる。移動の影響は import 文の書き換えに限られる。
  - テストは、これら 6 ファイルを直接参照していない。`postImageProcessing.ts` の純粋な計算（`computeInitialCrop`・`computeCropAroundCenter`・`getSlotDefs`）は、テストで固定されていない。

## Research Log

### 部品フォルダの規約（フックの置き場所）

- **Context**: フックと描画の移動先を決める。
- **Sources Consulted**: `.kiro/steering/structure.md`（「部品（`src/components/<領域>/<Name>/`）」）、既存の `src/components/share/useWebShareCrosspost.ts`。
- **Findings**: 規約は「フックは `useX.ts`」「部品の判断は同じフォルダの `camelCase.ts`」。フォルダの領域は機能の単位で、`share`・`settings`・`schedule`・`image` などがある。`i18n` の領域はまだ無い。
- **Implications**: フックは `components/<領域>/useX.ts` に置く。翻訳の入口は、機能の領域ではなく横断の基盤なので、新しい領域 `i18n` を `components/` に作り、steering の領域の一覧に登録する。

### `postImageProcessing.ts` を分割するか

- **Context**: brief は「計算は `lib/image/` に残し、描画だけを `components/image/` へ移す」と書いている。
- **Alternatives Considered**:
  1. 分割する: 計算（`computeInitialCrop`・`computeCropAroundCenter`・`getSlotDefs`・`compressToByteBudget` など）と canvas の描画を分ける。
  2. 型だけを直す: `Area` を lib 側の型に置き換え、ファイルは動かさない。
- **Selected Approach**: 2。React に依存しない canvas の処理は、UI の依存ではない。`lib/video` と `lib/entry` が使う定数と既定のサムネイルの作成も、このファイルにあるため動かすと消費側の import が増える。
- **Rationale**: 要件 2.1（React と react-easy-crop の import を含まない）を、型の定義の置き換えだけで満たせる。要件 2.3（出力は同じ）の危険も小さい。
- **Trade-offs**: 843 行のファイルは残る。ファイルの大きさは、別の spec（`src-folder-layout` など）で扱う。

### `croppedImageStyle.ts` の置き場所

- **Context**: `computeCroppedImageStyle` は `CSSProperties`（React の型）を返す。
- **Selected Approach**: `components/image/croppedImageStyle.ts` へ移す。戻り値が描画のための値であり、唯一の利用者（`components/image/ImagePicker`）も部品である。
- **Rationale**: lib に残すと、戻り値の型のため React の型が残る。部品の側に置けば、react-easy-crop の `Area` 型も部品の側から使える。

### 通知関数の扱い

- **Context**: `useScheduleAvailability.ts` は、フック、通知関数、イベント名を持つ。
- **Selected Approach**: ファイル全体を `components/schedule/useScheduleAvailability.ts` へ移す。利用者はすべて部品であり、イベント（`window` への通知）は DOM の処理で、lib に残す必要がない。
- **Rationale**: 分けると、通知の利用者（部品）と通知の定義（lib）が分かれ、読み手の負担が増える。

### 翻訳の判断の分離

- **Context**: 要件 1.1（`lib/i18n` は React を import しない）。
- **Findings**: `lib/i18n` の残りのファイル（`format.ts`・`store.ts`・`translate.ts`・`locale.ts` など）は、React を import していない。`react.ts` の役割（`useSyncExternalStore` による購読）は、`store.ts` の `subscribe` と `getLocale` を使うだけで、判断を持たない。
- **Implications**: `react.ts` の全体を `components/i18n/` へ移せば、lib の判断はそのまま残る。

## Architecture Pattern Evaluation

| Option                                       | Description                                     | Strengths                                  | Risks / Limitations                        | Notes                            |
| -------------------------------------------- | ----------------------------------------------- | ------------------------------------------ | ------------------------------------------ | -------------------------------- |
| A. UI 依存のファイルを部品の側へ移す（採用） | フックと描画は `components/`、型は lib 側で定義 | 規約（lib は UI を含まない）に直接対応する | import の書き換えが約 80 件                | 要件 1・3・4 に対応              |
| B. lib に React の薄い入口を残す             | `lib/i18n/react.ts` を残し、判断だけ別に出す    | 消費側の import が変わらない               | lib に React が残り、要件 1.1 を満たさない | 不採用                           |
| C. `postImageProcessing.ts` を分割する       | 計算と描画を別ファイルにする                    | 1 ファイルが小さくなる                     | 消費側の import が増え、スコープが広がる   | 今回は採らない（別 spec の論点） |

## Design Decisions

### Decision: react-easy-crop の `Area` は lib 側で同じ形の型として定義する

- **Context**: 要件 2.1。`lib/image/postImageProcessing.ts` は `Area` 型だけを react-easy-crop から import している。
- **Selected Approach**: `CropArea`（`{ x: number; y: number; width: number; height: number }`）を lib 側で定義し、`postImageProcessing.ts` の `Area` を `CropArea` に置き換える。部品の側（`react-easy-crop` を使う `CropSlot`・`ImagePicker`）は、そのまま `Area` を使う。TypeScript の構造的型付けにより、`Area` の値は `CropArea` として渡せる。
- **Follow-up**: `tests/` の型検査（`npm run test:type`）で、部品から lib への代入が通ることを確かめる。

### Decision: 移動先の領域 `i18n` を components/ に追加する

- **Selected Approach**: `src/components/i18n/` を作る。steering の領域の一覧に `i18n`（表示言語の React の入口）を登録する。
- **Rationale**: 翻訳の入口は 70 件以上の部品から使われ、機能の領域（`share`・`settings` など）には属さない。

## Risks & Mitigations

- **import の書き換えの量（約 80 件）** — 1 回の機械的な置換で行い、型検査と component テストで差分の誤りを検出する。
- **計算の結果が変わる** — 純粋な計算（`computeInitialCrop`・`computeCropAroundCenter`・`getSlotDefs`・`computeCroppedImageStyle`）に、移動の前の特性化テストを足す。
- **許容リストの項目が残る** — 移動の後に `npm run test:imports -- --emit-allowlist` の差分（削除のみ）を確かめてから反映する。
- **描画の変化** — component テスト（6 件）と e2e（7 件）で守る。

## References

- `.kiro/steering/structure.md`（「部品」の規約、「lib の領域の依存の向き」）
- `.kiro/specs/src-lib-ui-boundary/requirements.md`
- `.kiro/specs/src-cycles/design.md`（`lib` の依存の向きの実測）
