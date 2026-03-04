"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Car, Search } from "lucide-react"
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

interface VehicleAutocompleteProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function VehicleAutocomplete({
  value,
  onChange,
  placeholder = "Digite modelo ou placa...",
  disabled = false,
}: VehicleAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadVehicles()
  }, [])

  useEffect(() => {
    if (value && value.length > 0) {
      const searchTerm = value.toLowerCase()
      const filtered = vehicles.filter(
        (v) =>
          v.modelo?.toLowerCase().includes(searchTerm) ||
          v.marca?.toLowerCase().includes(searchTerm) ||
          v.placa?.toLowerCase().includes(searchTerm) ||
          `${v.marca} ${v.modelo}`.toLowerCase().includes(searchTerm),
      )
      setFilteredVehicles(filtered.slice(0, 10))
      setOpen(filtered.length > 0)
    } else {
      setFilteredVehicles([])
      setOpen(false)
    }
  }, [value, vehicles])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const loadVehicles = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("estoque")
        .select("id, modelo, marca, placa, ano, cor, valor, status")
        .order("modelo", { ascending: true })

      if (error) {
        console.error("[v0] Error loading vehicles:", error)
      } else {
        setVehicles(data || [])
      }
    } catch (error) {
      console.error("[v0] Error loading vehicles:", error)
    }
    setLoading(false)
  }

  const handleSelect = (vehicle: Vehicle) => {
    const displayValue = `${vehicle.marca} ${vehicle.modelo} - ${vehicle.placa}`
    onChange(displayValue)
    setOpen(false)
    inputRef.current?.blur()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  const formatCurrency = (value: string) => {
    const num = Number.parseFloat(value)
    if (isNaN(num)) return value
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={() => value && filteredVehicles.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10"
        />
      </div>

      {open && filteredVehicles.length > 0 && (
        <div className="absolute z-[100] w-full mt-1 bg-white rounded-md border shadow-lg max-h-[300px] overflow-auto">
          <div className="p-2">
            <p className="text-xs font-medium text-gray-500 px-2 py-1">Veículos do Estoque</p>
            {filteredVehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                onClick={() => handleSelect(vehicle)}
                className="w-full text-left cursor-pointer hover:bg-gray-100 p-2 rounded-md transition-colors"
              >
                <div className="flex items-start gap-3 w-full">
                  <Car className="h-5 w-5 text-gray-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {vehicle.marca} {vehicle.modelo}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">{vehicle.ano}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">
                        Placa: <span className="font-mono">{vehicle.placa}</span>
                        {vehicle.cor && ` • ${vehicle.cor}`}
                      </span>
                      {vehicle.valor && (
                        <span className="text-xs font-medium text-green-600 shrink-0">
                          {formatCurrency(vehicle.valor)}
                        </span>
                      )}
                    </div>
                    {vehicle.status && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${
                          vehicle.status.toLowerCase() === "disponível" || vehicle.status.toLowerCase() === "disponivel"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {vehicle.status}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
        </div>
      )}
    </div>
  )
}
