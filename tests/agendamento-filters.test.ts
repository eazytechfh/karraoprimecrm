import assert from "node:assert/strict"
import test from "node:test"

import {
  HISTORICO_AGENDAMENTO_STAGES,
  SDR_FUNNEL_APPOINTMENT_STAGES,
  classifySdrFunnelStage,
  getCurrentMonthFullRange,
  resolveAgendamentoDateRange,
  resolveHistoricoStages,
} from "../lib/agendamento-filters.ts"

test("o historico geral inclui agendamentos confirmados", () => {
  assert.ok(HISTORICO_AGENDAMENTO_STAGES.includes("agendado"))
})

test("traduz visita realizada para todos os estados que comprovam visita", () => {
  assert.deepEqual(resolveHistoricoStages("visita_realizada"), ["visita_realizada", "sucesso", "insucesso"])
})

test("mantem um status simples como filtro exato", () => {
  assert.deepEqual(resolveHistoricoStages("agendado"), ["agendado"])
})

test("sem periodo ou datas consulta todo o historico", () => {
  assert.deepEqual(resolveAgendamentoDateRange({}, new Date("2026-07-29T12:00:00Z")), {
    startDate: undefined,
    endDate: undefined,
  })
})

test("periodo mensal continua disponivel quando selecionado", () => {
  assert.deepEqual(resolveAgendamentoDateRange({ periodo: "mes" }, new Date("2026-07-29T12:00:00Z")), {
    startDate: "2026-07-01",
    endDate: "2026-07-29",
  })
})

test("classifica as etapas do funil SDR pela regra de negocio", () => {
  assert.deepEqual(SDR_FUNNEL_APPOINTMENT_STAGES, ["agendado", "reagendado", "visita_realizada", "sucesso"])
  assert.deepEqual(classifySdrFunnelStage("agendado"), { agendamento: true, visita: false, sucesso: false })
  assert.deepEqual(classifySdrFunnelStage("reagendado"), { agendamento: true, visita: false, sucesso: false })
  assert.deepEqual(classifySdrFunnelStage("visita_realizada"), { agendamento: true, visita: true, sucesso: false })
  assert.deepEqual(classifySdrFunnelStage("sucesso"), { agendamento: true, visita: true, sucesso: true })
  assert.deepEqual(classifySdrFunnelStage("insucesso"), { agendamento: false, visita: false, sucesso: false })
})

test("retorna o primeiro e o ultimo dia do mes atual inteiro", () => {
  assert.deepEqual(getCurrentMonthFullRange(new Date("2026-07-29T12:00:00Z")), {
    dataInicio: "2026-07-01",
    dataFim: "2026-07-31",
  })

  assert.deepEqual(getCurrentMonthFullRange(new Date("2024-02-10T12:00:00Z")), {
    dataInicio: "2024-02-01",
    dataFim: "2024-02-29",
  })
})
