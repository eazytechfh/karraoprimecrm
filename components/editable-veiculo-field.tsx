"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { updateLeadVeiculo } from "@/lib/leads"
import { Check, X, Edit3, Car, Search } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

interface Vehicle {
  id: number
  modelo: string
  marca: string
  placa: string
  ano: number
  cor: string
  valor: string
  status: string
}

interface EditableVeiculoFieldProps {
  leadId: number
  currentVeiculo: string
  onVeiculoUpdate: (newVeiculo: string) => void
  className?: string
}

export function EditableVeiculoField({
  leadId,
  currentVeiculo,
  onVeiculoUpdate,
  className = "",
}: EditableVeiculoFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(currentVeiculo || "")
  const [loading, setLoading] = useState(false)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditing) {
      loadVehicles()
    }
  }, [isEditing])

  useEffect(() => {
    if (editValue && editValue.length > 0 && vehicles.length > 0) {
      const searchTerm = editValue.toLowerCase()
      const filtered = vehicles.filter(
        (v) =>
          v.modelo?.toLowerCase().includes(searchTerm) ||
          v.marca?.toLowerCase().includes(searchTerm) ||
          v.placa?.toLowerCase().includes(searchTerm) ||
          `${v.marca} ${v.modelo}`.toLowerCase().includes(searchTerm),
      )
      setFilteredVehicles(filtered.slice(0, 8))
      setShowSuggestions(filtered.length > 0)
    } else {
      setFilteredVehicles([])
      setShowSuggestions(false)
    }
  }, [editValue, vehicles])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const loadVehicles = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("estoque")
        .select("id, modelo, marca, placa, ano, cor, valor, status")
        .order("modelo", { ascending: true })

      if (!error && data) {
        setVehicles(data)
      }
    } catch (error) {
      console.error("Error loading vehicles:", error)
    }
  }

  const handleStartEdit = () => {
    setIsEditing(true)
    setEditValue(currentVeiculo || "")
  }

  const handleSelectVehicle = (vehicle: Vehicle) => {
    const displayValue = `${vehicle.marca} ${vehicle.modelo} - ${vehicle.placa}`
    setEditValue(displayValue)
    setShowSuggestions(false)
  }

  const handleSave = async () => {
    setLoading(true)

    try {
      const success = await updateLeadVeiculo(leadId, editValue)

      if (success) {
        onVeiculoUpdate(editValue)
        setIsEditing(false)
      } else {
        setEditValue(currentVeiculo || "")
      }
    } catch (error) {
      console.error("Error updating veiculo:", error)
      setEditValue(currentVeiculo || "")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditValue(currentVeiculo || "")
    setIsEditing(false)
    setShowSuggestions(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyPress}
              onFocus={() => editValue && filteredVehicles.length > 0 && setShowSuggestions(true)}
              className="text-xs h-7 pl-7 pr-1 border-blue-300 focus:border-blue-500"
              placeholder="Digite modelo ou placa..."
              autoFocus
              disabled={loading}
            />
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={loading}
              className="h-7 w-7 p-0 bg-blue-500 hover:bg-blue-600"
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="h-7 w-7 p-0 border-gray-300 hover:bg-gray-50 bg-transparent"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {showSuggestions && filteredVehicles.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white rounded-md border shadow-lg max-h-[250px] overflow-auto">
            <Command>
              <CommandList>
                <CommandGroup heading="Veículos do Estoque">
                  {filteredVehicles.map((vehicle) => (
                    <CommandItem
                      key={vehicle.id}
                      onSelect={() => handleSelectVehicle(vehicle)}
                      className="cursor-pointer hover:bg-gray-100 p-2"
                    >
                      <div className="flex items-start gap-2 w-full">
                        <Car className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-xs truncate">
                              {vehicle.marca} {vehicle.modelo}
                            </span>
                            <span className="text-xs text-gray-500 shrink-0">{vehicle.ano}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Placa: <span className="font-mono">{vehicle.placa}</span>
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-between group cursor-pointer hover:bg-blue-50 rounded p-2 transition-colors border border-blue-200 ${className}`}
      onClick={handleStartEdit}
    >
      <div className="flex items-center gap-2">
        <Car className="h-4 w-4 text-blue-600" />
        <div>
          <span className="text-sm font-medium text-blue-800">Veículo de Interesse</span>
          <div className="text-sm text-gray-700">
            {currentVeiculo || <span className="text-gray-400 italic">Clique para adicionar veículo</span>}
          </div>
        </div>
      </div>
      <Edit3 className="h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}
