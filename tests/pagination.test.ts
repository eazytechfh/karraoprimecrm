import assert from "node:assert/strict"
import test from "node:test"

import { collectPaginatedRows } from "../lib/pagination.ts"

test("coleta todas as paginas ate receber um lote incompleto", async () => {
  const rows = Array.from({ length: 2_350 }, (_, index) => ({ id: index + 1 }))
  const requestedPages: Array<[number, number]> = []

  const result = await collectPaginatedRows(async (from, to) => {
    requestedPages.push([from, to])
    return rows.slice(from, to + 1)
  }, 1_000)

  assert.equal(result.length, 2_350)
  assert.deepEqual(requestedPages, [
    [0, 999],
    [1_000, 1_999],
    [2_000, 2_999],
  ])
})

test("encerra imediatamente quando nao existem registros", async () => {
  let calls = 0
  const result = await collectPaginatedRows(async () => {
    calls++
    return []
  }, 1_000)

  assert.deepEqual(result, [])
  assert.equal(calls, 1)
})
