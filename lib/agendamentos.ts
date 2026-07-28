import { createClient } from "@/utils/supabase/client"
import { getCurrentUser } from "@/lib/auth"

export interface Agendamento {
  id: number
  id_empresa: number
  id_lead: number
  nome_lead: string
  telefone?: string
  email?: string
  modelo_veiculo?: string
  data_agendamento?: string
  hora_agendamento?: string
  vendedor?: string
  estagio_agendamento: string
  observacoes?: string
  observacoes_vendedor?: string // Novo campo para observações do vendedor
  sdr_responsavel?: string
  motivo_perda?: string
  data_perda?: string
  data_venda?: string
  veiculo_vendido?: string
  valor_venda?: number
  created_at: string
  updated_at: string
}

export interface HistoricoMovimentacao {
  id: number
  id_agendamento: number
  id_empresa: number
  estagio_anterior?: string
  estagio_novo: string
  usuario_nome: string
  usuario_cargo: string
  motivo_perda?: string
  observacao?: string
  created_at: string
}

export interface Vendedor {
  id: number
  nome_usuario: string
  email?: string
  telefone?: string
  cargo?: string
  id_empresa: number
}

export const ESTAGIO_AGENDAMENTO_LABELS = {
  agendar: "Agendar",
  agendado: "Agendado",
  nao_compareceu: "Não Compareceu",
  reagendado: "Reagendado",
  visita_realizada: "Visita Realizada",
  sucesso: "Sucesso",
  insucesso: "Insucesso",
}

export const ESTAGIO_AGENDAMENTO_COLORS = {
  agendar: "bg-blue-100 text-blue-800",
  agendado: "bg-cyan-100 text-cyan-800",
  nao_compareceu: "bg-amber-100 text-amber-800",
  reagendado: "bg-indigo-100 text-indigo-800",
  visita_realizada: "bg-purple-100 text-purple-800",
  sucesso: "bg-emerald-100 text-emerald-800",
  insucesso: "bg-red-100 text-red-800",
}

export const VALID_ESTAGIOS_AGENDAMENTO = [
  "agendar",
  "agendado",
  "nao_compareceu",
  "reagendado",
  "visita_realizada",
  "sucesso",
  "insucesso",
]

const DASHBOARD_BATCH_SIZE = 1000

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getAgendamentoDateRange(filters?: { dataInicio?: string; dataFim?: string; periodo?: "mes" | "hoje" | "ultimos7dias" }) {
  if (filters?.dataInicio || filters?.dataFim) {
    return {
      startDate: filters.dataInicio,
      endDate: filters.dataFim,
    }
  }

  const now = new Date()

  if (filters?.periodo === "hoje") {
    const today = formatDateInput(now)
    return { startDate: today, endDate: today }
  }

  if (filters?.periodo === "ultimos7dias") {
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    return { startDate: formatDateInput(start), endDate: formatDateInput(now) }
  }

  return {
    startDate: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: formatDateInput(now),
  }
}

function toDateTimeRange(startDate?: string, endDate?: string) {
  const start = startDate ? new Date(`${startDate}T00:00:00`).toISOString() : undefined
  let endExclusive: string | undefined

  if (endDate) {
    const end = new Date(`${endDate}T00:00:00`)
    end.setDate(end.getDate() + 1)
    endExclusive = end.toISOString()
  }

  return { start, endExclusive }
}

export function formatAgendamentoDate(date?: string) {
  if (!date) return ""

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-")
    return `${day}/${month}/${year}`
  }

  const parsedDate = new Date(date)
  return Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleDateString("pt-BR")
}

const ESTAGIO_AGENDAMENTO_NORMALIZATION: Record<string, string> = {
  agendar: "agendar",
  agendado: "agendado",
  nao_compareceu: "nao_compareceu",
  "não compareceu": "nao_compareceu",
  reagendado: "reagendado",
  visita_realizada: "visita_realizada",
  realizou_visita: "visita_realizada",
  "realizou a visita": "visita_realizada",
  sucesso: "sucesso",
  fechou: "sucesso",
  insucesso: "insucesso",
  nao_fechou: "insucesso",
  "não fechou": "insucesso",
}

export function normalizeAgendamentoStage(estagio?: string | null): string {
  if (!estagio) return "agendar"
  return ESTAGIO_AGENDAMENTO_NORMALIZATION[estagio.toLowerCase().trim()] || estagio
}

export interface AgendamentoCheckboxFlags {
  hasFlags: boolean
  realizouVisita: boolean
  ganho: boolean
  cleanObservacoes: string
}

export function parseAgendamentoCheckboxFlags(observacoes?: string): AgendamentoCheckboxFlags {
  const raw = observacoes || ""
  const match = raw.match(/__flags__:rv=(0|1);g=(0|1)/)
  const hasFlags = !!match
  const realizouVisita = match ? match[1] === "1" : false
  const ganho = match ? match[2] === "1" : false
  const cleanObservacoes = raw
    .replace(/\n?__flags__:rv=(0|1);g=(0|1)\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return { hasFlags, realizouVisita, ganho, cleanObservacoes }
}

export function shouldAppearInRealizouVisitaColumn(agendamento: Pick<Agendamento, "estagio_agendamento" | "observacoes">) {
  const estagio = normalizeAgendamentoStage(agendamento.estagio_agendamento)

  if (estagio === "visita_realizada") {
    return true
  }

  if (estagio !== "sucesso") {
    return false
  }

  const flags = parseAgendamentoCheckboxFlags(agendamento.observacoes)
  return flags.ganho && flags.realizouVisita
}

export const MOTIVOS_PERDA = [
  "Avaliação baixa",
  "Desistência do cliente",
  "Duplicidade de lead",
  "Financiamento recusado",
  "Perdido concorrente",
  "Preço alto",
  "Sem contato",
  "Valor",
  "VEICULO VENDIDO",
] as const

export type MotivoPerda = (typeof MOTIVOS_PERDA)[number]

export const REGRAS_MOVIMENTACAO: Record<string, { de: string[]; para: string[] }> = {
  sdr: {
    de: VALID_ESTAGIOS_AGENDAMENTO,
    para: VALID_ESTAGIOS_AGENDAMENTO,
  },
  vendedor: {
    de: VALID_ESTAGIOS_AGENDAMENTO,
    para: VALID_ESTAGIOS_AGENDAMENTO,
  },
  gestor: {
    de: VALID_ESTAGIOS_AGENDAMENTO,
    para: VALID_ESTAGIOS_AGENDAMENTO,
  },
  administrador: {
    de: VALID_ESTAGIOS_AGENDAMENTO,
    para: VALID_ESTAGIOS_AGENDAMENTO,
  },
}

export function canMoveStage(cargo: string | undefined, estagioAtual: string, estagioNovo: string): boolean {
  if (!cargo) {
    console.log("[v0] canMoveStage: No cargo provided")
    return false
  }

  const cargoLower = cargo.toLowerCase().trim()
  console.log("[v0] canMoveStage:", { cargo, cargoLower, estagioAtual, estagioNovo })

  if (cargoLower === "administrador" || cargoLower === "gestor") {
    console.log("[v0] canMoveStage: Admin/Gestor - permitido")
    return true
  }

  const regras = REGRAS_MOVIMENTACAO[cargoLower]
  if (!regras) {
    console.log("[v0] canMoveStage: No rules for cargo:", cargoLower)
    return false
  }

  const estagioAtualNormalizado = normalizeAgendamentoStage(estagioAtual)
  const estagioNovoNormalizado = normalizeAgendamentoStage(estagioNovo)
  const canMove = regras.de.includes(estagioAtualNormalizado) && regras.para.includes(estagioNovoNormalizado)
  console.log("[v0] canMoveStage result:", canMove, { regras })
  return canMove
}

export function getMoveErrorMessage(cargo: string | undefined): string {
  if (!cargo) return "Você não tem permissão para mover agendamentos."

  const cargoLower = cargo.toLowerCase().trim()

  if (cargoLower === "sdr") {
    return "SDR pode mover leads de qualquer etapa para todas as etapas."
  }
  if (cargoLower === "vendedor") {
    return "Vendedor pode mover leads de qualquer etapa para todas as etapas."
  }
  if (cargoLower === "administrador" || cargoLower === "gestor") {
    return "Movimentação não permitida para este estágio."
  }
  return `Cargo '${cargo}' não tem permissão para esta movimentação.`
}

async function syncMissingAgendamentosFromLeads(idEmpresa: number) {
  const supabase = createClient()
  const user = getCurrentUser()
  const leads: Array<{
    id: number
    id_empresa: number
    nome_lead?: string
    telefone?: string
    email?: string
    veiculo_interesse?: string
    vendedor?: string
    sdr_responsavel?: string
    estagio_lead?: string
  }> = []
  let from = 0

  while (true) {
    const to = from + DASHBOARD_BATCH_SIZE - 1
    let leadsQuery = supabase
      .from("BASE_DE_LEADS")
      .select("id, id_empresa, nome_lead, telefone, email, veiculo_interesse, vendedor, sdr_responsavel, estagio_lead")
      .eq("id_empresa", idEmpresa)
      .in("estagio_lead", ["em_qualificacao", "vendedor", "transferido"])
      .range(from, to)

    if (user?.cargo === "vendedor") {
      leadsQuery = leadsQuery.eq("vendedor", user.nome_usuario)
    }

    const { data: leadsData, error: leadsError } = await leadsQuery

    if (leadsError) {
      console.error("[v0] Error fetching leads to sync agendamentos:", leadsError)
      return
    }

    if (!leadsData || leadsData.length === 0) {
      break
    }

    leads.push(...leadsData)

    if (leadsData.length < DASHBOARD_BATCH_SIZE) {
      break
    }

    from += DASHBOARD_BATCH_SIZE
  }

  if (leads.length === 0) {
    return
  }

  const existingLeadIds = new Set<number>()
  const leadIds = leads.map((lead) => lead.id)

  for (let index = 0; index < leadIds.length; index += DASHBOARD_BATCH_SIZE) {
    const batch = leadIds.slice(index, index + DASHBOARD_BATCH_SIZE)
    const { data: existingAgendamentos, error: existingError } = await supabase
      .from("AGENDAMENTOS")
      .select("id_lead")
      .eq("id_empresa", idEmpresa)
      .in("id_lead", batch)

    if (existingError) {
      console.error("[v0] Error checking existing agendamentos:", existingError)
      return
    }

    for (const agendamento of existingAgendamentos || []) {
      existingLeadIds.add(agendamento.id_lead)
    }
  }

  const missingLeads = leads.filter((lead) => !existingLeadIds.has(lead.id))

  if (missingLeads.length === 0) {
    return
  }

  const now = new Date().toISOString()
  const payload = missingLeads.map((lead) => ({
    id_empresa: lead.id_empresa,
    id_lead: lead.id,
    nome_lead: lead.nome_lead || "Lead sem nome",
    telefone: lead.telefone || null,
    email: lead.email || null,
    modelo_veiculo: lead.veiculo_interesse || null,
    vendedor: lead.vendedor || null,
    sdr_responsavel: lead.sdr_responsavel || null,
    estagio_agendamento: "agendar",
    created_at: now,
    updated_at: now,
  }))

  for (let index = 0; index < payload.length; index += DASHBOARD_BATCH_SIZE) {
    const { error: insertError } = await supabase
      .from("AGENDAMENTOS")
      .insert(payload.slice(index, index + DASHBOARD_BATCH_SIZE))

    if (insertError) {
      console.error("[v0] Error syncing missing agendamentos:", insertError)
      return
    }
  }
}

async function getMissingLeadAgendamentoCards(
  idEmpresa: number,
  existingAgendamentos: Agendamento[],
): Promise<Agendamento[]> {
  const supabase = createClient()
  const user = getCurrentUser()
  const existingLeadIds = new Set(existingAgendamentos.map((agendamento) => agendamento.id_lead).filter(Boolean))
  const missingCards: Agendamento[] = []
  let from = 0

  while (true) {
    const to = from + DASHBOARD_BATCH_SIZE - 1
    let leadsQuery = supabase
      .from("BASE_DE_LEADS")
      .select(
        "id, id_empresa, nome_lead, telefone, email, veiculo_interesse, vendedor, sdr_responsavel, estagio_lead, created_at, updated_at",
      )
      .eq("id_empresa", idEmpresa)
      .in("estagio_lead", ["em_qualificacao", "vendedor", "transferido"])
      .range(from, to)

    if (user?.cargo === "vendedor") {
      leadsQuery = leadsQuery.eq("vendedor", user.nome_usuario)
    }

    const { data: leadsData, error: leadsError } = await leadsQuery

    if (leadsError) {
      console.error("[v0] Error fetching virtual agendamento leads:", leadsError)
      return []
    }

    if (!leadsData || leadsData.length === 0) {
      break
    }

    for (const lead of leadsData) {
      if (existingLeadIds.has(lead.id)) {
        continue
      }

      missingCards.push({
        id: -lead.id,
        id_empresa: lead.id_empresa,
        id_lead: lead.id,
        nome_lead: lead.nome_lead || "Lead sem nome",
        telefone: lead.telefone || undefined,
        email: lead.email || undefined,
        modelo_veiculo: lead.veiculo_interesse || undefined,
        vendedor: lead.vendedor || undefined,
        sdr_responsavel: lead.sdr_responsavel || undefined,
        estagio_agendamento: "agendar",
        created_at: lead.created_at || new Date().toISOString(),
        updated_at: lead.updated_at || new Date().toISOString(),
      })
    }

    if (leadsData.length < DASHBOARD_BATCH_SIZE) {
      break
    }

    from += DASHBOARD_BATCH_SIZE
  }

  return missingCards
}

export async function getAgendamentos(idEmpresa: number): Promise<Agendamento[]> {
  const supabase = createClient()
  const user = getCurrentUser()

  console.log("[v0] getAgendamentos - user:", { nome: user?.nome_usuario, cargo: user?.cargo })
  await syncMissingAgendamentosFromLeads(idEmpresa)

  // SDR deve ver TODOS os agendamentos da empresa (mesmo comportamento do admin)
  if (user && user.cargo === "sdr") {
    console.log("[v0] Buscando TODOS os agendamentos para SDR:", user.nome_usuario)

    const { data: agendamentosData, error: agendamentosError } = await supabase
      .from("AGENDAMENTOS")
      .select("*")
      .eq("id_empresa", idEmpresa)
      .order("created_at", { ascending: false })

    if (agendamentosError) {
      console.error("[v0] Error fetching agendamentos:", agendamentosError)
      return []
    }

    const agendamentos = agendamentosData || []
    const missingLeadCards = await getMissingLeadAgendamentoCards(idEmpresa, agendamentos)

    console.log("[v0] Total de agendamentos retornados para SDR:", agendamentos.length + missingLeadCards.length)
    return [...agendamentos, ...missingLeadCards].map((agendamento) => ({
      ...agendamento,
      estagio_agendamento: normalizeAgendamentoStage(agendamento.estagio_agendamento),
    }))
  }

  let query = supabase
    .from("AGENDAMENTOS")
    .select("*")
    .eq("id_empresa", idEmpresa)
    .order("created_at", { ascending: false })

  if (user && user.cargo === "vendedor") {
    console.log("[v0] Filtrando agendamentos para Vendedor:", user.nome_usuario)
    query = query.eq("vendedor", user.nome_usuario)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error fetching agendamentos:", error)
    return []
  }

  const agendamentos = data || []
  const missingLeadCards = await getMissingLeadAgendamentoCards(idEmpresa, agendamentos)

  console.log("[v0] Agendamentos retornados:", agendamentos.length + missingLeadCards.length)
  return [...agendamentos, ...missingLeadCards].map((agendamento) => ({
    ...agendamento,
    estagio_agendamento: normalizeAgendamentoStage(agendamento.estagio_agendamento),
  }))
}

export async function getAgendamentosByLead(idLead: number): Promise<Agendamento[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("AGENDAMENTOS")
    .select("*")
    .eq("id_lead", idLead)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching agendamentos by lead:", error)
    return []
  }

  return (data || []).map((agendamento) => ({
    ...agendamento,
    estagio_agendamento: normalizeAgendamentoStage(agendamento.estagio_agendamento),
  }))
}

export async function createAgendamento(
  agendamento: Omit<Agendamento, "id" | "created_at" | "updated_at">,
): Promise<Agendamento | null> {
  const supabase = createClient()
  const payload = {
    ...agendamento,
    estagio_agendamento: normalizeAgendamentoStage(agendamento.estagio_agendamento),
  }

  try {
    const { data, error } = await supabase.from("AGENDAMENTOS").insert([payload]).select()

    if (error) {
      console.error("Error creating agendamento:", error)
      return null
    }

    return data?.[0] || null
  } catch (error) {
    console.error("Unexpected error creating agendamento:", error)
    return null
  }
}

export async function updateAgendamento(id: number, updates: Partial<Agendamento>): Promise<boolean> {
  const supabase = createClient()
  const normalizedUpdates = {
    ...updates,
    ...(updates.estagio_agendamento
      ? { estagio_agendamento: normalizeAgendamentoStage(updates.estagio_agendamento) }
      : {}),
  }

  try {
    console.log("[v0] updateAgendamento - id:", id)
    console.log("[v0] updateAgendamento - updates:", normalizedUpdates)

    const { error } = await supabase
      .from("AGENDAMENTOS")
      .update({
        ...normalizedUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error("[v0] Error updating agendamento - code:", error.code)
      console.error("[v0] Error updating agendamento - message:", error.message)
      console.error("[v0] Error updating agendamento - details:", error.details)
      console.error("[v0] Error updating agendamento - hint:", error.hint)
      return false
    }

    console.log("[v0] updateAgendamento - success")
    return true
  } catch (error) {
    console.error("[v0] Unexpected error updating agendamento:", error)
    return false
  }
}

export async function updateAgendamentoStage(id: number, novoEstagio: string): Promise<boolean> {
  const supabase = createClient()
  const { data: agendamento } = await supabase.from("AGENDAMENTOS").select("*").eq("id", id).single()

  if (!agendamento) {
    console.error("Agendamento not found")
    return false
  }

  const user = getCurrentUser()
  if (!user || !canMoveStage(user.cargo, agendamento.estagio_agendamento, novoEstagio)) {
    console.error(getMoveErrorMessage(user?.cargo))
    return false
  }

  const estagioAtual = normalizeAgendamentoStage(agendamento.estagio_agendamento)
  const estagioNovo = normalizeAgendamentoStage(novoEstagio)
  const result = await updateAgendamento(id, { estagio_agendamento: estagioNovo })

  if (result && estagioNovo === "agendado") {
    await sendNotificaVendedorWebhook(agendamento)
  }

  if (result) {
    await registrarHistoricoMovimentacao(
      id,
      agendamento.id_empresa,
      estagioAtual,
      estagioNovo,
      user.nome_usuario,
      user.cargo || "",
    )
  }

  return result
}

export async function updateAgendamentoStageWithMotivo(
  id: number,
  novoEstagio: string,
  motivoPerda?: string,
): Promise<boolean> {
  const supabase = createClient()
  const { data: agendamento } = await supabase.from("AGENDAMENTOS").select("*").eq("id", id).single()

  if (!agendamento) {
    console.error("Agendamento not found")
    return false
  }

  const user = getCurrentUser()
  if (!user || !canMoveStage(user.cargo, agendamento.estagio_agendamento, novoEstagio)) {
    console.error(getMoveErrorMessage(user?.cargo))
    return false
  }

  const estagioAtual = normalizeAgendamentoStage(agendamento.estagio_agendamento)
  const estagioNovo = normalizeAgendamentoStage(novoEstagio)
  const updates: Partial<Agendamento> = { estagio_agendamento: estagioNovo }

  if (estagioNovo === "insucesso" && motivoPerda) {
    updates.motivo_perda = motivoPerda
    updates.data_perda = new Date().toISOString().split("T")[0]
  }

  const result = await updateAgendamento(id, updates)

  if (result && estagioNovo === "agendado") {
    await sendNotificaVendedorWebhook(agendamento)
  }

  if (result) {
    await registrarHistoricoMovimentacao(
      id,
      agendamento.id_empresa,
      estagioAtual,
      estagioNovo,
      user.nome_usuario,
      user.cargo || "",
      motivoPerda,
    )
  }

  return result
}

export async function registrarHistoricoMovimentacao(
  idAgendamento: number,
  idEmpresa: number,
  estagioAnterior: string | undefined,
  estagioNovo: string,
  usuarioNome: string,
  usuarioCargo: string,
  motivoPerda?: string,
  observacao?: string,
): Promise<boolean> {
  const supabase = createClient()

  try {
    const { error } = await supabase.from("HISTORICO_MOVIMENTACOES").insert([
      {
        id_agendamento: idAgendamento,
        id_empresa: idEmpresa,
        estagio_anterior: estagioAnterior,
        estagio_novo: estagioNovo,
        usuario_nome: usuarioNome,
        usuario_cargo: usuarioCargo,
        motivo_perda: motivoPerda,
        observacao: observacao,
      },
    ])

    if (error) {
      console.error("[v0] Error registering movement history:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("[v0] Unexpected error registering movement history:", error)
    return false
  }
}

export async function getHistoricoMovimentacoes(idAgendamento: number): Promise<HistoricoMovimentacao[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("HISTORICO_MOVIMENTACOES")
    .select("*")
    .eq("id_agendamento", idAgendamento)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching movement history:", error)
    return []
  }

  return data || []
}

export async function sendNotificaVendedorWebhook(agendamento: Agendamento): Promise<boolean> {
  try {
    console.log("[v0] Starting notifica-vendedor webhook for agendamento:", agendamento.id)

    const webhookUrl = "https://n8n.eazy.tec.br/webhook/56429119-88b2-48f5-9676-e2535ae6204c"

    const now = new Date()
    const brasiliaOffset = -3 * 60
    const utc = now.getTime() + now.getTimezoneOffset() * 60000
    const brasiliaTime = new Date(utc + brasiliaOffset * 60000)

    const payload = {
      id: agendamento.id,
      id_empresa: agendamento.id_empresa,
      id_lead: agendamento.id_lead,
      nome_lead: agendamento.nome_lead,
      telefone: agendamento.telefone,
      email: agendamento.email,
      modelo_veiculo: agendamento.modelo_veiculo,
      data_agendamento: agendamento.data_agendamento,
      hora_agendamento: agendamento.hora_agendamento,
      vendedor: agendamento.vendedor,
      estagio_agendamento: agendamento.estagio_agendamento,
      observacoes: agendamento.observacoes,
      observacoes_vendedor: agendamento.observacoes_vendedor,
      sdr_responsavel: agendamento.sdr_responsavel,
      motivo_perda: agendamento.motivo_perda,
      data_perda: agendamento.data_perda,
      data_venda: agendamento.data_venda,
      veiculo_vendido: agendamento.veiculo_vendido,
      valor_venda: agendamento.valor_venda,
      created_at: agendamento.created_at,
      updated_at: agendamento.updated_at,
      timestamp: brasiliaTime.toISOString(),
      action: "moved_to_agendado",
    }

    console.log("[v0] Notifica vendedor webhook payload:", payload)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "CRM-Karrao-Multimarcas/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      mode: "cors",
    })

    clearTimeout(timeoutId)

    console.log("[v0] Notifica vendedor webhook response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unable to read error response")
      console.error("[v0] Notifica vendedor webhook error:", errorText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log("[v0] Notifica vendedor webhook success")
    return true
  } catch (error) {
    console.error("[v0] Error sending notifica vendedor webhook:", error)
    return false
  }
}

export async function deleteAgendamento(id: number): Promise<boolean> {
  const supabase = createClient()

  try {
    const { error } = await supabase.from("AGENDAMENTOS").delete().eq("id", id)

    if (error) {
      console.error("Error deleting agendamento:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Unexpected error deleting agendamento:", error)
    return false
  }
}

export async function deleteAgendamentos(ids: number[]): Promise<boolean> {
  const supabase = createClient()

  try {
    const { error } = await supabase.from("AGENDAMENTOS").delete().in("id", ids)

    if (error) {
      console.error("Error deleting agendamentos:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Unexpected error deleting agendamentos:", error)
    return false
  }
}

export async function getVendedores(idEmpresa: string | number): Promise<Vendedor[]> {
  const supabase = createClient()
  const empresaId = typeof idEmpresa === "string" ? Number.parseInt(idEmpresa, 10) : idEmpresa

  const { data, error } = await supabase
    .from("AUTORIZAÇÃO")
    .select("id, nome_usuario, email, telefone, cargo, id_empresa")
    .eq("id_empresa", empresaId)
    .eq("cargo", "vendedor")
    .order("nome_usuario", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching vendedores:", error)
    return []
  }

  return data || []
}

export async function getSdrs(idEmpresa: string | number): Promise<Vendedor[]> {
  const supabase = createClient()
  const empresaId = typeof idEmpresa === "string" ? Number.parseInt(idEmpresa, 10) : idEmpresa

  const { data, error } = await supabase
    .from("AUTORIZAÇÃO")
    .select("id, nome_usuario, email, telefone, cargo, id_empresa")
    .eq("id_empresa", empresaId)
    .eq("cargo", "sdr")
    .order("nome_usuario", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching SDRs:", error)
    return []
  }

  return data || []
}

export async function getHistoricoVisitas(
  idEmpresa: number,
  filters?: {
    dataInicio?: string
    dataFim?: string
    vendedor?: string
    sdr?: string
    status?: string
    periodo?: "mes" | "hoje" | "ultimos7dias"
  },
  pagination?: { page: number; pageSize: number },
): Promise<{ data: Agendamento[]; total: number }> {
  const supabase = createClient()
  const user = getCurrentUser()
  const { startDate, endDate } = getAgendamentoDateRange(filters)
  const { start, endExclusive } = toDateTimeRange(startDate, endDate)
  const dateRange = { startDate, endDate, start, endExclusive }
  const allData: Agendamento[] = []
  let from = 0

  while (true) {
    const to = from + DASHBOARD_BATCH_SIZE - 1
    let query = supabase
      .from("AGENDAMENTOS")
      .select("*")
      .eq("id_empresa", idEmpresa)
      .in("estagio_agendamento", ["agendar", "nao_compareceu", "reagendado", "visita_realizada", "sucesso", "insucesso"])
      .order("updated_at", { ascending: false })
      .range(from, to)

    if (user && user.cargo === "vendedor") {
      query = query.eq("vendedor", user.nome_usuario)
    }

    if (user && user.cargo === "sdr") {
      query = query.eq("sdr_responsavel", user.nome_usuario)
    }

    if (filters?.vendedor) {
      query = query.eq("vendedor", filters.vendedor)
    }

    if (filters?.sdr) {
      query = query.eq("sdr_responsavel", filters.sdr)
    }

    if (filters?.status) {
      query = query.eq("estagio_agendamento", normalizeAgendamentoStage(filters.status))
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Error fetching historico visitas:", error)
      return { data: [], total: 0 }
    }

    if (!data || data.length === 0) {
      break
    }

    allData.push(...data)

    if (data.length < DASHBOARD_BATCH_SIZE) {
      break
    }

    from += DASHBOARD_BATCH_SIZE
  }

  const filteredByDate = allData.filter((agendamento) => isWithinAgendamentoPerformanceRange(agendamento, dateRange))
  const paginatedData = pagination
    ? filteredByDate.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize)
    : filteredByDate

  return {
    data: paginatedData.map((agendamento) => ({
      ...agendamento,
      estagio_agendamento: normalizeAgendamentoStage(agendamento.estagio_agendamento),
    })),
    total: filteredByDate.length,
  }
}

export interface SdrStats {
  sdr: string
  leads: number
  agendamentos: number
  visitas: number
  sucesso: number
}

interface SdrPerformanceFilters {
  dataInicio?: string
  dataFim?: string
  sdr?: string
  periodo?: "mes" | "hoje" | "ultimos7dias"
}

function resolveSdrPerformanceDateRange(filters?: SdrPerformanceFilters) {
  const { startDate, endDate } = getAgendamentoDateRange(filters)
  const { start, endExclusive } = toDateTimeRange(startDate, endDate)

  return { startDate, endDate, start, endExclusive }
}

function isWithinAgendamentoPerformanceRange(
  agendamento: Pick<Agendamento, "data_agendamento" | "updated_at">,
  range: { startDate?: string; endDate?: string; start?: string; endExclusive?: string },
) {
  if (agendamento.data_agendamento) {
    const dataAgendamento = agendamento.data_agendamento.split("T")[0]

    if (range.startDate && dataAgendamento < range.startDate) {
      return false
    }

    if (range.endDate && dataAgendamento > range.endDate) {
      return false
    }

    return true
  }

  if (!agendamento.updated_at) {
    return false
  }

  if (range.start && agendamento.updated_at < range.start) {
    return false
  }

  if (range.endExclusive && agendamento.updated_at >= range.endExclusive) {
    return false
  }

  return true
}

export async function getSdrPerformanceStats(idEmpresa: number, filters?: SdrPerformanceFilters): Promise<SdrStats[]> {
  const supabase = createClient()
  const user = getCurrentUser()
  const { startDate, endDate, start, endExclusive } = resolveSdrPerformanceDateRange(filters)
  const performanceRange = { startDate, endDate, start, endExclusive }

  // Only real SDRs from AUTORIZAÇÃO table
  const { data: sdrsData } = await supabase
    .from("AUTORIZAÇÃO")
    .select("nome_usuario")
    .eq("id_empresa", idEmpresa)
    .eq("cargo", "sdr")

  const realSdrs = new Set((sdrsData || []).map((s) => s.nome_usuario as string))
  if (realSdrs.size === 0) return []

  const statsMap: Record<string, SdrStats> = {}
  for (const sdrName of realSdrs) {
    statsMap[sdrName] = { sdr: sdrName, leads: 0, agendamentos: 0, visitas: 0, sucesso: 0 }
  }

  const sdrFilter = user?.cargo === "sdr" ? user.nome_usuario : filters?.sdr || null

  // Leads por SDR (mês atual)
  let leadsFrom = 0
  while (true) {
    const leadsTo = leadsFrom + DASHBOARD_BATCH_SIZE - 1
    let leadsQuery = supabase
      .from("BASE_DE_LEADS")
      .select("sdr_responsavel")
      .eq("id_empresa", idEmpresa)
      .not("sdr_responsavel", "is", null)
      .range(leadsFrom, leadsTo)

    if (start) leadsQuery = leadsQuery.gte("created_at", start)
    if (endExclusive) leadsQuery = leadsQuery.lt("created_at", endExclusive)
    if (sdrFilter) leadsQuery = leadsQuery.eq("sdr_responsavel", sdrFilter)

    const { data: leadsData, error: leadsError } = await leadsQuery

    if (leadsError) {
      throw leadsError
    }

    if (!leadsData || leadsData.length === 0) {
      break
    }

    for (const row of leadsData) {
      const sdr = row.sdr_responsavel as string
      if (statsMap[sdr]) statsMap[sdr].leads++
    }

    if (leadsData.length < DASHBOARD_BATCH_SIZE) {
      break
    }

    leadsFrom += DASHBOARD_BATCH_SIZE
  }

  // Agendamentos por SDR (mês atual)
  let agFrom = 0
  while (true) {
    const agTo = agFrom + DASHBOARD_BATCH_SIZE - 1
    let agQuery = supabase
      .from("AGENDAMENTOS")
      .select("sdr_responsavel, data_agendamento, updated_at")
      .eq("id_empresa", idEmpresa)
      .not("sdr_responsavel", "is", null)
      .range(agFrom, agTo)

    if (sdrFilter) agQuery = agQuery.eq("sdr_responsavel", sdrFilter)

    const { data: agData, error: agError } = await agQuery

    if (agError) {
      throw agError
    }

    if (!agData || agData.length === 0) {
      break
    }

    for (const row of agData) {
      const sdr = row.sdr_responsavel as string
      if (!statsMap[sdr]) continue
      if (!isWithinAgendamentoPerformanceRange(row, performanceRange)) continue
      statsMap[sdr].agendamentos++
    }

    if (agData.length < DASHBOARD_BATCH_SIZE) {
      break
    }

    agFrom += DASHBOARD_BATCH_SIZE
  }

  // Visitas e sucessos do mês atual, considerando a movimentação ocorrida no mês
  let visitasFrom = 0
  while (true) {
    const visitasTo = visitasFrom + DASHBOARD_BATCH_SIZE - 1
    let visitasQuery = supabase
      .from("AGENDAMENTOS")
      .select("sdr_responsavel, estagio_agendamento, data_agendamento, updated_at")
      .eq("id_empresa", idEmpresa)
      .not("sdr_responsavel", "is", null)
      .in("estagio_agendamento", ["visita_realizada", "sucesso", "insucesso"])
      .range(visitasFrom, visitasTo)

    if (sdrFilter) visitasQuery = visitasQuery.eq("sdr_responsavel", sdrFilter)

    const { data: visitasData, error: visitasError } = await visitasQuery

    if (visitasError) {
      throw visitasError
    }

    if (!visitasData || visitasData.length === 0) {
      break
    }

    for (const row of visitasData) {
      const sdr = row.sdr_responsavel as string
      if (!statsMap[sdr]) continue
      if (!isWithinAgendamentoPerformanceRange(row, performanceRange)) continue

      const estagio = normalizeAgendamentoStage(row.estagio_agendamento)
      if (["visita_realizada", "sucesso", "insucesso"].includes(estagio)) {
        statsMap[sdr].visitas++
      }
      if (estagio === "sucesso") {
        statsMap[sdr].sucesso++
      }
    }

    if (visitasData.length < DASHBOARD_BATCH_SIZE) {
      break
    }

    visitasFrom += DASHBOARD_BATCH_SIZE
  }

  return Object.values(statsMap).sort((a, b) => a.sdr.localeCompare(b.sdr, "pt-BR"))
}

export async function marcarRealizouVisita(id: number): Promise<boolean> {
  const supabase = createClient()
  const { data: agendamento } = await supabase.from("AGENDAMENTOS").select("*").eq("id", id).single()

  if (!agendamento) {
    console.error("Agendamento not found")
    return false
  }

  const user = getCurrentUser()
  if (!user) {
    console.error("User not found")
    return false
  }

  const result = await updateAgendamento(id, { estagio_agendamento: "visita_realizada" })

  if (result) {
    await registrarHistoricoMovimentacao(
      id,
      agendamento.id_empresa,
      normalizeAgendamentoStage(agendamento.estagio_agendamento),
      "visita_realizada",
      user.nome_usuario,
      user.cargo || "",
      undefined,
      "Marcado como visita realizada",
    )
  }

  return result
}

export async function reagendarVisita(id: number): Promise<boolean> {
  const supabase = createClient()
  const { data: agendamento } = await supabase.from("AGENDAMENTOS").select("*").eq("id", id).single()

  if (!agendamento) {
    console.error("Agendamento not found")
    return false
  }

  const user = getCurrentUser()
  if (!user) {
    console.error("User not found")
    return false
  }

  const result = await updateAgendamento(id, { estagio_agendamento: "reagendado" })

  if (result) {
    await registrarHistoricoMovimentacao(
      id,
      agendamento.id_empresa,
      normalizeAgendamentoStage(agendamento.estagio_agendamento),
      "reagendado",
      user.nome_usuario,
      user.cargo || "",
      undefined,
      "Visita reagendada",
    )
  }

  return result
}

export async function registrarVenda(
  id: number,
  dataVenda: string,
  veiculoVendido: string,
  valorVenda: number,
): Promise<boolean> {
  const updates: Partial<Agendamento> = {
    estagio_agendamento: "sucesso",
    data_venda: dataVenda,
    veiculo_vendido: veiculoVendido,
    valor_venda: valorVenda,
  }

  return await updateAgendamento(id, updates)
}

export async function sendFollowUpWebhook(agendamentos: Agendamento[]): Promise<Response> {
  try {
    console.log("[v0] Starting follow up webhook for", agendamentos.length, "agendamentos")

    const webhookUrl = "https://n8n.eazy.tec.br/webhook/enviarfollowkarrao"

    const now = new Date()
    const brasiliaOffset = -3 * 60
    const utc = now.getTime() + now.getTimezoneOffset() * 60000
    const brasiliaTime = new Date(utc + brasiliaOffset * 60000)

    const payload = {
      agendamentos: agendamentos.map((a) => ({
        id: a.id,
        nome_lead: a.nome_lead,
        telefone: a.telefone,
        email: a.email,
        modelo_veiculo: a.modelo_veiculo,
        vendedor: a.vendedor,
        sdr_responsavel: a.sdr_responsavel,
        estagio: a.estagio_agendamento,
      })),
      count: agendamentos.length,
      timestamp: brasiliaTime.toISOString(),
      action: "send_follow_up",
    }

    console.log("[v0] Follow up webhook payload:", payload)

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })

    console.log("[v0] Follow up webhook response status:", response.status)
    return response
  } catch (error) {
    console.error("[v0] Error sending follow up webhook:", error)
    throw error
  }
}

export async function sendMessageWebhook(agendamentos: Agendamento[], message: string): Promise<Response> {
  try {
    console.log("[v0] Starting send message webhook for", agendamentos.length, "agendamentos")

    const webhookUrl = "https://n8n.eazy.tec.br/webhook/fda6002f-33a2-4550-ada9-34cffa3e140e"

    const now = new Date()
    const brasiliaOffset = -3 * 60
    const utc = now.getTime() + now.getTimezoneOffset() * 60000
    const brasiliaTime = new Date(utc + brasiliaOffset * 60000)

    const payload = {
      agendamentos: agendamentos.map((a) => ({
        id: a.id,
        nome_lead: a.nome_lead,
        telefone: a.telefone,
        email: a.email,
        modelo_veiculo: a.modelo_veiculo,
        vendedor: a.vendedor,
        sdr_responsavel: a.sdr_responsavel,
        estagio: a.estagio_agendamento,
      })),
      message: message,
      count: agendamentos.length,
      timestamp: brasiliaTime.toISOString(),
      action: "send_message",
    }

    console.log("[v0] Send message webhook payload:", payload)

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })

    console.log("[v0] Send message webhook response status:", response.status)
    return response
  } catch (error) {
    console.error("[v0] Error sending message webhook:", error)
    throw error
  }
}
