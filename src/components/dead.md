# 概要

このmarkdownは、実装を検討されたが最終的には実装を見送られ、参照先がなくなったデッドコードを示すメモである。
メモは以下のようなフォーマットで記載すること。

````md
# <コンポーネント名>

- 概要: <コンポーネントの概要が記載される>
- 依存関係
  - <コンポーネントの実行に必要な、他のコンポーネントの名前>
    - <他コンポーネントが本コンポーネントと持つ関係、依存理由の記述>
  - ...
- 設置方法
  ```ts
  <コンポーネントの配置方法が、実際のソースコードを例に記載される>
  ```
- 必要な設定値等
  - <コンポーネントが必要とする設定値などが記載される>
````

# PaginationModeSelect

- 概要: タイムライン/Entry一覧のページ送り方式（自動読み込み/ページ送り）を切り替えるプルダウン。`Timeline`・`EntryList` から選択UIとしての参照が削除され、現在どこからも import されていない完全なデッドコード。
- 依存関係
  - `PaginationMode`（`src/lib/settings/timelineSettings.ts`）
    - 選択肢の型定義として依存。型自体は本コンポーネントのために `timelineSettings.ts` に残置されている。
- 設置方法
  ```ts
  import PaginationModeSelect from "@/components/PaginationModeSelect"
  import {
    readPaginationModeSetting,
    writePaginationModeSetting,
  } from "@/lib/settings/timelineSettings"

  const [paginationMode, setPaginationMode] = useState(() =>
    readPaginationModeSetting("infinite"),
  )

  <PaginationModeSelect
    value={paginationMode}
    onChange={next => {
      setPaginationMode(next)
      writePaginationModeSetting(next)
    }}
  />
  ```
- 必要な設定値等
  - `readPaginationModeSetting` / `writePaginationModeSetting`（`src/lib/settings/timelineSettings.ts`）: localStorage キー `timelinePaginationMode` の読み書き関数。現在はコメントアウトされており未使用。

# 手動ページネーション（ページ送り方式一式）

- 概要: `PaginationMode === "paged"` のときに有効化されていた、前へ/次へボタンによる手動ページ送り一式。`Timeline`・`EntryList` では `paginationMode` が `"infinite"` に固定されたため、以下の呼び出しはすべて到達不能な分岐として残置されている。
- 依存関係
  - `useCursorPaginationController`（`src/components/ComponentList/index.tsx`）
    - cursor履歴・前後移動状態を管理するフック。`Timeline`/`EntryList` から `enabled: paginationMode === "paged"` として呼び出されているが、`paginationMode` が常に `"infinite"` のため実質常時 disabled。
  - `PageSizeSelect`（`src/components/PageSizeSelect`）
    - 1ページあたり表示件数選択UI。`Timeline`/`EntryList` 内では `isPaged` 分岐内にのみ描画されるため到達不能。コンポーネント自体は汎用UIで、他用途への再利用は可能。
  - `NavigationBar`（`src/components/NavigationBar`）
    - 前へ/次へボタンのUI。`Timeline`/`EntryList` の `isPaged` 分岐で使用されているが到達不能。**ただしコンポーネント全体としては現役**で、`DraftListPanel`（下書き一覧）では無条件に使用されている。デッドなのは `Timeline`/`EntryList` 内での「ページ送り方式」用途のみ。
- 設置方法
  ```ts
  const paginationMode = "infinite" as PaginationMode // 従来は選択UI/設定値から取得していた

  const pagedController = useCursorPaginationController<T>({
    cursorPagination: {
      pageSize,
      fetchPage,
      enabled: paginationMode === "paged",
      loadingText: "読み込み中...",
      emptyText: "初期化中...",
    },
  })

  const isPaged = paginationMode === "paged"

  {isPaged ? (
    <PageSizeSelect
      value={pageSize}
      onChange={next => {
        setPageSize(next)
        writePageSizeSetting(next)
      }}
      ariaLabel="表示件数"
    />
  ) : (
    <span aria-hidden="true" />
  )}

  {isPaged ? (
    <NavigationBar
      pagination={pagedController.pagination}
      ariaLabel="post timeline pagination"
    />
  ) : null}
  ```
- 必要な設定値等
  - `paginationMode` が `"paged"` になる経路（`PaginationModeSelect` での選択、または `readPaginationModeSetting` による永続化値の復元）。現在はいずれも無効化されているため到達不可能。
  - `pageSize` 自体の設定（`readPageSizeSetting`/`writePageSizeSetting`）は無限スクロールとは無関係に生きているが、表示先（`PageSizeSelect`）が到達不能なため実質未使用。
