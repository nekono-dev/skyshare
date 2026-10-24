/**
 * R2 互換のテスト用バケット。保管したオブジェクトを Map で保持する。
 */
import type { R2Bucket } from "@/lib/schedule/cfTypes"

export type FakeR2 = R2Bucket & { objects: Map<string, ArrayBuffer> }

export const createFakeR2 = (): FakeR2 => {
    const objects = new Map<string, ArrayBuffer>()
    // 保管時の content-type をキーごとに覚え、読み出しで返す
    const types = new Map<string, string | undefined>()
    return {
        objects,
        put: async (
            key: string,
            value: ArrayBuffer,
            options?: { httpMetadata?: { contentType?: string } },
        ) => {
            objects.set(key, value)
            types.set(key, options?.httpMetadata?.contentType)
        },
        get: async (key: string) => {
            const value = objects.get(key)
            return value
                ? {
                      arrayBuffer: async () => value,
                      httpMetadata: { contentType: types.get(key) },
                  }
                : null
        },
        delete: async (keys: string | string[]) => {
            for (const k of Array.isArray(keys) ? keys : [keys])
                objects.delete(k)
        },
    }
}
