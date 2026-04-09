"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  getAgendamentos,
  deleteAgendamento,
  getVendedores,
  formatAgendamentoDate,
  type Agendamento,
  type Vendedor,
  type HistoricoMovimentacao,
  ESTAGIO_AGENDAMENTO_LABELS,
  VALID_ESTAGIOS_AGENDAMENTO,
  normalizeAgendamentoStage,
  updateAgendamento,
  updateAgendamentoStageWithMotivo,
  type MotivoPerda,
  canMoveStage,
  getMoveErrorMessage,
  registrarHistoricoMovimentacao,
  getHistoricoMovimentacoes,
  sendNotificaVendedorWebhook,
  createAgendamento,
  marcarRealizouVisita,
  reagendarVisita,
} from "@/lib/agendamentos"
import { getCurrentUser, canEditCards, type User } from "@/lib/auth"
import {
  Search,
  Filter,
  Phone,
  Calendar,
  Clock,
  Trash2,
  AlertTriangle,
  Lock,
  History,
  ArrowRight,
  GripVertical,
  Check,
  X,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MotivoPerdaModal } from "@/components/motivo-perda-modal"
import { RegistrarVendaModal } from "@/components/registrar-venda-modal"
import { VehicleAutocomplete } from "./vehicle-autocomplete"
import { createClient } from "@/utils/supabase/client"

const COLUNAS_KANBAN_AGENDAMENTOS = [
  "agendar",
  "agendado",
  "nao_compareceu",
  "reagendado",
  "visita_realizada",
  "sucesso",
  "insucesso",
]
const CHECKBOX_FLAGS_PREFIX = "__flags__:"

function parseCheckboxFlagsFromObservacoes(observacoes?: string) {
  const raw = observacoes || ""
  const match = raw.match(/__flags__:rv=(0|1);g=(0|1)/)
  const hasFlags = !!match
  const realizouVisita = match ? match[1] === "1" : false
  const ganho = match ? match[2] === "1" : false
  const clean = raw
    .replace(/\n?__flags__:rv=(0|1);g=(0|1)\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return { hasFlags, realizouVisita, ganho, cleanObservacoes: clean }
}

function buildObservacoesWithCheckboxFlags(observacoes: string | undefined, realizouVisita: boolean, ganho: boolean) {
  const base = (observacoes || "")
    .replace(/\n?__flags__:rv=(0|1);g=(0|1)\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  const flags = `${CHECKBOX_FLAGS_PREFIX}rv=${realizouVisita ? "1" : "0"};g=${ganho ? "1" : "0"}`
  return base ? `${base}\n${flags}` : flags
}

function DraggableCard({
  agendamento,
  onClick,
  onRealizouVisita,
  onNaoRealizouVisita,
  isMoving,
  onVendido,
}: {
  agendamento: any
  onClick: () => void
  onRealizouVisita: (agendamento: Agendamento) => void
  onNaoRealizouVisita: (agendamento: Agendamento) => void
  isMoving: boolean
  onVendido: (agendamento: Agendamento) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: agendamento.id.toString(),
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined

  return (
    <Card ref={setNodeRef} style={style} className="transition-all duration-200 relative" onClick={onClick}>
      {/* Drag handle - small grip icon that handles dragging */}
      <div
        {...listeners}
        {...attributes}
        className="absolute top-2 right-2 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
        onClick={(e) => e.stopPropagation()} // Prevent opening modal when dragging
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>

      <CardHeader className="p-3 cursor-pointer pr-10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium truncate">{agendamento.nome_lead}</CardTitle>
            {agendamento.telefone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Phone className="h-3 w-3" />
                {agendamento.telefone}
              </p>
            )}
            {agendamento.data_agendamento && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                {formatAgendamentoDate(agendamento.data_agendamento)}
                {agendamento.hora_agendamento && (
                  <>
                    {" • "}
                    <Clock className="h-3 w-3" />
                    {agendamento.hora_agendamento}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      {agendamento.estagio_agendamento === "agendado" && (
        <CardContent className="p-2 pt-0 space-y-1">
          <Button
            size="sm"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 h-7"
            onClick={(e) => {
              e.stopPropagation()
              onVendido(agendamento)
            }}
            disabled={isMoving}
          >
            <Check className="h-3 w-3 mr-1" />
            Sucesso
          </Button>
          <Button
            size="sm"
            className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-1 h-7"
            onClick={(e) => {
              e.stopPropagation()
              onRealizouVisita(agendamento)
            }}
            disabled={isMoving}
          >
            <Check className="h-3 w-3 mr-1" />
            Visita realizada
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="w-full text-xs py-1 h-7"
            onClick={(e) => {
              e.stopPropagation()
              onNaoRealizouVisita(agendamento)
            }}
            disabled={isMoving}
          >
            <X className="h-3 w-3 mr-1" />
            Não compareceu
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

function DroppableColumn({ stage, children }: { stage: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  })

  return (
    <div
      ref={setNodeRef}
      className={`w-80 min-h-[500px] flex-shrink-0 transition-all duration-200 ${
        isOver ? "bg-accent/20 rounded-lg" : ""
      }`}
    >
      {children}
    </div>
  )
}

export function AgendamentosKanban() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [filteredAgendamentos, setFilteredAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [movingAgendamento, setMovingAgendamento] = useState<number | null>(null)
  const [deletingAgendamento, setDeletingAgendamento] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [historicoMovimentacoes, setHistoricoMovimentacoes] = useState<HistoricoMovimentacao[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  const [showMotivoPerdaModal, setShowMotivoPerdaModal] = useState(false)
  const [showRegistrarVendaModal, setShowRegistrarVendaModal] = useState(false)
  const [pendingMove, setPendingMove] = useState<{
    agendamentoId: number
    oldStage: string
    agendamento: Agendamento
  } | null>(null)

  const [formData, setFormData] = useState({
    modelo_veiculo: "",
    data_agendamento: "",
    hora_agendamento: "",
    vendedor: "",
    observacoes: "",
    observacoes_vendedor: "", // Novo campo
    email: "", // Novo campo
    ganho: false,
    realizou_visita: false,
  })

  const [editedAgendamento, setEditedAgendamento] = useState<{
    modelo_veiculo?: string
    data_agendamento?: string
    hora_agendamento?: string
    vendedor?: string
    observacoes?: string
    observacoes_vendedor?: string
    nome_lead?: string
    telefone_lead?: string
    email?: string
  }>({})

  const [showNaoRealizouModal, setShowNaoRealizouModal] = useState(false)
  const [agendamentoParaNaoRealizou, setAgendamentoParaNaoRealizou] = useState<Agendamento | null>(null)

  const userCanEdit = canEditCards(currentUser)
  const isVendedor = currentUser?.cargo?.toLowerCase() === "vendedor"
  const isSdr = currentUser?.cargo?.toLowerCase() === "sdr"
  const canEdit = userCanEdit || isSdr || isVendedor



  const loadData = async () => {
    const user = getCurrentUser()
    setCurrentUser(user)
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

    setFilteredAgendamentos(filtered)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    const { id: draggableId } = active
    const { id: droppableId } = over

    const agendamentoId = Number.parseInt(draggableId)
    const newStage = normalizeAgendamentoStage(String(droppableId))

    const agendamento = agendamentos.find((a) => a.id === agendamentoId)
    const oldStage = normalizeAgendamentoStage(agendamento?.estagio_agendamento || "")

    console.log("[v0] handleDragEnd:", { agendamentoId, oldStage, newStage, cargo: currentUser?.cargo })

    if (!VALID_ESTAGIOS_AGENDAMENTO.includes(newStage)) {
      setStatusMessage({
        type: "error",
        text: `Estágio inválido: ${newStage}`,
      })
      setTimeout(() => setStatusMessage(null), 5000)
      return
    }

    if (!canMoveStage(currentUser?.cargo, oldStage, newStage)) {
      console.log("[v0] canMoveStage returned false")
      setStatusMessage({
        type: "error",
        text: getMoveErrorMessage(currentUser?.cargo),
      })
      setTimeout(() => setStatusMessage(null), 5000)
      return
    }

    if (agendamentoId < 0 && agendamento) {
      console.log("[v0] Converting virtual lead to real agendamento")
      const newAgendamento = await createAgendamento({
        id_empresa: agendamento.id_empresa,
        id_lead: agendamento.id_lead,
        nome_lead: agendamento.nome_lead,
        telefone: agendamento.telefone,
        email: agendamento.email,
        modelo_veiculo: agendamento.modelo_veiculo,
        estagio_agendamento: newStage,
        sdr_responsavel: agendamento.sdr_responsavel,
        vendedor: agendamento.vendedor,
      })

      if (newAgendamento) {
        // Remove virtual lead and add real agendamento
        setAgendamentos((prev) => prev.filter((a) => a.id !== agendamentoId).concat(newAgendamento))

        setStatusMessage({
          type: "success",
          text: newStage === "agendado" ? "Agendamento confirmado!" : "Lead movido com sucesso!",
        })
        setTimeout(() => setStatusMessage(null), 5000)
        return
      } else {
        setStatusMessage({
          type: "error",
          text: "Erro ao criar agendamento",
        })
        setTimeout(() => setStatusMessage(null), 5000)
        return
      }
    }

    if (newStage === "sucesso") {
      if (agendamento) {
        setPendingMove({ agendamentoId, oldStage, agendamento })
        setShowRegistrarVendaModal(true)
      }
      return
    }

    if (newStage === "insucesso") {
      if (agendamento) {
        setPendingMove({ agendamentoId, oldStage, agendamento })
        setShowMotivoPerdaModal(true)
      }
      return
    }

    await executeMove(agendamentoId, newStage, oldStage)
  }

  const executeMove = async (agendamentoId: number, newStage: string, oldStage: string, motivoPerda?: MotivoPerda) => {
    setMovingAgendamento(agendamentoId)

    const agendamento = agendamentos.find((a) => a.id === agendamentoId)

    setAgendamentos((prev) =>
      prev.map((a) =>
        a.id === agendamentoId
          ? {
              ...a,
              estagio_agendamento: newStage,
              updated_at: new Date().toISOString(),
              motivo_perda: motivoPerda || a.motivo_perda,
              data_perda: newStage === "insucesso" ? new Date().toISOString().split("T")[0] : a.data_perda,
            }
          : a,
      ),
    )

    try {
      const success = await updateAgendamentoStageWithMotivo(agendamentoId, newStage, motivoPerda)

      if (!success) {
        setAgendamentos((prev) =>
          prev.map((a) => (a.id === agendamentoId ? { ...a, estagio_agendamento: oldStage } : a)),
        )

        setStatusMessage({
          type: "error",
          text: "Erro ao mover o agendamento",
        })
      } else {
        if (currentUser && agendamento) {
          await registrarHistoricoMovimentacao(
            agendamentoId,
            agendamento.id_empresa,
            oldStage,
            newStage,
            currentUser.nome_usuario,
            currentUser.cargo || "desconhecido",
            motivoPerda,
          )
        }

        if (newStage === "agendado") {
          setStatusMessage({
            type: "success",
            text: "Agendamento confirmado! Notificação enviada para o vendedor.",
          })
        } else if (newStage === "visita_realizada") {
          setStatusMessage({
            type: "success",
            text: "Visita realizada com sucesso!",
          })
        } else if (newStage === "sucesso") {
          setStatusMessage({
            type: "success",
            text: "Sucesso registrado com sucesso!",
          })
        } else if (newStage === "insucesso") {
          setStatusMessage({
            type: "success",
            text: "Insucesso registrado!",
          })
        } else {
          setStatusMessage({
            type: "success",
            text: "Agendamento movido com sucesso!",
          })
        }
      }
    } catch (error) {
      setAgendamentos((prev) => prev.map((a) => (a.id === agendamentoId ? { ...a, estagio_agendamento: oldStage } : a)))
      setStatusMessage({
        type: "error",
        text: "Erro ao mover o agendamento",
      })
    } finally {
      setMovingAgendamento(null)
      setTimeout(() => setStatusMessage(null), 5000)
    }
  }

  const handleConfirmRegistrarVenda = async (data: string, veiculo: string, valor: number) => {
    if (pendingMove) {
      setShowRegistrarVendaModal(false)

      setMovingAgendamento(pendingMove.agendamentoId)

      setAgendamentos((prev) =>
        prev.map((a) =>
          a.id === pendingMove.agendamentoId
            ? {
                ...a,
                estagio_agendamento: "sucesso",
                data_venda: data,
                veiculo_vendido: veiculo,
                valor_venda: valor,
                updated_at: new Date().toISOString(),
              }
            : a,
        ),
      )

      try {
        const success = await updateAgendamento(pendingMove.agendamentoId, {
          estagio_agendamento: "sucesso",
          data_venda: data,
          veiculo_vendido: veiculo,
          valor_venda: valor,
        })

        if (!success) {
          setAgendamentos((prev) =>
            prev.map((a) =>
              a.id === pendingMove.agendamentoId ? { ...a, estagio_agendamento: pendingMove.oldStage } : a,
            ),
          )

          setStatusMessage({
            type: "error",
            text: "Erro ao registrar venda",
          })
        } else {
          if (currentUser) {
            await registrarHistoricoMovimentacao(
              pendingMove.agendamentoId,
              pendingMove.agendamento.id_empresa,
              pendingMove.oldStage,
              "sucesso",
              currentUser.nome_usuario,
              currentUser.cargo || "desconhecido",
              undefined,
              `Venda: ${veiculo} - R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            )
          }

          setStatusMessage({
            type: "success",
            text: "Sucesso registrado com sucesso!",
          })
        }
      } catch (error) {
        setAgendamentos((prev) =>
          prev.map((a) =>
            a.id === pendingMove.agendamentoId ? { ...a, estagio_agendamento: pendingMove.oldStage } : a,
          ),
        )
        setStatusMessage({
          type: "error",
          text: "Erro ao registrar venda",
        })
      } finally {
        setMovingAgendamento(null)
        setPendingMove(null)
        setTimeout(() => setStatusMessage(null), 5000)
      }
    }
  }

  const handleCancelRegistrarVenda = () => {
    setShowRegistrarVendaModal(false)
    setPendingMove(null)
  }

  const handleConfirmMotivoPerda = async (motivo: MotivoPerda, data: string) => {
    if (pendingMove) {
      setShowMotivoPerdaModal(false)
      await executeMove(pendingMove.agendamentoId, "insucesso", pendingMove.oldStage, motivo)
      setPendingMove(null)
    }
  }

  const handleOpenAgendamento = async (agendamento: Agendamento) => {
    const parsed = parseCheckboxFlagsFromObservacoes(agendamento.observacoes)
    const normalizedStage = normalizeAgendamentoStage(agendamento.estagio_agendamento)
    const isGanho = parsed.hasFlags ? parsed.ganho : normalizedStage === "sucesso"
    const isRealizouVisita = parsed.hasFlags ? parsed.realizouVisita : normalizedStage === "visita_realizada"

    setSelectedAgendamento(agendamento)
    setFormData({
      modelo_veiculo: agendamento.modelo_veiculo || "",
      data_agendamento: agendamento.data_agendamento || "",
      hora_agendamento: agendamento.hora_agendamento || "",
      vendedor: agendamento.vendedor || "",
      observacoes: parsed.cleanObservacoes || "",
      observacoes_vendedor: agendamento.observacoes_vendedor || "",
      email: agendamento.email || "", // Novo campo
      ganho: isGanho,
      realizou_visita: isRealizouVisita,
    })

    setLoadingHistorico(true)
    const historico = await getHistoricoMovimentacoes(agendamento.id)
    setHistoricoMovimentacoes(historico)
    setLoadingHistorico(false)
  }

  const handleSaveAgendamento = async () => {
    if (!selectedAgendamento) return

    try {
      console.log("[v0] Saving agendamento:", selectedAgendamento.id)
      console.log("[v0] Edited data:", editedAgendamento)

      const updates: Partial<Agendamento> = {
        nome_lead: editedAgendamento.nome_lead ?? selectedAgendamento.nome_lead,
        telefone: editedAgendamento.telefone ?? selectedAgendamento.telefone,
        email: editedAgendamento.email ?? selectedAgendamento.email,
        modelo_veiculo: editedAgendamento.modelo_veiculo ?? selectedAgendamento.modelo_veiculo,
        data_agendamento: editedAgendamento.data_agendamento ?? selectedAgendamento.data_agendamento,
        hora_agendamento: editedAgendamento.hora_agendamento ?? selectedAgendamento.hora_agendamento,
        vendedor: editedAgendamento.vendedor ?? selectedAgendamento.vendedor,
        observacoes: buildObservacoesWithCheckboxFlags(
          editedAgendamento.observacoes ?? formData.observacoes ?? selectedAgendamento.observacoes,
          formData.realizou_visita,
          formData.ganho,
        ),
      }

      Object.keys(updates).forEach((key) => {
        if (updates[key as keyof typeof updates] === undefined) {
          delete updates[key as keyof typeof updates]
        }
      })

      const hasRequiredFields =
        updates.data_agendamento &&
        updates.hora_agendamento &&
        updates.vendedor &&
        ["agendar", "reagendado", "nao_compareceu"].includes(normalizeAgendamentoStage(selectedAgendamento.estagio_agendamento))

      if (formData.ganho) {
        updates.estagio_agendamento = "sucesso"
      } else if (formData.realizou_visita) {
        updates.estagio_agendamento = "visita_realizada"
      } else if (hasRequiredFields) {
        updates.estagio_agendamento = "agendado"
      }

      console.log("[v0] Updates to save:", updates)

      if (selectedAgendamento.id < 0) {
        console.log("[v0] Creating real agendamento from virtual lead")

        const newAgendamento = await createAgendamento({
          id_empresa: selectedAgendamento.id_empresa,
          id_lead: selectedAgendamento.id_lead,
          nome_lead: updates.nome_lead || selectedAgendamento.nome_lead,
          telefone: updates.telefone || selectedAgendamento.telefone,
          email: updates.email || selectedAgendamento.email,
          modelo_veiculo: updates.modelo_veiculo || selectedAgendamento.modelo_veiculo,
          data_agendamento: updates.data_agendamento,
          hora_agendamento: updates.hora_agendamento,
          vendedor: updates.vendedor,
          observacoes: updates.observacoes,
          estagio_agendamento: updates.estagio_agendamento || "agendar",
          sdr_responsavel: selectedAgendamento.sdr_responsavel,
        })

        if (newAgendamento) {
          console.log("[v0] Virtual lead converted to real agendamento successfully")

          if (hasRequiredFields && currentUser) {
            await registrarHistoricoMovimentacao(
              newAgendamento.id,
              newAgendamento.id_empresa,
              normalizeAgendamentoStage(selectedAgendamento.estagio_agendamento),
              "agendado",
              currentUser.nome_usuario,
              currentUser.cargo || "desconhecido",
            )

            await sendNotificaVendedorWebhook(newAgendamento)
          }

          await loadData()
          setSelectedAgendamento(null)
          setEditedAgendamento({})

          setStatusMessage({
            type: "success",
            text: hasRequiredFields
              ? "Agendamento salvo e movido para 'Agendado'! Vendedor notificado."
              : "Agendamento criado com sucesso!",
          })
        } else {
          console.error("[v0] Failed to create real agendamento from virtual lead")
          setStatusMessage({
            type: "error",
            text: "Erro ao criar agendamento",
          })
        }

        setTimeout(() => setStatusMessage(null), 5000)
        return
      }

      const success = await updateAgendamento(selectedAgendamento.id, updates)

      if (success) {
        console.log("[v0] Save successful")

        if (hasRequiredFields && currentUser) {
          await registrarHistoricoMovimentacao(
            selectedAgendamento.id,
            selectedAgendamento.id_empresa,
            normalizeAgendamentoStage(selectedAgendamento.estagio_agendamento),
            "agendado",
            currentUser.nome_usuario,
            currentUser.cargo || "desconhecido",
          )

          const updatedAgendamento = { ...selectedAgendamento, ...updates }
          await sendNotificaVendedorWebhook(updatedAgendamento)
        }

        await loadData()
        setSelectedAgendamento(null)
        setEditedAgendamento({})

        setStatusMessage({
          type: "success",
          text: hasRequiredFields
            ? "Agendamento salvo e movido para 'Agendado'! Vendedor notificado."
            : "Agendamento atualizado com sucesso!",
        })
      } else {
        console.error("[v0] Save failed - updateAgendamento returned false")
        setStatusMessage({
          type: "error",
          text: "Erro ao atualizar agendamento",
        })
      }
    } catch (error) {
      console.error("[v0] Error in handleSaveAgendamento:", error)
      setStatusMessage({
        type: "error",
        text: "Erro ao atualizar agendamento",
      })
    } finally {
      setTimeout(() => setStatusMessage(null), 5000)
    }
  }

  const handleDeleteAgendamento = async (agendamentoId: number) => {
    if (agendamentoId < 0) {
      setStatusMessage({
        type: "error",
        text: "Não é possível excluir leads que ainda não foram convertidos em agendamentos.",
      })
      setTimeout(() => setStatusMessage(null), 5000)
      return
    }

    const agendamento = agendamentos.find((a) => a.id === agendamentoId)
    const canDelete = userCanEdit || (isSdr && agendamento?.sdr_responsavel === currentUser?.nome_usuario)

    if (!canDelete) {
      setStatusMessage({
        type: "error",
        text: "Você não tem permissão para excluir este agendamento.",
      })
      setTimeout(() => setStatusMessage(null), 5000)
      return
    }

    if (!confirm("Tem certeza que deseja excluir este agendamento?")) return

    setDeletingAgendamento(agendamentoId)

    try {
      const success = await deleteAgendamento(agendamentoId)

      if (success) {
        setAgendamentos((prev) => prev.filter((a) => a.id !== agendamentoId))

        if (selectedAgendamento && selectedAgendamento.id === agendamentoId) {
          setSelectedAgendamento(null)
        }

        setStatusMessage({
          type: "success",
          text: "Agendamento excluído com sucesso!",
        })
      } else {
        setStatusMessage({
          type: "error",
          text: "Erro ao excluir agendamento",
        })
      }
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: "Erro inesperado ao excluir agendamento",
      })
    } finally {
      setDeletingAgendamento(null)
      setTimeout(() => setStatusMessage(null), 5000)
    }
  }

  const getAgendamentosByStage = (stage: string) => {
    if (stage !== "visita_realizada") {
      return filteredAgendamentos.filter((a) => normalizeAgendamentoStage(a.estagio_agendamento) === stage)
    }

    const realizouVisita = filteredAgendamentos.filter(
      (a) => normalizeAgendamentoStage(a.estagio_agendamento) === "visita_realizada",
    )
    const sucessosEspelho = filteredAgendamentos
      .filter((a) => {
        if (normalizeAgendamentoStage(a.estagio_agendamento) !== "sucesso") return false
        const flags = parseCheckboxFlagsFromObservacoes(a.observacoes)
        return flags.ganho && flags.realizouVisita
      })
      .map((a) => ({ ...a, __mirrorFromSucesso: true }))

    return [...realizouVisita, ...sucessosEspelho]
  }

  const formatHistoricoDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleFieldChange = (field: string, value: string) => {
    setEditedAgendamento({ ...editedAgendamento, [field]: value })
    setFormData({ ...formData, [field]: value })
  }

  const handleCancelMotivoPerda = () => {
    setShowMotivoPerdaModal(false)
    setPendingMove(null)
  }

  const handleRealizouVisita = async (agendamento: Agendamento) => {
    setMovingAgendamento(agendamento.id)

    setAgendamentos((prev) =>
      prev.map((a) =>
        a.id === agendamento.id
          ? { ...a, estagio_agendamento: "visita_realizada", updated_at: new Date().toISOString() }
          : a,
      ),
    )

    try {
      const success = await marcarRealizouVisita(agendamento.id)

      if (success) {
        setStatusMessage({
          type: "success",
          text: "Visita realizada com sucesso!",
        })
      } else {
        setAgendamentos((prev) =>
          prev.map((a) => (a.id === agendamento.id ? { ...a, estagio_agendamento: "agendado" } : a)),
        )
        setStatusMessage({
          type: "error",
          text: "Erro ao marcar visita como realizada",
        })
      }
    } catch (error) {
      setAgendamentos((prev) =>
        prev.map((a) => (a.id === agendamento.id ? { ...a, estagio_agendamento: "agendado" } : a)),
      )
      setStatusMessage({
        type: "error",
        text: "Erro ao marcar visita como realizada",
      })
    } finally {
      setMovingAgendamento(null)
      setTimeout(() => setStatusMessage(null), 5000)
    }
  }

  const handleNaoRealizouVisita = (agendamento: Agendamento) => {
    setAgendamentoParaNaoRealizou(agendamento)
    setShowNaoRealizouModal(true)
  }

  const handleReagendar = async () => {
    if (!agendamentoParaNaoRealizou) return

    setShowNaoRealizouModal(false)
    setMovingAgendamento(agendamentoParaNaoRealizou.id)

    setAgendamentos((prev) =>
      prev.map((a) =>
        a.id === agendamentoParaNaoRealizou.id
          ? { ...a, estagio_agendamento: "reagendado", updated_at: new Date().toISOString() }
          : a,
      ),
    )

    try {
      const success = await reagendarVisita(agendamentoParaNaoRealizou.id)

      if (success) {
        setStatusMessage({
          type: "success",
          text: "Visita reagendada com sucesso!",
        })
      } else {
        setAgendamentos((prev) =>
          prev.map((a) => (a.id === agendamentoParaNaoRealizou.id ? { ...a, estagio_agendamento: "agendado" } : a)),
        )
        setStatusMessage({
          type: "error",
          text: "Erro ao reagendar visita",
        })
      }
    } catch (error) {
      setAgendamentos((prev) =>
        prev.map((a) => (a.id === agendamentoParaNaoRealizou.id ? { ...a, estagio_agendamento: "agendado" } : a)),
      )
      setStatusMessage({
        type: "error",
        text: "Erro ao reagendar visita",
      })
    } finally {
      setMovingAgendamento(null)
      setAgendamentoParaNaoRealizou(null)
      setTimeout(() => setStatusMessage(null), 5000)
    }
  }

  const handleNaoFechouFromModal = () => {
    if (!agendamentoParaNaoRealizou) return

    setShowNaoRealizouModal(false)
    setPendingMove({
      agendamentoId: agendamentoParaNaoRealizou.id,
      oldStage: agendamentoParaNaoRealizou.estagio_agendamento,
      agendamento: agendamentoParaNaoRealizou,
    })
    setAgendamentoParaNaoRealizou(null)
    setShowMotivoPerdaModal(true)
  }

  const handleVendido = async (agendamento: Agendamento) => {
    const now = new Date()
    const dataVenda = now.toISOString().split("T")[0]

    setMovingAgendamento(agendamento.id)

    setAgendamentos((prev) =>
      prev.map((a) =>
        a.id === agendamento.id
          ? {
              ...a,
              estagio_agendamento: "sucesso",
              data_venda: dataVenda,
              updated_at: now.toISOString(),
            }
          : a,
      ),
    )

    try {
      const success = await updateAgendamento(agendamento.id, {
        estagio_agendamento: "sucesso",
        data_venda: dataVenda,
      })

      if (!success) {
        setAgendamentos((prev) =>
          prev.map((a) => (a.id === agendamento.id ? { ...a, estagio_agendamento: "agendado" } : a)),
        )

        setStatusMessage({
          type: "error",
          text: "Erro ao registrar venda",
        })
      } else {
        if (currentUser) {
          await registrarHistoricoMovimentacao(
            agendamento.id,
            agendamento.id_empresa,
            "agendado",
            "sucesso",
            currentUser.nome_usuario,
            currentUser.cargo || "desconhecido",
            undefined,
            `Venda registrada em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
          )
        }

        setStatusMessage({
          type: "success",
          text: "Sucesso registrado com sucesso!",
        })
      }
    } catch (error) {
      setAgendamentos((prev) =>
        prev.map((a) => (a.id === agendamento.id ? { ...a, estagio_agendamento: "agendado" } : a)),
      )
      setStatusMessage({
        type: "error",
        text: "Erro ao registrar venda",
      })
    } finally {
      setMovingAgendamento(null)
      setTimeout(() => setStatusMessage(null), 5000)
    }
  }

  useEffect(() => {
    loadData()

    const supabase = createClient()
    const user = getCurrentUser()

    if (user) {
      console.log("[v0] Setting up realtime subscription for agendamentos")

      const channel = supabase
        .channel("agendamentos-changes")
        .on(
          "postgres_changes",
          {
            event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
            schema: "public",
            table: "AGENDAMENTOS",
            filter: `id_empresa=eq.${user.id_empresa}`,
          },
          (payload) => {
            console.log("[v0] Realtime update received:", payload)
            loadData()
          },
        )
        .subscribe()

      return () => {
        console.log("[v0] Cleaning up realtime subscription")
        supabase.removeChannel(channel)
      }
    }
  }, [])

  useEffect(() => {
    filterAgendamentos()
  }, [agendamentos, searchTerm])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {COLUNAS_KANBAN_AGENDAMENTOS.map((_, index) => (
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
    <div className="container mx-auto p-4 max-w-[1800px] space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
            {currentUser && (
              <Badge variant="secondary" className="ml-2">
                {currentUser.cargo?.toUpperCase()}
              </Badge>
            )}
            {!userCanEdit && !isVendedor && !isSdr && (
              <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800">
                <Lock className="h-3 w-3 mr-1" />
                Modo Visualização
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome, telefone ou vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {statusMessage && (
        <Alert
          className={`${statusMessage.type === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className={statusMessage.type === "success" ? "text-green-700" : "text-red-700"}>
            {statusMessage.text}
          </AlertDescription>
        </Alert>
      )}

      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUNAS_KANBAN_AGENDAMENTOS.map((coluna) => {
            const agendamentosColuna = getAgendamentosByStage(coluna)
            const total = agendamentosColuna.reduce((sum, a) => sum + Number(a.valor_venda || 0), 0)

            return (
              <DroppableColumn key={coluna} stage={coluna}>
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        {ESTAGIO_AGENDAMENTO_LABELS[coluna as keyof typeof ESTAGIO_AGENDAMENTO_LABELS] || coluna}
                      </CardTitle>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="secondary" className="font-mono">
                          {agendamentosColuna.length}
                        </Badge>
                        {coluna === "sucesso" && total > 0 && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {agendamentosColuna.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum agendamento</p>
                    ) : (
                      agendamentosColuna.map((agendamento: any) =>
                        agendamento.__mirrorFromSucesso ? (
                          <Card
                            key={`mirror-sucesso-${agendamento.id}`}
                            className="transition-all duration-200 cursor-pointer border-green-200 bg-green-50/30"
                            onClick={() => handleOpenAgendamento(agendamento)}
                          >
                            <CardHeader className="p-3 pr-10">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm font-medium truncate">{agendamento.nome_lead}</CardTitle>
                                  {agendamento.telefone && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                      <Phone className="h-3 w-3" />
                                      {agendamento.telefone}
                                    </p>
                                  )}
                                  <p className="text-xs text-green-700 mt-2">Espelho de "Sucesso"</p>
                                </div>
                              </div>
                            </CardHeader>
                          </Card>
                        ) : (
                          <DraggableCard
                            key={agendamento.id}
                            agendamento={agendamento}
                            onClick={() => handleOpenAgendamento(agendamento)}
                            onRealizouVisita={handleRealizouVisita}
                            onNaoRealizouVisita={handleNaoRealizouVisita}
                            onVendido={handleVendido}
                            isMoving={movingAgendamento === agendamento.id}
                          />
                        ),
                      )
                    )}
                  </CardContent>
                </Card>
              </DroppableColumn>
            )
          })}
        </div>
      </DndContext>

      <Dialog open={selectedAgendamento !== null} onOpenChange={() => setSelectedAgendamento(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAgendamento?.nome_lead}
              {isVendedor && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  Vendedor
                </Badge>
              )}
              {isSdr && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  SDR
                </Badge>
              )}
              {!userCanEdit && !isVendedor && !isSdr && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  <Lock className="h-3 w-3 mr-1" />
                  Somente Leitura
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedAgendamento && (
            <>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {(formData.data_agendamento || formData.hora_agendamento) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-blue-900 mb-2">
                        <Calendar className="h-4 w-4" />
                        Agendamento Marcado
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {formData.data_agendamento && (
                          <div>
                            <span className="text-blue-700 font-medium">Data:</span>{" "}
                            <span className="text-blue-900">
                              {formatAgendamentoDate(formData.data_agendamento)}
                            </span>
                          </div>
                        )}
                        {formData.hora_agendamento && (
                          <div>
                            <span className="text-blue-700 font-medium">Hora:</span>{" "}
                            <span className="text-blue-900">{formData.hora_agendamento}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-700">Nome</label>
                    <Input
                      value={editedAgendamento.nome_lead ?? selectedAgendamento.nome_lead ?? ""}
                      onChange={(e) => handleFieldChange("nome_lead", e.target.value)}
                      disabled={!canEdit}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Telefone</label>
                    <Input
                      value={editedAgendamento.telefone_lead ?? selectedAgendamento.telefone_lead ?? ""}
                      onChange={(e) => handleFieldChange("telefone_lead", e.target.value)}
                      disabled={true}
                      className="mt-1 bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <Input
                      value={editedAgendamento.email ?? selectedAgendamento.email ?? ""}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      disabled={!canEdit}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Modelo do Veículo</label>
                    <div className="mt-1">
                      <VehicleAutocomplete
                        value={editedAgendamento.modelo_veiculo ?? selectedAgendamento.modelo_veiculo ?? ""}
                        onChange={(value) => handleFieldChange("modelo_veiculo", value)}
                        placeholder="Digite modelo ou placa..."
                        disabled={!canEdit}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Data</label>
                    <Input
                      type="date"
                      value={editedAgendamento.data_agendamento ?? selectedAgendamento.data_agendamento ?? ""}
                      onChange={(e) => handleFieldChange("data_agendamento", e.target.value)}
                      className="mt-1"
                      disabled={!canEdit}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Hora</label>
                    <Input
                      type="time"
                      value={editedAgendamento.hora_agendamento ?? selectedAgendamento.hora_agendamento ?? ""}
                      onChange={(e) => handleFieldChange("hora_agendamento", e.target.value)}
                      className="mt-1"
                      disabled={!canEdit}
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
                        disabled={!canEdit}
                      />
                      Visita Realizada
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
                          }))
                        }
                        disabled={!canEdit}
                      />
                      Sucesso
                    </label>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Vendedor</label>
                    <Select
                      value={editedAgendamento.vendedor ?? selectedAgendamento.vendedor ?? ""}
                      onValueChange={(value) => handleFieldChange("vendedor", value)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione um vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedores.map((v) => (
                          <SelectItem key={v.id} value={v.nome_usuario}>
                            {v.nome_usuario}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Observações</label>
                    <Textarea
                      placeholder="Adicione observações"
                      value={editedAgendamento.observacoes ?? selectedAgendamento.observacoes ?? ""}
                      onChange={(e) => handleFieldChange("observacoes", e.target.value)}
                      className="mt-1"
                      disabled={!canEdit}
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      Observações do Vendedor
                      {isVendedor && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          Editável
                        </Badge>
                      )}
                    </label>
                    <Textarea
                      placeholder="Observações do vendedor sobre o atendimento..."
                      value={editedAgendamento.observacoes_vendedor ?? selectedAgendamento.observacoes_vendedor ?? ""}
                      onChange={(e) => handleFieldChange("observacoes_vendedor", e.target.value)}
                      className="mt-1"
                      disabled={!isVendedor && !userCanEdit}
                      rows={3}
                    />
                    {!isVendedor && (
                      <p className="text-xs text-gray-500 mt-1">Apenas vendedores podem editar este campo.</p>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                      <History className="h-4 w-4" />
                      Histórico de Movimentações
                    </label>

                    {loadingHistorico ? (
                      <div className="space-y-2">
                        {[1, 2].map((i) => (
                          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                        ))}
                      </div>
                    ) : historicoMovimentacoes.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">Nenhuma movimentação registrada.</p>
                    ) : (
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        {historicoMovimentacoes.map((h) => (
                          <div key={h.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="text-xs">
                                {h.estagio_anterior
                                  ? ESTAGIO_AGENDAMENTO_LABELS[
                                      h.estagio_anterior as keyof typeof ESTAGIO_AGENDAMENTO_LABELS
                                    ] || h.estagio_anterior
                                  : "Início"}
                              </Badge>
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <Badge variant="secondary" className="text-xs">
                                {ESTAGIO_AGENDAMENTO_LABELS[
                                  h.estagio_novo as keyof typeof ESTAGIO_AGENDAMENTO_LABELS
                                ] || h.estagio_novo}
                              </Badge>
                            </div>
                            <div className="mt-2 text-xs text-gray-600">
                              <span className="font-medium">{h.usuario_nome}</span>
                              <span className="text-gray-400"> ({h.usuario_cargo})</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">{formatHistoricoDate(h.created_at)}</div>
                            {h.motivo_perda && (
                              <div className="mt-2 text-xs bg-red-50 text-red-700 p-2 rounded">
                                <span className="font-medium">Motivo da perda:</span> {h.motivo_perda}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="mt-4 pt-4 border-t">
                {userCanEdit || isVendedor || isSdr ? (
                  <div className="flex gap-2 w-full">
                    <Button
                      onClick={handleSaveAgendamento}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Salvar
                    </Button>
                    {(userCanEdit || (isSdr && selectedAgendamento?.sdr_responsavel === currentUser?.nome_usuario)) &&
                      !isVendedor && (
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDeleteAgendamento(selectedAgendamento.id)}
                          disabled={deletingAgendamento === selectedAgendamento.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setSelectedAgendamento(null)} className="w-full">
                    Fechar
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showNaoRealizouModal} onOpenChange={setShowNaoRealizouModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cliente não compareceu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">O que deseja fazer com este agendamento?</p>
            <div className="space-y-2">
              <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white" onClick={handleReagendar}>
                <Calendar className="h-4 w-4 mr-2" />
                Reagendar
                <span className="ml-auto text-xs opacity-80">Mover para Reagendado</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-red-200 text-red-700 hover:bg-red-50 bg-transparent"
                onClick={handleNaoFechouFromModal}
              >
                <X className="h-4 w-4 mr-2" />
                Insucesso
                <span className="ml-auto text-xs opacity-80">Registrar motivo</span>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNaoRealizouModal(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RegistrarVendaModal
        isOpen={showRegistrarVendaModal}
        onClose={handleCancelRegistrarVenda}
        onConfirm={handleConfirmRegistrarVenda}
        leadName={pendingMove?.agendamento?.nome_lead || ""}
      />

      <MotivoPerdaModal
        isOpen={showMotivoPerdaModal}
        onClose={handleCancelMotivoPerda}
        onConfirm={handleConfirmMotivoPerda}
        leadName={pendingMove?.agendamento?.nome_lead || ""}
      />
    </div>
  )
}
