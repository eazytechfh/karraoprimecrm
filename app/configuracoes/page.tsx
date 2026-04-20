"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { SidebarNav } from "@/components/sidebar-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { User, Building, CreditCard, Users, Shield, Lock, Tag, Trash2 } from "lucide-react"
import { EditProfileForm } from "@/components/edit-profile-form"
import { AddMemberForm } from "@/components/add-member-form"
import { MembersManagement } from "@/components/members-management"
import { createEtiqueta, deleteEtiqueta, getEtiquetas, type Etiqueta } from "@/lib/etiquetas"
import { toast } from "@/components/ui/use-toast"
import {
  getCompanyMembers,
  STATUS_COLORS,
  STATUS_LABELS,
  CARGO_COLORS,
  CARGO_LABELS,
  canManageMembers,
} from "@/lib/auth"

export default function Configuracoes() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [companyMembers, setCompanyMembers] = useState([])
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [etiquetaNome, setEtiquetaNome] = useState("")
  const [etiquetaCor, setEtiquetaCor] = useState("#8b5cf6")
  const [savingEtiqueta, setSavingEtiqueta] = useState(false)
  const [deletingEtiquetaId, setDeletingEtiquetaId] = useState<string | null>(null)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.push("/")
    } else {
      setUser(currentUser)
      loadCompanyMembers(currentUser.id_empresa)
      loadEtiquetasData(currentUser.id_empresa)
    }
  }, [router])

  const loadCompanyMembers = async (idEmpresa) => {
    setLoadingMembers(true)
    const members = await getCompanyMembers(idEmpresa)
    setCompanyMembers(members)
    setLoadingMembers(false)
  }

  const handleProfileUpdate = () => {
    const updatedUser = getCurrentUser()
    if (updatedUser) {
      setUser(updatedUser)
    }
    setIsEditingProfile(false)
  }

  const handleMembersUpdate = () => {
    if (user) {
      loadCompanyMembers(user.id_empresa)
      loadEtiquetasData(user.id_empresa)
    }
  }

  const loadEtiquetasData = async (idEmpresa) => {
    const data = await getEtiquetas(idEmpresa)
    setEtiquetas(data)
  }

  const handleCreateEtiqueta = async () => {
    if (!user || !etiquetaNome.trim() || !canAddMembers) return

    const nomeNormalizado = etiquetaNome.trim().toLowerCase()
    if (etiquetas.some((etiqueta) => etiqueta.nome.trim().toLowerCase() === nomeNormalizado)) {
      toast({
        title: "Etiqueta ja existe",
        description: "Escolha outro nome para essa etiqueta.",
      })
      return
    }

    setSavingEtiqueta(true)
    const created = await createEtiqueta({
      id_empresa: user.id_empresa,
      nome: etiquetaNome,
      cor: etiquetaCor,
    })

    if (created) {
      setEtiquetas((prev) => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")))
      setEtiquetaNome("")
      toast({
        title: "Etiqueta criada",
        description: created.nome,
      })
    } else {
      toast({
        title: "Erro ao criar etiqueta",
        description: "Nao foi possivel salvar a etiqueta.",
        variant: "destructive",
      })
    }

    setSavingEtiqueta(false)
  }

  const handleDeleteEtiqueta = async (etiquetaId: string) => {
    if (!user || !canAddMembers) return

    setDeletingEtiquetaId(etiquetaId)
    const success = await deleteEtiqueta(user.id_empresa, etiquetaId)

    if (success) {
      setEtiquetas((prev) => prev.filter((etiqueta) => etiqueta.id !== etiquetaId))
      toast({
        title: "Etiqueta removida",
      })
    } else {
      toast({
        title: "Erro ao remover etiqueta",
        description: "Nao foi possivel excluir a etiqueta.",
        variant: "destructive",
      })
    }

    setDeletingEtiquetaId(null)
  }

  if (!user) return null

  const activeMembers = companyMembers.filter((member) => member.status === "ativo")
  const adminMembers = companyMembers.filter((member) => member.cargo === "administrador")
  const canAddMembers = canManageMembers(user)
  const isUserAdmin = canManageMembers(user)
  const canCreateEtiqueta = !!user

  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav />

      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="w-full px-4 py-8 sm:px-6 xl:px-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Configurações</h1>
              <p className="text-gray-600">Gerencie sua conta e preferências</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informações Pessoais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditingProfile ? (
                    <EditProfileForm
                      user={user}
                      onCancel={() => setIsEditingProfile(false)}
                      onSuccess={handleProfileUpdate}
                    />
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="nome">Nome</Label>
                        <Input id="nome" value={user.nome_usuario} readOnly />
                      </div>
                      <div>
                        <Label htmlFor="email">E-mail</Label>
                        <Input id="email" value={user.email} readOnly />
                      </div>
                      <div>
                        <Label htmlFor="telefone">Telefone</Label>
                        <Input id="telefone" value={user.telefone || ""} readOnly />
                      </div>
                      <div>
                        <Label>Cargo</Label>
                        <div className="mt-1">
                          <Badge className={CARGO_COLORS[user.cargo]}>
                            <div className="flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              {CARGO_LABELS[user.cargo]}
                            </div>
                          </Badge>
                        </div>
                      </div>
                      <Button className="w-full" onClick={() => setIsEditingProfile(true)}>
                        Editar Perfil
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Informações da Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="empresa">Nome da Empresa</Label>
                    <Input id="empresa" value={user.nome_empresa} readOnly />
                  </div>
                  <div>
                    <Label htmlFor="id-empresa">ID da Empresa</Label>
                    <Input id="id-empresa" value={user.id_empresa.toString()} readOnly />
                  </div>
                  <div>
                    <Label>Status da Conta</Label>
                    <div className="mt-1">
                      <Badge className={STATUS_COLORS[user.status]}>{STATUS_LABELS[user.status]}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Plano Atual
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Plano</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-sm">
                        {user.plano.charAt(0).toUpperCase() + user.plano.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>• Membros ilimitados</p>
                    <p>• Dashboard completo</p>
                    <p>• Kanban de leads</p>
                    <p>• Relatórios básicos</p>
                  </div>
                  <Button className="w-full" disabled>
                    Upgrade de Plano (Em breve)
                  </Button>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Gerenciar Membros
                      {!isUserAdmin && <Lock className="h-4 w-4 text-gray-400" />}
                    </CardTitle>
                    {isUserAdmin && (
                      <Button onClick={() => setIsAddingMember(true)} size="sm">
                        Adicionar Membro
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">Total de Membros</p>
                      <p className="text-2xl font-bold text-blue-700">{companyMembers.length}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-green-900">Membros Ativos</p>
                      <p className="text-2xl font-bold text-green-700">{activeMembers.length}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-purple-900">Administradores</p>
                      <p className="text-2xl font-bold text-purple-700">{adminMembers.length}</p>
                    </div>
                  </div>

                  {!isUserAdmin && (
                    <Alert className="border-yellow-200 bg-yellow-50">
                      <Lock className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-700">
                        Apenas administradores podem gerenciar membros da equipe.
                      </AlertDescription>
                    </Alert>
                  )}

                  {loadingMembers ? (
                    <div className="space-y-3">
                      {[...Array(2)].map((_, i) => (
                        <div key={i} className="h-20 bg-gray-100 rounded animate-pulse"></div>
                      ))}
                    </div>
                  ) : (
                    <MembersManagement
                      members={companyMembers}
                      currentUser={user}
                      onMembersUpdate={handleMembersUpdate}
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Criar Etiqueta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isUserAdmin && (
                    <Alert className="border-blue-200 bg-blue-50">
                      <Lock className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-700">
                        Apenas administradores podem excluir etiquetas.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-4 lg:grid-cols-[1fr_220px_160px]">
                    <div className="space-y-2">
                      <Label htmlFor="etiqueta-nome">Nome da Etiqueta</Label>
                      <Input
                        id="etiqueta-nome"
                        value={etiquetaNome}
                        onChange={(e) => setEtiquetaNome(e.target.value)}
                        placeholder="Ex.: Cliente quente"
                        disabled={!canCreateEtiqueta || savingEtiqueta}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="etiqueta-cor">Cor da Etiqueta</Label>
                      <div className="flex items-center gap-3 rounded-md border bg-white px-3 py-2">
                        <input
                          id="etiqueta-cor"
                          type="color"
                          value={etiquetaCor}
                          onChange={(e) => setEtiquetaCor(e.target.value)}
                          disabled={!canCreateEtiqueta || savingEtiqueta}
                          className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                        <span className="text-sm font-medium text-gray-600">{etiquetaCor}</span>
                      </div>
                    </div>

                    <div className="flex items-end">
                      <Button
                        onClick={handleCreateEtiqueta}
                        className="w-full"
                        disabled={!canCreateEtiqueta || savingEtiqueta || !etiquetaNome.trim()}
                      >
                        {savingEtiqueta ? "Criando..." : "Criar Etiqueta"}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-dashed p-4">
                    <p className="mb-3 text-sm font-medium text-gray-700">Etiquetas criadas</p>
                    {etiquetas.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {etiquetas.map((etiqueta) => (
                          <div
                            key={etiqueta.id}
                            className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm"
                          >
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                              style={{ backgroundColor: etiqueta.cor }}
                            >
                              {etiqueta.nome}
                            </span>
                            {isUserAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteEtiqueta(etiqueta.id)}
                                disabled={deletingEtiquetaId === etiqueta.id}
                                className="text-gray-400 transition hover:text-red-500 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Nenhuma etiqueta criada ainda.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {isUserAdmin && (
        <AddMemberForm
          isOpen={isAddingMember}
          onClose={() => setIsAddingMember(false)}
          onSuccess={handleMembersUpdate}
          currentUser={user}
        />
      )}
    </div>
  )
}
