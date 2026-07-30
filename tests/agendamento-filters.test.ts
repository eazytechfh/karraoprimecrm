import assert from "node:assert/strict"
import test from "node:test"

import {
  HISTORICO_AGENDAMENTO_STAGES,
  SDR_FUNNEL_APPOINTMENT_STAGES,
  classifySdrFunnelStage,
  ensureVisitCheckboxFlag,
  getCurrentMonthFullRange,
  isAgendamentoWithinDateRange,
  resolveAgendamentoDateRange,
  resolveHistoricoStages,
} from "../lib/agendamento-filters.ts"

test("marca e preserva no banco a flag de visita realizada", () => {
  assert.equal(ensureVisitCheckboxFlag("Cliente pediu retorno"), "Cliente pediu retorno\n__flags__:rv=1;g=0")
  assert.equal(
    ensureVisitCheckboxFlag("Cliente pediu retorno\n__flags__:rv=0;g=1"),
    "Cliente pediu retorno\n__flags__:rv=1;g=1",
  )
  assert.equal(ensureVisitCheckboxFlag("__flags__:rv=1;g=0"), "__flags__:rv=1;g=0")
})

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
  assert.deepEqual(SDR_FUNNEL_APPOINTMENT_STAGES, [
    "agendado",
    "reagendado",
    "visita_realizada",
    "sucesso",
    "insucesso",
  ])
  assert.deepEqual(classifySdrFunnelStage("agendado"), { agendamento: true, visita: false, sucesso: false })
  assert.deepEqual(classifySdrFunnelStage("reagendado"), { agendamento: true, visita: false, sucesso: false })
  assert.deepEqual(classifySdrFunnelStage("visita_realizada"), { agendamento: true, visita: true, sucesso: false })
  assert.deepEqual(classifySdrFunnelStage("sucesso"), { agendamento: true, visita: false, sucesso: true })
  assert.deepEqual(classifySdrFunnelStage("sucesso", true), { agendamento: true, visita: true, sucesso: true })
  assert.deepEqual(classifySdrFunnelStage("insucesso"), { agendamento: true, visita: false, sucesso: false })
  assert.deepEqual(classifySdrFunnelStage("insucesso", true), { agendamento: true, visita: true, sucesso: false })
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

test("mantem leads sem data visiveis na fila Agendar", () => {
  assert.equal(
    isAgendamentoWithinDateRange(
      { estagio_agendamento: "agendar", data_agendamento: null },
      "2026-07-01",
      "2026-07-31",
    ),
    true,
  )
})

test("oculta registros sem data fora da fila Agendar quando ha periodo", () => {
  assert.equal(
    isAgendamentoWithinDateRange(
      { estagio_agendamento: "agendado", data_agendamento: null },
      "2026-07-01",
      "2026-07-31",
    ),
    false,
  )
})

test("compara somente a data quando o banco retorna timestamp", () => {
  assert.equal(
    isAgendamentoWithinDateRange(
      { estagio_agendamento: "agendado", data_agendamento: "2026-07-31T18:30:00Z" },
      "2026-07-01",
      "2026-07-31",
    ),
    true,
  )
  assert.equal(
    isAgendamentoWithinDateRange(
      { estagio_agendamento: "agendado", data_agendamento: "2026-08-01T00:00:00Z" },
      "2026-07-01",
      "2026-07-31",
    ),
    false,
  )
})
