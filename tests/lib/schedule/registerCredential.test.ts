import { describe, expect, test, vi } from "vitest"
import { createFakeD1 } from "../../helpers/fakeD1"
import { registerScheduleCredential } from "@/lib/schedule/registerCredential"
import { loadCredential } from "@/lib/schedule/store"

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)))
const DID = "did:plc:aaaa"
const session = { did: DID, service: "https://pds.example/" }

const jwt = (scope: string) => {
    const b64 = (o: object) =>
        btoa(JSON.stringify(o))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")
    return `${b64({ alg: "none" })}.${b64({ scope })}.sig`
}
const fetchReturning = (status: number, body: object) =>
    vi.fn(
        async () => new Response(JSON.stringify(body), { status }),
    ) as unknown as typeof fetch

describe("registerScheduleCredential", () => {
    test("schedule-api/AC-5: アプリパスワードのログインに成功すると暗号化したトークンだけが保存される", async () => {
        const db = createFakeD1()
        const f = fetchReturning(200, {
            did: DID,
            accessJwt: jwt("com.atproto.appPass"),
            refreshJwt: "REFRESH-1",
        })
        const r = await registerScheduleCredential(
            db,
            KEY,
            session,
            "app-pass-word",
            5,
            f,
        )
        expect(r).toEqual({ ok: true })
        expect(await loadCredential(db, KEY, DID)).toEqual({
            service: "https://pds.example/",
            token: "REFRESH-1",
        })
        const rows = JSON.stringify(
            await db.prepare("SELECT * FROM schedule_credentials").all(),
        )
        expect(rows).not.toContain("app-pass-word")
        expect(rows).not.toContain("REFRESH-1")
        const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock
            .calls[0]!
        expect(JSON.parse(init.body).identifier).toBe(DID)
        expect(
            (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0],
        ).toBe("https://pds.example/xrpc/com.atproto.server.createSession")
    })

    test("schedule-api/AC-6: メインパスワードのセッションは400で拒否され何も保存されない", async () => {
        const db = createFakeD1()
        const f = fetchReturning(200, {
            did: DID,
            accessJwt: jwt("com.atproto.access"),
            refreshJwt: "R",
        })
        expect(
            await registerScheduleCredential(db, KEY, session, "main", 5, f),
        ).toEqual({ ok: false, status: 400 })
        expect(await loadCredential(db, KEY, DID)).toBeNull()
    })

    test("schedule-api/AC-7: ログイン先が別のアカウントなら400で拒否され何も保存されない", async () => {
        const db = createFakeD1()
        const f = fetchReturning(200, {
            did: "did:plc:other",
            accessJwt: jwt("com.atproto.appPass"),
            refreshJwt: "R",
        })
        expect(
            await registerScheduleCredential(db, KEY, session, "p", 5, f),
        ).toEqual({ ok: false, status: 400 })
        expect(await loadCredential(db, KEY, DID)).toBeNull()
    })

    test("認証の失敗は401、頻度制限は429、その他の失敗と通信の失敗は500になる", async () => {
        const db = createFakeD1()
        const run = (f: typeof fetch) =>
            registerScheduleCredential(db, KEY, session, "p", 5, f)
        expect(
            await run(fetchReturning(401, { error: "AuthenticationRequired" })),
        ).toEqual({ ok: false, status: 401 })
        expect(await run(fetchReturning(429, {}))).toEqual({
            ok: false,
            status: 429,
        })
        expect(await run(fetchReturning(502, {}))).toEqual({
            ok: false,
            status: 500,
        })
        expect(
            await run((async () => {
                throw new Error("net")
            }) as unknown as typeof fetch),
        ).toEqual({ ok: false, status: 500 })
    })

    test("schedule-api/AC-15: 認証に失敗してもパスワードとトークンがログに現れない", async () => {
        const db = createFakeD1()
        const logs: string[] = []
        const spies = (["log", "warn", "error"] as const).map(m =>
            vi.spyOn(console, m).mockImplementation((...a) => {
                logs.push(a.map(String).join(" "))
            }),
        )
        await registerScheduleCredential(
            db,
            KEY,
            session,
            "SECRET-PASSWORD",
            5,
            fetchReturning(500, { refreshJwt: "LEAK" }),
        )
        await registerScheduleCredential(
            db,
            KEY,
            session,
            "SECRET-PASSWORD",
            5,
            (async () => {
                throw new Error("SECRET-PASSWORD")
            }) as unknown as typeof fetch,
        )
        spies.forEach(s => s.mockRestore())
        expect(logs.join("\n")).not.toContain("SECRET-PASSWORD")
        expect(logs.join("\n")).not.toContain("LEAK")
    })
})
