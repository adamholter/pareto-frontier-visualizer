export type ModelRow = {
  name: string
  shortName: string
  creator: string
  creatorColor: string
  releaseDate: string
  releaseTime: number
  intelligence: number
  cost: number
}

export type FrontierEntry = {
  date: string
  available: ModelRow[]
  frontier: ModelRow[]
}

export type ParsedData = {
  rows: ModelRow[]
  filteredCount: number
}

const today = new Date()
today.setHours(23, 59, 59, 999)

export const chart = {
  width: 980,
  height: 560,
  margin: { top: 28, right: 28, bottom: 76, left: 82 },
}

export function parseCsvLine(line: string) {
  const values: string[] = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      value += '"'
      i += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(value)
      value = ''
    } else {
      value += char
    }
  }

  values.push(value)
  return values
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const parsed = new Date(`${value}T00:00:00Z`)
  const year = parsed.getUTCFullYear()

  if (
    Number.isNaN(parsed.getTime()) ||
    year < 1990 ||
    parsed.getTime() > today.getTime() ||
    value === '1970-01-01'
  ) {
    return null
  }

  return parsed
}

function normalizeColor(color: string | undefined) {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : '#5f6b7a'
}

export function parseData(csv: string): ParsedData {
  const [headerLine, ...bodyLines] = csv.trim().split(/\r?\n/)
  const headers = parseCsvLine(headerLine)
  const index = Object.fromEntries(headers.map((header, i) => [header, i]))
  const rows: ModelRow[] = []
  let filteredCount = 0

  for (const line of bodyLines) {
    const columns = parseCsvLine(line)
    const releaseDate = columns[index.release_date]?.trim()
    const date = parseDate(releaseDate)
    const intelligence = Number(columns[index.intelligence_index])
    const cost = Number(columns[index.cost_to_run])

    if (!date || !Number.isFinite(intelligence) || !Number.isFinite(cost) || cost <= 0) {
      filteredCount += 1
      continue
    }

    rows.push({
      name: columns[index.name]?.trim() || 'Unnamed model',
      shortName: columns[index.short_name]?.trim() || columns[index.name]?.trim() || 'Model',
      creator: columns[index.creator]?.trim() || 'Unknown',
      creatorColor: normalizeColor(columns[index.creator_color]?.trim()),
      releaseDate,
      releaseTime: date.getTime(),
      intelligence,
      cost,
    })
  }

  rows.sort((a, b) => a.releaseTime - b.releaseTime || a.cost - b.cost)
  return { rows, filteredCount }
}

export function getFrontier(rows: ModelRow[]) {
  return rows
    .filter((candidate) => {
      return !rows.some((other) => {
        const noWorse = other.cost <= candidate.cost && other.intelligence >= candidate.intelligence
        const strict = other.cost < candidate.cost || other.intelligence > candidate.intelligence
        return noWorse && strict
      })
    })
    .sort((a, b) => a.cost - b.cost || a.intelligence - b.intelligence)
}

export function uniqueReleaseDates(rows: ModelRow[]) {
  return Array.from(new Set(rows.map((row) => row.releaseDate))).sort()
}

export function getFrontierTimeline(rows: ModelRow[]) {
  return uniqueReleaseDates(rows).map((date) => {
    const dateTime = new Date(`${date}T23:59:59Z`).getTime()
    const available = rows.filter((row) => row.releaseTime <= dateTime)
    return { date, available, frontier: getFrontier(available) }
  })
}

export function getStartIndex(timeline: FrontierEntry[]) {
  return Math.max(
    0,
    timeline.findIndex((entry) => entry.frontier.length >= 3),
  )
}

export function getDomains(rows: ModelRow[]) {
  const allCosts = rows.map((row) => row.cost)
  const allScores = rows.map((row) => row.intelligence)
  const minCost = Math.min(...allCosts)
  const maxCost = Math.max(...allCosts)
  const minScore = Math.min(...allScores)
  const maxScore = Math.max(...allScores)

  return {
    minCost,
    maxCost,
    logMin: Math.log10(minCost) - 0.12,
    logMax: Math.log10(maxCost) + 0.12,
    yMin: Math.max(0, Math.floor(minScore - 2)),
    yMax: Math.ceil(maxScore + 2),
  }
}

export function buildLogTicks(min: number, max: number) {
  const ticks: number[] = []
  const start = Math.floor(Math.log10(min))
  const end = Math.ceil(Math.log10(max))

  for (let exponent = start; exponent <= end; exponent += 1) {
    for (const multiplier of [1, 2, 5]) {
      const value = multiplier * 10 ** exponent
      if (value >= min && value <= max) ticks.push(value)
    }
  }

  return ticks
}

export function makeScales(domains: ReturnType<typeof getDomains>) {
  const plotWidth = chart.width - chart.margin.left - chart.margin.right
  const plotHeight = chart.height - chart.margin.top - chart.margin.bottom

  return {
    plotWidth,
    plotHeight,
    xScale: (cost: number) =>
      chart.margin.left + ((Math.log10(cost) - domains.logMin) / (domains.logMax - domains.logMin)) * plotWidth,
    yScale: (score: number) =>
      chart.margin.top + (1 - (score - domains.yMin) / (domains.yMax - domains.yMin)) * plotHeight,
  }
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export function formatCost(value: number) {
  if (value >= 100) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  if (value >= 10) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}`
  if (value >= 1) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  return `$${value.toLocaleString(undefined, { maximumSignificantDigits: 2 })}`
}

export function formatScore(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
