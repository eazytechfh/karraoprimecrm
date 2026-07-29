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
] as const

export function classifySdrFunnelStage(stage?: string | null) {
  const normalized = (stage || "").toLowerCase().trim()
  return {
    agendamento: SDR_FUNNEL_APPOINTMENT_STAGES.some((item) => item === normalized),
    visita: normalized === "visita_realizada",
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
