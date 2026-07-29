export async function collectPaginatedRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1_000,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  while (true) {
    const page = await fetchPage(from, from + pageSize - 1)
    rows.push(...page)

    if (page.length < pageSize) break
    from += pageSize
  }

  return rows
}
