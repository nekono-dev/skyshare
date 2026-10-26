# Design Document

## Overview

**Purpose**: アプリのドメインに依存しない小さな処理（オブジェクトの判定、スクロールの固定、画像の読み込み待ち）を、複数の機能が共通で使えるようにする。
**Users**: 複数の機能で共通の小さな処理を使う、skyshare の実装者
**Impact**: アプリのドメインに依存しない処理を `src/util/` に集約し、機能ごとの重複を避ける。

### Goals

- 値がプレーンなオブジェクトかの判定。
- 重なって開くダイアログでも壊れないスクロールの固定。
- 生成直後の画像が読み込めるまでの待機。

### Non-Goals

- ダイアログの描画。
- 画像の生成。

## Boundary Commitments

### This Spec Owns

- 値がプレーンなオブジェクトかの判定。
- 重なって開くダイアログでも壊れないスクロールの固定。
- 生成直後の画像が読み込めるまでの待機。

### Out of Boundary

- ダイアログの描画。
- 画像の生成。

### Allowed Dependencies

- ブラウザの DOM（`document.body`・`Image`）

### Revalidation Triggers

- 各関数の戻り値の契約（判定の基準・失敗の返し方）を変えるとき
- スクロールの固定の要求の数え方を変えるとき（重なって開くダイアログに影響する）

## Architecture

### Architecture Pattern & Boundary Map

- なし

## File Structure Plan

| パス                           | 責務                           |
| ------------------------------ | ------------------------------ |
| `src/util/object.ts`           | オブジェクトの判定             |
| `src/util/scrollLock.ts`       | スクロールの固定の参照カウント |
| `src/util/waitForImageLoad.ts` | 画像の読み込みの待機           |

## Requirements Traceability

| Requirement        | Summary            | Components |
| ------------------ | ------------------ | ---------- |
| 1.1, 1.2           | オブジェクトの判定 | D-1        |
| 2.1, 2.2, 2.3      | スクロールの固定   | D-2        |
| 3.1, 3.2, 3.3, 3.4 | 画像の読み込み待ち | D-3        |

## Components and Interfaces

#### D-1: オブジェクトの判定

**Requirements**: 1.1, 1.2

```ts
export const isObjectRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
```

#### D-2: スクロールの固定

**Requirements**: 2.1, 2.2, 2.3

```ts
let lockCount = 0
export const acquireScrollLock = (): void // 0 → 1 のときだけ位置と body の style を保存し、position: fixed; top: -<scrollY>px にする
export const releaseScrollLock = (): void // 1 → 0 のときだけ style を復元し、保存した位置へ scrollTo する
```

- 固定中は `window.scrollY` が 0 になるため、2 件目以降の要求では位置を保存し直さない。
- `document` が無い環境では何もしない。

#### D-3: 画像の読み込みの待機

**Requirements**: 3.1, 3.2, 3.3, 3.4

```ts
// 既定の上限は 15000 ミリ秒、再試行の間隔は 1000 ミリ秒
export const waitForImageLoad = async (url: string, options: { timeoutMs?: number; intervalMs?: number } = {}): Promise<boolean>
```

| 条件                           | 結果                      |
| ------------------------------ | ------------------------- |
| URLが空、または `Image` が無い | 待たずに `false`          |
| 読み込めた                     | `true`                    |
| 失敗し、次の再試行が上限に届く | `false`（例外は投げない） |
| 失敗し、上限に届かない         | 間隔を空けて再試行する    |

## Error Handling

| 事象                   | 処理                        |
| ---------------------- | --------------------------- |
| 上限までに読み込めない | 例外を投げず `false` を返す |

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/util/object.test.ts tests/util/waitForImageLoad.test.ts`
  - `npx vitest run tests/util/scrollLock.test.ts`
- テストの名前には、対応する基準 ID を `[browser-utils/<ID>]` の形で付ける（例: `[browser-utils/1.1]`）
