import { createClient } from "@/utils/supabase/client"

export interface Etiqueta {
  id: string
  id_empresa: number
  nome: string
  cor: string
  created_at: string
  updated_at: string
}

interface LeadEtiqueta {
  id: string
  id_empresa: number
  id_lead: number
  id_etiqueta: string
  created_at: string
}

const ETIQUETAS_STORAGE_KEY = "crm_etiquetas_v1"
const LEAD_ETIQUETAS_STORAGE_KEY = "crm_lead_etiquetas_v1"

function isMissingTableError(error: any) {
  const message = String(error?.message || "")
  return error?.code === "42P01" || message.toLowerCase().includes("does not exist")
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function readStoredEtiquetas(): Etiqueta[] {
  if (!canUseLocalStorage()) return []

  try {
    const raw = window.localStorage.getItem(ETIQUETAS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeStoredEtiquetas(etiquetas: Etiqueta[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(ETIQUETAS_STORAGE_KEY, JSON.stringify(etiquetas))
}

function readStoredLeadEtiquetas(): LeadEtiqueta[] {
  if (!canUseLocalStorage()) return []

  try {
    const raw = window.localStorage.getItem(LEAD_ETIQUETAS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeStoredLeadEtiquetas(relacoes: LeadEtiqueta[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(LEAD_ETIQUETAS_STORAGE_KEY, JSON.stringify(relacoes))
}

function sortEtiquetas(etiquetas: Etiqueta[]) {
  return [...etiquetas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

function buildLeadEtiquetaMap(etiquetas: Etiqueta[], relacoes: LeadEtiqueta[]) {
  const etiquetasById = new Map(etiquetas.map((etiqueta) => [etiqueta.id, etiqueta]))
  const leadMap: Record<number, Etiqueta[]> = {}

  relacoes.forEach((relacao) => {
    const etiqueta = etiquetasById.get(relacao.id_etiqueta)
    if (!etiqueta) return

    if (!leadMap[relacao.id_lead]) {
      leadMap[relacao.id_lead] = []
    }

    leadMap[relacao.id_lead].push(etiqueta)
  })

  Object.keys(leadMap).forEach((leadId) => {
    leadMap[Number(leadId)] = sortEtiquetas(leadMap[Number(leadId)])
  })

  return leadMap
}

export async function getEtiquetas(idEmpresa: number): Promise<Etiqueta[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("ETIQUETAS")
    .select("*")
    .eq("id_empresa", idEmpresa)
    .order("nome", { ascending: true })

  if (!error) {
    return data || []
  }

  console.error("Erro ao buscar etiquetas no Supabase, usando armazenamento local:", error)

  return sortEtiquetas(readStoredEtiquetas().filter((etiqueta) => etiqueta.id_empresa === idEmpresa))
}

export async function createEtiqueta(input: {
  id_empresa: number
  nome: string
  cor: string
}): Promise<Etiqueta | null> {
  const payload = {
    id_empresa: input.id_empresa,
    nome: input.nome.trim(),
    cor: input.cor,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const supabase = createClient()
  const { data, error } = await supabase.from("ETIQUETAS").insert(payload).select().single()

  if (!error && data) {
    return data
  }

  console.error("Erro ao criar etiqueta no Supabase, usando armazenamento local:", error)

  const etiquetas = readStoredEtiquetas()
  const existente = etiquetas.find(
    (etiqueta) => etiqueta.id_empresa === input.id_empresa && etiqueta.nome.trim().toLowerCase() === payload.nome.toLowerCase(),
  )

  if (existente) {
    return existente
  }

  const etiqueta: Etiqueta = {
    id: crypto.randomUUID(),
    ...payload,
  }

  writeStoredEtiquetas([...etiquetas, etiqueta])
  return etiqueta
}

export async function deleteEtiqueta(idEmpresa: number, etiquetaId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from("ETIQUETAS").delete().eq("id_empresa", idEmpresa).eq("id", etiquetaId)

  if (!error) {
    await supabase.from("LEAD_ETIQUETAS").delete().eq("id_empresa", idEmpresa).eq("id_etiqueta", etiquetaId)
    return true
  }

  console.error("Erro ao excluir etiqueta no Supabase, usando armazenamento local:", error)

  writeStoredEtiquetas(
    readStoredEtiquetas().filter((etiqueta) => !(etiqueta.id_empresa === idEmpresa && etiqueta.id === etiquetaId)),
  )
  writeStoredLeadEtiquetas(
    readStoredLeadEtiquetas().filter(
      (relacao) => !(relacao.id_empresa === idEmpresa && relacao.id_etiqueta === etiquetaId),
    ),
  )
  return true
}

export async function getLeadEtiquetasMap(idEmpresa: number, leadIds: number[]): Promise<Record<number, Etiqueta[]>> {
  if (leadIds.length === 0) return {}

  const supabase = createClient()
  const [{ data: etiquetasData, error: etiquetasError }, { data: relacoesData, error: relacoesError }] =
    await Promise.all([
      supabase.from("ETIQUETAS").select("*").eq("id_empresa", idEmpresa),
      supabase.from("LEAD_ETIQUETAS").select("*").eq("id_empresa", idEmpresa).in("id_lead", leadIds),
    ])

  if (!etiquetasError && !relacoesError) {
    return buildLeadEtiquetaMap(etiquetasData || [], (relacoesData || []) as LeadEtiqueta[])
  }

  if (etiquetasError) {
    console.error("Erro ao buscar etiquetas dos leads no Supabase, usando armazenamento local:", etiquetasError)
  }

  if (relacoesError) {
    console.error("Erro ao buscar relacoes de etiquetas no Supabase, usando armazenamento local:", relacoesError)
  }

  const etiquetas = readStoredEtiquetas().filter((etiqueta) => etiqueta.id_empresa === idEmpresa)
  const relacoes = readStoredLeadEtiquetas().filter(
    (relacao) => relacao.id_empresa === idEmpresa && leadIds.includes(relacao.id_lead),
  )

  return buildLeadEtiquetaMap(etiquetas, relacoes)
}

export async function assignEtiquetaToLead(idEmpresa: number, leadId: number, etiquetaId: string): Promise<boolean> {
  const supabase = createClient()

  const { data: existente, error: consultaError } = await supabase
    .from("LEAD_ETIQUETAS")
    .select("id")
    .eq("id_empresa", idEmpresa)
    .eq("id_lead", leadId)
    .eq("id_etiqueta", etiquetaId)
    .maybeSingle()

  if (!consultaError) {
    if (existente) return true

    const { error: insertError } = await supabase.from("LEAD_ETIQUETAS").insert({
      id_empresa: idEmpresa,
      id_lead: leadId,
      id_etiqueta: etiquetaId,
      created_at: new Date().toISOString(),
    })

    if (!insertError) {
      return true
    }

    console.error("Erro ao vincular etiqueta ao lead no Supabase, usando armazenamento local:", insertError)
  } else if (consultaError) {
    console.error("Erro ao consultar etiqueta do lead no Supabase, usando armazenamento local:", consultaError)
  }

  const relacoes = readStoredLeadEtiquetas()
  const existeLocal = relacoes.some(
    (relacao) => relacao.id_empresa === idEmpresa && relacao.id_lead === leadId && relacao.id_etiqueta === etiquetaId,
  )

  if (existeLocal) return true

  writeStoredLeadEtiquetas([
    ...relacoes,
    {
      id: crypto.randomUUID(),
      id_empresa: idEmpresa,
      id_lead: leadId,
      id_etiqueta: etiquetaId,
      created_at: new Date().toISOString(),
    },
  ])

  return true
}

export async function removeEtiquetaFromLead(idEmpresa: number, leadId: number, etiquetaId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from("LEAD_ETIQUETAS")
    .delete()
    .eq("id_empresa", idEmpresa)
    .eq("id_lead", leadId)
    .eq("id_etiqueta", etiquetaId)

  if (!error) {
    return true
  }

  console.error("Erro ao remover etiqueta do lead no Supabase, usando armazenamento local:", error)

  writeStoredLeadEtiquetas(
    readStoredLeadEtiquetas().filter(
      (relacao) =>
        !(
          relacao.id_empresa === idEmpresa &&
          relacao.id_lead === leadId &&
          relacao.id_etiqueta === etiquetaId
        ),
    ),
  )

  return true
}
