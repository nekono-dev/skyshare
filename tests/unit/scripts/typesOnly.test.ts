/**
 * Tests that type modules contain declarations and exports without runtime values.
 *
 * - Uses fixed source snippets; repository-wide checks live in `typesRules.test.ts`.
 */
import { describe, expect, it } from "vitest"
import { findTypesOnlyViolations } from "../../../scripts/architecture/types-only"

const PATH = "src/types/fixture.ts"

/** 本文を一つのファイルとして判定し、違反の一覧を返す。 */
const violationsOf = (text: string) =>
    findTypesOnlyViolations([{ path: PATH, text }])

describe("Type-only module rule", () => {
    describe("Statements that violate the rule", () => {
        it.each([
            ["export const", 'export const a = "x"'],
            ["export let", "export let b = 1"],
            ["export function", "export function f() {}"],
            ["export class", "export class C {}"],
            ["export enum", "export enum E { A, B }"],
            ["export namespace", "export namespace N { export type T = 1 }"],
            ["export default value", "export default 1"],
            ["export default function", "export default function f() {}"],
            [
                "export default interface",
                "export default interface I { a: number }",
            ],
            ["value import", 'import { x } from "y"'],
            ["default value import", 'import z from "w"'],
            ["side-effect import", 'import "side-effect"'],
            ["export *", 'export * from "z"'],
            ["export * as", 'export * as ns from "z"'],
            ["value re-export", 'export { a } from "z"'],
            ["value variable declaration", "const a = 1"],
            ["value function declaration", "function g() {}"],
            ["expression statement", "console.log(1)"],
        ])("%s violates the rule", (_name, text) => {
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

        it("reports only value statements mixed with type statements", () => {
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

    describe("Type-only statements that pass", () => {
        it.each([
            ["type declaration", "type A = string"],
            ["interface declaration", "interface B { a: number }"],
            ["export type", "export type C = { a: number }"],
            ["export interface", "export interface D { b: string }"],
            ["named type import", 'import type { X } from "y"'],
            ["default type import", 'import type Z from "w"'],
            ["type-only named re-export", 'export type { Y } from "z"'],
            ["type-only star re-export", 'export type * from "z"'],
            ["type-only namespace re-export", 'export type * as ns from "z"'],
            ["declared type declaration", "declare type E = 1"],
        ])("%s passes the rule", (_name, text) => {
            expect(violationsOf(text)).toEqual([])
        })

        it("allows an empty file", () => {
            expect(violationsOf("")).toEqual([])
        })
    })

    it("reports each file violation with its path", () => {
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
