"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Send, MessageSquare, Loader2, CheckCircle } from "lucide-react"

interface SendMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: (message: string) => Promise<void>
  selectedCount: number
  onSuccess?: () => void
}

export function SendMessageModal({ isOpen, onClose, onSend, selectedCount, onSuccess }: SendMessageModalProps) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSend = async () => {
    if (!message.trim()) return

    setSending(true)
    try {
      await onSend(message)
      setMessage("")
      setShowSuccess(true)

      // Auto close and refresh after 2 seconds
      setTimeout(() => {
        setShowSuccess(false)
        onClose()
        if (onSuccess) {
          onSuccess()
        }
      }, 2000)
    } finally {
      setSending(false)
    }
  }

  const handleClose = () => {
    if (!sending) {
      setShowSuccess(false)
      setMessage("")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {showSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-700">Sua mensagem foi enviada com sucesso!</h3>
            <p className="text-sm text-muted-foreground">A página será atualizada automaticamente...</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                Enviar Mensagem
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  Você está enviando uma mensagem para <strong>{selectedCount}</strong> lead(s) selecionado(s).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Digite a mensagem para o Lead</Label>
                <Textarea
                  id="message"
                  placeholder="Digite sua mensagem aqui..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={!message.trim() || sending} className="gap-2">
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
