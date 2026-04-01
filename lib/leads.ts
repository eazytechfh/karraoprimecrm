import { createClient } from "@/utils/supabase/client"
import { getCurrentUser } from "@/lib/auth"

export interface Lead {
  id: number
  id_empresa: number
  nome_lead: string
  telefone?: string
  email?: string
  origem?: string
  vendedor?: string
  veiculo_interesse?: string
  resumo_qualificacao?: string
  estagio_lead: string
  resumo_comercial?: string
  valor: number
  observacao_vendedor?: string
  sdr_responsavel?: string
  created_at: string
  updated_at: string
}

export const ESTAGIO_LABELS = {
  pendente: "Pendente",
  em_qualificacao: "Em Qualificacao",
  contato_iniciado: "Contato Iniciado",
  nao_responde: "Nao Responde",
  vendedor: "Vendedor",
  resgate: "Resgate",
}

export const ESTAGIO_COLORS = {
  pendente: "bg-slate-100 text-slate-800",
  contato_iniciado: "bg-blue-100 text-blue-800",
  nao_responde: "bg-rose-100 text-rose-800",
  em_qualificacao: "bg-yellow-100 text-yellow-800",
  vendedor: "bg-purple-100 text-purple-800",
  resgate: "bg-indigo-100 text-indigo-800",
}

// Lista dos estágios válidos para validação
export const VALID_ESTAGIOS = ["pendente", "contato_iniciado", "nao_responde", "em_qualificacao", "vendedor", "resgate"]

export function normalizeLeadStage(stage?: string) {
  switch ((stage || "").toLowerCase()) {
    case "novo_lead":
    case "novo lead":
      return "pendente"
    case "transferido":
      return "vendedor"
    case "follow_up":
      return "resgate"
    default:
      return stage || "pendente"
  }
}

export interface CreateLeadData {
  nome_lead: string
  telefone?: string
  email?: string
  origem?: string
  veiculo_interesse?: string
  valor?: number
  observacao_vendedor?: string
  id_empresa: number
  estagio_lead: string
  sdr_responsavel?: string
}

const DASHBOARD_BATCH_SIZE = 1000

async function fetchAllLeadStatsRows(idEmpresa: number) {
  const supabase = createClient()
  const allLeads: Array<Pick<Lead, "estagio_lead" | "origem" | "valor">> = []
  let from = 0

  while (true) {
    const to = from + DASHBOARD_BATCH_SIZE - 1
    const { data, error } = await supabase
      .from("BASE_DE_LEADS")
      .select("estagio_lead, origem, valor")
      .eq("id_empresa", idEmpresa)
      .range(from, to)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    allLeads.push(...data)

    if (data.length < DASHBOARD_BATCH_SIZE) {
      break
    }

    from += DASHBOARD_BATCH_SIZE
  }

  return allLeads
}

async function fetchAllLeadsRows(
  idEmpresa: number,
  user?: ReturnType<typeof getCurrentUser>,
): Promise<Lead[]> {
  const supabase = createClient()
  const allLeads: Lead[] = []
  let from = 0

  while (true) {
    const to = from + DASHBOARD_BATCH_SIZE - 1
    let query = supabase
      .from("BASE_DE_LEADS")
      .select("*")
      .eq("id_empresa", idEmpresa)
      .order("created_at", { ascending: false })
      .range(from, to)

    if (user?.cargo === "sdr") {
      query = query.or(`sdr_responsavel.eq.${user.nome_usuario},estagio_lead.eq.resgate`)
    }

    if (user?.cargo === "vendedor") {
      query = query.eq("vendedor", user.nome_usuario)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    allLeads.push(...data)

    if (data.length < DASHBOARD_BATCH_SIZE) {
      break
    }

    from += DASHBOARD_BATCH_SIZE
  }

  return allLeads
}

export async function getAccurateLeadStats(idEmpresa: number) {
  try {
    const leads = await fetchAllLeadStatsRows(idEmpresa)

    const totalLeads = leads.length
    const leadsPorEstagio = leads.reduce((acc: any, lead) => {
      const estagio = normalizeLeadStage(lead.estagio_lead)
      acc[estagio] = (acc[estagio] || 0) + 1
      return acc
    }, {})

    const leadsPorOrigem = leads.reduce((acc: any, lead) => {
      if (lead.origem) {
        acc[lead.origem] = (acc[lead.origem] || 0) + 1
      }
      return acc
    }, {})

    const fechados = leadsPorEstagio.fechado || 0
    const conversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1) : "0"

    const valorTotal = leads.reduce((sum, lead) => sum + (lead.valor || 0), 0)
    const valorMedio = totalLeads > 0 ? valorTotal / totalLeads : 0

    return {
      totalLeads,
      leadsPorEstagio,
      leadsPorOrigem,
      conversao,
      valorTotal,
      valorMedio,
    }
  } catch (error) {
    console.error("Error fetching accurate lead stats:", error)
    return {
      totalLeads: 0,
      leadsPorEstagio: {},
      leadsPorOrigem: {},
      conversao: {},
      valorTotal: 0,
      valorMedio: 0,
    }
  }
}

export async function createLead(leadData: CreateLeadData): Promise<boolean> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from("BASE_DE_LEADS")
      .insert({
        ...leadData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()

    if (error) {
      console.error("Error creating lead:", error)
      return false
    }

    console.log("Lead created successfully:", data)
    return true
  } catch (error) {
    console.error("Error creating lead:", error)
    return false
  }
}

export async function getLeads(idEmpresa: number): Promise<Lead[]> {
  const user = getCurrentUser()

  try {
    const data = await fetchAllLeadsRows(idEmpresa, user)

    return data.map((lead) => ({
      ...lead,
      estagio_lead: normalizeLeadStage(lead.estagio_lead),
    }))
  } catch (error) {
    console.error("Error fetching leads:", error)
    return []
  }
}

export async function updateLeadStage(leadId: number, newStage: string): Promise<boolean> {
  // Validar se o estágio é válido
  if (!VALID_ESTAGIOS.includes(newStage)) {
    console.error("Invalid stage:", newStage)
    return false
  }

  const supabase = createClient()

  try {
    const { data: leadData, error: fetchError } = await supabase
      .from("BASE_DE_LEADS")
      .select("*")
      .eq("id", leadId)
      .single()

    if (fetchError || !leadData) {
      console.error("Error fetching lead before update:", fetchError)
      return false
    }

    let sdrResponsavel = leadData.sdr_responsavel

    if (newStage === "transferido" && leadData.vendedor) {
      console.log("[v0] Lead movido para transferido. Buscando SDR pelo vendedor:", leadData.vendedor)

      // Buscar SDR na tabela AUTORIZAÇÃO pelo nome do vendedor
      const { data: sdrData, error: sdrError } = await supabase
        .from("AUTORIZAÇÃO")
        .select("nome_usuario")
        .eq("id_empresa", leadData.id_empresa)
        .eq("cargo", "sdr")
        .ilike("nome_usuario", leadData.vendedor.trim())
        .single()

      if (sdrData && !sdrError) {
        sdrResponsavel = sdrData.nome_usuario
        console.log("[v0] SDR encontrado:", sdrResponsavel)
      } else {
        console.warn("[v0] Nenhum SDR encontrado com nome:", leadData.vendedor)
      }
    }

    const { data, error } = await supabase
      .from("BASE_DE_LEADS")
      .update({
        estagio_lead: newStage,
        ...(sdrResponsavel && { sdr_responsavel: sdrResponsavel }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .select()

    if (error) {
      console.error("Error updating lead stage:", error)
      console.error("Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      return false
    }

    if (!data || data.length === 0) {
      console.error("No lead found with ID:", leadId)
      return false
    }

    console.log("Lead stage updated successfully:", {
      leadId,
      newStage,
      sdrResponsavel,
      updatedLead: data[0],
    })

    // O trigger assign_sdr_from_vendedor() cuida de criar o agendamento com o SDR correto

    return true
  } catch (error) {
    console.error("Unexpected error updating lead stage:", error)
    return false
  }
}

export async function updateLeadValue(leadId: number, newValue: number): Promise<boolean> {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from("BASE_DE_LEADS")
      .update({
        valor: newValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)

    if (error) {
      console.error("Error updating lead value:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Unexpected error updating lead value:", error)
    return false
  }
}

export async function updateLeadObservacao(leadId: number, newObservacao: string): Promise<boolean> {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from("BASE_DE_LEADS")
      .update({
        observacao_vendedor: newObservacao,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)

    if (error) {
      console.error("Error updating lead observacao:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Unexpected error updating lead observacao:", error)
    return false
  }
}

export async function updateLeadVeiculo(leadId: number, newVeiculo: string): Promise<boolean> {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from("BASE_DE_LEADS")
      .update({
        veiculo_interesse: newVeiculo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)

    if (error) {
      console.error("Error updating lead veiculo:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Unexpected error updating lead veiculo:", error)
    return false
  }
}

export async function updateLeadEmail(leadId: number, newEmail: string): Promise<boolean> {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from("BASE_DE_LEADS")
      .update({
        email: newEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)

    if (error) {
      console.error("Error updating lead email:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Unexpected error updating lead email:", error)
    return false
  }
}

function toBrasiliaTime(date: Date): string {
  // Criar nova data com offset de -3 horas (Brasília)
  const brasiliaOffset = -3 * 60 // -3 horas em minutos
  const utc = date.getTime() + date.getTimezoneOffset() * 60000
  const brasiliaTime = new Date(utc + brasiliaOffset * 60000)

  return brasiliaTime.toISOString()
}

export async function generateResumoComercial(lead: Lead): Promise<boolean> {
  try {
    console.log("[v0] Starting webhook call for lead:", lead.id)

    const webhookUrl = "https://n8n.eazy.tec.br/webhook/7ad80528-91ba-45f3-836b-0c1523ccf109resumo"

    const now = new Date()
    const brasiliaTimestamp = toBrasiliaTime(now)

    // Converter created_at e updated_at para horário de Brasília
    const createdAtBrasilia = toBrasiliaTime(new Date(lead.created_at))
    const updatedAtBrasilia = toBrasiliaTime(new Date(lead.updated_at))

    const payload = {
      id: lead.id,
      id_empresa: lead.id_empresa,
      nome_lead: lead.nome_lead,
      telefone: lead.telefone,
      email: lead.email,
      origem: lead.origem,
      vendedor: lead.vendedor,
      veiculo_interesse: lead.veiculo_interesse,
      resumo_qualificacao: lead.resumo_qualificacao,
      estagio_lead: lead.estagio_lead,
      resumo_comercial: lead.resumo_comercial,
      valor: lead.valor,
      observacao_vendedor: lead.observacao_vendedor,
      created_at: createdAtBrasilia,
      updated_at: updatedAtBrasilia,
      timestamp: brasiliaTimestamp,
    }

    console.log("[v0] Webhook payload:", payload)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "CRM-Atual-Veiculos/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      mode: "cors", // Explicitly set CORS mode
    })

    clearTimeout(timeoutId)

    console.log("[v0] Webhook response status:", response.status)
    console.log("[v0] Webhook response headers:", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unable to read error response")
      console.error("[v0] Webhook error response:", errorText)
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }

    const responseData = await response.text().catch(() => "No response body")
    console.log("[v0] Webhook success response:", responseData)

    return true
  } catch (error) {
    console.error("[v0] Error sending webhook:", error)

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.error("[v0] Webhook request timed out after 30 seconds")
      } else if (error.message.includes("Failed to fetch")) {
        console.error("[v0] Network error - check if webhook URL is accessible and CORS is configured")
      }
      console.error("[v0] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      })
    }

    return false
  }
}

export async function sendPesquisaAtendimentoWebhook(lead: Lead): Promise<boolean> {
  try {
    console.log("[v0] Starting pesquisa atendimento webhook call for lead:", lead.id)

    const webhookUrl = "https://eazytech-n8n.gsl3ku.easypanel.host/webhook/7f1e49f9-a476-49b7-9883-8a01fe6622e2"

    const now = new Date()
    const brasiliaTimestamp = toBrasiliaTime(now)

    // Converter created_at e updated_at para horário de Brasília
    const createdAtBrasilia = toBrasiliaTime(new Date(lead.created_at))
    const updatedAtBrasilia = toBrasiliaTime(new Date(lead.updated_at))

    const payload = {
      id: lead.id,
      id_empresa: lead.id_empresa,
      nome_lead: lead.nome_lead,
      telefone: lead.telefone,
      email: lead.email,
      origem: lead.origem,
      vendedor: lead.vendedor,
      nome_vendedor: lead.vendedor, // adicionando nome_vendedor como campo separado
      veiculo_interesse: lead.veiculo_interesse,
      resumo_qualificacao: lead.resumo_qualificacao,
      estagio_lead: lead.estagio_lead,
      resumo_comercial: lead.resumo_comercial,
      valor: lead.valor,
      observacao_vendedor: lead.observacao_vendedor,
      created_at: createdAtBrasilia,
      updated_at: updatedAtBrasilia,
      timestamp: brasiliaTimestamp,
      action: "moved_to_pesquisa_atendimento", // identificador da ação
    }

    console.log("[v0] Pesquisa atendimento webhook payload:", payload)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "CRM-Atual-Veiculos/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      mode: "cors",
    })

    clearTimeout(timeoutId)

    console.log("[v0] Pesquisa atendimento webhook response status:", response.status)
    console.log("[v0] Pesquisa atendimento webhook response headers:", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unable to read error response")
      console.error("[v0] Pesquisa atendimento webhook error response:", errorText)
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }

    const responseData = await response.text().catch(() => "No response body")
    console.log("[v0] Pesquisa atendimento webhook success response:", responseData)

    return true
  } catch (error) {
    console.error("[v0] Error sending pesquisa atendimento webhook:", error)

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.error("[v0] Pesquisa atendimento webhook request timed out after 30 seconds")
      } else if (error.message.includes("Failed to fetch")) {
        console.error("[v0] Network error - check if webhook URL is accessible and CORS is configured")
      }
      console.error("[v0] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      })
    }

    return false
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function parseCurrency(value: string): number {
  if (!value || typeof value !== "string") return 0

  // Remove espaços e caracteres especiais, mantendo apenas números, vírgulas e pontos
  let cleanValue = value.replace(/[^\d,.-]/g, "")

  // Se estiver vazio após limpeza, retorna 0
  if (!cleanValue) return 0

  // Lidar com diferentes formatos de entrada:
  // 35000 -> 35000
  // 35.000 -> 35000 (formato brasileiro de milhares)
  // 35,00 -> 35 (formato brasileiro de decimais)
  // 35.000,00 -> 35000 (formato brasileiro completo)

  // Se tem vírgula, assumimos que é separador decimal brasileiro
  if (cleanValue.includes(",")) {
    // Se tem ponto E vírgula, o ponto é separador de milhares
    if (cleanValue.includes(".") && cleanValue.includes(",")) {
      // Formato: 35.000,00 -> remove pontos e substitui vírgula por ponto
      cleanValue = cleanValue.replace(/\./g, "").replace(",", ".")
    } else {
      // Formato: 35000,00 -> substitui vírgula por ponto
      cleanValue = cleanValue.replace(",", ".")
    }
  }
  // Se tem apenas pontos, pode ser separador de milhares ou decimal
  else if (cleanValue.includes(".")) {
    // Se tem mais de um ponto, são separadores de milhares
    const dotCount = (cleanValue.match(/\./g) || []).length
    if (dotCount > 1) {
      // Remove todos os pontos (separadores de milhares)
      cleanValue = cleanValue.replace(/\./g, "")
    }
    // Se tem apenas um ponto, pode ser decimal ou milhares
    // Se tem mais de 3 dígitos após o ponto, é separador de milhares
    else {
      const parts = cleanValue.split(".")
      if (parts[1] && parts[1].length > 2) {
        // É separador de milhares, remove o ponto
        cleanValue = cleanValue.replace(".", "")
      }
      // Senão, mantém como separador decimal
    }
  }

  // Converte para número
  const numericValue = Number.parseFloat(cleanValue)

  return isNaN(numericValue) ? 0 : numericValue
}

export async function getLeadStats(idEmpresa: number) {
  const supabase = createClient()

  const { data: leads, error } = await supabase
    .from("BASE_DE_LEADS")
    .select("estagio_lead, origem, valor")
    .eq("id_empresa", idEmpresa)

  if (error || !leads) {
    return {
      totalLeads: 0,
      leadsPorEstagio: {},
      leadsPorOrigem: {},
      conversao: {},
      valorTotal: 0,
      valorMedio: 0,
    }
  }

  const totalLeads = leads.length
  const leadsPorEstagio = leads.reduce((acc: any, lead) => {
    const estagio = normalizeLeadStage(lead.estagio_lead)
    acc[estagio] = (acc[estagio] || 0) + 1
    return acc
  }, {})

  const leadsPorOrigem = leads.reduce((acc: any, lead) => {
    if (lead.origem) {
      acc[lead.origem] = (acc[lead.origem] || 0) + 1
    }
    return acc
  }, {})

  const fechados = leadsPorEstagio.fechado || 0
  const conversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1) : "0"

  // Calcular valores totais e médios
  const valorTotal = leads.reduce((sum, lead) => sum + (lead.valor || 0), 0)
  const valorMedio = totalLeads > 0 ? valorTotal / totalLeads : 0

  return {
    totalLeads,
    leadsPorEstagio,
    leadsPorOrigem,
    conversao,
    valorTotal,
    valorMedio,
  }
}

export async function deleteLead(leadId: number): Promise<boolean> {
  const supabase = createClient()

  try {
    const { error } = await supabase.from("BASE_DE_LEADS").delete().eq("id", leadId)

    if (error) {
      console.error("Error deleting lead:", error)
      return false
    }

    console.log("Lead deleted successfully:", leadId)
    return true
  } catch (error) {
    console.error("Unexpected error deleting lead:", error)
    return false
  }
}

export async function deleteLeads(leadIds: number[]): Promise<boolean> {
  const supabase = createClient()

  try {
    const { error } = await supabase.from("BASE_DE_LEADS").delete().in("id", leadIds)

    if (error) {
      console.error("Error deleting leads:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error deleting leads:", error)
    return false
  }
}

export async function sendFollowUpWebhook(leads: Lead[]): Promise<boolean> {
  try {
    const response = await fetch("https://n8n.eazy.tec.br/webhook/enviarfollowkarrao", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leads: leads.map((lead) => ({
          id: lead.id,
          nome: lead.nome_lead,
          telefone: lead.telefone,
          email: lead.email,
          origem: lead.origem,
          vendedor: lead.vendedor,
          veiculo_interesse: lead.veiculo_interesse,
          valor: lead.valor,
          observacao: lead.observacao_vendedor,
          estagio: lead.estagio_lead,
        })),
        timestamp: new Date().toISOString(),
      }),
    })

    return response.ok
  } catch (error) {
    console.error("Error sending follow up webhook:", error)
    return false
  }
}

export async function sendMessageWebhook(leads: Lead[], message: string): Promise<boolean> {
  try {
    const response = await fetch("https://n8n.eazy.tec.br/webhook/fda6002f-33a2-4550-ada9-34cffa3e140e", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leads: leads.map((lead) => ({
          id: lead.id,
          nome: lead.nome_lead,
          telefone: lead.telefone,
          email: lead.email,
          origem: lead.origem,
          vendedor: lead.vendedor,
          veiculo_interesse: lead.veiculo_interesse,
          valor: lead.valor,
          observacao: lead.observacao_vendedor,
          estagio: lead.estagio_lead,
        })),
        mensagem: message,
        timestamp: new Date().toISOString(),
      }),
    })

    return response.ok
  } catch (error) {
    console.error("Error sending message webhook:", error)
    return false
  }
}
