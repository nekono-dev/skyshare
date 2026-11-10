/**
 * codex の実行を先着順の 1 本の列に入れ、種類ごとの同時実行数と待ち時間の上限を守る純粋な部品。
 * 読み取りと書き込みは別々に数え、先頭が許されない間は後ろの呼び出しを追い越させない。
 * 時計（現在時刻とタイマー）は注入する。プロセスやファイルシステムには触れない。
 */

/** 待ち時間の上限に達して、実行されずに拒否された呼び出しのエラー。 */
export class WaitLimitError extends Error {
  constructor(waitLimitMs) {
    super(
      `待ち時間が上限（${waitLimitMs} ミリ秒）に達したため、実行しませんでした`,
    )
    this.name = "WaitLimitError"
  }
}

/**
 * @param {{ maxConcurrent: { read: number, write: number }, waitLimitMs: number, clock: { now: () => number, setTimeout: Function, clearTimeout: Function } }} options
 * @returns {{ acquire: (kind: "read" | "write") => Promise<{ release: () => void }> }}
 */
export const createExecQueue = ({ maxConcurrent, waitLimitMs, clock }) => {
  // 待機の列（到着順）。先頭から順に実行を許す
  const waiting = []
  const running = { read: 0, write: 0 }

  /** 先頭から、実行の上限に空きがある限り実行を許す。先頭が許されなければ止まる。 */
  const pump = () => {
    while (waiting.length > 0) {
      const head = waiting[0]
      if (running[head.kind] >= maxConcurrent[head.kind]) return
      waiting.shift()
      // 実行中の時間を待ち時間に含めないため、許可した時点でタイマーを外す
      clock.clearTimeout(head.handle)
      running[head.kind] += 1
      head.resolve({ release: makeRelease(head.kind) })
    }
  }

  /** 同じ許可を二度解放しても数えが狂わないよう、一度だけ減らす。 */
  const makeRelease = kind => {
    let released = false
    return () => {
      if (released) return
      released = true
      running[kind] -= 1
      pump()
    }
  }

  return {
    acquire: kind =>
      new Promise((resolve, reject) => {
        const entry = { kind, resolve, reject, handle: undefined }
        entry.handle = clock.setTimeout(() => {
          // 待ち時間の上限に達した呼び出しは列から外す。後ろが先頭になるため、再度判定する
          const index = waiting.indexOf(entry)
          if (index !== -1) waiting.splice(index, 1)
          reject(new WaitLimitError(waitLimitMs))
          pump()
        }, waitLimitMs)
        waiting.push(entry)
        pump()
      }),
  }
}
