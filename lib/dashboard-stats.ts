import { createClient } from "@/utils/supabase/client"

export interface DashboardFilters {
  vendedor?: string
  origem?: string
  periodo?: string
}

export interface VendedorStats {
  vendedor: string
  total_leads: number
  leads_fechados: number
  taxa_conversao: number
  valor_total: number
  valor_medio: number
  leads_por_estagio: Record<string, number>
}

export interface VeiculoStats {
  veiculo: string
  total_interesse: number
  leads_fechados: number
  taxa_conversao: number
  valor_total: number
  valor_medio: number
}

export interface OrigemStats {
  origem: string
  total_leads: number
  leads_fechados: number
  taxa_conversao: number
  valor_total: number
  valor_medio: number
}

export interface SdrPerformanceStats {
  sdr_responsavel: string
  total_agendamentos: number
  agendamentos_realizados: number
  agendamentos_fechados: number
  agendamentos_nao_fechados: number
  taxa_conversao: number
}

export interface EstagioEvolution {
  data: string
  [key: string]: string | number
}

function getStartDateFromPeriodo(periodo?: string) {
  if (!periodo) return null

  const now = new Date()
  const startDate = new Date()

  switch (periodo) {
    case "hoje":
      startDate.setHours(0, 0, 0, 0)
      break
    case "7d":
      startDate.setDate(now.getDate() - 7)
      break
    case "30d":
      startDate.setDate(now.getDate() - 30)
      break
    case "90d":
      startDate.setDate(now.getDate() - 90)
      break
    default:
      startDate.setDate(now.getDate() - 30)
  }

  return startDate.toISOString()
}

export async function getDashboardData(idEmpresa: number, filters: DashboardFilters = {}) {
  const supabase = createClient()

  // =========================
  // 1) QUERY PRINCIPAL (DADOS)
  // =========================
  let query = supabase.from("BASE_DE_LEADS").select("*").eq("id_empresa", idEmpresa)

  // Aplicar filtros
  if (filters.vendedor) {
    query = query.eq("vendedor", filters.vendedor)
  }

  if (filters.origem) {
    query = query.eq("origem", filters.origem)
  }

  const startDateISO = getStartDateFromPeriodo(filters.periodo)
  if (startDateISO) {
    query = query.gte("created_at", startDateISO)
  }

  const { data: leads, error } = await query

  // ================================
  // 2) COUNT EXATO (TOTAL REAL)
  //    (mesmos filtros do query acima)
  // ================================
  let countQuery = supabase
    .from("BASE_DE_LEADS")
    .select("*", { count: "exact", head: true })
    .eq("id_empresa", idEmpresa)

  if (filters.vendedor) {
    countQuery = countQuery.eq("vendedor", filters.vendedor)
  }

  if (filters.origem) {
    countQuery = countQuery.eq("origem", filters.origem)
  }

  if (startDateISO) {
    countQuery = countQuery.gte("created_at", startDateISO)
  }

  const { count: totalLeadsReal, error: countError } = await countQuery

  const { data: agendamentos, error: agendamentosError } = await supabase
    .from("AGENDAMENTOS")
    .select("*")
    .eq("id_empresa", idEmpresa)

  if (error || !leads) {
    console.error("Error fetching dashboard data:", error)
    return {
      totalLeads: 0,
      leadsPorEstagio: {},
      leadsPorOrigem: {},
      conversao: "0",
      vendedorStats: [],
      veiculoStats: [],
      origemStats: [],
      sdrPerformanceStats: [],
      estagioResumo: [],
      estagioEvolution: [],
      availableVendedores: [],
      availableOrigens: [],
      valorTotal: 0,
      valorMedio: 0,
    }
  }

  if (countError) {
    console.warn("Count error (using leads.length as fallback):", countError)
  }

  // ✅ TOTAL REAL (se falhar o count, cai no length)
  const totalLeads = (totalLeadsReal ?? leads.length) as number

  // Estatísticas básicas espelhando BASE_DE_LEADS
  // (não usar leads.length aqui pois pode estar limitado a 1000 no retorno)
  // totalLeads já é o count real com filtros.
  // Obs: as quebras por estágio/valor etc. continuam com base nos dados carregados no "leads".
  // Se você também quiser essas estatísticas completas, aí precisaria paginar ou fazer agregações no banco.
  // (você pediu somente o bloco Total de Leads)

  // Agrupamento por ESTAGIO_LEAD (coluna estagio_lead)
  const leadsPorEstagio = leads.reduce((acc: any, lead) => {
    const estagio = lead.estagio_lead
    acc[estagio] = (acc[estagio] || 0) + 1
    return acc
  }, {})

  // Agrupamento por ORIGEM (coluna origem)
  const leadsPorOrigem = leads.reduce((acc: any, lead) => {
    if (lead.origem) {
      acc[lead.origem] = (acc[lead.origem] || 0) + 1
    }
    return acc
  }, {})

  const fechados = leadsPorEstagio.fechado || 0
  const conversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1) : "0"

  // Calcular valores totais
  const valorTotal = leads.reduce((sum, lead) => sum + (Number(lead.valor) || 0), 0)
  const valorTotalInteiro = Math.trunc(valorTotal) // ✅ remove ",00"
  const valorMedio = totalLeads > 0 ? valorTotal / totalLeads : 0

  // Performance por VENDEDOR (coluna vendedor) - espelhando exatamente a tabela
  const vendedorAgrupamento = leads.reduce((acc: any, lead) => {
    if (!lead.vendedor) return acc

    if (!acc[lead.vendedor]) {
      acc[lead.vendedor] = {
        vendedor: lead.vendedor,
        total_leads: 0,
        leads_fechados: 0,
        valor_total: 0,
        leads_por_estagio: {},
      }
    }

    acc[lead.vendedor].total_leads++
    acc[lead.vendedor].valor_total += Number(lead.valor) || 0

    if (lead.estagio_lead === "fechado") {
      acc[lead.vendedor].leads_fechados++
    }

    // Contar leads por estágio para cada vendedor
    const estagio = lead.estagio_lead
    acc[lead.vendedor].leads_por_estagio[estagio] = (acc[lead.vendedor].leads_por_estagio[estagio] || 0) + 1

    return acc
  }, {})

  const vendedorStats: VendedorStats[] = Object.values(vendedorAgrupamento)
    .map((vendedor: any) => ({
      ...vendedor,
      taxa_conversao: vendedor.total_leads > 0 ? (vendedor.leads_fechados / vendedor.total_leads) * 100 : 0,
      valor_medio: vendedor.total_leads > 0 ? vendedor.valor_total / vendedor.total_leads : 0,
    }))
    .sort((a, b) => b.total_leads - a.total_leads) // Ordenar por quantidade (maior para menor)

  // TOP VEÍCULOS (coluna veiculo_interesse) - agrupamento por quantidade do maior para o menor
  const veiculoAgrupamento = leads.reduce((acc: any, lead) => {
    if (!lead.veiculo_interesse) return acc

    if (!acc[lead.veiculo_interesse]) {
      acc[lead.veiculo_interesse] = {
        veiculo: lead.veiculo_interesse,
        total_interesse: 0,
        leads_fechados: 0,
        valor_total: 0,
      }
    }

    acc[lead.veiculo_interesse].total_interesse++
    acc[lead.veiculo_interesse].valor_total += Number(lead.valor) || 0

    if (lead.estagio_lead === "fechado") {
      acc[lead.veiculo_interesse].leads_fechados++
    }

    return acc
  }, {})

  const veiculoStats: VeiculoStats[] = Object.values(veiculoAgrupamento)
    .map((veiculo: any) => ({
      ...veiculo,
      taxa_conversao: veiculo.total_interesse > 0 ? (veiculo.leads_fechados / veiculo.total_interesse) * 100 : 0,
      valor_medio: veiculo.total_interesse > 0 ? veiculo.valor_total / veiculo.total_interesse : 0,
    }))
    .sort((a, b) => b.total_interesse - a.total_interesse) // Ordenar do maior para o menor

  // Performance por ORIGEM (coluna origem) - espelhando exatamente a tabela
  const origemAgrupamento = leads.reduce((acc: any, lead) => {
    if (!lead.origem) return acc

    if (!acc[lead.origem]) {
      acc[lead.origem] = {
        origem: lead.origem,
        total_leads: 0,
        leads_fechados: 0,
        valor_total: 0,
      }
    }

    acc[lead.origem].total_leads++
    acc[lead.origem].valor_total += Number(lead.valor) || 0

    if (lead.estagio_lead === "fechado") {
      acc[lead.origem].leads_fechados++
    }

    return acc
  }, {})

  const origemStats: OrigemStats[] = Object.values(origemAgrupamento)
    .map((origem: any) => ({
      ...origem,
      taxa_conversao: origem.total_leads > 0 ? (origem.leads_fechados / origem.total_leads) * 100 : 0,
      valor_medio: origem.total_leads > 0 ? origem.valor_total / origem.total_leads : 0,
    }))
    .sort((a, b) => b.total_leads - a.total_leads) // Ordenar por quantidade (maior para menor)

  const sdrAgrupamento = (agendamentos || []).reduce((acc: any, agendamento) => {
    const sdr = agendamento.sdr_responsavel || "Não atribuído"

    if (!acc[sdr]) {
      acc[sdr] = {
        sdr_responsavel: sdr,
        total_agendamentos: 0,
        agendamentos_realizados: 0,
        agendamentos_fechados: 0,
        agendamentos_nao_fechados: 0,
      }
    }

    acc[sdr].total_agendamentos++

    // Contar por estágio do agendamento
    if (
      agendamento.estagio === "agendado" ||
      agendamento.estagio === "realizou_visita" ||
      agendamento.estagio === "fechou" ||
      agendamento.estagio === "nao_fechou"
    ) {
      acc[sdr].agendamentos_realizados++
    }

    if (agendamento.estagio === "fechou") {
      acc[sdr].agendamentos_fechados++
    }

    if (agendamento.estagio === "nao_fechou") {
      acc[sdr].agendamentos_nao_fechados++
    }

    return acc
  }, {})

  const sdrPerformanceStats: SdrPerformanceStats[] = Object.values(sdrAgrupamento)
    .map((sdr: any) => ({
      ...sdr,
      taxa_conversao:
        sdr.agendamentos_realizados > 0 ? (sdr.agendamentos_fechados / sdr.agendamentos_realizados) * 100 : 0,
    }))
    .sort((a, b) => b.total_agendamentos - a.total_agendamentos)

  // Evolução por ESTÁGIO (coluna estagio_lead) - resumo da quantidade de cada estágio
  const estagioResumo = Object.entries(leadsPorEstagio).map(([estagio, quantidade]) => ({
    estagio,
    quantidade: quantidade as number,
    percentual: totalLeads > 0 ? (((quantidade as number) / totalLeads) * 100).toFixed(1) : "0",
  }))

  // Para o gráfico de linha temporal (últimos 30 dias)
  const estagioEvolution: EstagioEvolution[] = []
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    return date
  })

  last30Days.forEach((date) => {
    const dayLeads = leads.filter((lead) => {
      const leadDate = new Date(lead.created_at)
      return leadDate.toDateString() === date.toDateString()
    })

    const dayData: EstagioEvolution = {
      data: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    }

    const estagios = ["novo_lead", "em_qualificacao", "transferido", "follow_up"]

    estagios.forEach((estagio) => {
      dayData[estagio] = dayLeads.filter((lead) => lead.estagio_lead === estagio).length
    })

    estagioEvolution.push(dayData)
  })

  // Listas para filtros - espelhando exatamente as colunas da tabela
  const availableVendedores = [...new Set(leads.map((lead) => lead.vendedor).filter(Boolean))].sort()
  const availableOrigens = [...new Set(leads.map((lead) => lead.origem).filter(Boolean))].sort()

  return {
    totalLeads, // ✅ agora é o TOTAL REAL (count exact)
    leadsPorEstagio,
    leadsPorOrigem,
    conversao,
    vendedorStats,
    veiculoStats,
    origemStats,
    sdrPerformanceStats,
    estagioResumo,
    estagioEvolution,
    availableVendedores,
    availableOrigens,
    valorTotal: valorTotalInteiro, // ✅ sem ",00"
    valorMedio,
  }
}
