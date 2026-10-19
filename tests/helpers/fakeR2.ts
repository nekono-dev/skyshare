/**
 * R2 互換のテスト用バケット。保管したオブジェクトを Map で保持する。
 */
import type { R2Bucket } from "@/lib/schedule/cfTypes"

export type FakeR2 = R2Bucket & { objects: Map<string, ArrayBuffer> }

export const createFakeR2 = (): FakeR2 => {
    const objects = new Map<string, ArrayBuffer>()
    return {
        objects,
        put: async (key: string, value: ArrayBuffer) => {
            objects.set(key, value)
        },
        get: async (key: string) => {
            const value = objects.get(key)
            return value
                ? { arrayBuffer: async () => value, httpMetadata: {} }
                : null
        },
        delete: async (keys: string | string[]) => {
            for (const k of Array.isArray(keys) ? keys : [keys])
                objects.delete(k)
        },
    }
}
