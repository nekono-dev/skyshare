// 各テストの後に DOM を片付ける（テスト間で部品の状態を残さない）
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
    cleanup()
})
