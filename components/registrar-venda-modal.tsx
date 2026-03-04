"use client"

import type React from "react"

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
import { Input } from "@/components/ui/input"
import { CheckCircle } from "lucide-react"

interface RegistrarVendaModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: string, veiculo: string, valor: number) => void
  leadName: string
}

export function RegistrarVendaModal({ isOpen, onClose, onConfirm, leadName }: RegistrarVendaModalProps) {
  const [data, setData] = useState(new Date().toISOString().split("T")[0])
  const [veiculo, setVeiculo] = useState("")
  const [valor, setValor] = useState("")

  const handleConfirm = () => {
    if (veiculo && valor) {
      const valorNumerico = Number.parseFloat(valor.replace(/[^\d,]/g, "").replace(",", "."))
      onConfirm(data, veiculo, valorNumerico)
      // Reset form
      setData(new Date().toISOString().split("T")[0])
      setVeiculo("")
      setValor("")
    }
  }

  const handleClose = () => {
    setData(new Date().toISOString().split("T")[0])
    setVeiculo("")
    setValor("")
    onClose()
  }

  const formatCurrency = (value: string) => {
    // Remove non-numeric characters except comma
    const numericValue = value.replace(/[^\d,]/g, "")

    // Format as currency
    if (numericValue) {
      const parts = numericValue.split(",")
      const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".")
      const decimalPart = parts[1] !== undefined ? `,${parts[1].slice(0, 2)}` : ""
      return `R$ ${integerPart}${decimalPart}`
    }
    return ""
  }

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value)
    setValor(formatted)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            Registrar Venda
          </DialogTitle>
          <DialogDescription>
            Registre os detalhes da venda do lead <span className="font-semibold">{leadName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="data-venda">Data</Label>
            <Input id="data-venda" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="veiculo">Veículo Vendido</Label>
            <Input
              id="veiculo"
              type="text"
              placeholder="Ex: CHEVROLET ONIX PLUS 1.0"
              value={veiculo}
              onChange={(e) => setVeiculo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">Valor</Label>
            <Input id="valor" type="text" placeholder="R$ 0,00" value={valor} onChange={handleValorChange} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!veiculo || !valor} className="bg-green-600 hover:bg-green-700">
            Confirmar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
