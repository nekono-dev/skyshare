# Structure: 依存規則の検査

## 依存規則の検査

`npm run test:imports` が、上の規約を次の規則で検査する（`scripts/architecture/`）。既存の違反は `config/architecture/import-allowlist.json` に、所有 spec 付きで記録する。許容リストに無い違反は失敗になる。

| 規則                | 内容                                                                                                      | 根拠                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| layer               | `lib` → `components`・`pages`、`util` → 上位層の import を禁止する                                        | 依存の向き                                             |
| uiInLib             | `lib` から `react`・`react-*` の import を禁止する                                                        | `lib` は UI に依存しない                               |
| cycle               | 循環 import を禁止する（型だけの import を含む）                                                          | 循環 import は作らない                                 |
| crossRegionRelative | 領域をまたぐ相対 import を禁止する                                                                        | 領域をまたぐ import は `@/`                            |
| relativeDepth       | `../` が 3 段以上の相対 import を禁止する                                                                 | `../` は 3 段未満                                      |
| jsExtension         | 拡張子 `.js` を付けた import を禁止する                                                                   | 拡張子は付けない                                       |
| libLayer            | 基盤の領域から業務の領域への import を禁止する（層の逆流）                                                | `lib` の領域の依存の向き（基盤は業務を import しない） |
| utilShared          | 各 `src/util/` モジュールは、`src/util/` の外の二つ以上の領域から使われること                             | 「共通（`src/util/`・`src/styles/`）」                 |
| typesLeaf           | `src/types/` は `src/types/` の外（`lib`・`components`・`util`・`pages`）と外部パッケージを import しない | 「型（`src/types/`）」                                 |
| typesOnly           | `src/types/` の文は型だけにする（`export type`・`export interface`・`import type` 以外を置かない）        | 「型（`src/types/`）」                                 |

許容リストの各項目は、所有 spec と理由（`reason`）を持つ。理由の無い項目は読み込みエラーにする（`scripts/architecture/allowlist.ts`）。

`utilShared`・`typesLeaf`・`typesOnly` も、上の表の規則として検査する。

規則の根拠は、steering の規約（`structure.md` と `structure-*.md`）だけに限る。規則の追加・変更・緩和は、その規約の改訂と同じ変更で行う。想定の構成（リファクタリングの目標）を理由に規則を変えない。

---

_updated_at: 2026-11-08_
