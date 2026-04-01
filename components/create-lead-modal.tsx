"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, User, Phone, Mail, Car, DollarSign, FileText, MapPin } from "lucide-react"
import { createLead } from "@/lib/leads"
import { getCurrentUser } from "@/lib/auth"
import { VehicleAutocomplete } from "./vehicle-autocomplete"

interface CreateLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const ORIGENS = [
  "Website",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "Indicação",
  "Telefone",
  "Presencial",
  "OLX",
  "Webmotors",
  "iCarros",
  "Outro",
]

export function CreateLeadModal({ isOpen, onClose, onSuccess }: CreateLeadModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome_lead: "",
    telefone: "",
    email: "",
    origem: "",
    veiculo_interesse: "",
    valor: "",
    observacao_vendedor: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nome_lead.trim()) {
      alert("O nome do lead é obrigatório")
      return
    }

    setIsLoading(true)

    try {
      const user = getCurrentUser()
      if (!user) {
        alert("Usuário não autenticado")
        return
      }

      const success = await createLead({
        nome_lead: formData.nome_lead,
        telefone: formData.telefone || undefined,
        email: formData.email || undefined,
        origem: formData.origem || undefined,
        veiculo_interesse: formData.veiculo_interesse || undefined,
        valor: formData.valor ? Number.parseFloat(formData.valor) : 0,
        observacao_vendedor: formData.observacao_vendedor || undefined,
        id_empresa: user.id_empresa,
        estagio_lead: "pendente",
        sdr_responsavel: user.cargo === "sdr" ? user.nome_usuario : undefined,
      })

      if (success) {
        // Reset form
        setFormData({
          nome_lead: "",
          telefone: "",
          email: "",
          origem: "",
          veiculo_interesse: "",
          valor: "",
          observacao_vendedor: "",
        })
        onSuccess()
        onClose()
      } else {
        alert("Erro ao criar lead. Tente novamente.")
      }
    } catch (error) {
      console.error("Error creating lead:", error)
      alert("Erro ao criar lead. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Nova Negociação
          </DialogTitle>
          <DialogDescription>Cadastre um novo lead manualmente no sistema.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome do Lead */}
            <div className="md:col-span-2">
              <Label htmlFor="nome_lead" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nome do Lead *
              </Label>
              <Input
                id="nome_lead"
                value={formData.nome_lead}
                onChange={(e) => setFormData({ ...formData, nome_lead: e.target.value })}
                placeholder="Nome completo do lead"
                className="mt-1"
                required
              />
            </div>

            {/* Telefone */}
            <div>
              <Label htmlFor="telefone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone
              </Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="mt-1"
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="mt-1"
              />
            </div>

            {/* Origem */}
            <div>
              <Label htmlFor="origem" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Origem
              </Label>
              <Select value={formData.origem} onValueChange={(value) => setFormData({ ...formData, origem: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((origem) => (
                    <SelectItem key={origem} value={origem}>
                      {origem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Veículo de Interesse */}
            <div>
              <Label htmlFor="veiculo_interesse" className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Veículo de Interesse
              </Label>
              <div className="mt-1">
                <VehicleAutocomplete
                  value={formData.veiculo_interesse}
                  onChange={(value) => setFormData({ ...formData, veiculo_interesse: value })}
                  placeholder="Digite modelo ou placa..."
                />
              </div>
            </div>

            {/* Valor */}
            <div className="md:col-span-2">
              <Label htmlFor="valor" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Valor Estimado (R$)
              </Label>
              <Input
                id="valor"
                type="number"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                placeholder="0,00"
                className="mt-1"
              />
            </div>

            {/* Observações */}
            <div className="md:col-span-2">
              <Label htmlFor="observacao_vendedor" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Observações
              </Label>
              <Textarea
                id="observacao_vendedor"
                value={formData.observacao_vendedor}
                onChange={(e) => setFormData({ ...formData, observacao_vendedor: e.target.value })}
                placeholder="Informações adicionais sobre o lead..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Cadastrar Lead"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
