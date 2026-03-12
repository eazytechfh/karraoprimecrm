"use client"

import { useState, useEffect } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Car,
  FileText,
  User,
  Trash2,
  Loader2,
  Sparkles,
  X,
  Send,
  Move,
  Edit,
  Save,
  ChevronDown,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LeadsListView } from "./leads-list-view"
import { EditableValueField } from "./editable-value-field"
import { EditableObservacaoField } from "./editable-observacao-field"
import { EditableVeiculoField } from "./editable-veiculo-field"
import { EditableEmailField } from "./editable-email-field"
import { ProgressModal } from "./progress-modal"
import { CreateLeadModal } from "./create-lead-modal"
import type { Lead } from "@/types/lead"
import {
  getLeads,
  updateLeadStage,
  updateLeadObservacao,
  generateResumoComercial,
  sendPesquisaAtendimentoWebhook,
  deleteLead,
  ESTAGIO_LABELS,
  ESTAGIO_COLORS,
  VALID_ESTAGIOS,
  formatCurrency,
} from "@/lib/leads"
import { getCurrentUser } from "@/lib/auth"
import { createClient } from "@/utils/supabase/client"
import { Input } from "@/components/ui/input" // Added Input component
import { toast } from "@/components/ui/use-toast" // Added toast for notifications

const COLUNAS_KANBAN = ["novo_lead", "em_qualificacao", "vendedor", "follow_up"]
const MOTIVOS_LEAD = [
  "Nenhum motivo",
  "Desistência cliente",
  "Ficha não aprova",
  "Comprou em outra loja",
  "Não gostou do carro",
  "Não vai comprar agora",
  "Outros Motivos",
]
const MOTIVO_PREFIX = "[Motivo] "

export function KanbanBoard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterOrigem, setFilterOrigem] = useState("")
  const [filterEstagio, setFilterEstagio] = useState("")
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban")
  const [generatingResumo, setGeneratingResumo] = useState(false)
  const [resumoMessage, setResumoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [movingLead, setMovingLead] = useState<number | null>(null)
  const [deletingLead, setDeletingLead] = useState<number | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [vendedores, setVendedores] = useState<any[]>([])
  const [selectedVendedor, setSelectedVendedor] = useState<string>("")
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [leadToTransfer, setLeadToTransfer] = useState<any>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editedLead, setEditedLead] = useState<any>(null)
  const [availableSDRs, setAvailableSDRs] = useState<any[]>([])
  const [availableVendedores, setAvailableVendedores] = useState<any[]>([])
  const [selectedMotivo, setSelectedMotivo] = useState<string>("")

  const extractMotivo = (observacao?: string) => {
    if (!observacao) return ""
    const motivoLine = observacao
      .split("\n")
      .find((line) => line.trim().toLowerCase().startsWith(MOTIVO_PREFIX.toLowerCase()))
    return motivoLine ? motivoLine.replace(MOTIVO_PREFIX, "").trim() : ""
  }

  const upsertMotivoInObservacao = (observacao: string | undefined, motivo: string) => {
    if (motivo === "Nenhum motivo") {
      return (observacao || "")
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.trim() && !line.trim().toLowerCase().startsWith(MOTIVO_PREFIX.toLowerCase()))
        .join("\n")
        .trim()
    }

    const linhasSemMotivo = (observacao || "")
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() && !line.trim().toLowerCase().startsWith(MOTIVO_PREFIX.toLowerCase()))

    return [`${MOTIVO_PREFIX}${motivo}`, ...linhasSemMotivo].join("\n").trim()
  }

  useEffect(() => {
    loadLeads()
  }, [])

  useEffect(() => {
    filterLeads()
  }, [leads, searchTerm, filterOrigem, filterEstagio])

  useEffect(() => {
    setSelectedMotivo(extractMotivo(selectedLead?.observacao_vendedor))
  }, [selectedLead])

  const loadLeads = async () => {
    const user = getCurrentUser()
    if (user) {
      const data = await getLeads(user.id_empresa)
      setLeads(data)
    }
    setLoading(false)
  }

  const ensureAgendamentoForLead = async (lead: Partial<Lead> & { id: number }, vendedorOverride?: string) => {
    const supabase = createClient()
    const vendedor = vendedorOverride ?? lead.vendedor

    if (!vendedor) return

    const { data: existingAgendamento, error: existingError } = await supabase
      .from("AGENDAMENTOS")
      .select("id, vendedor")
      .eq("id_lead", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingError) {
      console.error("[v0] Error checking existing agendamento:", existingError)
      return
    }

    if (existingAgendamento) {
      const { error: updateError } = await supabase
        .from("AGENDAMENTOS")
        .update({
          vendedor,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAgendamento.id)

      if (updateError) {
        console.error("[v0] Error updating agendamento vendedor:", updateError)
      }
      return
    }

    const user = getCurrentUser()
    const { error: insertError } = await supabase.from("AGENDAMENTOS").insert({
      id_empresa: user?.id_empresa,
      id_lead: lead.id,
      nome_lead: lead.nome_lead || "Lead sem nome",
      telefone: lead.telefone || null,
      email: lead.email || null,
      modelo_veiculo: lead.veiculo_interesse || null,
      vendedor,
      sdr_responsavel: lead.sdr_responsavel || null,
      estagio_agendamento: "agendar",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error("[v0] Error creating agendamento for lead:", insertError)
    }
  }

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

    setFilteredLeads(filtered)
  }

  const handleDragStart = (start: any) => {
    const leadId = Number.parseInt(start.draggableId)
    const lead = leads.find((l) => l.id === leadId)
    setDraggedLead(lead || null)
  }

  const handleDragEnd = async (result: DropResult) => {
    setDraggedLead(null)

    if (!result.destination) {
      return
    }

    const { source, destination, draggableId } = result

    // Se foi solto na mesma coluna, não faz nada
    if (source.droppableId === destination.droppableId) {
      return
    }

    const leadId = Number.parseInt(draggableId)
    const newStage = destination.droppableId
    const oldStage = source.droppableId

    // Validar se o novo estágio é válido
    if (!VALID_ESTAGIOS.includes(newStage)) {
      console.error("Invalid stage:", newStage)
      setResumoMessage({
        type: "error",
        text: `Estágio inválido: ${newStage}. Recarregue a página e tente novamente.`,
      })
      setTimeout(() => setResumoMessage(null), 5000)
      return
    }

    console.log("Moving lead:", {
      leadId,
      from: oldStage,
      to: newStage,
      validStages: VALID_ESTAGIOS,
    })

    setMovingLead(leadId)

    const leadData = leads.find((lead) => lead.id === leadId)

    // Atualização otimista da UI
    setLeads((prevLeads) =>
      prevLeads.map((lead) =>
        lead.id === leadId ? { ...lead, estagio_lead: newStage, updated_at: new Date().toISOString() } : lead,
      ),
    )

    try {
      // Atualizar no banco de dados
      const success = await updateLeadStage(leadId, newStage)

      if (!success) {
        // Reverter se falhou
        setLeads((prevLeads) =>
          prevLeads.map((lead) => (lead.id === leadId ? { ...lead, estagio_lead: oldStage } : lead)),
        )

        // Mostrar erro
        setResumoMessage({
          type: "error",
          text: "Erro ao mover o lead. Verifique o console para mais detalhes e tente novamente.",
        })

        setTimeout(() => setResumoMessage(null), 5000)
      } else {
        console.log("Lead moved successfully")

        if ((newStage === "transferido" || newStage === "vendedor") && leadData) {
          await ensureAgendamentoForLead(leadData)
          setResumoMessage({
            type: "success",
            text: "Lead transferido com sucesso! Um novo agendamento foi criado na aba Agendamentos.",
          })
          setTimeout(() => setResumoMessage(null), 5000)
        }

        if (newStage === "pesquisa_atendimento" && leadData) {
          console.log("[v0] Lead moved to Pesquisa de Atendimento, triggering webhook")

          try {
            const webhookSuccess = await sendPesquisaAtendimentoWebhook(leadData)

            if (webhookSuccess) {
              setResumoMessage({
                type: "success",
                text: "Lead movido para Pesquisa de Atendimento e webhook enviado com sucesso!",
              })
            } else {
              setResumoMessage({
                type: "error",
                text: "Lead movido, mas houve erro ao enviar webhook de Pesquisa de Atendimento.",
              })
            }

            setTimeout(() => setResumoMessage(null), 5000)
          } catch (webhookError) {
            console.error("[v0] Error sending pesquisa atendimento webhook:", webhookError)
            setResumoMessage({
              type: "error",
              text: "Lead movido, mas houve erro ao processar webhook de Pesquisa de Atendimento.",
            })
            setTimeout(() => setResumoMessage(null), 5000)
          }
        }
      }
    } catch (error) {
      console.error("Unexpected error moving lead:", error)

      // Reverter se falhou
      setLeads((prevLeads) =>
        prevLeads.map((lead) => (lead.id === leadId ? { ...lead, estagio_lead: oldStage } : lead)),
      )

      setResumoMessage({
        type: "error",
        text: "Erro inesperado ao mover o lead. Tente novamente.",
      })

      setTimeout(() => setResumoMessage(null), 5000)
    } finally {
      setMovingLead(null)
    }
  }

  const handleValueUpdate = (leadId: number, newValue: number) => {
    setLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? { ...lead, valor: newValue } : lead)))

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, valor: newValue })
    }
  }

  const handleObservacaoUpdate = (leadId: number, newObservacao: string) => {
    setLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, observacao_vendedor: newObservacao } : lead)),
    )

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, observacao_vendedor: newObservacao })
    }
  }

  const handleVeiculoUpdate = (leadId: number, newVeiculo: string) => {
    setLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, veiculo_interesse: newVeiculo } : lead)),
    )

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, veiculo_interesse: newVeiculo })
    }
  }

  const handleEmailUpdate = (leadId: number, newEmail: string) => {
    setLeads((prevLeads) => prevLeads.map((lead) => (lead.id === leadId ? { ...lead, email: newEmail } : lead)))

    // Atualizar o lead selecionado se for o mesmo
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, email: newEmail })
    }
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

  const handleDeleteLead = async (leadId: number) => {
    if (!confirm("Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.")) {
      return
    }

    setDeletingLead(leadId)

    try {
      const success = await deleteLead(leadId)

      if (success) {
        // Remover o lead da lista local
        setLeads((prevLeads) => prevLeads.filter((lead) => lead.id !== leadId))

        // Fechar o modal se o lead excluído estava selecionado
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead(null)
        }

        setResumoMessage({
          type: "success",
          text: "Lead excluído com sucesso!",
        })
      } else {
        setResumoMessage({
          type: "error",
          text: "Erro ao excluir o lead. Tente novamente.",
        })
      }
    } catch (error) {
      setResumoMessage({
        type: "error",
        text: "Erro inesperado ao excluir o lead.",
      })
    } finally {
      setDeletingLead(null)

      // Limpar mensagem após 5 segundos
      setTimeout(() => {
        setResumoMessage(null)
      }, 5000)
    }
  }

  const getLeadsByStage = (stage: string) => {
    return filteredLeads.filter((lead) => lead.estagio_lead === stage)
  }

  const getStageTotal = (stage: string) => {
    const stageLeads = getLeadsByStage(stage)
    return stageLeads.reduce((total, lead) => total + (lead.valor || 0), 0)
  }

  const origens = [...new Set(leads.map((lead) => lead.origem).filter(Boolean))]

  const handleLeadsUpdate = () => {
    loadLeads()
  }

  const handleLeadCreated = () => {
    loadLeads()
    setResumoMessage({
      type: "success",
      text: "Lead cadastrado com sucesso!",
    })
    setTimeout(() => setResumoMessage(null), 5000)
  }

  const loadVendedores = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("AUTORIZAÇÃO")
        .select("nome_usuario, cargo")
        .eq("cargo", "vendedor")
        .order("nome_usuario")

      if (error) throw error
      setVendedores(data || [])
    } catch (error) {
      console.error("[v0] Error loading vendedores:", error)
    }
  }

  const loadUsersForEdit = async () => {
    try {
      const supabase = createClient()

      // Buscar SDRs
      const { data: sdrs } = await supabase
        .from("AUTORIZAÇÃO")
        .select("nome_usuario, cargo")
        .eq("cargo", "sdr")
        .eq("id_empresa", 1) // Assuming a default company ID, adjust if needed

      // Buscar Vendedores
      const { data: vendedoresData } = await supabase
        .from("AUTORIZAÇÃO")
        .select("nome_usuario, cargo")
        .eq("cargo", "vendedor")
        .eq("id_empresa", 1) // Assuming a default company ID, adjust if needed

      setAvailableSDRs(sdrs || [])
      setAvailableVendedores(vendedoresData || [])
    } catch (error) {
      console.error("[v0] Error loading users for edit:", error)
    }
  }

  const handleSaveEditedLead = async () => {
    if (!editedLead) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("BASE_DE_LEADS")
        .update({
          nome_lead: editedLead.nome_lead,
          telefone: editedLead.telefone,
          sdr_responsavel: editedLead.sdr_responsavel,
          vendedor: editedLead.vendedor,
        })
        .eq("id", editedLead.id)

      if (error) throw error

      // Update local state
      setLeads((prevLeads) => prevLeads.map((lead) => (lead.id === editedLead.id ? { ...lead, ...editedLead } : lead)))
      setSelectedLead({ ...selectedLead, ...editedLead })
      setIsEditMode(false)
      setEditedLead(null) // Clear editedLead after saving

      toast({
        title: "Sucesso",
        description: "Lead atualizado com sucesso!",
      })
    } catch (error) {
      console.error("[v0] Error saving edited lead:", error)
      toast({
        title: "Erro",
        description: "Erro ao salvar alterações do lead.",
        variant: "destructive",
      })
    }
  }

  const handleTransferClick = (lead: any) => {
    setLeadToTransfer(lead)
    setShowTransferDialog(true)
    setSelectedVendedor("")
    setShowConfirmation(false)
    loadVendedores()
  }

  const handleSelectMotivo = async (motivo: string) => {
    if (!selectedLead) return

    const novaObservacao = upsertMotivoInObservacao(selectedLead.observacao_vendedor, motivo)
    const success = await updateLeadObservacao(selectedLead.id, novaObservacao)

    if (!success) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o motivo.",
        variant: "destructive",
      })
      return
    }

    setSelectedMotivo(motivo === "Nenhum motivo" ? "" : motivo)
    setLeads((prev) =>
      prev.map((lead) => (lead.id === selectedLead.id ? { ...lead, observacao_vendedor: novaObservacao } : lead)),
    )
    setSelectedLead({ ...selectedLead, observacao_vendedor: novaObservacao })

    if (editedLead && editedLead.id === selectedLead.id) {
      setEditedLead({ ...editedLead, observacao_vendedor: novaObservacao })
    }

    toast({
      title: "Motivo salvo",
      description: motivo === "Nenhum motivo" ? "Motivo removido." : motivo,
    })
  }

  const handleVendedorSelected = () => {
    if (selectedVendedor) {
      setShowConfirmation(true)
    }
  }

  const handleConfirmTransfer = async () => {
    if (!leadToTransfer || !selectedVendedor) return

    setTransferring(true)
    try {
      const response = await fetch("https://n8n.eazy.tec.br/webhook/b507a7a4-4eff-40da-bf4a-c90a4c1d752c", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...leadToTransfer,
          vendedor_transferido: selectedVendedor,
          data_transferencia: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        // Update the lead's vendedor and move to "vendedor" stage in the database
        const supabaseClient = createClient()
        await supabaseClient
          .from("BASE_DE_LEADS")
          .update({
            vendedor: selectedVendedor,
            estagio_lead: "vendedor",
            updated_at: new Date().toISOString(),
          })
          .eq("id", leadToTransfer.id)

        await ensureAgendamentoForLead(leadToTransfer, selectedVendedor)

        // Update the lead's vendedor and stage in local state
        setLeads((prevLeads) =>
          prevLeads.map((lead) =>
            lead.id === leadToTransfer.id
              ? { ...lead, vendedor: selectedVendedor, estagio_lead: "vendedor" }
              : lead,
          ),
        )

        // Update selectedLead if it's the same lead
        if (selectedLead && selectedLead.id === leadToTransfer.id) {
          setSelectedLead({ ...selectedLead, vendedor: selectedVendedor, estagio_lead: "vendedor" })
        }

        setShowTransferDialog(false)
        setShowConfirmation(false)
        setShowSuccessMessage(true)
        setLeadToTransfer(null)
        setSelectedVendedor("")
      } else {
        throw new Error("Erro ao enviar webhook")
      }
    } catch (error) {
      console.error("Error sending transfer webhook:", error)
      alert("Erro ao enviar mensagem. Tente novamente.")
    } finally {
      setTransferring(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {COLUNAS_KANBAN.map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className="pb-3">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded"></div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* CreateLeadModal */}
      <CreateLeadModal
        isOpen={showCreateLeadModal}
        onClose={() => setShowCreateLeadModal(false)}
        onSuccess={handleLeadCreated}
      />

      {/* Progress Modal */}
      <ProgressModal
        isOpen={showProgressModal}
        onComplete={handleProgressComplete}
        duration={10}
        title="Gerando Resumo Comercial"
        message="Nossa IA está analisando os dados do lead e gerando um resumo comercial personalizado..."
      />

      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{showConfirmation ? "Confirmar Transferência" : "Selecionar Vendedor"}</DialogTitle>
          </DialogHeader>

          {!showConfirmation ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Selecione o vendedor para transferir o lead <strong>{leadToTransfer?.nome_lead}</strong>
              </p>

              <div className="space-y-2">
                {vendedores.length === 0 ? (
                  <p className="text-sm text-gray-500">Carregando vendedores...</p>
                ) : (
                  vendedores.map((vendedor) => (
                    <label
                      key={vendedor.nome_usuario}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedVendedor === vendedor.nome_usuario ? "border-blue-500 bg-blue-50" : "border-gray-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="vendedor"
                        value={vendedor.nome_usuario}
                        checked={selectedVendedor === vendedor.nome_usuario}
                        onChange={(e) => setSelectedVendedor(e.target.value)}
                        className="mr-3"
                      />
                      <span className="font-medium">{vendedor.nome_usuario}</span>
                    </label>
                  ))
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleVendedorSelected}
                  disabled={!selectedVendedor}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  Continuar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-lg font-semibold mb-2">Deseja Transferir?</p>
                <p className="text-sm text-gray-600">
                  Lead: <strong>{leadToTransfer?.nome_lead}</strong>
                </p>
                <p className="text-sm text-gray-600">
                  Para: <strong>{selectedVendedor}</strong>
                </p>
              </div>

              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setShowConfirmation(false)} disabled={transferring}>
                  Não
                </Button>
                <Button
                  onClick={handleConfirmTransfer}
                  disabled={transferring}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {transferring ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Sim"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessMessage} onOpenChange={setShowSuccessMessage}>
        <DialogContent className="max-w-sm">
          <div className="text-center py-8">
            <p className="text-lg font-medium">Mensagem enviada ao Vendedor</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Visualização
            </div>
            <div className="flex gap-2">
              {/* Nova Negociação button */}
              <Button
                onClick={() => setShowCreateLeadModal(true)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <Send className="h-4 w-4" />
                Nova Negociação
              </Button>
              <Button
                variant={viewMode === "kanban" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                Kanban
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                Lista
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Mensagem de Status Global */}
      {resumoMessage && (
        <div
          className={`border ${
            resumoMessage.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          } p-4 flex items-center gap-4`}
        >
          {resumoMessage.type === "success" ? (
            <Sparkles className="h-6 w-6 text-green-600" />
          ) : (
            <X className="h-6 w-6 text-red-600" />
          )}
          <span className={resumoMessage.type === "success" ? "text-green-700" : "text-red-700"}>
            {resumoMessage.text}
          </span>
        </div>
      )}

      {viewMode === "list" ? (
        <LeadsListView leads={leads} onLeadsUpdate={handleLeadsUpdate} />
      ) : (
        <>
          {/* Filtros */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Filtros
                </div>
                <div className="flex gap-2">
                  {/* Nova Negociação button */}
                  <Button
                    onClick={() => setShowCreateLeadModal(true)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Send className="h-4 w-4" />
                    Nova Negociação
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    placeholder="Buscar por nome, telefone ou vendedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div>
                  <select value={filterOrigem} onChange={(e) => setFilterOrigem(e.target.value)}>
                    <option value="all">Todas as origens</option>
                    {origens.map((origem) => (
                      <option key={origem} value={origem!}>
                        {origem}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select value={filterEstagio} onChange={(e) => setFilterEstagio(e.target.value)}>
                    <option value="all">Todos os estágios</option>
                    {Object.entries(ESTAGIO_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kanban Board */}
          <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto">
              <div className="flex gap-4 min-w-max pb-4">
                {COLUNAS_KANBAN.map((stage) => (
                  <Droppable key={stage} droppableId={stage}>
                    {(provided, snapshot) => (
                      <Card
                        className={`w-80 min-h-[500px] flex-shrink-0 transition-all duration-200 ${
                          snapshot.isDraggingOver
                            ? "bg-gradient-to-b from-blue-50 to-blue-100 border-blue-300 shadow-lg transform scale-105"
                            : "hover:shadow-md"
                        }`}
                      >
                        <CardHeader className="pb-3">
                          <div className="text-sm font-medium flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              {snapshot.isDraggingOver && <Move className="h-4 w-4 text-blue-500 animate-pulse" />}
                              {ESTAGIO_LABELS[stage as keyof typeof ESTAGIO_LABELS]}
                            </span>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="secondary" className="text-xs">
                                {getLeadsByStage(stage).length}
                              </Badge>
                              <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                                {formatCurrency(getStageTotal(stage))}
                              </Badge>
                            </div>
                          </div>
                          {snapshot.isDraggingOver && (
                            <div className="text-xs text-blue-600 font-medium animate-pulse">
                              ↓ Solte aqui para mover
                            </div>
                          )}
                        </CardHeader>
                        <CardContent ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                          {getLeadsByStage(stage).map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id.toString()} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`cursor-grab active:cursor-grabbing transition-all duration-200 ${
                                    snapshot.isDragging
                                      ? "shadow-2xl rotate-3 scale-105 bg-white border-blue-300 z-50"
                                      : "hover:shadow-md hover:-translate-y-1"
                                  } ${movingLead === lead.id ? "opacity-50" : ""}`}
                                  onClick={(e) => {
                                    // Só abre o modal se não estiver arrastando
                                    if (!snapshot.isDragging) {
                                      setSelectedLead(lead)
                                    }
                                  }}
                                >
                                  <CardContent className="p-3">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-sm text-gray-900 truncate flex-1">
                                          {lead.nome_lead}
                                        </h4>
                                        <div className="flex items-center gap-1">
                                          {movingLead === lead.id && (
                                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                          )}
                                          <Move className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                        </div>
                                      </div>

                                      {/* Campo de Valor Editável */}
                                      <div
                                        className="border border-gray-200 rounded p-1"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <EditableValueField
                                          leadId={lead.id}
                                          currentValue={lead.valor || 0}
                                          onValueUpdate={(newValue) => handleValueUpdate(lead.id, newValue)}
                                        />
                                      </div>

                                      {lead.telefone && (
                                        <p className="text-xs text-gray-600 flex items-center gap-1">
                                          <Phone className="h-3 w-3" />
                                          {lead.telefone}
                                        </p>
                                      )}
                                      {lead.veiculo_interesse && (
                                        <p className="text-xs text-gray-600 flex items-center gap-1 truncate">
                                          <Car className="h-3 w-3 flex-shrink-0" />
                                          <span className="truncate">{lead.veiculo_interesse}</span>
                                        </p>
                                      )}
                                      <div className="flex justify-between items-center">
                                        {lead.origem && (
                                          <Badge variant="outline" className="text-xs">
                                            {lead.origem}
                                          </Badge>
                                        )}
                                        {lead.vendedor && (
                                          <span className="text-xs text-gray-500 truncate ml-2">{lead.vendedor}</span>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {/* Placeholder quando vazio */}
                          {getLeadsByStage(stage).length === 0 && (
                            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                              <div className="text-xs">Nenhum lead neste estágio</div>
                              <div className="text-xs mt-1">Arraste leads aqui</div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </Droppable>
                ))}
              </div>
            </div>
          </DragDropContext>

          {/* Modal de Detalhes do Lead - Com Botão Gerar Resumo */}
          <Dialog
            open={!!selectedLead}
            onOpenChange={() => {
              setSelectedLead(null)
              setIsEditMode(false) // Reset edit mode when closing
              setEditedLead(null) // Clear editedLead when closing
            }}
          >
            <DialogContent className="max-w-5xl max-h-[95vh] w-[95vw] overflow-hidden">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="flex items-center justify-between text-xl">
                  <div className="flex items-center gap-2">
                    <User className="h-6 w-6" />
                    Detalhes do Lead
                  </div>
                  {selectedLead && (
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="flex items-center gap-2 bg-white">
                            Motivos
                            {selectedMotivo && <span className="max-w-[160px] truncate text-xs">({selectedMotivo})</span>}
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                          {MOTIVOS_LEAD.map((motivo) => (
                            <DropdownMenuItem key={motivo} onClick={() => handleSelectMotivo(motivo)}>
                              {motivo}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {/* Edit Lead button */}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          if (!isEditMode) {
                            setEditedLead({ ...selectedLead }) // Initialize editedLead with current lead data
                            loadUsersForEdit() // Load SDRs and Vendedores when entering edit mode
                          } else {
                            setEditedLead(null) // Clear editedLead if canceling edit
                          }
                          setIsEditMode(!isEditMode)
                        }}
                        className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600"
                      >
                        <Edit className="h-4 w-4" />
                        {isEditMode ? "Cancelar Edição" : "Editar Lead"}
                      </Button>
                      {isEditMode &&
                        editedLead && ( // Show Save button only when in edit mode and editedLead is not null
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleSaveEditedLead}
                            className="flex items-center gap-2 bg-green-500 hover:bg-green-600"
                          >
                            <Save className="h-4 w-4" />
                            Salvar
                          </Button>
                        )}
                      {/* Delete Lead button */}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteLead(selectedLead.id)}
                        disabled={deletingLead === selectedLead.id}
                        className="flex items-center gap-2"
                      >
                        {deletingLead === selectedLead.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Excluindo...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Excluir Lead
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </DialogTitle>
              </DialogHeader>
              {selectedLead && (
                <div className="flex flex-col h-full max-h-[80vh]">
                  {/* Header Info - Fixed */}
                  <div className="flex-shrink-0 space-y-4 pb-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        {isEditMode && editedLead ? (
                          <Input
                            value={editedLead.nome_lead || ""}
                            onChange={(e) => setEditedLead({ ...editedLead, nome_lead: e.target.value })}
                            className="font-semibold text-2xl h-auto p-2 border-2 border-blue-300"
                            placeholder="Nome do Lead"
                          />
                        ) : (
                          <h3 className="font-semibold text-2xl">{selectedLead.nome_lead}</h3>
                        )}
                        <Badge
                          className={`mt-2 ${ESTAGIO_COLORS[selectedLead.estagio_lead as keyof typeof ESTAGIO_COLORS]}`}
                        >
                          {ESTAGIO_LABELS[selectedLead.estagio_lead as keyof typeof ESTAGIO_LABELS]}
                        </Badge>
                      </div>
                      <Button
                        onClick={() => handleTransferClick(selectedLead)}
                        className="bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Transferir
                      </Button>
                    </div>

                    {/* Informações Básicas em Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <Phone className="h-4 w-4 text-gray-500" />
                        {isEditMode && editedLead ? (
                          <Input
                            value={editedLead.telefone || ""}
                            onChange={(e) => setEditedLead({ ...editedLead, telefone: e.target.value })}
                            className="text-sm font-medium h-auto p-1 border border-blue-300"
                            placeholder="Telefone"
                          />
                        ) : (
                          <span className="text-sm font-medium">{selectedLead.telefone}</span>
                        )}
                      </div>

                      {selectedLead.email && (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <Mail className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium truncate">{selectedLead.email}</span>
                        </div>
                      )}

                      {selectedLead.origem && (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">{selectedLead.origem}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                        <User className="h-4 w-4 text-blue-500" />
                        <div className="flex flex-col flex-1">
                          <span className="text-xs text-gray-500">SDR Responsável</span>
                          {isEditMode && editedLead ? (
                            <select
                              value={editedLead.sdr_responsavel || ""}
                              onChange={(e) => setEditedLead({ ...editedLead, sdr_responsavel: e.target.value })}
                              className="text-sm font-medium bg-transparent border border-blue-300 rounded p-1"
                            >
                              <option value="">Selecione um SDR</option>
                              {availableSDRs.map((sdr) => (
                                <option key={sdr.nome_usuario} value={sdr.nome_usuario}>
                                  {sdr.nome_usuario}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm font-medium">{selectedLead.sdr_responsavel}</span>
                          )}
                        </div>
                      </div>

                      {selectedLead.vendedor && (
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                          <User className="h-4 w-4 text-green-500" />
                          <div className="flex flex-col flex-1">
                            <span className="text-xs text-gray-500">Vendedor</span>
                            {isEditMode && editedLead ? (
                              <select
                                value={editedLead.vendedor || ""}
                                onChange={(e) => setEditedLead({ ...editedLead, vendedor: e.target.value })}
                                className="text-sm font-medium bg-transparent border border-green-300 rounded p-1"
                              >
                                <option value="">Selecione um Vendedor</option>
                                {availableVendedores.map((vendedor) => (
                                  <option key={vendedor.nome_usuario} value={vendedor.nome_usuario}>
                                    {vendedor.nome_usuario}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-sm font-medium">{selectedLead.vendedor}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedLead.veiculo_interesse && (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <Car className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium">{selectedLead.veiculo_interesse}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium">
                          {new Date(selectedLead.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 mt-4 overflow-auto">
                    <div className="space-y-6 pr-4">
                      {/* Campos Editáveis */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Valor do Lead - Editável */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            <span className="text-lg font-semibold text-green-800">Valor do Negócio</span>
                          </div>
                          <EditableValueField
                            leadId={selectedLead.id}
                            currentValue={selectedLead.valor || 0}
                            onValueUpdate={(newValue) => handleValueUpdate(selectedLead.id, newValue)}
                            className="text-xl"
                          />
                        </div>

                        {/* Interacoes do Lead */}
                        <div>
                          <EditableObservacaoField
                            leadId={selectedLead.id}
                            currentObservacao={selectedLead.observacao_vendedor || ""}
                            onObservacaoUpdate={(newObservacao) =>
                              handleObservacaoUpdate(selectedLead.id, newObservacao)
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Veículo - Editável */}
                        <div>
                          <EditableVeiculoField
                            leadId={selectedLead.id}
                            currentVeiculo={selectedLead.veiculo_interesse || ""}
                            onVeiculoUpdate={(newVeiculo) => handleVeiculoUpdate(selectedLead.id, newVeiculo)}
                          />
                        </div>

                        {/* E-mail - Editável */}
                        <div>
                          <EditableEmailField
                            leadId={selectedLead.id}
                            currentEmail={selectedLead.email || ""}
                            onEmailUpdate={(newEmail) => handleEmailUpdate(selectedLead.id, newEmail)}
                          />
                        </div>
                      </div>

                      {/* Resumos - Somente Leitura */}
                      {selectedLead.resumo_qualificacao && (
                        <div>
                          <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-500" />
                            Resumo de Qualificação
                          </h4>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed font-medium">
                              {selectedLead.resumo_qualificacao}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Resumo Comercial com Botão Gerar */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5 text-green-500" />
                            Resumo Comercial
                          </h4>
                          <Button
                            onClick={handleGenerateResumo}
                            disabled={generatingResumo}
                            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                            size="sm"
                          >
                            {generatingResumo ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Gerando...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Gerar Resumo Comercial
                              </>
                            )}
                          </Button>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed font-medium">
                            {selectedLead.resumo_comercial || (
                              <span className="text-gray-500 italic">
                                Nenhum resumo comercial disponível. Clique em "Gerar Resumo Comercial" para criar um.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Transfer Button */}
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleTransferClick(selectedLead)}
                          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
                          size="sm"
                        >
                          Transferir Lead
                        </Button>
                      </div>

                      {/* Espaço extra no final para scroll confortável */}
                      <div className="h-4"></div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
