"use client"

import { useEffect, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { updateLeadObservacao } from "@/lib/leads"
import { CARGO_LABELS, getCurrentUser } from "@/lib/auth"
import { Edit3, Loader2, MessageSquare, Plus, X } from "lucide-react"

interface EditableObservacaoFieldProps {
  leadId: number
  currentObservacao: string
  onObservacaoUpdate: (newObservacao: string) => void
  className?: string
}

interface InteractionEntry {
  id: string
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

  const blockRegex = /\[Interacao\]([\s\S]*?)\[\/Interacao\]/g
  const parsedEntries: InteractionEntry[] = []
  const legacyParts: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null = null

  while ((match = blockRegex.exec(content)) !== null) {
    const legacyChunk = content.slice(lastIndex, match.index).trim()
    if (legacyChunk) {
      legacyParts.push(legacyChunk)
    }

    const normalizedBlock = match[1].trim()
    const lines = normalizedBlock.split("\n")
    const authorLine = lines.find((line) => line.startsWith("Autor: "))
    const cargoLine = lines.find((line) => line.startsWith("Cargo: "))
    const dateLine = lines.find((line) => line.startsWith("Data: "))
    const messageIndex = lines.findIndex((line) => line.startsWith("Mensagem: "))

    if (authorLine && cargoLine && dateLine && messageIndex !== -1) {
      const firstMessageLine = lines[messageIndex].replace("Mensagem: ", "")
      const remainingMessageLines = lines.slice(messageIndex + 1)
      const createdAt = dateLine.replace("Data: ", "").trim()

      parsedEntries.push({
        id: `${createdAt}-${parsedEntries.length}`,
        author: authorLine.replace("Autor: ", "").trim(),
        cargo: cargoLine.replace("Cargo: ", "").trim(),
        createdAt,
        message: [firstMessageLine, ...remainingMessageLines].join("\n").trim(),
      })
    }

    lastIndex = blockRegex.lastIndex
  }

  const trailingLegacy = content.slice(lastIndex).trim()
  if (trailingLegacy) {
    legacyParts.push(trailingLegacy)
  }

  const legacyEntries = legacyParts.map((message, index) => ({
    id: `legacy-${index}`,
    author: "Registro anterior",
    cargo: "Historico",
    createdAt: "",
    message,
    isLegacy: true,
  }))

  return [...parsedEntries.reverse(), ...legacyEntries]
}

function createInteractionEntry(message: string, existingEntry?: InteractionEntry): InteractionEntry {
  const currentUser = getCurrentUser()
  const author = existingEntry?.author || currentUser?.nome_usuario || "Usuario"
  const cargo =
    existingEntry?.cargo || (currentUser?.cargo ? CARGO_LABELS[currentUser.cargo] || currentUser.cargo : "Usuario")
  const createdAt = existingEntry?.createdAt || new Date().toISOString()

  return {
    id: existingEntry?.id || `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    author,
    cargo,
    createdAt,
    message: message.trim(),
    isLegacy: existingEntry?.isLegacy,
  }
}

function serializeInteractionEntries(entries: InteractionEntry[]) {
  return entries
    .slice()
    .reverse()
    .map((entry) => {
      if (entry.isLegacy) {
        return entry.message.trim()
      }

      return [
        INTERACTION_START,
        `Autor: ${entry.author}`,
        `Cargo: ${entry.cargo}`,
        `Data: ${entry.createdAt}`,
        `Mensagem: ${entry.message.trim()}`,
        INTERACTION_END,
      ].join("\n")
    })
    .filter(Boolean)
    .join("\n\n")
    .trim()
}

function buildObservacaoWithEntries(observacao: string, entries: InteractionEntry[]) {
  const { motivoLine } = splitMotivoAndContent(observacao)
  const serializedEntries = serializeInteractionEntries(entries)
  return [serializedEntries, motivoLine].filter(Boolean).join("\n").trim()
}

function upsertInteractionEntry(entries: InteractionEntry[], message: string, editingEntryId: string | null) {
  if (editingEntryId) {
    return entries.map((entry) => (entry.id === editingEntryId ? createInteractionEntry(message, entry) : entry))
  }

  return [createInteractionEntry(message), ...entries]
}

function formatInteractionDate(dateValue: string) {
  if (!dateValue) return ""

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return dateValue

  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${day}/${month} ${hours}:${minutes}`
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
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  useEffect(() => {
    setEntries(parseInteractionHistory(currentObservacao || ""))
    setEditingEntryId(null)
    setNewMessage("")
  }, [currentObservacao])

  const handleStartEdit = (entry: InteractionEntry) => {
    setEditingEntryId(entry.id)
    setNewMessage(entry.message)
  }

  const handleCancelEdit = () => {
    setEditingEntryId(null)
    setNewMessage("")
  }

  const handleSave = async () => {
    if (!newMessage.trim()) return

    setLoading(true)

    try {
      const nextEntries = upsertInteractionEntry(entries, newMessage, editingEntryId)
      const nextObservacao = buildObservacaoWithEntries(currentObservacao || "", nextEntries)
      const success = await updateLeadObservacao(leadId, nextObservacao)

      if (success) {
        onObservacaoUpdate(nextObservacao)
        setNewMessage("")
        setEditingEntryId(null)
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
          entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-orange-100 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{entry.message}</p>
                {!entry.isLegacy && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-orange-500 hover:bg-orange-100 hover:text-orange-700"
                    onClick={() => handleStartEdit(entry)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
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
        <div className="flex justify-end gap-2">
          {editingEntryId && (
            <Button type="button" size="sm" variant="outline" onClick={handleCancelEdit} disabled={loading}>
              <X className="mr-1 h-3 w-3" />
              Cancelar
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading || !newMessage.trim()}
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
            {editingEntryId ? "Salvar edicao" : "Registrar interacao"}
          </Button>
        </div>
        <p className="text-xs text-gray-500">Cada nova mensagem fica registrada com usuario, cargo e data.</p>
      </div>
    </div>
  )
}
