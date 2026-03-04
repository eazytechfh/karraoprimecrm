"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { SidebarNav } from "@/components/sidebar-nav"
import { AgendamentosKanban } from "@/components/agendamentos-kanban"
import { AgendamentosListView } from "@/components/agendamentos-list-view"
import { Button } from "@/components/ui/button"
import { LayoutGrid, List } from "lucide-react"
import { Card } from "@/components/ui/card"

export default function Agendamentos() {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban")

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push("/")
    }
  }, [router])

  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav />

      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="container mx-auto px-6 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Agendamentos</h1>
              <p className="text-gray-600">Gerencie os agendamentos de visitas com clientes</p>
            </div>

            <Card className="mb-6">
              <div className="p-4">
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === "kanban" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("kanban")}
                    className="flex items-center gap-2"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Kanban
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="flex items-center gap-2"
                  >
                    <List className="h-4 w-4" />
                    Lista
                  </Button>
                </div>
              </div>
            </Card>

            {/* View Content */}
            {viewMode === "kanban" ? <AgendamentosKanban /> : <AgendamentosListView />}
          </div>
        </main>
      </div>
    </div>
  )
}
