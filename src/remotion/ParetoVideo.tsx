import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import csvText from '../data/pareto_intelligence_vs_cost.csv?raw'
import { creatorInitials, getCreatorIcon } from '../logos'
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
  parseData,
  type ModelRow,
} from '../pareto'

const parsed = parseData(csvText)
const timeline = getFrontierTimeline(parsed.rows)
const startIndex = getStartIndex(timeline)
const domains = getDomains(parsed.rows)
const scales = makeScales(domains)
const costTicks = buildLogTicks(domains.minCost, domains.maxCost).filter((tick) => [1, 2, 5].includes(Number(String(tick)[0])))
const scoreTicks = Array.from({ length: 6 }, (_, i) => domains.yMin + ((domains.yMax - domains.yMin) / 5) * i)

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function animatedFrontier(lower: ModelRow[], upper: ModelRow[], t: number) {
  const count = Math.max(lower.length, upper.length)

  return Array.from({ length: count }, (_, index) => {
    const from = lower[Math.min(index, lower.length - 1)]
    const to = upper[Math.min(index, upper.length - 1)]
    const model = t > 0.55 ? to : from

    return {
      model,
      x: lerp(scales.xScale(from.cost), scales.xScale(to.cost), t),
      y: lerp(scales.yScale(from.intelligence), scales.yScale(to.intelligence), t),
    }
  })
}

function LogoMark({ creator, color }: { creator: string; color: string }) {
  const icon = getCreatorIcon(creator)
  if (creator === 'Amazon') {
    return (
      <span style={{ ...styles.logoMark, color: '#111318' }}>
        <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.8 }}>a</span>
        <svg viewBox="0 0 48 16" style={{ position: 'absolute', width: 30, height: 10, marginTop: 20 }} aria-hidden="true">
          <path d="M5 4 C16 14 31 14 43 4" fill="none" stroke="#ff9900" strokeWidth="3" strokeLinecap="round" />
          <path d="M37 2 L44 4 L39 10" fill="none" stroke="#ff9900" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }

  if (creator === 'Microsoft') {
    return (
      <span style={{ ...styles.logoMark, display: 'grid', gridTemplateColumns: 'repeat(2, 10px)', gap: 3 }}>
        {['#f25022', '#7fba00', '#00a4ef', '#ffb900'].map((square) => (
          <span key={square} style={{ width: 10, height: 10, background: square }} />
        ))}
      </span>
    )
  }

  if (creator === 'xAI') {
    return (
      <span style={{ ...styles.logoMark, color: '#6c5fd7' }}>
        <svg viewBox="0 0 727.27 778.68" style={{ width: 23, height: 25, fill: 'currentColor' }} aria-hidden="true">
          <polygon transform="translate(-134,-113.32)" points="508.67 574.07 761.27 213.32 639.19 213.32 447.64 486.9" />
          <polygon transform="translate(-134,-113.32)" points="356.08 792 417.12 704.83 356.08 617.66 234 792" />
          <polygon transform="translate(-134,-113.32)" points="508.67 792 630.75 792 356.08 399.72 234 399.72" />
          <polygon transform="translate(-134,-113.32)" points="761.27 256.91 661.27 399.72 671.27 792 751.27 792" />
        </svg>
      </span>
    )
  }

  return (
    <span style={{ ...styles.logoMark, color }}>
      {icon ? (
        <svg viewBox={icon.viewBox ?? '0 0 24 24'} style={{ width: 22, height: 22, fill: 'currentColor' }} aria-hidden="true">
          <path d={icon.path} />
        </svg>
      ) : (
        creatorInitials(creator)
      )}
    </span>
  )
}

export function ParetoVideo() {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const rawProgress = interpolate(frame, [36, durationInFrames - 36], [startIndex, timeline.length - 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const lowerIndex = Math.max(startIndex, Math.min(timeline.length - 1, Math.floor(rawProgress)))
  const upperIndex = Math.max(startIndex, Math.min(timeline.length - 1, Math.ceil(rawProgress)))
  const t = upperIndex === lowerIndex ? 0 : rawProgress - lowerIndex
  const lower = timeline[lowerIndex]
  const upper = timeline[upperIndex]
  const selected = timeline[Math.round(rawProgress)] ?? upper
  const points = animatedFrontier(lower.frontier, upper.frontier, t)
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const topLabels = selected.frontier.slice(-5).reverse()
  const progress = (rawProgress - startIndex) / (timeline.length - 1 - startIndex)

  return (
    <AbsoluteFill style={styles.page}>
      <div style={styles.statusStrip}>
        <div style={styles.kicker}>Pareto frontier over time</div>
        <div style={styles.date}>{formatDate(selected.date)}</div>
        <div style={styles.summary}>{selected.frontier.length} frontier models · {selected.available.length} released models</div>
      </div>

      <div style={styles.chartFrame}>
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={styles.svg}>
          <rect x={chart.margin.left} y={chart.margin.top} width={scales.plotWidth} height={scales.plotHeight} fill="#fbfbfa" />
          {scoreTicks.map((tick) => {
            const y = scales.yScale(tick)
            return (
              <g key={tick}>
                <line x1={chart.margin.left} x2={chart.width - chart.margin.right} y1={y} y2={y} stroke="#e3e5e8" />
                <text x={chart.margin.left - 14} y={y + 4} textAnchor="end" fill="#64707f" fontSize="13">
                  {formatScore(tick)}
                </text>
              </g>
            )
          })}
          {costTicks.map((tick) => {
            const x = scales.xScale(tick)
            return (
              <g key={tick}>
                <line x1={x} x2={x} y1={chart.margin.top} y2={chart.height - chart.margin.bottom} stroke="#eceef0" strokeDasharray="3 5" />
                <text x={x} y={chart.height - chart.margin.bottom + 26} textAnchor="middle" fill="#64707f" fontSize="13">
                  {formatCost(tick)}
                </text>
              </g>
            )
          })}
          <line x1={chart.margin.left} x2={chart.width - chart.margin.right} y1={chart.height - chart.margin.bottom} y2={chart.height - chart.margin.bottom} stroke="#141820" strokeWidth="1.6" />
          <line x1={chart.margin.left} x2={chart.margin.left} y1={chart.margin.top} y2={chart.height - chart.margin.bottom} stroke="#141820" strokeWidth="1.6" />
          <path d={path} fill="none" stroke="#111318" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map(({ model, x, y }, index) => (
            <g key={`${index}-${model.name}-${model.releaseDate}`}>
              <circle cx={x} cy={y} r="11" fill={model.creatorColor} opacity="0.18" />
              <circle cx={x} cy={y} r="6.5" fill={model.creatorColor} stroke="#fff" strokeWidth="2.5" />
            </g>
          ))}
          <text x={chart.margin.left + scales.plotWidth / 2} y={chart.height - 18} textAnchor="middle" fill="#28303b" fontSize="16" fontWeight="700">
            Cost to run, log scale
          </text>
          <text transform={`translate(24 ${chart.margin.top + scales.plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill="#28303b" fontSize="16" fontWeight="700">
            Intelligence index
          </text>
        </svg>
      </div>

      <div style={styles.labelPanel}>
        {topLabels.map((model) => (
          <div key={`${model.name}-${model.releaseDate}`} style={styles.labelRow}>
            <LogoMark creator={model.creator} color={model.creatorColor} />
            <div style={{ minWidth: 0 }}>
              <div style={styles.modelName}>{model.shortName}</div>
              <div style={styles.modelMeta}>{model.creator} · {formatCost(model.cost)} · {formatScore(model.intelligence)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.footerBlock}>
        <div style={styles.rail}>
          <div style={{ ...styles.railFill, width: `${progress * 100}%` }} />
        </div>
        <div style={styles.footer}>Only Pareto-optimal models shown · source rows cleaned for valid release date, cost, and intelligence</div>
      </div>
    </AbsoluteFill>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: '#f4f5f3',
    color: '#111318',
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    padding: '36px 72px 34px',
  },
  statusStrip: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    alignItems: 'baseline',
    gap: 24,
    padding: '14px 0 18px',
    borderBottom: '2px solid #dadcdb',
  },
  kicker: {
    color: '#6a7280',
    fontSize: 22,
    fontWeight: 760,
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  date: { fontSize: 24, fontWeight: 820 },
  summary: { color: '#66717f', fontSize: 22, fontWeight: 650 },
  chartFrame: {
    marginTop: 22,
    border: '2px solid #d9dcda',
    borderRadius: 14,
    background: '#fff',
    padding: 20,
  },
  svg: { display: 'block', width: '100%', height: 'auto' },
  labelPanel: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
    marginTop: 28,
  },
  labelRow: {
    display: 'grid',
    gridTemplateColumns: '54px minmax(0, 1fr)',
    alignItems: 'center',
    gap: 18,
    minHeight: 74,
    border: '2px solid #d9dcda',
    borderRadius: 12,
    background: '#fff',
    padding: '12px 18px',
  },
  logoMark: {
    position: 'relative',
    display: 'grid',
    width: 50,
    height: 50,
    placeItems: 'center',
    border: '2px solid #d9dcda',
    borderRadius: 12,
    background: '#fff',
    fontSize: 17,
    fontWeight: 900,
  },
  modelName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 28, fontWeight: 820 },
  modelMeta: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#687382', fontSize: 22, fontWeight: 620 },
  footerBlock: {
    marginTop: 30,
  },
  rail: {
    height: 12,
    borderRadius: 999,
    background: '#dfe1df',
    overflow: 'hidden',
  },
  railFill: { height: '100%', borderRadius: 999, background: '#111318' },
  footer: {
    marginTop: 12,
    color: '#687382',
    fontSize: 18,
    fontWeight: 620,
  },
}
