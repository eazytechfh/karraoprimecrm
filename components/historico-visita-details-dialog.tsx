"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ESTAGIO_AGENDAMENTO_LABELS,
  normalizeAgendamentoStage,
  parseAgendamentoCheckboxFlags,
  shouldAppearInRealizouVisitaColumn,
  type Agendamento,
} from "@/lib/agendamentos"

interface HistoricoVisitaDetailsDialogProps {
  visita: Agendamento | null
  onClose: () => void
}

function formatDateOnly(dateString?: string) {
  if (!dateString) return "-"
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("pt-BR")
}

function formatDateTime(dateString?: string) {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "-"
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-1 break-words text-sm font-medium text-gray-900">{children || "-"}</div>
    </div>
  )
}

export function HistoricoVisitaDetailsDialog({ visita, onClose }: HistoricoVisitaDetailsDialogProps) {
  if (!visita) return null

  const normalizedStage = normalizeAgendamentoStage(visita.estagio_agendamento)
  const realizouVisita = shouldAppearInRealizouVisitaColumn(visita)
  const ganhou = normalizedStage === "sucesso"
  const observacoes = parseAgendamentoCheckboxFlags(visita.observacoes).cleanObservacoes
  const statusLabel =
    ESTAGIO_AGENDAMENTO_LABELS[normalizedStage as keyof typeof ESTAGIO_AGENDAMENTO_LABELS] ||
    visita.estagio_agendamento

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{visita.nome_lead || "Informações da visita"}</DialogTitle>
          <DialogDescription>Informações completas do agendamento selecionado.</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto pr-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailItem label="Cliente">{visita.nome_lead || "-"}</DetailItem>
            <DetailItem label="Telefone">{visita.telefone || "-"}</DetailItem>
            <DetailItem label="E-mail">{visita.email || "-"}</DetailItem>
            <DetailItem label="Modelo do veículo">{visita.modelo_veiculo || "-"}</DetailItem>
            <DetailItem label="Vendedor">{visita.vendedor || "-"}</DetailItem>
            <DetailItem label="SDR responsável">{visita.sdr_responsavel || "-"}</DetailItem>
            <DetailItem label="Data do agendamento">
              {visita.data_agendamento
                ? `${formatDateOnly(visita.data_agendamento)}${visita.hora_agendamento ? ` às ${visita.hora_agendamento}` : ""}`
                : "-"}
            </DetailItem>
            <DetailItem label="Status final">
              <Badge className="bg-slate-100 text-slate-800">{statusLabel}</Badge>
            </DetailItem>
            <DetailItem label="Visita realizada">
              <Badge className={realizouVisita ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-700"}>
                {realizouVisita ? "Sim" : "Não"}
              </Badge>
            </DetailItem>
            <DetailItem label="Sucesso">
              <Badge className={ganhou ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}>
                {ganhou ? "Sim" : "Não"}
              </Badge>
            </DetailItem>
            <DetailItem label="Data da venda">{formatDateOnly(visita.data_venda)}</DetailItem>
            <DetailItem label="Valor da venda">{formatCurrency(visita.valor_venda)}</DetailItem>
            <DetailItem label="Veículo vendido">{visita.veiculo_vendido || "-"}</DetailItem>
            <DetailItem label="Motivo">{visita.motivo_perda || "-"}</DetailItem>
            <DetailItem label="Data do insucesso">{formatDateOnly(visita.data_perda)}</DetailItem>
            <DetailItem label="Criado em">{formatDateTime(visita.created_at)}</DetailItem>
            <DetailItem label="Última atualização">{formatDateTime(visita.updated_at)}</DetailItem>
          </div>

          {(observacoes || visita.observacoes_vendedor) && (
            <div className="mt-3 space-y-3">
              {observacoes && (
                <DetailItem label="Observações">
                  <p className="whitespace-pre-wrap">{observacoes}</p>
                </DetailItem>
              )}
              {visita.observacoes_vendedor && (
                <DetailItem label="Observações do vendedor">
                  <p className="whitespace-pre-wrap">{visita.observacoes_vendedor}</p>
                </DetailItem>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
