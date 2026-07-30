import assert from "node:assert/strict"
import test from "node:test"

import {
  resolveLeadEntryAgendamentoStage,
  shouldCreateAgendamentoForLeadStage,
} from "../lib/lead-agendamento-policy.ts"

test("cria agendamento para as etapas integradas com agendamentos", () => {
  assert.equal(shouldCreateAgendamentoForLeadStage("vendedor"), true)
  assert.equal(shouldCreateAgendamentoForLeadStage("em_qualificacao"), true)
  assert.equal(shouldCreateAgendamentoForLeadStage("pendente"), false)
})

test("novo vinculo sempre inicia em agendar", () => {
  assert.equal(resolveLeadEntryAgendamentoStage(undefined, true), "agendar")
})

test("entrada em vendedor reinicia etapa operacional nao encerrada", () => {
  assert.equal(resolveLeadEntryAgendamentoStage("agendado", true), "agendar")
  assert.equal(resolveLeadEntryAgendamentoStage("visita_realizada", true), "agendar")
})

test("nova entrada em vendedor reabre resultados encerrados em Agendar", () => {
  assert.equal(resolveLeadEntryAgendamentoStage("sucesso", true), "agendar")
  assert.equal(resolveLeadEntryAgendamentoStage("insucesso", true), "agendar")
})

test("sincronizacao sem nova entrada preserva a etapa atual", () => {
  assert.equal(resolveLeadEntryAgendamentoStage("reagendado", false), "reagendado")
  assert.equal(resolveLeadEntryAgendamentoStage("sucesso", false), "sucesso")
  assert.equal(resolveLeadEntryAgendamentoStage("insucesso", false), "insucesso")
})
