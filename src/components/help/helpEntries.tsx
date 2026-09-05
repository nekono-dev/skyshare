/**
 * ヘルプページに表示するFAQ/案内記事の静的データ。
 *
 * 責務と処理概要:
 * - 記事は外部データソースを持たず、この配列に直接追記して管理する。
 * - `description`/`content` は文字列だけでなくJSX(画像・リスト等)も許容し、
 *   コンポーネントをそのまま埋め込める形にしている。
 */
import type { ReactNode } from "react"
import ui from "@/styles/ui.module.css"

/**
 * ヘルプ記事1件分のデータ形状。
 *
 * 想定する入力形状:
 * - `id`: 記事を一意に識別するキー(表示順の変更に影響されない固定値)
 * - `title`: カードの見出し
 * - `description`: 見出し直下に表示する本文
 * - `content`: 本文の下に追加で表示する任意コンテンツ(手順リスト・画像等)
 */
export type HelpEntry = {
  id: string
  title: string
  description: ReactNode
  content?: ReactNode
}

export const helpEntries: HelpEntry[] = [
  {
    id: "android-media-permission",
    title: "画像が選択できない",
    description:
      "アクセス権が拒否されたため、メディアを選択できません」と表示される",
    content: (
      <div className={ui["text-muted"]}>
        ブラウザに写真・動画へのアクセス権限が許可されていない場合に、
        このメッセージが表示されます。
        <ul className={ui.list}>
          <li className={`${ui["list-item"]}`}>端末の「設定」アプリを開く</li>
          <li className={`${ui["list-item"]}`}>
            「アプリ」→ ご利用のブラウザ（Chromeなど）を選択
          </li>
          <li className={`${ui["list-item"]}`}>
            「権限」→「写真と動画」（または「ファイルとメディア」）を許可に変更
          </li>
        </ul>
        アプリとしてインストール（PWA化）している場合も、アプリ化を行なったブラウザ上の設定を修正してください。
      </div>
    ),
  },
]
