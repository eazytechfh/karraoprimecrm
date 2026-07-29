import assert from "node:assert/strict"
import test from "node:test"

import { calculateCrmMetrics } from "../lib/crm-metrics.ts"

test("calcula vendas e conversao pelo ultimo agendamento em sucesso", () => {
  const leads = [
    { id: 1, estagio_lead: "vendedor", vendedor: "Ana", origem: "Site", valor: 100 },
    { id: 2, estagio_lead: "resgate", vendedor: "Bruno", origem: "Indicacao", valor: 200 },
  ]
  const agendamentos = [
    { id: 10, id_lead: 1, estagio_agendamento: "visita_realizada", updated_at: "2026-07-01T10:00:00Z" },
    { id: 11, id_lead: 1, estagio_agendamento: "sucesso", updated_at: "2026-07-02T10:00:00Z" },
    { id: 12, id_lead: 2, estagio_agendamento: "insucesso", updated_at: "2026-07-02T10:00:00Z" },
  ]

  const result = calculateCrmMetrics(leads, agendamentos)

  assert.equal(result.totalLeads, 2)
  assert.equal(result.totalVendas, 1)
  assert.equal(result.conversao, "50.0")
  assert.equal(result.vendasPorVendedor.Ana, 1)
  assert.equal(result.vendasPorVendedor.Bruno, 0)
})

test("ignora agendamentos que nao pertencem ao conjunto filtrado de leads", () => {
  const leads = [{ id: 1, estagio_lead: "vendedor", vendedor: "Ana", origem: "Site", valor: 100 }]
  const agendamentos = [
    { id: 10, id_lead: 1, estagio_agendamento: "sucesso", updated_at: "2026-07-02T10:00:00Z" },
    { id: 20, id_lead: 999, estagio_agendamento: "sucesso", updated_at: "2026-07-02T10:00:00Z" },
  ]

  const result = calculateCrmMetrics(leads, agendamentos)

  assert.equal(result.totalAgendamentos, 1)
  assert.equal(result.totalVendas, 1)
})

test("deduplica agendamentos do mesmo lead usando o registro mais recente", () => {
  const leads = [{ id: 1, estagio_lead: "vendedor", vendedor: "Ana", origem: "Site", valor: 100 }]
  const agendamentos = [
    { id: 10, id_lead: 1, estagio_agendamento: "sucesso", updated_at: "2026-07-01T10:00:00Z" },
    { id: 11, id_lead: 1, estagio_agendamento: "insucesso", updated_at: "2026-07-03T10:00:00Z" },
  ]

  const result = calculateCrmMetrics(leads, agendamentos)

  assert.equal(result.totalAgendamentos, 1)
  assert.equal(result.totalVendas, 0)
})

test("desempata agendamentos com o mesmo timestamp pelo maior id", () => {
  const leads = [{ id: 1, estagio_lead: "vendedor", vendedor: "Ana" }]
  const agendamentos = [
    { id: 10, id_lead: 1, estagio_agendamento: "sucesso", updated_at: "2026-07-03T10:00:00Z" },
    { id: 11, id_lead: 1, estagio_agendamento: "insucesso", updated_at: "2026-07-03T10:00:00Z" },
  ]

  const result = calculateCrmMetrics(leads, agendamentos)

  assert.equal(result.totalVendas, 0)
  assert.equal(result.latestAgendamentos[0].id, 11)
})

test("reconhece alias legado fechou como sucesso", () => {
  const leads = [{ id: 1, estagio_lead: "vendedor", vendedor: "Ana" }]
  const agendamentos = [
    { id: 10, id_lead: 1, estagio_agendamento: "fechou", updated_at: "2026-07-03T10:00:00Z" },
  ]

  assert.equal(calculateCrmMetrics(leads, agendamentos).totalVendas, 1)
})
