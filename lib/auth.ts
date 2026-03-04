import { createClient } from "@/utils/supabase/client"

export interface User {
  id: number
  id_empresa: number
  nome_empresa: string
  nome_usuario: string
  email: string
  telefone?: string
  plano: string
  status: "ativo" | "pendente" | "inativo"
  cargo: "administrador" | "gestor" | "sdr" | "vendedor"
  created_at: string
  updated_at: string
}

export const STATUS_LABELS = {
  ativo: "Ativo",
  pendente: "Pendente",
  inativo: "Inativo",
}

export const STATUS_COLORS = {
  ativo: "bg-green-100 text-green-800",
  pendente: "bg-yellow-100 text-yellow-800",
  inativo: "bg-red-100 text-red-800",
}

export const CARGO_LABELS = {
  administrador: "Administrador",
  gestor: "Gestor",
  sdr: "SDR",
  vendedor: "Vendedor",
}

export const CARGO_COLORS = {
  administrador: "bg-red-100 text-red-800",
  gestor: "bg-purple-100 text-purple-800",
  sdr: "bg-blue-100 text-blue-800",
  vendedor: "bg-green-100 text-green-800",
}

// Verifica se o usuário tem acesso total (administrador ou gestor)
export function hasFullAccess(user: User | null): boolean {
  return user?.cargo === "administrador" || user?.cargo === "gestor"
}

// Verifica se o usuário pode acessar a aba Negociações
export function canAccessNegociacoes(user: User | null): boolean {
  // Administrador, gestor, SDR e vendedor podem acessar
  return (
    user?.cargo === "administrador" || user?.cargo === "gestor" || user?.cargo === "sdr" || user?.cargo === "vendedor"
  )
}

// Verifica se o usuário pode acessar a aba Agendamentos
export function canAccessAgendamentos(user: User | null): boolean {
  // Todos os cargos podem acessar agendamentos
  return (
    user?.cargo === "administrador" || user?.cargo === "gestor" || user?.cargo === "sdr" || user?.cargo === "vendedor"
  )
}

// Verifica se o usuário pode acessar Dashboard
export function canAccessDashboard(user: User | null): boolean {
  // Apenas administrador e gestor
  return hasFullAccess(user)
}

// Verifica se o usuário pode acessar Estoque
export function canAccessEstoque(user: User | null): boolean {
  // Apenas administrador e gestor
  return hasFullAccess(user)
}

// Verifica se o usuário pode acessar Configurações
export function canAccessConfiguracoes(user: User | null): boolean {
  // Apenas administrador e gestor
  return hasFullAccess(user)
}

// Verifica se o usuário pode editar cards (leads/agendamentos)
export function canEditCards(user: User | null): boolean {
  // Vendedor não pode editar, apenas movimentar
  return user?.cargo !== "vendedor"
}

// Verifica se o usuário pode movimentar cards no kanban
export function canMoveCards(user: User | null): boolean {
  // Todos podem movimentar
  return true
}

// Verifica se o usuário pode acessar Histórico de Visitas
export function canAccessHistoricoVisitas(user: User | null): boolean {
  // Todos os cargos podem acessar histórico de visitas
  return (
    user?.cargo === "administrador" || user?.cargo === "gestor" || user?.cargo === "sdr" || user?.cargo === "vendedor"
  )
}

export async function signIn(email: string, senha: string): Promise<User | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("AUTORIZAÇÃO")
    .select("*")
    .eq("email", email)
    .eq("senha", senha)
    .eq("status", "ativo")

  if (error) {
    console.error("[v0] Login query error:", error)
    return null
  }

  if (!data || data.length === 0) {
    console.error("[v0] No user found with provided credentials")
    return null
  }

  if (data.length > 1) {
    console.error("[v0] Multiple users found - this should not happen")
    return null
  }

  const user = data[0] as User

  localStorage.setItem("eazy_click_user", JSON.stringify(user))

  return user
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null

  const userData = localStorage.getItem("eazy_click_user")
  return userData ? JSON.parse(userData) : null
}

export function signOut() {
  localStorage.removeItem("eazy_click_user")
}

export function isAdmin(user: User | null): boolean {
  return user?.cargo === "administrador" || user?.cargo === "gestor"
}

export function canManageMembers(user: User | null): boolean {
  return isAdmin(user)
}

export async function updateUser(userId: number, userData: Partial<User>): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from("AUTORIZAÇÃO")
    .update({
      nome_usuario: userData.nome_usuario,
      email: userData.email,
      telefone: userData.telefone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) {
    console.error("Error updating user:", error)
    return false
  }

  const currentUser = getCurrentUser()
  if (currentUser) {
    const updatedUser = { ...currentUser, ...userData }
    localStorage.setItem("eazy_click_user", JSON.stringify(updatedUser))
  }

  return true
}

export async function getCompanyMembers(idEmpresa: number): Promise<User[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("AUTORIZAÇÃO")
    .select("*")
    .eq("id_empresa", idEmpresa)
    .order("cargo", { ascending: false })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching company members:", error)
    return []
  }

  return data || []
}

export async function addCompanyMember(memberData: {
  id_empresa: number
  nome_empresa: string
  nome_usuario: string
  email: string
  senha: string
  telefone?: string
  status?: "ativo" | "pendente" | "inativo"
  cargo?: "administrador" | "gestor" | "sdr" | "vendedor"
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const { data: existingUser } = await supabase
    .from("AUTORIZAÇÃO")
    .select("email")
    .eq("email", memberData.email)
    .single()

  if (existingUser) {
    return { success: false, error: "Este e-mail já está cadastrado no sistema." }
  }

  const { data, error } = await supabase
    .from("AUTORIZAÇÃO")
    .insert({
      id_empresa: memberData.id_empresa,
      nome_empresa: memberData.nome_empresa,
      nome_usuario: memberData.nome_usuario,
      email: memberData.email,
      senha: memberData.senha,
      telefone: memberData.telefone || null,
      plano: "gratuito",
      status: memberData.status || "ativo",
      cargo: memberData.cargo || "sdr",
    })
    .select()

  if (error) {
    console.error("Error adding company member:", error)
    return { success: false, error: "Erro ao adicionar membro. Tente novamente." }
  }

  return { success: true }
}

export async function updateMemberStatus(
  memberId: number,
  status: "ativo" | "pendente" | "inativo",
  currentUser: User,
): Promise<{ success: boolean; error?: string }> {
  if (!canManageMembers(currentUser)) {
    return { success: false, error: "Você não tem permissão para alterar status de membros." }
  }

  const supabase = createClient()

  const { error } = await supabase
    .from("AUTORIZAÇÃO")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("id_empresa", currentUser.id_empresa)

  if (error) {
    console.error("Error updating member status:", error)
    return { success: false, error: "Erro ao atualizar status do membro." }
  }

  return { success: true }
}

export async function updateMemberCargo(
  memberId: number,
  cargo: "administrador" | "gestor" | "sdr" | "vendedor",
  currentUser: User,
): Promise<{ success: boolean; error?: string }> {
  if (!canManageMembers(currentUser)) {
    return { success: false, error: "Você não tem permissão para alterar cargos." }
  }

  const supabase = createClient()

  const { error } = await supabase
    .from("AUTORIZAÇÃO")
    .update({
      cargo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("id_empresa", currentUser.id_empresa)

  if (error) {
    console.error("Error updating member cargo:", error)
    return { success: false, error: "Erro ao atualizar cargo do membro." }
  }

  return { success: true }
}

export async function deleteMember(memberId: number, currentUser: User): Promise<{ success: boolean; error?: string }> {
  if (!canManageMembers(currentUser)) {
    return { success: false, error: "Você não tem permissão para excluir membros." }
  }

  if (memberId === currentUser.id) {
    return { success: false, error: "Você não pode excluir sua própria conta." }
  }

  const supabase = createClient()

  const { error } = await supabase
    .from("AUTORIZAÇÃO")
    .delete()
    .eq("id", memberId)
    .eq("id_empresa", currentUser.id_empresa)

  if (error) {
    console.error("Error deleting member:", error)
    return { success: false, error: "Erro ao excluir membro." }
  }

  return { success: true }
}
