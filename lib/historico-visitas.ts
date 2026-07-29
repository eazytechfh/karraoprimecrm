export function getHistoricoRowAriaLabel(nomeLead?: string) {
  const nome = nomeLead?.trim()
  return nome ? `Abrir informações de ${nome}` : "Abrir informações do cliente"
}
