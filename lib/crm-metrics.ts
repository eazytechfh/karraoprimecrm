export interface MetricLead {
  id: number
  estagio_lead?: string | null
  vendedor?: string | null
  origem?: string | null
  valor?: number | string | null
}

export interface MetricAgendamento {
  id: number
  id_lead?: number | null
  estagio_agendamento?: string | null
  updated_at?: string | null
  created_at?: string | null
}

export interface CrmMetrics {
  totalLeads: number
  totalAgendamentos: number
  totalVendas: number
  conversao: string
  leadsPorEstagio: Record<string, number>
  leadsPorOrigem: Record<string, number>
  vendasPorVendedor: Record<string, number>
  successfulLeadIds: number[]
  latestAgendamentos: MetricAgendamento[]
  valorTotal: number
  valorMedio: number
}

function normalizeLeadMetricStage(stage?: string | null) {
  const normalized = (stage || "").toLowerCase().trim()
  if (["novo_lead", "novo lead", "oportunidade"].includes(normalized)) return "pendente"
  if (normalized === "transferido") return "vendedor"
  if (["follow_up", "follow up"].includes(normalized)) return "resgate"
  return normalized || "pendente"
}

function getAgendamentoTimestamp(agendamento: MetricAgendamento) {
  return Date.parse(agendamento.updated_at || agendamento.created_at || "") || 0
}

function normalizeAgendamentoMetricStage(stage?: string | null) {
  const normalized = (stage || "").toLowerCase().trim()
  if (["fechou", "ganho"].includes(normalized)) return "sucesso"
  if (["nao_fechou", "não fechou", "perdido"].includes(normalized)) return "insucesso"
  if (["realizou_visita", "realizou a visita"].includes(normalized)) return "visita_realizada"
  return normalized || "agendar"
}

function isNewerAgendamento(candidate: MetricAgendamento, current: MetricAgendamento) {
  const candidateTimestamp = getAgendamentoTimestamp(candidate)
  const currentTimestamp = getAgendamentoTimestamp(current)
  return candidateTimestamp > currentTimestamp ||
    (candidateTimestamp === currentTimestamp && candidate.id > current.id)
}

export function calculateCrmMetrics(
  leads: MetricLead[],
  agendamentos: MetricAgendamento[],
): CrmMetrics {
  const leadIds = new Set(leads.map((lead) => lead.id))
  const latestByLead = new Map<number, MetricAgendamento>()

  for (const agendamento of agendamentos) {
    if (agendamento.id_lead == null || !leadIds.has(agendamento.id_lead)) continue

    const current = latestByLead.get(agendamento.id_lead)
    if (!current || isNewerAgendamento(agendamento, current)) {
      latestByLead.set(agendamento.id_lead, agendamento)
    }
  }

  const successfulLeadIds = new Set(
    [...latestByLead.entries()]
      .filter(([, agendamento]) => normalizeAgendamentoMetricStage(agendamento.estagio_agendamento) === "sucesso")
      .map(([leadId]) => leadId),
  )

  const leadsPorEstagio: Record<string, number> = {}
  const leadsPorOrigem: Record<string, number> = {}
  const vendasPorVendedor: Record<string, number> = {}
  let valorTotal = 0

  for (const lead of leads) {
    const stage = normalizeLeadMetricStage(lead.estagio_lead)
    leadsPorEstagio[stage] = (leadsPorEstagio[stage] || 0) + 1

    if (lead.origem) {
      leadsPorOrigem[lead.origem] = (leadsPorOrigem[lead.origem] || 0) + 1
    }

    if (lead.vendedor) {
      vendasPorVendedor[lead.vendedor] = (vendasPorVendedor[lead.vendedor] || 0) +
        (successfulLeadIds.has(lead.id) ? 1 : 0)
    }

    valorTotal += Number(lead.valor) || 0
  }

  const totalLeads = leads.length
  const totalVendas = successfulLeadIds.size

  return {
    totalLeads,
    totalAgendamentos: latestByLead.size,
    totalVendas,
    conversao: totalLeads > 0 ? ((totalVendas / totalLeads) * 100).toFixed(1) : "0",
    leadsPorEstagio,
    leadsPorOrigem,
    vendasPorVendedor,
    successfulLeadIds: [...successfulLeadIds],
    latestAgendamentos: [...latestByLead.values()],
    valorTotal,
    valorMedio: totalLeads > 0 ? valorTotal / totalLeads : 0,
  }
}
