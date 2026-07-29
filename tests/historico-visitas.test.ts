import assert from "node:assert/strict"
import test from "node:test"

import { getHistoricoRowAriaLabel } from "../lib/historico-visitas.ts"

test("identifica de forma acessivel o cliente que sera aberto", () => {
  assert.equal(getHistoricoRowAriaLabel("Joao"), "Abrir informações de Joao")
  assert.equal(getHistoricoRowAriaLabel(""), "Abrir informações do cliente")
})
