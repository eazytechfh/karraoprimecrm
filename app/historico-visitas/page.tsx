"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentUser } from "@/lib/auth"
import {
  getHistoricoVisitas,
  getVendedores,
  getSdrs,
  shouldAppearInRealizouVisitaColumn,
  type Agendamento,
  type Vendedor,
  ESTAGIO_AGENDAMENTO_LABELS,
} from "@/lib/agendamentos"
import { Calendar, Phone, User, Clock, Filter } from "lucide-react"

export default function HistoricoVisitasPage() {
  const [historico, setHistorico] = useState<Agendamento[]>([])
  const [filteredHistorico, setFilteredHistorico] = useState<Agendamento[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [sdrs, setSdrs] = useState<Vendedor[]>([]) // Added SDRs state
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const [filters, setFilters] = useState({
    periodo: "",
    vendedor: "",
    sdr: "", // Added SDR filter
    status: "", // Added status filter
    realizouVisita: "",
    ganho: "",
    dataInicio: "",
    dataFim: "",
  })

  const currentUser = getCurrentUser()

  const loadData = async () => {
    if (!currentUser) return

    setLoading(true)

    const filterParams: any = {}

    if (filters.periodo) {
      filterParams.periodo = filters.periodo
    }
    if (filters.vendedor) {
      filterParams.vendedor = filters.vendedor
    }
    if (filters.sdr) {
      filterParams.sdr = filters.sdr
    }
    if (filters.dataInicio) {
      filterParams.dataInicio = filters.dataInicio
    }
    if (filters.dataFim) {
      filterParams.dataFim = filters.dataFim
    }

    const [historicoData, vendedoresData, sdrsData] = await Promise.all([
      getHistoricoVisitas(currentUser.id_empresa, filterParams),
      getVendedores(currentUser.id_empresa),
      getSdrs(currentUser.id_empresa),
    ])

    setHistorico(historicoData)
    setVendedores(vendedoresData)
    setSdrs(sdrsData)
    setLoading(false)
  }

  const filterHistorico = () => {
    let filtered = [...historico]

    if (searchTerm) {
      filtered = filtered.filter(
        (h) =>
          h.nome_lead.toLowerCase().includes(searchTerm.toLowerCase()) ||
          h.telefone?.includes(searchTerm) ||
          h.vendedor?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (filters.status) {
      filtered = filtered.filter((h) => {
        if (filters.status === "realizou_visita") {
          return shouldAppearInRealizouVisitaColumn(h)
        }

        return h.estagio_agendamento === filters.status
      })
    }

    if (filters.realizouVisita) {
      filtered = filtered.filter((h) => {
        const realizouVisita = shouldAppearInRealizouVisitaColumn(h)
        return filters.realizouVisita === "sim" ? realizouVisita : !realizouVisita
      })
    }

    if (filters.ganho) {
      filtered = filtered.filter((h) => {
        const ganhou = h.estagio_agendamento === "fechou"
        return filters.ganho === "sim" ? ganhou : !ganhou
      })
    }

    setFilteredHistorico(filtered)
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleApplyFilters = () => {
    loadData()
  }

  const handleClearFilters = () => {
    setFilters({
      periodo: "",
      vendedor: "",
      sdr: "", // Added SDR to clear
      status: "", // Added status to clear
      realizouVisita: "",
      ganho: "",
      dataInicio: "",
      dataFim: "",
    })
    setTimeout(() => loadData(), 0)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusBadge = (estagio: string) => {
    const colors = {
      realizou_visita: "bg-purple-100 text-purple-800",
      fechou: "bg-green-100 text-green-800",
      nao_fechou: "bg-red-100 text-red-800",
    }

    return (
      <Badge className={colors[estagio as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {ESTAGIO_AGENDAMENTO_LABELS[estagio as keyof typeof ESTAGIO_AGENDAMENTO_LABELS] || estagio}
      </Badge>
    )
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterHistorico()
  }, [historico, searchTerm, filters.realizouVisita, filters.ganho])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-48"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Histórico de Visitas</h1>
        <p className="text-gray-600 mt-1">Visualize todas as visitas realizadas, reagendadas e não fechadas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Período Rápido</label>
              <Select value={filters.periodo} onValueChange={(value) => handleFilterChange("periodo", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="ultimos7dias">Últimos 7 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Data Início</label>
              <Input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => handleFilterChange("dataInicio", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Data Fim</label>
              <Input
                type="date"
                value={filters.dataFim}
                onChange={(e) => handleFilterChange("dataFim", e.target.value)}
              />
            </div>

            {currentUser?.cargo !== "vendedor" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Vendedor</label>
                <Select value={filters.vendedor} onValueChange={(value) => handleFilterChange("vendedor", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os vendedores" />
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
            )}

            {currentUser?.cargo !== "sdr" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">SDR Responsável</label>
                <Select value={filters.sdr} onValueChange={(value) => handleFilterChange("sdr", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os SDRs" />
                  </SelectTrigger>
                  <SelectContent>
                    {sdrs.map((sdr) => (
                      <SelectItem key={sdr.id} value={sdr.nome_usuario}>
                        {sdr.nome_usuario}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Status da Visita</label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realizou_visita">Realizou Visita</SelectItem>
                  <SelectItem value="agendar">Não Realizou Visita (Reagendada)</SelectItem>
                  <SelectItem value="fechou">Fechou</SelectItem>
                  <SelectItem value="nao_fechou">Não Fechou</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Realizou Visita</label>
              <Select value={filters.realizouVisita} onValueChange={(value) => handleFilterChange("realizouVisita", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Ganho</label>
              <Select value={filters.ganho} onValueChange={(value) => handleFilterChange("ganho", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApplyFilters} className="bg-purple-600 hover:bg-purple-700">
              Aplicar Filtros
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              Limpar Filtros
            </Button>
          </div>

          <div className="relative">
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Visitas ({filteredHistorico.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredHistorico.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>Nenhuma visita encontrada com os filtros selecionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>SDR Responsável</TableHead>
                    <TableHead>Data da Venda</TableHead>
                    <TableHead>Data Agendamento</TableHead>
                    <TableHead>Realizou Visita</TableHead>
                    <TableHead>Ganho</TableHead>
                    <TableHead>Status Final</TableHead>
                    <TableHead>Última Atualização</TableHead>
                    {filteredHistorico.some((h) => h.motivo_perda) && <TableHead>Motivo</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistorico.map((visita) => (
                    <TableRow key={visita.id}>
                      {(() => {
                        const realizouVisita = shouldAppearInRealizouVisitaColumn(visita)
                        const ganhou = visita.estagio_agendamento === "fechou"
                        return (
                          <>
                      <TableCell className="font-medium">{visita.nome_lead}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="h-3 w-3" />
                          {visita.telefone}
                        </div>
                      </TableCell>
                      <TableCell>{visita.vendedor || "-"}</TableCell>
                      <TableCell>{visita.sdr_responsavel || "-"}</TableCell>
                      <TableCell>
                        {visita.data_venda ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            {new Date(visita.data_venda + "T00:00:00").toLocaleDateString("pt-BR")}
                            {visita.updated_at && visita.estagio_agendamento === "fechou" && (
                              <>
                                {" • "}
                                <Clock className="h-3 w-3 text-gray-400" />
                                {new Date(visita.updated_at).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {visita.data_agendamento ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            {new Date(visita.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR")}
                            {visita.hora_agendamento && (
                              <>
                                {" • "}
                                <Clock className="h-3 w-3 text-gray-400" />
                                {visita.hora_agendamento}
                              </>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={realizouVisita ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-700"}>
                          {realizouVisita ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={ganhou ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}>
                          {ganhou ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(visita.estagio_agendamento)}</TableCell>
                      <TableCell className="text-sm text-gray-600">{formatDate(visita.updated_at)}</TableCell>
                      {filteredHistorico.some((h) => h.motivo_perda) && (
                        <TableCell>
                          {visita.motivo_perda ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              {visita.motivo_perda}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )}
                          </>
                        )
                      })()}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
