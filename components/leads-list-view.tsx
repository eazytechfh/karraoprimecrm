"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  type Lead,
  ESTAGIO_LABELS,
  ESTAGIO_COLORS,
  updateLeadStage,
  generateResumoComercial,
  deleteLeads,
  sendFollowUpWebhook,
  sendMessageWebhook,
} from "@/lib/leads"
import { Download } from "lucide-react"
import { EditableValueField } from "./editable-value-field"
import { EditableObservacaoField } from "./editable-observacao-field"
import { EditableVeiculoField } from "./editable-veiculo-field"
import { EditableEmailField } from "./editable-email-field"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ProgressModal } from "./progress-modal"
import { SendMessageModal } from "./send-message-modal"
import { Filter, Search, ChevronDown, Trash2, Send, MessageSquare, Phone, Mail } from "lucide-react"

interface LeadsListViewProps {
  leads: Lead[]
  onLeadsUpdate: () => void
}

export function LeadsListView({ leads, onLeadsUpdate }: LeadsListViewProps) {
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>(leads)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterOrigem, setFilterOrigem] = useState("")
  const [filterEstagio, setFilterEstagio] = useState("")
  const [filterDataInicio, setFilterDataInicio] = useState("")
  const [filterDataFim, setFilterDataFim] = useState("")
  const [filterVeiculo, setFilterVeiculo] = useState("")
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([])
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [updatingStage, setUpdatingStage] = useState<number | null>(null)
  const [generatingResumo, setGeneratingResumo] = useState(false)
  const [resumoMessage, setResumoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)

  useEffect(() => {
    filterLeads()
  }, [leads, searchTerm, filterOrigem, filterEstagio, filterDataInicio, filterDataFim, filterVeiculo])

  useEffect(() => {
    setSelectedLeadIds([])
  }, [filteredLeads.length])

  const filterLeads = () => {
    let filtered = [...leads]

    if (searchTerm) {
      filtered = filtered.filter(
        (lead) =>
          lead.nome_lead.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.telefone?.includes(searchTerm) ||
          lead.vendedor?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (filterOrigem && filterOrigem !== "all") {
      filtered = filtered.filter((lead) => lead.origem === filterOrigem)
    }

    if (filterEstagio && filterEstagio !== "all") {
      filtered = filtered.filter((lead) => lead.estagio_lead === filterEstagio)
    }

    if (filterDataInicio) {
      filtered = filtered.filter((lead) => {
        const leadDate = new Date(lead.created_at).toISOString().split("T")[0]
        return leadDate >= filterDataInicio
      })
    }

    if (filterDataFim) {
      filtered = filtered.filter((lead) => {
        const leadDate = new Date(lead.created_at).toISOString().split("T")[0]
        return leadDate <= filterDataFim
      })
    }

    if (filterVeiculo && filterVeiculo !== "all") {
      filtered = filtered.filter((lead) => lead.veiculo_interesse?.toLowerCase().includes(filterVeiculo.toLowerCase()))
    }

    setFilteredLeads(filtered)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(filteredLeads.map((lead) => lead.id))
    } else {
      setSelectedLeadIds([])
    }
  }

  const handleSelectLead = (leadId: number, checked: boolean) => {
    if (checked) {
      setSelectedLeadIds((prev) => [...prev, leadId])
    } else {
      setSelectedLeadIds((prev) => prev.filter((id) => id !== leadId))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedLeadIds.length === 0) return
    if (!confirm(`Tem certeza que deseja excluir ${selectedLeadIds.length} lead(s)?`)) return

    const success = await deleteLeads(selectedLeadIds)
    if (success) {
      setActionMessage({ type: "success", text: `${selectedLeadIds.length} lead(s) excluído(s) com sucesso!` })
      setSelectedLeadIds([])
      onLeadsUpdate()
    } else {
      setActionMessage({ type: "error", text: "Erro ao excluir leads. Tente novamente." })
    }
    setTimeout(() => setActionMessage(null), 5000)
  }

  const handleSendFollowUp = async () => {
    if (selectedLeadIds.length === 0) return

    const selectedLeads = filteredLeads.filter((lead) => selectedLeadIds.includes(lead.id))
    const success = await sendFollowUpWebhook(selectedLeads)

    if (success) {
      setActionMessage({ type: "success", text: "Cadência programada para daqui á 5 minutos" })
    } else {
      setActionMessage({ type: "error", text: "Erro ao enviar follow up. Tente novamente." })
    }
    setTimeout(() => setActionMessage(null), 5000)
  }

  const handleSendMessage = async (message: string) => {
    if (selectedLeadIds.length === 0) return

    const selectedLeads = filteredLeads.filter((lead) => selectedLeadIds.includes(lead.id))
    const success = await sendMessageWebhook(selectedLeads, message)

    if (success) {
      setActionMessage({ type: "success", text: "Mensagem enviada com sucesso!" })
    } else {
      setActionMessage({ type: "error", text: "Erro ao enviar mensagem. Tente novamente." })
    }
    setTimeout(() => setActionMessage(null), 5000)
  }

  const handleStageChange = async (leadId: number, newStage: string, currentStage: string) => {
    if (newStage === currentStage) return

    setUpdatingStage(leadId)

    try {
      const success = await updateLeadStage(leadId, newStage)

      if (success) {
        setFilteredLeads((prevLeads) =>
          prevLeads.map((lead) =>
            lead.id === leadId ? { ...lead, estagio_lead: newStage, updated_at: new Date().toISOString() } : lead,
          ),
        )

        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead({ ...selectedLead, estagio_lead: newStage })
        }

        onLeadsUpdate()
      } else {
        setResumoMessage({
          type: "error",
          text: "Erro ao atualizar estágio do lead. Tente novamente.",
        })
        setTimeout(() => setResumoMessage(null), 3000)
      }
    } catch (error) {
      setResumoMessage({
        type: "error",
        text: "Erro de conexão. Verifique sua internet e tente novamente.",
      })
      setTimeout(() => setResumoMessage(null), 3000)
    } finally {
      setUpdatingStage(null)
    }
  }

  const handleValueUpdate = (leadId: number, newValue: number) => {
    setFilteredLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? { ...lead, valor: newValue } : lead)))

    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, valor: newValue })
    }

    onLeadsUpdate()
  }

  const handleObservacaoUpdate = (leadId: number, newObservacao: string) => {
    setFilteredLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, observacao_vendedor: newObservacao } : lead)),
    )

    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, observacao_vendedor: newObservacao })
    }

    onLeadsUpdate()
  }

  const handleVeiculoUpdate = (leadId: number, newVeiculo: string) => {
    setFilteredLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, veiculo_interesse: newVeiculo } : lead)),
    )

    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, veiculo_interesse: newVeiculo })
    }

    onLeadsUpdate()
  }

  const handleEmailUpdate = (leadId: number, newEmail: string) => {
    setFilteredLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? { ...lead, email: newEmail } : lead)))

    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, email: newEmail })
    }

    onLeadsUpdate()
  }

  const handleGenerateResumo = async () => {
    if (!selectedLead) return

    setGeneratingResumo(true)
    setResumoMessage(null)
    setShowProgressModal(true)

    try {
      const success = await generateResumoComercial(selectedLead)

      if (!success) {
        setResumoMessage({
          type: "error",
          text: "Erro ao enviar webhook. Tente novamente.",
        })
      }
    } catch (error) {
      setResumoMessage({
        type: "error",
        text: "Erro ao processar solicitação. Verifique sua conexão.",
      })
    } finally {
      setGeneratingResumo(false)
    }
  }

  const handleProgressComplete = () => {
    setShowProgressModal(false)
    setResumoMessage({
      type: "success",
      text: "Resumo comercial solicitado com sucesso! O resultado será processado pela nossa IA.",
    })
    setTimeout(() => {
      setResumoMessage(null)
    }, 5000)
  }

  const handleExportCSV = () => {
    const headers = [
      "Nome",
      "Telefone",
      "Email",
      "Origem",
      "Veículo de Interesse",
      "Estágio",
      "Vendedor",
      "Data Entrada",
      "Observações",
    ]

    const csvData = filteredLeads.map((lead) => [
      lead.nome_lead || "",
      lead.telefone_lead || "",
      lead.email_lead || "",
      lead.origem_lead || "",
      lead.veiculo_interesse || "",
      ESTAGIO_LABELS[lead.estagio_lead as keyof typeof ESTAGIO_LABELS] || lead.estagio_lead || "",
      lead.vendedor || "",
      lead.data_entrada ? new Date(lead.data_entrada).toLocaleDateString("pt-BR") : "",
      lead.observacao_vendedor || "",
    ])

    const csvContent = [
      headers.join(";"),
      ...csvData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")),
    ].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `leads_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const origens = [...new Set(leads.map((lead) => lead.origem).filter(Boolean))]
  const veiculos = [...new Set(leads.map((lead) => lead.veiculo_interesse).filter(Boolean))]

  return (
    <div className="space-y-4">
      <ProgressModal
        isOpen={showProgressModal}
        onComplete={handleProgressComplete}
        duration={10}
        title="Gerando Resumo Comercial"
        message="Nossa IA está analisando os dados do lead e gerando um resumo comercial personalizado..."
      />

      <SendMessageModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        onSend={handleSendMessage}
        selectedCount={selectedLeadIds.length}
        onSuccess={() => {
          setSelectedLeadIds([])
          onLeadsUpdate()
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
            <Select value={filterOrigem} onValueChange={setFilterOrigem}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {origens.map((origem) => (
                  <SelectItem key={origem} value={origem!}>
                    {origem}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEstagio} onValueChange={setFilterEstagio}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estágio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estágios</SelectItem>
                {Object.entries(ESTAGIO_LABELS).map(([key, label]) => (
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
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data Início</label>
              <Input type="date" value={filterDataInicio} onChange={(e) => setFilterDataInicio(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data Fim</label>
              <Input type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)} />
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

      {resumoMessage && (
        <Alert
          className={`${resumoMessage.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
        >
          <AlertDescription className={resumoMessage.type === "success" ? "text-green-700" : "text-red-700"}>
            {resumoMessage.text}
          </AlertDescription>
        </Alert>
      )}

      {selectedLeadIds.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">{selectedLeadIds.length} lead(s) selecionado(s)</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" className="gap-2">
                    Ações
                    <ChevronDown className="h-4 w-4" />
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

      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Button variant="default" size="sm" onClick={handleExportCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <div>
              <p className="text-sm font-medium text-green-900">
                <strong>Como usar:</strong> Clique no dropdown de estágio para alterar o status do lead
              </p>
              <p className="text-xs text-green-700 mt-1">As alterações são salvas automaticamente no banco de dados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Leads ({filteredLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Valor</TableHead>
                  <TableHead className="hidden md:table-cell">Telefone</TableHead>
                  <TableHead className="hidden lg:table-cell">Origem</TableHead>
                  <TableHead className="hidden lg:table-cell">Vendedor</TableHead>
                  <TableHead className="hidden xl:table-cell">Veículo</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-gray-50">
                    <TableCell>
                      <Checkbox
                        checked={selectedLeadIds.includes(lead.id)}
                        onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">{lead.nome_lead}</div>
                        <div className="text-sm text-gray-500 md:hidden">
                          {lead.telefone && (
                            <span className="flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" />
                              {lead.telefone}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div onClick={(e) => e.stopPropagation()}>
                        <EditableValueField
                          leadId={lead.id}
                          currentValue={lead.valor || 0}
                          onValueUpdate={(newValue) => handleValueUpdate(lead.id, newValue)}
                          className="min-w-[120px]"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{lead.telefone}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {lead.origem && (
                        <Badge variant="outline" className="text-xs">
                          {lead.origem}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{lead.vendedor}</TableCell>
                    <TableCell className="hidden xl:table-cell">{lead.veiculo_interesse}</TableCell>
                    <TableCell>
                      <Select
                        value={lead.estagio_lead}
                        onValueChange={(value) => handleStageChange(lead.id, value, lead.estagio_lead)}
                        disabled={updatingStage === lead.id}
                      >
                        <SelectTrigger className="w-auto min-w-[140px]">
                          <div className="flex items-center gap-2">
                            {updatingStage === lead.id && <Download className="h-3 w-3 animate-spin" />}
                            <Badge className={ESTAGIO_COLORS[lead.estagio_lead as keyof typeof ESTAGIO_COLORS]}>
                              {ESTAGIO_LABELS[lead.estagio_lead as keyof typeof ESTAGIO_LABELS]}
                            </Badge>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ESTAGIO_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <Badge className={`${ESTAGIO_COLORS[key as keyof typeof ESTAGIO_COLORS]} text-xs`}>
                                  {label}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLead(lead)} className="h-8 w-8 p-0">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredLeads.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum lead encontrado com os filtros aplicados.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] w-[95vw] overflow-hidden">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Download className="h-6 w-6" />
              Detalhes do Lead
            </DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="flex flex-col h-full max-h-[80vh]">
              <div className="flex-shrink-0 space-y-4 pb-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-2xl">{selectedLead.nome_lead}</h3>
                    <Badge
                      className={`mt-2 ${ESTAGIO_COLORS[selectedLead.estagio_lead as keyof typeof ESTAGIO_COLORS]}`}
                    >
                      {ESTAGIO_LABELS[selectedLead.estagio_lead as keyof typeof ESTAGIO_LABELS]}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedLead.telefone && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">{selectedLead.telefone}</span>
                    </div>
                  )}

                  {selectedLead.email && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium truncate">{selectedLead.email}</span>
                    </div>
                  )}

                  {selectedLead.origem && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <Download className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">{selectedLead.origem}</span>
                    </div>
                  )}

                  {selectedLead.vendedor && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <Download className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">{selectedLead.vendedor}</span>
                    </div>
                  )}

                  {selectedLead.veiculo_interesse && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <Download className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">{selectedLead.veiculo_interesse}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <Download className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">
                      {new Date(selectedLead.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 mt-4">
                <div className="space-y-6 pr-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Download className="h-5 w-5 text-green-600" />
                        <span className="text-lg font-semibold text-green-800">Valor do Negócio</span>
                      </div>
                      <EditableValueField
                        leadId={selectedLead.id}
                        currentValue={selectedLead.valor || 0}
                        onValueUpdate={(newValue) => handleValueUpdate(selectedLead.id, newValue)}
                        className="text-xl"
                      />
                    </div>

                    <div>
                      <EditableObservacaoField
                        leadId={selectedLead.id}
                        currentObservacao={selectedLead.observacao_vendedor || ""}
                        onObservacaoUpdate={(newObservacao) => handleObservacaoUpdate(selectedLead.id, newObservacao)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <EditableVeiculoField
                        leadId={selectedLead.id}
                        currentVeiculo={selectedLead.veiculo_interesse || ""}
                        onVeiculoUpdate={(newVeiculo) => handleVeiculoUpdate(selectedLead.id, newVeiculo)}
                      />
                    </div>

                    <div>
                      <EditableEmailField
                        leadId={selectedLead.id}
                        currentEmail={selectedLead.email || ""}
                        onEmailUpdate={(newEmail) => handleEmailUpdate(selectedLead.id, newEmail)}
                      />
                    </div>
                  </div>

                  {selectedLead.resumo_qualificacao && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Download className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-blue-800">Resumo de Qualificação</span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedLead.resumo_qualificacao}</p>
                    </div>
                  )}

                  {selectedLead.resumo_comercial && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Download className="h-5 w-5 text-purple-600" />
                        <span className="font-semibold text-purple-800">Resumo Comercial (IA)</span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedLead.resumo_comercial}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <Button
                      onClick={handleGenerateResumo}
                      disabled={generatingResumo}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      {generatingResumo ? (
                        <>
                          <Download className="h-4 w-4 mr-2 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Gerar Resumo Comercial
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
