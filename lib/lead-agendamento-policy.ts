export function resolveLeadEntryAgendamentoStage(
  existingStage?: string | null,
  resetToAgendar = false,
): string {
  const normalizedStage = (existingStage || "").toLowerCase().trim()

  // Uma entrada explicita em Vendedor representa a abertura de um novo ciclo.
  // Sincronizacoes do mesmo ciclo preservam a etapa em que o agendamento esta.
  if (resetToAgendar || !normalizedStage) {
    return "agendar"
  }

  return normalizedStage
}

export function shouldCreateAgendamentoForLeadStage(stage?: string | null): boolean {
  const normalizedStage = (stage || "").toLowerCase().trim()
  return normalizedStage === "vendedor" || normalizedStage === "em_qualificacao"
}
