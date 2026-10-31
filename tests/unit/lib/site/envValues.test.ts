/**
 * 環境の値（バージョン・本番のドメイン）の特性化テスト（src-duplicates 1.4・要件 5.2）。
 * 未設定の値（単体テストの環境）を含め、移す前の現行の値を固定する。
 */
import { describe, expect, it } from "vitest"
import { buildInfo } from "@/lib/site/buildInfo"
import { serviceVersion } from "@/vars"
import { skyshareEntryUrlgen } from "@/lib/entry/url"
import { GUEST_SAMPLE_ENTRY_PATH } from "@/lib/timeline/guest"

describe("バージョンの表示", () => {
    it("未設定のビルドでは、ビルド情報の版は unknown、コミットとリポジトリは null", () => {
        expect(buildInfo.version).toBe("unknown")
        expect(buildInfo.commit).toBeNull()
        expect(buildInfo.repository).toBeNull()
    })

    it("サービスの版は、埋め込みの値の文字列（未設定時は文字列の undefined）", () => {
        expect(serviceVersion).toBe(`${import.meta.env.PUBLIC_VERSION}`)
    })
})

describe("本番のドメインを使う URL の組み立て", () => {
    it("entry の URL は本番のドメインと、handle@rkey の形で組み立てる", () => {
        expect(skyshareEntryUrlgen("alice.test", "3lxyz")).toBe(
            "https://skyshare.nekono.dev/entries/alice.test@3lxyz/",
        )
    })

    it("ゲストの見本の投稿の経路は本番のドメインを前置する", () => {
        expect(GUEST_SAMPLE_ENTRY_PATH).toBe(
            "https://skyshare.nekono.dev/entries/sample/",
        )
    })
})
