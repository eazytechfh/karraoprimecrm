"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getAgendamentos,
  updateAgendamento,
  deleteAgendamentos,
  deleteAgendamento,
  getVendedores,
  sendFollowUpWebhook,
  sendMessageWebhook,
  type Agendamento,
  type Vendedor,
  ESTAGIO_AGENDAMENTO_LABELS,
} from "@/lib/agendamentos"
import { getCurrentUser, type User } from "@/lib/auth"
import {
  Search,
  Filter,
  Phone,
  Mail,
  Calendar,
  MoreHorizontal,
  Trash2,
  Send,
  MessageSquare,
  Download,
  Clock,
} from "lucide-react"
import { SendMessageModal } from "./send-message-modal"
import { VehicleAutocomplete } from "./vehicle-autocomplete"
import { createClient } from "@/utils/supabase/client"

export function AgendamentosListView() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [filteredAgendamentos, setFilteredAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterEstagio, setFilterEstagio] = useState("")
  const [filterDataInicio, setFilterDataInicio] = useState("")
  const [filterDataFim, setFilterDataFim] = useState("")
  const [filterVeiculo, setFilterVeiculo] = useState("")
  const [filterDataAgendamentoInicio, setFilterDataAgendamentoInicio] = useState("")
  const [filterDataAgendamentoFim, setFilterDataAgendamentoFim] = useState("")
  const [filterVendedor, setFilterVendedor] = useState("")
  const [filterSdrResponsavel, setFilterSdrResponsavel] = useState("")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userCanEdit, setUserCanEdit] = useState(false)
  const [isSdr, setIsSdr] = useState(false)

  const [formData, setFormData] = useState({
    modelo_veiculo: "",
    data_agendamento: "",
    hora_agendamento: "",
    id_vendedor: "",
    observacoes: "",
    realizou_visita: false,
    ganho: false,
  })

  useEffect(() => {
    loadData()

    const supabase = createClient()
    const user = getCurrentUser()

    if (user) {
      console.log("[v0] Setting up realtime subscription for agendamentos list view")

      const channel = supabase
        .channel("agendamentos-list-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "AGENDAMENTOS",
            filter: `id_empresa=eq.${user.id_empresa}`,
          },
          (payload) => {
            console.log("[v0] Realtime update received in list view:", payload)
            loadData()
          },
        )
        .subscribe()

      return () => {
        console.log("[v0] Cleaning up realtime subscription in list view")
        supabase.removeChannel(channel)
      }
    }
  }, [])

  useEffect(() => {
    filterAgendamentos()
  }, [
    agendamentos,
    searchTerm,
    filterEstagio,
    filterDataInicio,
    filterDataFim,
    filterVeiculo,
    filterDataAgendamentoInicio,
    filterDataAgendamentoFim,
    filterVendedor,
    filterSdrResponsavel,
  ])

  useEffect(() => {
    setSelectedIds([])
  }, [filteredAgendamentos.length])

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
    const cargo = user?.cargo?.toLowerCase() || ""
    setUserCanEdit(cargo === "administrador" || cargo === "gestor")
    setIsSdr(cargo === "sdr")
  }, [])

  const loadData = async () => {
    const user = getCurrentUser()
    if (user) {
      const [agendamentosData, vendedoresData] = await Promise.all([
        getAgendamentos(user.id_empresa),
        getVendedores(user.id_empresa),
      ])
      setAgendamentos(agendamentosData)
      setVendedores(vendedoresData)
    }
    setLoading(false)
  }

  const filterAgendamentos = () => {
    let filtered = [...agendamentos]

    if (searchTerm) {
      filtered = filtered.filter(
        (a) =>
          a.nome_lead.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.telefone?.includes(searchTerm) ||
          a.vendedor?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (filterEstagio && filterEstagio !== "all") {
      filtered = filtered.filter((a) => a.estagio_agendamento === filterEstagio)
    }

    // Filtro por período de entrada (created_at)
    if (filterDataInicio) {
      filtered = filtered.filter((a) => {
        const agendDate = new Date(a.created_at).toISOString().split("T")[0]
        return agendDate >= filterDataInicio
      })
    }

    if (filterDataFim) {
      filtered = filtered.filter((a) => {
        const agendDate = new Date(a.created_at).toISOString().split("T")[0]
        return agendDate <= filterDataFim
      })
    }

    if (filterVeiculo && filterVeiculo !== "all") {
      filtered = filtered.filter((a) => a.modelo_veiculo?.toLowerCase().includes(filterVeiculo.toLowerCase()))
    }

    if (filterDataAgendamentoInicio) {
      filtered = filtered.filter((a) => {
        if (!a.data_agendamento) return false
        return a.data_agendamento >= filterDataAgendamentoInicio
      })
    }

    if (filterDataAgendamentoFim) {
      filtered = filtered.filter((a) => {
        if (!a.data_agendamento) return false
        return a.data_agendamento <= filterDataAgendamentoFim
      })
    }

    if (filterVendedor && filterVendedor !== "all") {
      filtered = filtered.filter((a) => a.vendedor === filterVendedor)
    }

    if (filterSdrResponsavel && filterSdrResponsavel !== "all") {
      filtered = filtered.filter((a) => a.sdr_responsavel === filterSdrResponsavel)
    }

    setFilteredAgendamentos(filtered)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredAgendamentos.map((a) => a.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectItem = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id])
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} agendamento(s)?`)) return

    const success = await deleteAgendamentos(selectedIds)
    if (success) {
      setActionMessage({ type: "success", text: `${selectedIds.length} agendamento(s) excluído(s) com sucesso!` })
      setSelectedIds([])
      await loadData()
    } else {
      setActionMessage({ type: "error", text: "Erro ao excluir agendamentos. Tente novamente." })
    }
    setTimeout(() => setActionMessage(null), 5000)
  }

  const handleSendFollowUp = async () => {
    if (selectedIds.length === 0) return

    const selectedItems = filteredAgendamentos.filter((a) => selectedIds.includes(a.id))

    try {
      const response = await sendFollowUpWebhook(selectedItems)

      if (response.ok) {
        setActionMessage({ type: "success", text: "Cadência programada para daqui á 5 minutos" })
      } else {
        setActionMessage({ type: "error", text: "Erro ao enviar follow up. Tente novamente." })
      }
    } catch (error) {
      setActionMessage({ type: "error", text: "Erro ao enviar follow up. Tente novamente." })
    }
    setTimeout(() => setActionMessage(null), 5000)
  }

  const handleSendMessage = async (message: string) => {
    if (selectedIds.length === 0) return

    const selectedItems = filteredAgendamentos.filter((a) => selectedIds.includes(a.id))

    try {
      const response = await sendMessageWebhook(selectedItems, message)

      if (response.ok) {
        setActionMessage({ type: "success", text: "Mensagem enviada com sucesso!" })
      } else {
        setActionMessage({ type: "error", text: "Erro ao enviar mensagem. Tente novamente." })
      }
    } catch (error) {
      setActionMessage({ type: "error", text: "Erro ao enviar mensagem. Tente novamente." })
    }
    setTimeout(() => setActionMessage(null), 5000)
  }

  const handleOpenAgendamento = (agendamento: Agendamento) => {
    const isGanho = agendamento.estagio_agendamento === "fechou"
    const isRealizouVisita = agendamento.estagio_agendamento === "realizou_visita" || isGanho

    setSelectedAgendamento(agendamento)
    setFormData({
      modelo_veiculo: agendamento.modelo_veiculo || "",
      data_agendamento: agendamento.data_agendamento || "",
      hora_agendamento: agendamento.hora_agendamento || "",
      id_vendedor: agendamento.id_vendedor?.toString() || "",
      observacoes: agendamento.observacoes || "",
      realizou_visita: isRealizouVisita,
      ganho: isGanho,
    })
  }

  const handleSaveAgendamento = async () => {
    if (!selectedAgendamento) return

    let estagio_agendamento = selectedAgendamento.estagio_agendamento
    if (formData.ganho) {
      estagio_agendamento = "fechou"
    } else if (formData.realizou_visita) {
      estagio_agendamento = "realizou_visita"
    }

    await updateAgendamento(selectedAgendamento.id, {
      modelo_veiculo: formData.modelo_veiculo,
      data_agendamento: formData.data_agendamento,
      hora_agendamento: formData.hora_agendamento,
      id_vendedor: formData.id_vendedor ? Number.parseInt(formData.id_vendedor) : undefined,
      vendedor: vendedores.find((v) => v.id.toString() === formData.id_vendedor)?.nome_usuario,
      observacoes: formData.observacoes,
      estagio_agendamento,
    })

    await loadData()
    setSelectedAgendamento(null)
  }

  const handleDeleteAgendamento = async (agendamentoId: number) => {
    if (!confirm("Tem certeza que deseja excluir este agendamento?")) return

    await deleteAgendamento(agendamentoId)
    setAgendamentos((prev) => prev.filter((a) => a.id !== agendamentoId))

    if (selectedAgendamento && selectedAgendamento.id === agendamentoId) {
      setSelectedAgendamento(null)
    }
  }

  const handleExportCSV = () => {
    const headers = [
      "Nome",
      "Telefone",
      "Email",
      "Veículo",
      "Data Agendamento",
      "Hora Agendamento",
      "Vendedor",
      "Estágio",
      "Observações",
      "Motivo Perda",
    ]

    const csvData = filteredAgendamentos.map((agendamento) => [
      agendamento.nome_lead || "",
      agendamento.telefone || "",
      agendamento.email || "",
      agendamento.modelo_veiculo || "",
      agendamento.data_agendamento ? new Date(agendamento.data_agendamento).toLocaleDateString("pt-BR") : "",
      agendamento.hora_agendamento || "",
      agendamento.vendedor || "",
      ESTAGIO_AGENDAMENTO_LABELS[agendamento.estagio_agendamento as keyof typeof ESTAGIO_AGENDAMENTO_LABELS] ||
        agendamento.estagio_agendamento ||
        "",
      agendamento.observacoes || "",
      agendamento.motivo_perda || "",
    ])

    const csvContent = [
      headers.join(";"),
      ...csvData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")),
    ].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `agendamentos_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const veiculos = [...new Set(agendamentos.map((a) => a.modelo_veiculo).filter(Boolean))]
  const vendedoresUnicos = [...new Set(agendamentos.map((a) => a.vendedor).filter(Boolean))]
  const sdrsUnicos = [...new Set(agendamentos.map((a) => a.sdr_responsavel).filter(Boolean))]

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <SendMessageModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        onSend={handleSendMessage}
        selectedCount={selectedIds.length}
        onSuccess={() => {
          setSelectedIds([])
          loadData()
        }}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 bg-transparent">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, telefone ou vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterEstagio} onValueChange={setFilterEstagio}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estágio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estágios</SelectItem>
                {Object.entries(ESTAGIO_AGENDAMENTO_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterVeiculo} onValueChange={setFilterVeiculo}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os veículos</SelectItem>
                {veiculos.map((veiculo) => (
                  <SelectItem key={veiculo} value={veiculo!}>
                    {veiculo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterVendedor} onValueChange={setFilterVendedor}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {vendedoresUnicos.map((vendedor) => (
                  <SelectItem key={vendedor} value={vendedor!}>
                    {vendedor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSdrResponsavel} onValueChange={setFilterSdrResponsavel}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por SDR Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os SDRs</SelectItem>
                {sdrsUnicos.map((sdr) => (
                  <SelectItem key={sdr} value={sdr!}>
                    {sdr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data Entrada Início</label>
              <Input type="date" value={filterDataInicio} onChange={(e) => setFilterDataInicio(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data Entrada Fim</label>
              <Input type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data Agendamento Início</label>
              <Input
                type="date"
                value={filterDataAgendamentoInicio}
                onChange={(e) => setFilterDataAgendamentoInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data Agendamento Fim</label>
              <Input
                type="date"
                value={filterDataAgendamentoFim}
                onChange={(e) => setFilterDataAgendamentoFim(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {actionMessage && (
        <Alert
          className={`${actionMessage.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
        >
          <AlertDescription className={actionMessage.type === "success" ? "text-green-700" : "text-red-700"}>
            {actionMessage.text}
          </AlertDescription>
        </Alert>
      )}

      {selectedIds.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">
                {selectedIds.length} agendamento(s) selecionado(s)
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" className="gap-2">
                    Ações
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDeleteSelected} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSendFollowUp}>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Follow Up
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowMessageModal(true)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Enviar Mensagem
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Agendamentos ({filteredAgendamentos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === filteredAgendamentos.length && filteredAgendamentos.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden lg:table-cell">Veículo</TableHead>
                  <TableHead className="hidden lg:table-cell">Data/Hora</TableHead>
                  <TableHead className="hidden xl:table-cell">Vendedor</TableHead>
                  <TableHead className="hidden xl:table-cell">SDR Responsável</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgendamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      Nenhum agendamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAgendamentos.map((agendamento) => (
                    <TableRow key={agendamento.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(agendamento.id)}
                          onCheckedChange={(checked) => handleSelectItem(agendamento.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{agendamento.nome_lead}</div>
                          <div className="text-sm text-gray-500 md:hidden">
                            {agendamento.telefone && (
                              <span className="flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3" />
                                {agendamento.telefone}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{agendamento.telefone}</TableCell>
                      <TableCell className="hidden lg:table-cell">{agendamento.modelo_veiculo}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {agendamento.data_agendamento && (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {new Date(agendamento.data_agendamento).toLocaleDateString("pt-BR")}
                            {agendamento.hora_agendamento && (
                              <>
                                <Clock className="h-3 w-3 ml-2" />
                                {agendamento.hora_agendamento}
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">{agendamento.vendedor}</TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {agendamento.sdr_responsavel && (
                          <span className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="h-3 w-3" />
                            {agendamento.sdr_responsavel}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            ESTAGIO_AGENDAMENTO_LABELS[
                              agendamento.estagio_agendamento as keyof typeof ESTAGIO_AGENDAMENTO_LABELS
                            ]
                          }
                        >
                          {
                            ESTAGIO_AGENDAMENTO_LABELS[
                              agendamento.estagio_agendamento as keyof typeof ESTAGIO_AGENDAMENTO_LABELS
                            ]
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAgendamento(agendamento)}
                            className="gap-1 bg-transparent"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                            <span className="hidden sm:inline">Ver</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteAgendamento(agendamento.id)}
                            className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedAgendamento} onOpenChange={() => setSelectedAgendamento(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Agendamento</DialogTitle>
          </DialogHeader>

          {selectedAgendamento && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Nome</label>
                  <p className="text-sm text-gray-900">{selectedAgendamento.nome_lead}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Telefone</label>
                  <p className="text-sm text-gray-900">{selectedAgendamento.telefone || "-"}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Modelo do Veículo</label>
                <div className="mt-1">
                  <VehicleAutocomplete
                    value={formData.modelo_veiculo}
                    onChange={(value) => setFormData({ ...formData, modelo_veiculo: value })}
                    placeholder="Digite modelo ou placa..."
                    disabled={!userCanEdit && !isSdr}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Data</label>
                  <Input
                    type="date"
                    value={formData.data_agendamento}
                    onChange={(e) => setFormData({ ...formData, data_agendamento: e.target.value })}
                    className="mt-1"
                    disabled={!userCanEdit && !isSdr}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Hora</label>
                  <Input
                    type="time"
                    value={formData.hora_agendamento}
                    onChange={(e) => setFormData({ ...formData, hora_agendamento: e.target.value })}
                    className="mt-1"
                    disabled={!userCanEdit && !isSdr}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Vendedor</label>
                <Select
                  value={formData.id_vendedor}
                  onValueChange={(value) => setFormData({ ...formData, id_vendedor: value })}
                  disabled={!userCanEdit && !isSdr}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.map((v) => (
                      <SelectItem key={v.id} value={v.id.toString()}>
                        {v.nome_usuario}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Observações</label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                  rows={3}
                  disabled={!userCanEdit && !isSdr}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={formData.realizou_visita}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        realizou_visita: e.target.checked,
                        ganho: e.target.checked ? prev.ganho : false,
                      }))
                    }
                    disabled={!userCanEdit && !isSdr}
                  />
                  Realizou Visita
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={formData.ganho}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        ganho: e.target.checked,
                        realizou_visita: e.target.checked ? true : prev.realizou_visita,
                      }))
                    }
                    disabled={!userCanEdit && !isSdr}
                  />
                  Ganho
                </label>
              </div>

              {selectedAgendamento.data_agendamento && selectedAgendamento.hora_agendamento && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900">Agendado para:</p>
                  <p className="text-lg font-semibold text-blue-700">
                    {new Date(selectedAgendamento.data_agendamento).toLocaleDateString("pt-BR")} às{" "}
                    {selectedAgendamento.hora_agendamento}
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedAgendamento(null)} className="bg-transparent">
                  Cancelar
                </Button>
                {(userCanEdit || isSdr) && <Button onClick={handleSaveAgendamento}>Salvar</Button>}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
