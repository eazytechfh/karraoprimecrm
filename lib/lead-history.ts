import { createClient } from "@/utils/supabase/client"

export interface LeadHistorico {
  id: string | number
  id_lead: number
  id_empresa: number
  descricao: string
  usuario_nome: string
  usuario_cargo?: string
  created_at: string
}

const STORAGE_KEY = "crm_lead_historico_v1"

function isMissingTableError(error: any) {
  const message = String(error?.message || "")
  return error?.code === "42P01" || message.toLowerCase().includes("does not exist")
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function readStoredHistorico(): LeadHistorico[] {
  if (!canUseLocalStorage()) return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeStoredHistorico(items: LeadHistorico[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function sortHistorico(items: LeadHistorico[]) {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function registerLeadHistory(input: {
  id_lead: number
  id_empresa: number
  descricao: string
  usuario_nome: string
  usuario_cargo?: string
}) {
  const payload = {
    ...input,
    usuario_cargo: input.usuario_cargo || null,
    created_at: new Date().toISOString(),
  }

  const supabase = createClient()
  const { data, error } = await supabase.from("LEAD_HISTORICO").insert(payload).select().single()

  if (!error && data) {
    return data as LeadHistorico
  }

  if (!isMissingTableError(error)) {
    console.error("Erro ao registrar historico do lead:", error)
    return null
  }

  const localItem: LeadHistorico = {
    id: crypto.randomUUID(),
    ...payload,
  }

  writeStoredHistorico([localItem, ...readStoredHistorico()])
  return localItem
}

export async function getLeadHistory(idEmpresa: number, leadId: number): Promise<LeadHistorico[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("LEAD_HISTORICO")
    .select("*")
    .eq("id_empresa", idEmpresa)
    .eq("id_lead", leadId)
    .order("created_at", { ascending: false })

  if (!error) {
    return (data || []) as LeadHistorico[]
  }

  if (!isMissingTableError(error)) {
    console.error("Erro ao buscar historico do lead:", error)
  }

  return sortHistorico(readStoredHistorico().filter((item) => item.id_empresa === idEmpresa && item.id_lead === leadId))
}

export async function getLatestLeadHistoryMap(idEmpresa: number, leadIds: number[]) {
  if (leadIds.length === 0) return {}

  const supabase = createClient()
  const { data, error } = await supabase
    .from("LEAD_HISTORICO")
    .select("*")
    .eq("id_empresa", idEmpresa)
    .in("id_lead", leadIds)
    .order("created_at", { ascending: false })

  let historico: LeadHistorico[] = []

  if (!error) {
    historico = (data || []) as LeadHistorico[]
  } else {
    if (!isMissingTableError(error)) {
      console.error("Erro ao buscar ultimos historicos dos leads:", error)
    }
    historico = sortHistorico(
      readStoredHistorico().filter((item) => item.id_empresa === idEmpresa && leadIds.includes(item.id_lead)),
    )
  }

  return historico.reduce<Record<number, LeadHistorico>>((acc, item) => {
    if (!acc[item.id_lead]) {
      acc[item.id_lead] = item
    }
    return acc
  }, {})
}

export function formatLeadHistoryDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}
