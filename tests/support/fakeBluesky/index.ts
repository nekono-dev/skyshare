/**
 * Serves deterministic authorization, PLC, PDS, and AppView responses from one local origin.
 * Unknown routes return 404 and never reach the real service.
 */
import {
    createServer,
    type IncomingMessage,
    type Server,
    type ServerResponse,
} from "node:http"
import type { AddressInfo } from "node:net"
import { createFakeStore, respondTo } from "./routes"
import type { FakeBlueskyFixtures } from "./types"

export type { FakeBlueskyFixtures } from "./types"

/** Test endpoint used by the E2E process to read recorded requests. */
export const REQUESTS_PATH = "/__test/requests"

export type FakeBlueskyOptions = {
    /** 待ち受けるポート。0 のときは空いているポートを使う */
    readonly port: number
    readonly fixtures: FakeBlueskyFixtures
}

export type FakeBlueskyRequest = {
    readonly method: string
    readonly path: string
}

export interface FakeBluesky {
    /** 接続先の環境変数に渡す origin（例: `http://127.0.0.1:43123`） */
    readonly origin: string
    /** これまでに受けた経路（定義の有無を問わない） */
    readonly requests: ReadonlyArray<FakeBlueskyRequest>
    close(): Promise<void>
}

const send = (
    res: ServerResponse,
    status: number,
    body?: unknown,
    headers?: Record<string, string>,
): void => {
    res.writeHead(status, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        ...headers,
    })
    res.end(body === undefined ? undefined : JSON.stringify(body))
}

/** Starts the fake Bluesky server and returns its origin, request log, and close handle. */
export const startFakeBluesky = (
    options: FakeBlueskyOptions,
): Promise<FakeBluesky> => {
    const requests: FakeBlueskyRequest[] = []
    const store = createFakeStore()
    let origin = ""

    const handle = (
        req: IncomingMessage,
        res: ServerResponse,
        body: string,
    ): void => {
        const url = new URL(req.url ?? "/", origin)
        const method = req.method ?? "GET"
        requests.push({ method, path: url.pathname })

        // Handle CORS preflight requests from the browser.
        if (method === "OPTIONS") {
            send(res, 204, undefined, {
                "access-control-allow-headers": "*",
                "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
            })
            return
        }

        // This test endpoint exposes the request log; it is not a Bluesky route.
        if (method === "GET" && url.pathname === REQUESTS_PATH) {
            send(res, 200, { requests })
            return
        }

        const reply = respondTo({
            method,
            url,
            fixtures: options.fixtures,
            body,
            store,
        })
        if (!reply) {
            send(res, 404, { error: "NotFound", message: "no fake route" })
            return
        }
        send(res, reply.status, reply.body, reply.headers)
    }

    const server: Server = createServer(
        (req: IncomingMessage, res: ServerResponse) => {
            const chunks: Buffer[] = []
            req.on("data", (chunk: Buffer) => chunks.push(chunk))
            req.on("end", () =>
                handle(req, res, Buffer.concat(chunks).toString("utf8")),
            )
        },
    )

    return new Promise((resolve, reject) => {
        server.once("error", reject)
        server.listen(options.port, "127.0.0.1", () => {
            const { port } = server.address() as AddressInfo
            origin = `http://127.0.0.1:${port}`
            resolve({
                origin,
                requests,
                close: () =>
                    new Promise<void>((done, fail) =>
                        server.close(err => (err ? fail(err) : done())),
                    ),
            })
        })
    })
}
