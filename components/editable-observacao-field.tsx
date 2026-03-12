"use client"

import { useEffect, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { updateLeadObservacao } from "@/lib/leads"
import { CARGO_LABELS, getCurrentUser } from "@/lib/auth"
import { Loader2, MessageSquare, Plus } from "lucide-react"

interface EditableObservacaoFieldProps {
  leadId: number
  currentObservacao: string
  onObservacaoUpdate: (newObservacao: string) => void
  className?: string
}

interface InteractionEntry {
  author: string
  cargo: string
  createdAt: string
  message: string
  isLegacy?: boolean
}

const MOTIVO_PREFIX = "[Motivo] "
const INTERACTION_START = "[Interacao]"
const INTERACTION_END = "[/Interacao]"

function splitMotivoAndContent(observacao: string) {
  const lines = (observacao || "").split("\n")
  const motivoLine = lines.find((line) => line.trim().startsWith(MOTIVO_PREFIX)) || ""
  const contentLines = lines.filter((line) => !line.trim().startsWith(MOTIVO_PREFIX))
  return {
    motivoLine,
    content: contentLines.join("\n").trim(),
  }
}

function parseInteractionHistory(observacao: string): InteractionEntry[] {
  const { content } = splitMotivoAndContent(observacao)

  if (!content) return []

  const blocks = content
    .split(INTERACTION_END)
    .map((block) => block.trim())
    .filter(Boolean)

  const parsedEntries = blocks
    .map((block) => {
      if (!block.startsWith(INTERACTION_START)) return null

      const normalizedBlock = block.replace(INTERACTION_START, "").trim()
      const lines = normalizedBlock.split("\n")
      const authorLine = lines.find((line) => line.startsWith("Autor: "))
      const cargoLine = lines.find((line) => line.startsWith("Cargo: "))
      const dateLine = lines.find((line) => line.startsWith("Data: "))
      const messageIndex = lines.findIndex((line) => line.startsWith("Mensagem: "))

      if (!authorLine || !cargoLine || !dateLine || messageIndex === -1) return null

      const firstMessageLine = lines[messageIndex].replace("Mensagem: ", "")
      const remainingMessageLines = lines.slice(messageIndex + 1)

      return {
        author: authorLine.replace("Autor: ", "").trim(),
        cargo: cargoLine.replace("Cargo: ", "").trim(),
        createdAt: dateLine.replace("Data: ", "").trim(),
        message: [firstMessageLine, ...remainingMessageLines].join("\n").trim(),
      }
    })
    .filter((entry): entry is InteractionEntry => Boolean(entry))

  if (parsedEntries.length > 0) return parsedEntries.reverse()

  return [
    {
      author: "Registro anterior",
      cargo: "Historico",
      createdAt: "",
      message: content,
      isLegacy: true,
    },
  ]
}

function buildInteractionEntry(message: string) {
  const currentUser = getCurrentUser()
  const author = currentUser?.nome_usuario || "Usuario"
  const cargo = currentUser?.cargo ? CARGO_LABELS[currentUser.cargo] || currentUser.cargo : "Usuario"
  const createdAt = new Date().toISOString()

  return [
    INTERACTION_START,
    `Autor: ${author}`,
    `Cargo: ${cargo}`,
    `Data: ${createdAt}`,
    `Mensagem: ${message.trim()}`,
    INTERACTION_END,
  ].join("\n")
}

function appendInteraction(observacao: string, message: string) {
  const { motivoLine, content } = splitMotivoAndContent(observacao)
  const parts = [content, buildInteractionEntry(message)].filter(Boolean)
  const nextContent = parts.join("\n\n").trim()
  return [nextContent, motivoLine].filter(Boolean).join("\n").trim()
}

function formatInteractionDate(dateValue: string) {
  if (!dateValue) return ""

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return dateValue

  return date.toLocaleString("pt-BR")
}

export function EditableObservacaoField({
  leadId,
  currentObservacao,
  onObservacaoUpdate,
  className = "",
}: EditableObservacaoFieldProps) {
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<InteractionEntry[]>(() => parseInteractionHistory(currentObservacao || ""))

  useEffect(() => {
    setEntries(parseInteractionHistory(currentObservacao || ""))
  }, [currentObservacao])

  const handleSave = async () => {
    if (!newMessage.trim()) return

    setLoading(true)

    try {
      const nextObservacao = appendInteraction(currentObservacao || "", newMessage)
      const success = await updateLeadObservacao(leadId, nextObservacao)

      if (success) {
        onObservacaoUpdate(nextObservacao)
        setNewMessage("")
      }
    } catch (error) {
      console.error("Error updating observacao:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`rounded-lg border border-orange-200 bg-orange-50/40 p-4 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-orange-600" />
        <span className="text-sm font-medium text-orange-800">Interacoes do Lead</span>
      </div>

      <div className="mb-4 max-h-[280px] space-y-3 overflow-y-auto pr-1">
        {entries.length > 0 ? (
          entries.map((entry, index) => (
            <div key={`${entry.createdAt}-${index}`} className="rounded-lg border border-orange-100 bg-white p-3 shadow-sm">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{entry.message}</p>
              <div className="mt-3 text-xs text-gray-500">
                {entry.isLegacy ? (
                  <span>{entry.author}</span>
                ) : (
                  <span>
                    Feito por: {entry.author} ({entry.cargo}) - {formatInteractionDate(entry.createdAt)}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-orange-200 bg-white/70 p-4 text-sm italic text-gray-400">
            Nenhuma interacao registrada ainda.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="min-h-[110px] resize-none border-orange-300 focus:border-orange-500"
          placeholder="Digite uma nova interacao para este lead..."
          disabled={loading}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading || !newMessage.trim()}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
            Registrar interacao
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Cada nova mensagem fica registrada com usuario, cargo e data.
        </p>
      </div>
    </div>
  )
}
