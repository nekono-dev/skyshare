// @vitest-environment happy-dom
// 投稿フォームの描画と操作（component 層・要件 1.1・1.2・1.4）: 分割の前後で同じ表示と結果になることを固定する
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// 外部の API は、描画の確認に必要な応答（失敗）だけを返す
vi.mock("@/client/openapi/client", () => {
  const failed = async () => ({ status: 404, data: {} })
  return new Proxy(
    {},
    { get: (_target, name) => (name === "then" ? undefined : failed) },
  )
})

import ThreadComposer from "@/components/composer/ThreadComposer"

const ADD_LABEL = "Add to thread"
const REMOVE_LABEL = "Delete this segment"

const bodies = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("[contenteditable]"))

describe("ThreadComposer（投稿フォームの描画と操作）", () => {
  it("初期表示は入力欄が 1 つで、本文が空のとき投稿は無効、先頭の区切りには削除の操作が無い", () => {
    const { container } = render(<ThreadComposer variant="page" />)

    expect(bodies(container)).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Post" })).toHaveProperty(
      "disabled",
      true,
    )
    expect(screen.queryByRole("button", { name: REMOVE_LABEL })).toBeNull()
  })

  it("区切りを追加すると入力欄が増え、編集中でない先頭以外の区切りに削除の操作が出て、削除で減る", () => {
    const { container } = render(<ThreadComposer variant="page" />)

    fireEvent.click(screen.getByRole("button", { name: ADD_LABEL }))
    fireEvent.click(screen.getByRole("button", { name: ADD_LABEL }))
    expect(bodies(container)).toHaveLength(3)

    // 編集中の区切りは要約を出さないため、削除の操作は先頭以外の非アクティブな区切りだけに出る
    fireEvent.click(screen.getByRole("button", { name: REMOVE_LABEL }))
    expect(bodies(container)).toHaveLength(2)
  })

  it("提出が失敗したとき、失敗の文言を表示し、入力した本文を残す", async () => {
    const { container } = render(<ThreadComposer variant="page" />)
    const [body] = bodies(container)
    body.textContent = "本文"
    fireEvent.input(body)

    fireEvent.submit(container.querySelector("form") as HTMLFormElement)

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).not.toBe(""),
    )
    expect(bodies(container)[0].textContent).toBe("本文")
  })
})
