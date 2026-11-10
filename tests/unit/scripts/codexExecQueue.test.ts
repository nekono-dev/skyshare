/**
 * 先着順の待ち列（codex-exec-queue.mjs）の単体テスト。
 * 偽の時計を使い、時間は advance でだけ進める。プロセスは起動しない。
 */
import { describe, expect, it } from "vitest"
import {
    createExecQueue,
    WaitLimitError,
} from "../../../scripts/agent/codex-exec-queue.mjs"

type FakeTimer = { due: number; fn: () => void }

/** 時間を手で進める偽の時計。タイマーは advance で期限順に発火する。 */
const createFakeClock = () => {
    let current = 0
    let nextId = 1
    const timers = new Map<number, FakeTimer>()

    const clock = {
        now: () => current,
        setTimeout: (fn: () => void, ms: number) => {
            const id = nextId++
            timers.set(id, { due: current + ms, fn })
            return id
        },
        clearTimeout: (handle: unknown) => {
            timers.delete(handle as number)
        },
        advance: (ms: number) => {
            const target = current + ms
            for (;;) {
                let earliestId: number | undefined
                let earliestDue = Number.POSITIVE_INFINITY
                for (const [id, timer] of timers) {
                    if (timer.due <= target && timer.due < earliestDue) {
                        earliestId = id
                        earliestDue = timer.due
                    }
                }
                if (earliestId === undefined) break
                const timer = timers.get(earliestId) as FakeTimer
                timers.delete(earliestId)
                current = timer.due
                timer.fn()
            }
            current = target
        },
        pendingTimers: () => timers.size,
    }
    return clock
}

type Tracked = {
    state: () => "pending" | "admitted" | "rejected"
    release: () => void
    error: () => unknown
}

/** acquire の結果を観測する。release は admitted になったあとに呼ぶ。 */
const track = (promise: Promise<{ release: () => void }>): Tracked => {
    let state: "pending" | "admitted" | "rejected" = "pending"
    let admission: { release: () => void } | undefined
    let failure: unknown
    promise.then(
        value => {
            state = "admitted"
            admission = value
        },
        reason => {
            state = "rejected"
            failure = reason
        },
    )
    return {
        state: () => state,
        release: () => {
            if (admission === undefined)
                throw new Error("まだ実行を許されていません")
            admission.release()
        },
        error: () => failure,
    }
}

/** 保留中の Promise の解決を反映させる。 */
const flush = () => new Promise<void>(resolve => setImmediate(resolve))

const WAIT_LIMIT_MS = 1000

const setup = () => {
    const clock = createFakeClock()
    const queue = createExecQueue({
        maxConcurrent: { read: 5, write: 1 },
        waitLimitMs: WAIT_LIMIT_MS,
        clock,
    })
    return { clock, queue }
}

describe("createExecQueue", () => {
    it("admits a call at once when a slot is free", async () => {
        const { queue } = setup()
        const read = track(queue.acquire("read"))
        await flush()
        expect(read.state()).toBe("admitted")
    })

    it("admits a waiting write only after the running write releases", async () => {
        const { queue } = setup()
        const first = track(queue.acquire("write"))
        const second = track(queue.acquire("write"))
        await flush()
        expect(first.state()).toBe("admitted")
        expect(second.state()).toBe("pending")

        first.release()
        await flush()
        expect(second.state()).toBe("admitted")
    })

    it("allows up to five reads to run at the same time", async () => {
        const { queue } = setup()
        const reads = Array.from({ length: 6 }, () =>
            track(queue.acquire("read")),
        )
        await flush()
        expect(reads.slice(0, 5).map(r => r.state())).toEqual([
            "admitted",
            "admitted",
            "admitted",
            "admitted",
            "admitted",
        ])
        expect(reads[5].state()).toBe("pending")

        reads[0].release()
        await flush()
        expect(reads[5].state()).toBe("admitted")
    })

    it("counts reads and writes separately so both can run together", async () => {
        const { queue } = setup()
        const read = track(queue.acquire("read"))
        const write = track(queue.acquire("write"))
        await flush()
        expect(read.state()).toBe("admitted")
        expect(write.state()).toBe("admitted")
    })

    it("does not let a read overtake a waiting write even when read slots are free", async () => {
        const { queue } = setup()
        const runningWrite = track(queue.acquire("write"))
        const waitingWrite = track(queue.acquire("write"))
        const laterRead = track(queue.acquire("read"))
        await flush()
        expect(runningWrite.state()).toBe("admitted")
        expect(waitingWrite.state()).toBe("pending")
        expect(laterRead.state()).toBe("pending")

        runningWrite.release()
        await flush()
        expect(waitingWrite.state()).toBe("admitted")
        expect(laterRead.state()).toBe("admitted")
    })

    it("keeps arrival order among reads that wait behind a write", async () => {
        const { queue } = setup()
        const reads = Array.from({ length: 5 }, () =>
            track(queue.acquire("read")),
        )
        const firstWaitingRead = track(queue.acquire("read"))
        const write = track(queue.acquire("write"))
        const secondWaitingRead = track(queue.acquire("read"))
        await flush()
        expect(firstWaitingRead.state()).toBe("pending")

        reads[0].release()
        await flush()
        expect(firstWaitingRead.state()).toBe("admitted")
        expect(write.state()).toBe("admitted")
        expect(secondWaitingRead.state()).toBe("pending")
    })

    it("does not limit the number of waiting calls", async () => {
        const { queue } = setup()
        const running = track(queue.acquire("write"))
        const waiting = Array.from({ length: 50 }, () =>
            track(queue.acquire("write")),
        )
        await flush()
        expect(running.state()).toBe("admitted")
        expect(waiting.every(w => w.state() === "pending")).toBe(true)
    })

    it("rejects a waiting call with WaitLimitError when its wait reaches the limit", async () => {
        const { clock, queue } = setup()
        const running = track(queue.acquire("write"))
        const waiting = track(queue.acquire("write"))
        await flush()

        clock.advance(WAIT_LIMIT_MS - 1)
        await flush()
        expect(waiting.state()).toBe("pending")

        clock.advance(1)
        await flush()
        expect(waiting.state()).toBe("rejected")
        expect(waiting.error()).toBeInstanceOf(WaitLimitError)
        expect(running.state()).toBe("admitted")
    })

    it("removes a rejected call from the list so later calls are not blocked by it", async () => {
        const { clock, queue } = setup()
        const running = track(queue.acquire("write"))
        const timedOut = track(queue.acquire("write"))
        await flush()
        clock.advance(WAIT_LIMIT_MS)
        await flush()
        expect(timedOut.state()).toBe("rejected")

        running.release()
        const next = track(queue.acquire("write"))
        await flush()
        expect(next.state()).toBe("admitted")
    })

    it("admits the call behind a timed-out write once that write leaves the list", async () => {
        const { clock, queue } = setup()
        const running = track(queue.acquire("write"))
        const timedOutWrite = track(queue.acquire("write"))
        const readBehind = track(queue.acquire("read"))
        await flush()
        expect(readBehind.state()).toBe("pending")

        clock.advance(WAIT_LIMIT_MS)
        await flush()
        expect(timedOutWrite.state()).toBe("rejected")
        expect(readBehind.state()).toBe("admitted")
        expect(running.state()).toBe("admitted")
    })

    it("measures the wait from entering the list, not from the start of the queue", async () => {
        const { clock, queue } = setup()
        const running = track(queue.acquire("write"))
        const first = track(queue.acquire("write"))
        await flush()

        clock.advance(600)
        const second = track(queue.acquire("write"))
        await flush()

        clock.advance(WAIT_LIMIT_MS - 600)
        await flush()
        expect(first.state()).toBe("rejected")
        expect(second.state()).toBe("pending")

        clock.advance(600)
        await flush()
        expect(second.state()).toBe("rejected")
        expect(running.state()).toBe("admitted")
    })

    it("does not count running time as wait time", async () => {
        const { clock, queue } = setup()
        const long = track(queue.acquire("write"))
        await flush()

        clock.advance(WAIT_LIMIT_MS * 3)
        await flush()
        expect(long.state()).toBe("admitted")
        expect(clock.pendingTimers()).toBe(0)

        long.release()
        const next = track(queue.acquire("write"))
        await flush()
        expect(next.state()).toBe("admitted")
    })

    it("clears the wait timer once a call is admitted", async () => {
        const { clock, queue } = setup()
        const running = track(queue.acquire("write"))
        const waiting = track(queue.acquire("write"))
        await flush()
        expect(clock.pendingTimers()).toBe(1)

        running.release()
        await flush()
        expect(waiting.state()).toBe("admitted")
        expect(clock.pendingTimers()).toBe(0)
    })

    it("does not decrement the count twice when release is called twice", async () => {
        const { queue } = setup()
        const first = track(queue.acquire("write"))
        const second = track(queue.acquire("write"))
        const third = track(queue.acquire("write"))
        await flush()

        first.release()
        first.release()
        await flush()
        expect(second.state()).toBe("admitted")
        expect(third.state()).toBe("pending")
    })
})

describe("WaitLimitError", () => {
    it("is an Error with a clear name and message", () => {
        const error = new WaitLimitError(WAIT_LIMIT_MS)
        expect(error).toBeInstanceOf(Error)
        expect(error.name).toBe("WaitLimitError")
        expect(error.message).toContain(String(WAIT_LIMIT_MS))
    })
})
