import { useEffect, useMemo, useRef, useState } from 'react'
import csvText from './data/pareto_intelligence_vs_cost.csv?raw'
import { creatorInitials, getCreatorIcon } from './logos'
import {
  buildLogTicks,
  chart,
  formatCost,
  formatDate,
  formatScore,
  getDomains,
  getFrontierTimeline,
  getStartIndex,
  makeScales,
  type ModelRow,
  parseData,
} from './pareto'
import './App.css'

type TooltipState = {
  model: ModelRow
  x: number
  y: number
}

type AnimatedModel = {
  model: ModelRow
  x: number
  y: number
  opacity: number
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function useAnimatedNumber(target: number, duration = 650) {
  const [value, setValue] = useState(target)
  const valueRef = useRef(target)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    const from = valueRef.current
    const started = performance.now()
    let frameId = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration)
      setValue(lerp(from, target, easeInOutCubic(progress)))
      if (progress < 1) frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [duration, target])

  return value
}

function App() {
  const parsed = useMemo(() => parseData(csvText), [])
  const frontierByDate = useMemo(() => getFrontierTimeline(parsed.rows), [parsed.rows])
  const startIndex = useMemo(() => getStartIndex(frontierByDate), [frontierByDate])
  const latestIndex = Math.max(startIndex, frontierByDate.length - 1)

  const [dateIndex, setDateIndex] = useState(latestIndex)
  const [isPlaying, setIsPlaying] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const animatedIndex = useAnimatedNumber(dateIndex)

  useEffect(() => {
    if (!isPlaying || frontierByDate.length === 0) return

    const timer = window.setInterval(() => {
      setDateIndex((current) => (current >= frontierByDate.length - 1 ? startIndex : current + 1))
    }, 1050)

    return () => window.clearInterval(timer)
  }, [frontierByDate.length, isPlaying, startIndex])

  const selected = frontierByDate[dateIndex] ?? frontierByDate[startIndex]
  const lowerIndex = Math.max(startIndex, Math.min(frontierByDate.length - 1, Math.floor(animatedIndex)))
  const upperIndex = Math.max(startIndex, Math.min(frontierByDate.length - 1, Math.ceil(animatedIndex)))
  const tween = upperIndex === lowerIndex ? 0 : animatedIndex - lowerIndex
  const lower = frontierByDate[lowerIndex] ?? selected
  const upper = frontierByDate[upperIndex] ?? selected

  const domains = useMemo(() => getDomains(parsed.rows), [parsed.rows])
  const { plotWidth, plotHeight, xScale, yScale } = makeScales(domains)
  const costTicks = buildLogTicks(domains.minCost, domains.maxCost)
  const scoreTicks = Array.from({ length: 6 }, (_, i) => domains.yMin + ((domains.yMax - domains.yMin) / 5) * i)

  const animatedModels = useMemo<AnimatedModel[]>(() => {
    const byName = new Map<string, { from?: ModelRow; to?: ModelRow }>()
    for (const model of lower.frontier) byName.set(model.name, { from: model })
    for (const model of upper.frontier) byName.set(model.name, { ...byName.get(model.name), to: model })

    return Array.from(byName.values())
      .map(({ from, to }) => {
        const model = to ?? from
        if (!model) return null
        const anchor = from ?? to ?? model
        const destination = to ?? from ?? model
        return {
          model,
          x: lerp(xScale(anchor.cost), xScale(destination.cost), tween),
          y: lerp(yScale(anchor.intelligence), yScale(destination.intelligence), tween),
          opacity: lerp(from ? 1 : 0, to ? 1 : 0, tween),
        }
      })
      .filter((item): item is AnimatedModel => item !== null)
      .sort((a, b) => a.x - b.x) as AnimatedModel[]
  }, [lower.frontier, tween, upper.frontier, xScale, yScale])

  const frontierPath = animatedModels
    .filter((item) => item.opacity > 0.04)
    .map((item, index) => `${index === 0 ? 'M' : 'L'} ${item.x} ${item.y}`)
    .join(' ')

  const creatorCount = new Set(selected?.available.map((row) => row.creator)).size

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyeline">Artificial Analysis cost/performance map</p>
          <h1>AI models worth paying for</h1>
        </div>
        <div className="stats" aria-label="Current selection summary">
          <div>
            <span>{selected ? formatDate(selected.date) : 'No date'}</span>
            <small>market snapshot</small>
          </div>
          <div>
            <span>{selected?.frontier.length ?? 0}</span>
            <small>best deals</small>
          </div>
          <div>
            <span>{selected?.available.length ?? 0}</span>
            <small>models tested</small>
          </div>
          <div>
            <span>{creatorCount}</span>
            <small>labs compared</small>
          </div>
        </div>
      </header>

      <section className="workspace" aria-label="Pareto frontier visualizer">
        <div className="chartPanel">
          <div className="chartHeader">
            <div>
              <h2>The best tradeoffs rise to the line</h2>
              <p>
                Every point on the frontier beats the field on price, performance, or both.
                {parsed.filteredCount > 0 ? ` ${parsed.filteredCount} source rows were filtered during cleanup.` : ''}
              </p>
            </div>
            <button className="playButton" type="button" onClick={() => setIsPlaying((value) => !value)}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>

          <div className="chartWrap">
            <svg
              className="chart"
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              role="img"
              aria-label={`Pareto frontier chart for ${selected?.date ?? 'selected date'}`}
              onMouseLeave={() => setTooltip(null)}
            >
              <rect
                x={chart.margin.left}
                y={chart.margin.top}
                width={plotWidth}
                height={plotHeight}
                className="plotBg"
              />

              {scoreTicks.map((tick) => {
                const y = yScale(tick)
                return (
                  <g key={tick}>
                    <line x1={chart.margin.left} x2={chart.width - chart.margin.right} y1={y} y2={y} className="grid" />
                    <text x={chart.margin.left - 14} y={y + 4} textAnchor="end" className="tickLabel">
                      {formatScore(tick)}
                    </text>
                  </g>
                )
              })}

              {costTicks.map((tick) => {
                const x = xScale(tick)
                return (
                  <g key={tick}>
                    <line x1={x} x2={x} y1={chart.margin.top} y2={chart.height - chart.margin.bottom} className="grid vertical" />
                    <text x={x} y={chart.height - chart.margin.bottom + 26} textAnchor="middle" className="tickLabel">
                      {formatCost(tick)}
                    </text>
                  </g>
                )
              })}

              <line
                x1={chart.margin.left}
                x2={chart.width - chart.margin.right}
                y1={chart.height - chart.margin.bottom}
                y2={chart.height - chart.margin.bottom}
                className="axis"
              />
              <line
                x1={chart.margin.left}
                x2={chart.margin.left}
                y1={chart.margin.top}
                y2={chart.height - chart.margin.bottom}
                className="axis"
              />

              <path d={frontierPath} className="frontierLine" />

              {animatedModels.map(({ model, x, y, opacity }) => (
                <g key={`${model.name}-${model.releaseDate}`} opacity={opacity}>
                  <circle cx={x} cy={y} r="8" fill={model.creatorColor} className="pointHalo" />
                  <circle
                    cx={x}
                    cy={y}
                    r="5.5"
                    fill={model.creatorColor}
                    className="point"
                    onMouseMove={() => setTooltip({ model, x, y })}
                    onFocus={() => setTooltip({ model, x, y })}
                    tabIndex={0}
                  />
                </g>
              ))}

              <text x={chart.margin.left + plotWidth / 2} y={chart.height - 18} textAnchor="middle" className="axisTitle">
                Cost to run, log scale
              </text>
              <text transform={`translate(24 ${chart.margin.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" className="axisTitle">
                Intelligence index
              </text>
            </svg>

            {tooltip ? (
              <div className="tooltip" style={{ left: `${(tooltip.x / chart.width) * 100}%`, top: `${(tooltip.y / chart.height) * 100}%` }}>
                <strong>{tooltip.model.name}</strong>
                <span>{tooltip.model.creator}</span>
                <dl>
                  <div>
                    <dt>Cost</dt>
                    <dd>{formatCost(tooltip.model.cost)}</dd>
                  </div>
                  <div>
                    <dt>Intel.</dt>
                    <dd>{formatScore(tooltip.model.intelligence)}</dd>
                  </div>
                  <div>
                    <dt>Released</dt>
                    <dd>{formatDate(tooltip.model.releaseDate)}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </div>

          <div className="timeline">
            <label htmlFor="date-slider">Release date</label>
            <input
              id="date-slider"
              type="range"
              min={startIndex}
              max={Math.max(0, frontierByDate.length - 1)}
              step="1"
              value={dateIndex}
              onChange={(event) => {
                setIsPlaying(false)
                setDateIndex(Number(event.target.value))
              }}
            />
            <output htmlFor="date-slider">{selected ? formatDate(selected.date) : 'No clean data'}</output>
          </div>
        </div>

        <aside className="frontierList" aria-label="Current frontier model list">
          <div className="listTitle">
            <h2>Worth a closer look</h2>
            <span>cheapest edge to premium power</span>
          </div>
          <ol>
            {selected?.frontier.map((model) => {
              const icon = getCreatorIcon(model.creator)
              return (
                <li key={`${model.name}-${model.releaseDate}`}>
                  <span className="brandMark" style={{ color: model.creatorColor }}>
                    {icon ? (
                      <svg viewBox={icon.viewBox ?? '0 0 24 24'} aria-hidden="true">
                        <path d={icon.path} />
                      </svg>
                    ) : (
                      creatorInitials(model.creator)
                    )}
                  </span>
                  <div>
                    <strong>{model.shortName}</strong>
                    <small>
                      {model.creator} · {formatDate(model.releaseDate)}
                    </small>
                  </div>
                  <div className="modelMetrics">
                    <span>{formatCost(model.cost)}</span>
                    <span>{formatScore(model.intelligence)}</span>
                  </div>
                </li>
              )
            })}
          </ol>
        </aside>
      </section>
    </main>
  )
}

export default App
