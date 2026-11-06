/**
 * 規則 typesOnly（structure-checks 3.4）の単体テスト。
 *
 * 責務と処理概要:
 * - `findTypesOnlyViolations` の判定を、fixture の本文（文字列）で固定する。
 * - 違反（値の宣言・値の export・export default・値の import・export *）と、
 *   正例（type・interface 宣言、export type・export interface、import type）を確かめる。
 * - 実リポジトリの `src/types/` は読まない（8.5 の範囲は `typesRules.test.ts` が受け持つ）。
 */
import { describe, expect, it } from "vitest"
import { findTypesOnlyViolations } from "../../../scripts/architecture/typesOnly"

const PATH = "src/types/fixture.ts"

/** 本文を一つのファイルとして判定し、違反の一覧を返す。 */
const violationsOf = (text: string) =>
    findTypesOnlyViolations([{ path: PATH, text }])

describe("規則 typesOnly（structure-checks 3.4）", () => {
    describe("違反にする文", () => {
        it.each([
            ["export const", 'export const a = "x"'],
            ["export let", "export let b = 1"],
            ["export function", "export function f() {}"],
            ["export class", "export class C {}"],
            ["export enum", "export enum E { A, B }"],
            ["export namespace", "export namespace N { export type T = 1 }"],
            ["export default（値）", "export default 1"],
            ["export default（関数）", "export default function f() {}"],
            [
                "export default（型）",
                "export default interface I { a: number }",
            ],
            ["値の import", 'import { x } from "y"'],
            ["値の import（既定）", 'import z from "w"'],
            ["副作用の import", 'import "side-effect"'],
            ["export *", 'export * from "z"'],
            ["export * as", 'export * as ns from "z"'],
            ["値の export { } from", 'export { a } from "z"'],
            ["値の変数宣言", "const a = 1"],
            ["値の関数宣言", "function g() {}"],
            ["式文", "console.log(1)"],
        ])("%s を違反にする", (_name, text) => {
            const found = violationsOf(text)
            expect(found.length).toBeGreaterThan(0)
            for (const v of found) {
                expect(v).toEqual({
                    ruleId: "typesOnly",
                    from: PATH,
                    specifier: "",
                    message: expect.any(String),
                })
            }
        })

        it("型の文に値の文が混じるとき、値の文だけを違反にする", () => {
            const found = violationsOf(
                [
                    "export type A = string",
                    "export const b = 1",
                    "interface C {}",
                ].join("\n"),
            )
            expect(found).toHaveLength(1)
        })
    })

    describe("違反にしない文（型だけの文）", () => {
        it.each([
            ["type 宣言", "type A = string"],
            ["interface 宣言", "interface B { a: number }"],
            ["export type", "export type C = { a: number }"],
            ["export interface", "export interface D { b: string }"],
            ["import type（名前付き）", 'import type { X } from "y"'],
            ["import type（既定）", 'import type Z from "w"'],
            [
                "export type { } from（型だけの再エクスポート）",
                'export type { Y } from "z"',
            ],
            [
                "export type *（型だけの再エクスポート）",
                'export type * from "z"',
            ],
            [
                "export type * as（型だけの再エクスポート）",
                'export type * as ns from "z"',
            ],
            ["declare の型宣言", "declare type E = 1"],
        ])("%s を違反にしない", (_name, text) => {
            expect(violationsOf(text)).toEqual([])
        })

        it("空のファイルは違反にしない", () => {
            expect(violationsOf("")).toEqual([])
        })
    })

    it("複数のファイルの違反を、それぞれのパスで報告する", () => {
        const found = findTypesOnlyViolations([
            { path: "src/types/ok.ts", text: "export type A = 1" },
            { path: "src/types/ng.ts", text: "export const b = 2" },
        ])
        expect(found).toEqual([
            {
                ruleId: "typesOnly",
                from: "src/types/ng.ts",
                specifier: "",
                message: expect.any(String),
            },
        ])
    })
})
