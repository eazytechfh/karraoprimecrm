export const HISTORICO_AGENDAMENTO_STAGES = [
  "agendar",
  "agendado",
  "nao_compareceu",
  "reagendado",
  "visita_realizada",
  "sucesso",
  "insucesso",
] as const

export const SDR_FUNNEL_APPOINTMENT_STAGES = [
  "agendado",
  "reagendado",
  "visita_realizada",
  "sucesso",
  "insucesso",
] as const

const CHECKBOX_FLAGS_PATTERN = /__flags__:rv=(0|1);g=(0|1)/

export function ensureVisitCheckboxFlag(observacoes?: string) {
  const raw = observacoes || ""
  const match = raw.match(CHECKBOX_FLAGS_PATTERN)
  const ganho = match?.[2] === "1"
  const base = raw
    .replace(/\n?__flags__:rv=(0|1);g=(0|1)\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  const flags = `__flags__:rv=1;g=${ganho ? "1" : "0"}`

  return base ? `${base}\n${flags}` : flags
}

export function classifySdrFunnelStage(stage?: string | null, realizouVisitaMarcada = false) {
  const normalized = (stage || "").toLowerCase().trim()
  return {
    agendamento: SDR_FUNNEL_APPOINTMENT_STAGES.some((item) => item === normalized),
    visita:
      normalized === "visita_realizada" ||
      (["sucesso", "insucesso"].includes(normalized) && realizouVisitaMarcada),
    sucesso: normalized === "sucesso",
  }
}

export function resolveHistoricoStages(status?: string): string[] {
  if (!status) return [...HISTORICO_AGENDAMENTO_STAGES]
  if (status === "visita_realizada") return ["visita_realizada", "sucesso", "insucesso"]
  return [status]
}

export interface AgendamentoDateFilters {
  dataInicio?: string
  dataFim?: string
  periodo?: "mes" | "hoje" | "ultimos7dias"
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getCurrentMonthFullRange(now = new Date()) {
  return {
    dataInicio: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    dataFim: formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

export function resolveAgendamentoDateRange(filters: AgendamentoDateFilters = {}, now = new Date()) {
  if (filters.dataInicio || filters.dataFim) {
    return { startDate: filters.dataInicio, endDate: filters.dataFim }
  }

  if (filters.periodo === "hoje") {
    const today = formatDateInput(now)
    return { startDate: today, endDate: today }
  }

  if (filters.periodo === "ultimos7dias") {
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    return { startDate: formatDateInput(start), endDate: formatDateInput(now) }
  }

  if (filters.periodo === "mes") {
    return {
      startDate: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: formatDateInput(now),
    }
  }

  return { startDate: undefined, endDate: undefined }
}
