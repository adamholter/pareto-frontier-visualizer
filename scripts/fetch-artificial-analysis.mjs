#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const endpoint = new URL('https://artificialanalysis.ai/api/data/website/host-models/performance')
endpoint.searchParams.set('prompt_length', process.env.AA_PROMPT_LENGTH || '10000')
endpoint.searchParams.set('parallel_queries', process.env.AA_PARALLEL_QUERIES || '1')

const outputCsv = resolve('src/data/pareto_intelligence_vs_cost.csv')
const outputMeta = resolve('src/data/artificial-analysis-meta.json')

function csvCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function toCsv(rows) {
  const headers = [
    'name',
    'short_name',
    'slug',
    'creator',
    'creator_color',
    'reasoning',
    'release_date',
    'intelligence_index',
    'cost_to_run',
    'cost_input',
    'cost_reasoning',
    'cost_answer',
    'output_tokens',
    'is_open_weights',
    'size_class',
    'deprecated',
  ]

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n') + '\n'
}

function getCost(model, hostModel) {
  const counts = model.intelligence_index_token_counts
  if (!counts) return null

  const inputTokens = counts.input_tokens ?? 0
  const answerTokens = counts.answer_tokens ?? 0
  const reasoningTokens = counts.reasoning_tokens ?? 0
  const inputPrice = hostModel.price_1m_input_tokens
  const outputPrice = hostModel.price_1m_output_tokens

  if (!Number.isFinite(inputPrice) || !Number.isFinite(outputPrice)) return null

  const inputCost = (inputTokens / 1_000_000) * inputPrice
  const answerCost = (answerTokens / 1_000_000) * outputPrice
  const reasoningCost = (reasoningTokens / 1_000_000) * outputPrice

  return {
    inputCost,
    answerCost,
    reasoningCost,
    totalCost: inputCost + answerCost + reasoningCost,
    outputTokens: counts.output_tokens ?? answerTokens + reasoningTokens,
  }
}

function modelSortKey(model) {
  return [
    model.release_date,
    String(model.intelligence_index).padStart(8, '0'),
    model.name,
  ].join('|')
}

function normalizeRows(hostModels) {
  const chosenByModelId = new Map()

  for (const hostModel of hostModels) {
    const model = hostModel.model
    if (!model?.id) continue

    const existing = chosenByModelId.get(model.id)
    const isComputedHost = hostModel.id === model.computed_performance_host_model_id

    if (!existing || isComputedHost) {
      chosenByModelId.set(model.id, { hostModel, isComputedHost })
    }
  }

  return Array.from(chosenByModelId.values())
    .map(({ hostModel }) => {
      const model = hostModel.model
      const cost = getCost(model, hostModel)

      if (
        !cost ||
        !model.release_date ||
        model.deleted ||
        !Number.isFinite(model.intelligence_index) ||
        !Number.isFinite(cost.totalCost) ||
        cost.totalCost <= 0
      ) {
        return null
      }

      return {
        name: model.name,
        short_name: model.short_name || model.name,
        slug: model.model_url?.split('/').filter(Boolean).pop() || model.id,
        creator: model.model_creators?.name || 'Unknown',
        creator_color: model.model_creators?.color || '#5f6b7a',
        reasoning: Boolean(model.reasoning_model),
        release_date: model.release_date,
        intelligence_index: Number(model.intelligence_index.toFixed(2)),
        cost_to_run: Number(cost.totalCost.toFixed(8)),
        cost_input: Number(cost.inputCost.toFixed(8)),
        cost_reasoning: Number(cost.reasoningCost.toFixed(8)),
        cost_answer: Number(cost.answerCost.toFixed(8)),
        output_tokens: cost.outputTokens,
        is_open_weights: Boolean(model.is_open_weights),
        size_class: model.size_class || '',
        deprecated: Boolean(model.deprecated),
      }
    })
    .filter(Boolean)
    .sort((a, b) => modelSortKey(a).localeCompare(modelSortKey(b)))
}

async function main() {
  const response = await fetch(endpoint, {
    headers: {
      accept: 'application/json',
      'user-agent': 'pareto-frontier-visualizer/0.1 (+https://github.com/adamholter/pareto-frontier-visualizer)',
    },
  })

  if (!response.ok) {
    throw new Error(`Artificial Analysis fetch failed: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  const hostModels = payload.hostModels ?? []
  const rows = normalizeRows(hostModels)

  if (rows.length < 100) {
    throw new Error(`Artificial Analysis scrape returned too few usable rows: ${rows.length}`)
  }

  const meta = {
    fetched_at: new Date().toISOString(),
    source_url: endpoint.toString(),
    source: 'Artificial Analysis public website data route',
    source_note:
      'The documented free API is account/API-key based and does not expose every chart field. This script uses the public website data route, selects each model computed_performance_host_model_id, and computes cost_to_run from Intelligence Index token counts and current input/output pricing.',
    prompt_options: payload.prompt_options,
    raw_host_model_count: hostModels.length,
    csv_row_count: rows.length,
  }

  await mkdir(dirname(outputCsv), { recursive: true })
  await writeFile(outputCsv, toCsv(rows))
  await writeFile(outputMeta, `${JSON.stringify(meta, null, 2)}\n`)

  console.log(`Wrote ${rows.length} rows to ${outputCsv}`)
  console.log(`Wrote metadata to ${outputMeta}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
