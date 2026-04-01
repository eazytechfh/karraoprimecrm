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

export async function getAgendamentos(idEmpresa: number): Promise<Agendamento[]> {
  const supabase = createClient()
  const user = getCurrentUser()

  console.log("[v0] getAgendamentos - user:", { nome: user?.nome_usuario, cargo: user?.cargo })

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

    console.log("[v0] Total de agendamentos retornados para SDR:", agendamentosData?.length || 0)
    return (agendamentosData || []).map((agendamento) => ({
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

  console.log("[v0] Agendamentos retornados:", data?.length || 0)
  return (data || []).map((agendamento) => ({
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
    sdr?: string // Added SDR filter parameter
    status?: string // Added status filter parameter
    periodo?: "hoje" | "ultimos7dias"
  },
): Promise<Agendamento[]> {
  const supabase = createClient()
  const user = getCurrentUser()

  let query = supabase
    .from("AGENDAMENTOS")
    .select("*")
    .eq("id_empresa", idEmpresa)
    .in("estagio_agendamento", ["agendar", "nao_compareceu", "reagendado", "visita_realizada", "sucesso", "insucesso"])
    .order("updated_at", { ascending: false })

  // Filter by vendedor role
  if (user && user.cargo === "vendedor") {
    query = query.eq("vendedor", user.nome_usuario)
  }

  // Filter by SDR role
  if (user && user.cargo === "sdr") {
    query = query.eq("sdr_responsavel", user.nome_usuario)
  }

  // Apply filters
  if (filters?.vendedor) {
    query = query.eq("vendedor", filters.vendedor)
  }

  if (filters?.sdr) {
    query = query.eq("sdr_responsavel", filters.sdr)
  }

  if (filters?.status) {
    query = query.eq("estagio_agendamento", normalizeAgendamentoStage(filters.status))
  }

  if (filters?.periodo === "hoje") {
    const hoje = new Date().toISOString().split("T")[0]
    query = query.gte("updated_at", hoje)
  } else if (filters?.periodo === "ultimos7dias") {
    const seteDiasAtras = new Date()
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
    query = query.gte("updated_at", seteDiasAtras.toISOString())
  }

  if (filters?.dataInicio) {
    query = query.gte("updated_at", filters.dataInicio)
  }

  if (filters?.dataFim) {
    const dataFimAjustada = new Date(filters.dataFim)
    dataFimAjustada.setDate(dataFimAjustada.getDate() + 1)
    query = query.lt("updated_at", dataFimAjustada.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error fetching histórico visitas:", error)
    return []
  }

  return (data || []).map((agendamento) => ({
    ...agendamento,
    estagio_agendamento: normalizeAgendamentoStage(agendamento.estagio_agendamento),
  }))
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
