import { helper } from "./helper"
import type { Shape } from "@/lib/timeline/shape"

export const run = (s: Shape) => helper(s, import("@/util/time"))
