"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle } from "lucide-react"
import { MOTIVOS_PERDA, type MotivoPerda } from "@/lib/agendamentos"

interface MotivoPerdaModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (motivo: MotivoPerda, data: string) => void
  leadName: string
}

export function MotivoPerdaModal({ isOpen, onClose, onConfirm, leadName }: MotivoPerdaModalProps) {
  const [motivo, setMotivo] = useState<MotivoPerda | "">("")
  const [data, setData] = useState(new Date().toISOString().split("T")[0])

  const handleConfirm = () => {
    if (motivo) {
      onConfirm(motivo, data)
      setMotivo("")
      setData(new Date().toISOString().split("T")[0])
    }
  }

  const handleClose = () => {
    setMotivo("")
    setData(new Date().toISOString().split("T")[0])
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Registrar Perda do Lead
          </DialogTitle>
          <DialogDescription>
            Deseja mudar o lead <span className="font-semibold">{leadName}</span> como perdido? Por favor, informe o
            motivo da perda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="data-perda">Data</Label>
            <input
              id="data-perda"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Select value={motivo} onValueChange={(value) => setMotivo(value as MotivoPerda)}>
              <SelectTrigger id="motivo">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_PERDA.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!motivo} variant="destructive">
            Confirmar Perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
