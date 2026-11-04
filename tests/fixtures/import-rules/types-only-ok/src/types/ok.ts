// 型だけの文のみ（typesOnly の正例）
import type { Outcome } from "./other"

export type Result = { outcome: Outcome }

export interface Labeled {
    label: string
}

export type { Outcome } from "./other"
