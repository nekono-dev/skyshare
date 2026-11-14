/**
 * 予約一覧の待機中・失敗の行のサムネイル表示を検証する。
 */
// @vitest-environment happy-dom
import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const listSchedules = vi.fn()
vi.mock("@/client/openapi/client", () => ({
  listSchedules: (...args: unknown[]) => listSchedules(...args),
  deleteSchedule: vi.fn(),
}))

import ScheduleList from "@/components/composer/ThreadComposer/ScheduleList"

describe("ScheduleList thumbnails", () => {
  beforeEach(() => {
    listSchedules.mockResolvedValue({
      status: 200,
      data: {
        items: [
          {
            id: "pending-image",
            runAt: "2026-11-15T10:00:00.000Z",
            status: "pending",
            postCount: 1,
            preview: "本文",
            lastError: null,
            thumbnailIndex: 2,
          },
          {
            id: "pending-empty",
            runAt: "2026-11-15T11:00:00.000Z",
            status: "pending",
            postCount: 1,
            preview: "画像なし",
            lastError: null,
            thumbnailIndex: null,
          },
          {
            id: "failed-image",
            runAt: "2026-11-14T10:00:00.000Z",
            status: "failed",
            postCount: 1,
            preview: "失敗",
            lastError: "unknown",
            thumbnailIndex: 5,
          },
          {
            id: "running-image",
            runAt: "2026-11-14T10:30:00.000Z",
            status: "running",
            postCount: 1,
            preview: "実行中",
            lastError: null,
            thumbnailIndex: 7,
          },
          {
            id: "failed-empty",
            runAt: "2026-11-14T09:00:00.000Z",
            status: "failed",
            postCount: 1,
            preview: "失敗・画像なし",
            lastError: "unknown",
            thumbnailIndex: null,
          },
        ],
      },
    })
  })

  it("画像付きの待機中の行と失敗の行にだけサムネイルを表示し、実行中の行には出さない", async () => {
    const { container } = render(<ScheduleList active onSelect={() => {}} />)
    await vi.waitFor(() => {
      expect(container.querySelectorAll("img")).toHaveLength(2)
    })
    const sources = [...container.querySelectorAll("img")].map(image => [
      image.closest("li")?.getAttribute("data-status"),
      image.getAttribute("src"),
      image.getAttribute("alt"),
    ])
    expect(sources).toEqual([
      ["pending", "/v2/schedules/pending-image/images/2", ""],
      ["failed", "/v2/schedules/failed-image/images/5", ""],
    ])
  })

  it("サムネイルは内容の右に置く（内容の後ろ）", async () => {
    const { container } = render(<ScheduleList active onSelect={() => {}} />)
    const image = await vi.waitFor(() => {
      const found = container.querySelector("img")
      expect(found).not.toBeNull()
      return found as HTMLImageElement
    })
    expect(image.nextElementSibling).toBeNull()
    expect(image.previousElementSibling?.textContent).toContain("本文")
  })

  it("待機中の行には状態の表示を出さず、失敗の行には出す", async () => {
    const { container } = render(<ScheduleList active onSelect={() => {}} />)
    await vi.waitFor(() => {
      expect(
        container.querySelectorAll('li[data-status="pending"]'),
      ).toHaveLength(2)
    })
    for (const row of container.querySelectorAll('li[data-status="pending"]')) {
      expect(row.querySelector("strong")).toBeNull()
    }
    for (const row of container.querySelectorAll('li[data-status="failed"]')) {
      expect(row.querySelector("strong")).not.toBeNull()
    }
  })
})
