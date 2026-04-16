"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SidebarNav } from "@/components/sidebar-nav"
import { getCurrentUser } from "@/lib/auth"
import {
  getHistoricoVisitas,
  getVendedores,
  getSdrs,
  shouldAppearInRealizouVisitaColumn,
  type Agendamento,
  type Vendedor,
  ESTAGIO_AGENDAMENTO_LABELS,
  normalizeAgendamentoStage,
} from "@/lib/agendamentos"
import { Calendar, Phone, User, Clock, Filter, Download } from "lucide-react"

export default function HistoricoVisitasPage() {
  const router = useRouter()
  const [historico, setHistorico] = useState<Agendamento[]>([])
  const [filteredHistorico, setFilteredHistorico] = useState<Agendamento[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [sdrs, setSdrs] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const [filters, setFilters] = useState({
    periodo: "",
    vendedor: "",
    sdr: "",
    status: "",
    realizouVisita: "",
    ganho: "",
    dataInicio: "",
    dataFim: "",
  })

  const currentUser = getCurrentUser()

  const loadData = async () => {
    if (!currentUser) return

    setLoading(true)

    const filterParams: Record<string, string> = {}

    if (filters.periodo) filterParams.periodo = filters.periodo
    if (filters.vendedor) filterParams.vendedor = filters.vendedor
    if (filters.sdr) filterParams.sdr = filters.sdr
    if (filters.dataInicio) filterParams.dataInicio = filters.dataInicio
    if (filters.dataFim) filterParams.dataFim = filters.dataFim

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
        if (filters.status === "visita_realizada") {
          return shouldAppearInRealizouVisitaColumn(h)
        }

        return normalizeAgendamentoStage(h.estagio_agendamento) === filters.status
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
        const ganhou = normalizeAgendamentoStage(h.estagio_agendamento) === "sucesso"
        return filters.ganho === "sim" ? ganhou : !ganhou
      })
    }

    setFilteredHistorico(filtered)
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleApplyFilters = () => {
    loadData()
  }

  const handleClearFilters = () => {
    setFilters({
      periodo: "",
      vendedor: "",
      sdr: "",
      status: "",
      realizouVisita: "",
      ganho: "",
      dataInicio: "",
      dataFim: "",
    })
    setTimeout(() => loadData(), 0)
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDateOnly = (dateString?: string) => {
    if (!dateString) return ""
    return new Date(`${dateString}T00:00:00`).toLocaleDateString("pt-BR")
  }

  const getStatusLabel = (estagio: string) => {
    const normalizedStage = normalizeAgendamentoStage(estagio)
    return ESTAGIO_AGENDAMENTO_LABELS[normalizedStage as keyof typeof ESTAGIO_AGENDAMENTO_LABELS] || estagio
  }

  const getStatusBadge = (estagio: string) => {
    const colors = {
      visita_realizada: "bg-purple-100 text-purple-800",
      sucesso: "bg-green-100 text-green-800",
      insucesso: "bg-red-100 text-red-800",
      reagendado: "bg-indigo-100 text-indigo-800",
      nao_compareceu: "bg-amber-100 text-amber-800",
    }

    const normalizedStage = normalizeAgendamentoStage(estagio)

    return (
      <Badge className={colors[normalizedStage as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {getStatusLabel(estagio)}
      </Badge>
    )
  }

  const handleExportCSV = () => {
    const headers = [
      "Cliente",
      "Telefone",
      "Vendedor",
      "SDR Responsavel",
      "Data da Venda",
      "Data Agendamento",
      "Hora Agendamento",
      "Visita Realizada",
      "Sucesso",
      "Status Final",
      "Ultima Atualizacao",
      "Motivo",
    ]

    const csvData = filteredHistorico.map((visita) => {
      const realizouVisita = shouldAppearInRealizouVisitaColumn(visita)
      const ganhou = normalizeAgendamentoStage(visita.estagio_agendamento) === "sucesso"

      return [
        visita.nome_lead || "",
        visita.telefone || "",
        visita.vendedor || "",
        visita.sdr_responsavel || "",
        formatDateOnly(visita.data_venda),
        formatDateOnly(visita.data_agendamento),
        visita.hora_agendamento || "",
        realizouVisita ? "Sim" : "Nao",
        ganhou ? "Sim" : "Nao",
        getStatusLabel(visita.estagio_agendamento),
        formatDateTime(visita.updated_at),
        visita.motivo_perda || "",
      ]
    })

    const csvContent = [
      headers.join(";"),
      ...csvData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")),
    ].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `historico_visitas_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push("/")
      return
    }

    loadData()
  }, [router])

  useEffect(() => {
    filterHistorico()
  }, [historico, searchTerm, filters.status, filters.realizouVisita, filters.ganho])

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <SidebarNav />

        <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
            <div className="w-full p-4 sm:p-6 xl:px-8">
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
          </main>
        </div>
      </div>
    )
  }

  const showMotivoColumn = filteredHistorico.some((h) => h.motivo_perda)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarNav />

      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="w-full space-y-6 p-4 sm:p-6 xl:px-8">
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
                        <SelectItem value="visita_realizada">Visita Realizada</SelectItem>
                        <SelectItem value="nao_compareceu">Não Compareceu</SelectItem>
                        <SelectItem value="reagendado">Reagendado</SelectItem>
                        <SelectItem value="sucesso">Sucesso</SelectItem>
                        <SelectItem value="insucesso">Insucesso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Visita Realizada</label>
                    <Select
                      value={filters.realizouVisita}
                      onValueChange={(value) => handleFilterChange("realizouVisita", value)}
                    >
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
                    <label className="text-sm font-medium text-gray-700">Sucesso</label>
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
                <CardTitle className="flex items-center justify-between gap-4">
                  <span>Visitas ({filteredHistorico.length})</span>
                  <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 bg-transparent">
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </Button>
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
                          <TableHead>Visita Realizada</TableHead>
                          <TableHead>Sucesso</TableHead>
                          <TableHead>Status Final</TableHead>
                          <TableHead>Última Atualização</TableHead>
                          {showMotivoColumn && <TableHead>Motivo</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHistorico.map((visita) => {
                          const realizouVisita = shouldAppearInRealizouVisitaColumn(visita)
                          const ganhou = normalizeAgendamentoStage(visita.estagio_agendamento) === "sucesso"

                          return (
                            <TableRow key={visita.id}>
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
                                    {formatDateOnly(visita.data_venda)}
                                    {visita.updated_at && normalizeAgendamentoStage(visita.estagio_agendamento) === "sucesso" && (
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
                                    {formatDateOnly(visita.data_agendamento)}
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
                              <TableCell className="text-sm text-gray-600">{formatDateTime(visita.updated_at)}</TableCell>
                              {showMotivoColumn && (
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
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
