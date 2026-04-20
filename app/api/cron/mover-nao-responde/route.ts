import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Busca leads em "nao_responde" há mais de 5 dias
  const cincoDialAtras = new Date()
  cincoDialAtras.setDate(cincoDialAtras.getDate() - 5)

  const { data: leads, error: fetchError } = await supabase
    .from("BASE_DE_LEADS")
    .select("id, id_empresa")
    .ilike("estagio_lead", "nao_responde")
    .lte("updated_at", cincoDialAtras.toISOString())

  if (fetchError) {
    console.error("[cron] Erro ao buscar leads:", fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ moved: 0, message: "Nenhum lead para mover" })
  }

  const leadIds = leads.map((l) => l.id)

  // Exclui leads com agendamento em "agendado" ou "reagendado"
  const { data: agendados } = await supabase
    .from("AGENDAMENTOS")
    .select("id_lead")
    .in("id_lead", leadIds)
    .in("estagio_agendamento", ["agendado", "reagendado"])

  const idsProtegidos = new Set((agendados || []).map((a) => a.id_lead))
  const idsMover = leadIds.filter((id) => !idsProtegidos.has(id))

  if (idsMover.length === 0) {
    return NextResponse.json({ moved: 0, message: "Todos os leads estão protegidos por agendamento" })
  }

  const { error: updateError } = await supabase
    .from("BASE_DE_LEADS")
    .update({ estagio_lead: "resgate", updated_at: new Date().toISOString() })
    .in("id", idsMover)

  if (updateError) {
    console.error("[cron] Erro ao mover leads:", updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  console.log(`[cron] ${idsMover.length} lead(s) movidos de nao_responde para resgate`)
  return NextResponse.json({
    moved: idsMover.length,
    protected: idsProtegidos.size,
    total_candidates: leads.length,
  })
}
