"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ESTAGIO_LABELS } from "@/lib/leads"
import { Users, TrendingUp, Award, Zap, Activity, DollarSign } from "lucide-react"

// Função para formatar moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

interface DashboardStatsProps {
  stats: {
    totalLeads: number
    totalVendas: number
    totalAgendamentos: number
    leadsPorEstagio: Record<string, number>
    leadsPorOrigem: Record<string, number>
    conversao: string
    valorTotal: number
    valorMedio: number
  }
}

export function DashboardStats({ stats }: DashboardStatsProps) {

  const statCards = [
    {
      title: "Total de Leads",
      value: stats.totalLeads,
      subtitle: "Leads cadastrados",
      icon: Users,
      gradient: "from-purple-500 to-blue-500",
      bgGradient: "from-purple-50 via-white to-blue-50",
      borderColor: "border-purple-200",
    },
    {
      title: "Taxa de Conversão",
      value: `${stats.conversao}%`,
      subtitle: "Leads fechados",
      icon: TrendingUp,
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-50 via-white to-cyan-50",
      borderColor: "border-blue-200",
    },
    {
      title: "Valor Total",
      value: formatCurrency(stats.valorTotal || 0),
      subtitle: "Pipeline de vendas",
      icon: DollarSign,
      gradient: "from-green-500 to-emerald-500",
      bgGradient: "from-green-50 via-white to-emerald-50",
      borderColor: "border-green-200",
    },
    {
      title: "Fechados",
      value: stats.totalVendas,
      subtitle: "Vendas realizadas",
      icon: Award,
      gradient: "from-orange-500 to-red-500",
      bgGradient: "from-orange-50 via-white to-red-50",
      borderColor: "border-orange-200",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Cards Principais */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, index) => (
          <Card
            key={card.title}
            className={`border-0 shadow-xl bg-gradient-to-br ${card.bgGradient} hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 bg-gradient-to-r ${card.gradient} rounded-xl shadow-lg`}>
                      <card.icon className="h-6 w-6 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-gray-600">{card.title}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                    <p className="text-sm text-gray-500">{card.subtitle}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cards de Resumo Expandidos */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-50 via-white to-purple-50 hover:shadow-2xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-bold">
                Distribuição por Estágio
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.leadsPorEstagio)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([estagio, count], index) => (
                  <div
                    key={estagio}
                    className="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          index === 0
                            ? "bg-gradient-to-r from-green-400 to-blue-500"
                            : index === 1
                              ? "bg-gradient-to-r from-blue-400 to-purple-500"
                              : index === 2
                                ? "bg-gradient-to-r from-purple-400 to-pink-500"
                                : index === 3
                                  ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                                  : "bg-gradient-to-r from-gray-400 to-gray-500"
                        }`}
                      ></div>
                      <span className="text-sm font-medium text-gray-700">
                        {ESTAGIO_LABELS[estagio as keyof typeof ESTAGIO_LABELS]}
                      </span>
                    </div>
                    <Badge className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 font-semibold">
                      {count as number}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 hover:shadow-2xl transition-all duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl shadow-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent font-bold">
                Canais de Origem
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.leadsPorOrigem)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([origem, count], index) => (
                  <div
                    key={origem}
                    className="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          index === 0
                            ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                            : index === 1
                              ? "bg-gradient-to-r from-blue-400 to-cyan-500"
                              : index === 2
                                ? "bg-gradient-to-r from-purple-400 to-indigo-500"
                                : index === 3
                                  ? "bg-gradient-to-r from-orange-400 to-red-500"
                                  : "bg-gradient-to-r from-gray-400 to-gray-500"
                        }`}
                      ></div>
                      <span className="text-sm font-medium text-gray-700">{origem}</span>
                    </div>
                    <Badge className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 font-semibold">
                      {count as number}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
