/**
 * 汎用リスト整列コンポーネント。
 *
 * 責務と処理概要:
 * - `items` 配列を受け取り、各要素ごとに雛形コンポーネントを反復描画する。
 * - 1要素ごとの表示用 props は `getItemProps` で生成し、`item` 本体も併せて渡す。
 * - 既存の投稿内容コンポーネントのような「内容情報を受け取る」UIを簡単に一覧化できる。
 */
import type { ComponentType, Key } from "react"
import styles from "./index.module.css"

type DefaultItemProps = Record<string, unknown>

type ItemComponentProps<TItem, TItemProps extends object> = TItemProps & {
  item: TItem
}

export type ComponentListProps<
  TItem,
  TItemProps extends object = DefaultItemProps,
> = {
  items: TItem[]
  itemComponent: ComponentType<ItemComponentProps<TItem, TItemProps>>
  getItemProps?: (item: TItem, index: number) => TItemProps
  getItemKey?: (item: TItem, index: number) => Key
  className?: string
}

/**
 * リスト要素の key を解決する。
 *
 * Input:
 * - `item`: リストの要素
 * - `index`: 配列内の位置
 * - `getItemKey`: 呼び出し側が指定した key 生成関数
 *
 * Output:
 * - 描画用の key 値
 *
 * 例:
 * - 入力: `{ id: "post-1" }`
 * - 出力: `"post-1"`
 */
const resolveItemKey = <TItem, TItemProps extends object>(
  item: TItem,
  index: number,
  getItemKey?: (item: TItem, index: number) => Key,
) => {
  if (getItemKey) {
    const customKey = getItemKey(item, index)
    if (customKey !== undefined && customKey !== null) {
      return customKey
    }
  }

  const maybeId = (item as { id?: Key }).id
  if (typeof maybeId === "string" || typeof maybeId === "number") {
    return maybeId
  }

  return index
}

/**
 * リスト要素を縦方向に整列して描画する。
 *
 * Input:
 * - `items`: 各要素を持つ配列
 * - `itemComponent`: 1要素を描画する雛形コンポーネント
 * - `getItemProps`: 各要素から渡す props を生成する関数
 * - `getItemKey`: 各要素用の key を生成する関数
 * - `className`: 追加の className
 *
 * Output:
 * - 各要素が整列されたコンテナ
 *
 * 例:
 * - 入力: `items=[{ text, data }, ...]` と `PostContent` コンポーネント
 * - 出力: `PostContent` を各要素ごとに並べた一覧
 */
export const Component = <TItem, TItemProps extends object = DefaultItemProps>({
  items,
  itemComponent: ItemComponent,
  getItemProps,
  getItemKey,
  className,
}: ComponentListProps<TItem, TItemProps>) => {
  const containerClassName = className
    ? `${styles.container} ${className}`
    : styles.container

  return (
    <div className={containerClassName}>
      {items.map((item, index) => {
        const resolvedProps = getItemProps
          ? getItemProps(item, index)
          : ({} as TItemProps)

        return (
          <div
            key={resolveItemKey(item, index, getItemKey)}
            className={styles.item}
          >
            <ItemComponent item={item} {...resolvedProps} />
          </div>
        )
      })}
    </div>
  )
}

export default Component
