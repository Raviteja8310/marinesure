import React from 'react'
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { EmptyState } from './ui'
import { inr } from '../lib/format'

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)

ChartJS.defaults.font.family = '"Manrope Variable", Manrope, system-ui, sans-serif'
ChartJS.defaults.color = '#8CA2B6'
ChartJS.defaults.borderColor = 'rgba(140, 162, 182, 0.12)'

export const SERIES = ['#10B9AE', '#D5B477', '#54D8D0', '#7C9CC0', '#E08A8A', '#9AD9A8', '#C6A6E8']

const tooltip = {
  backgroundColor: '#0B2438', borderColor: '#26405A', borderWidth: 1, padding: 10, titleColor: '#fff', bodyColor: '#CBD8E2',
  cornerRadius: 8, displayColors: true, boxPadding: 4,
}

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const money = (v) => inr(v, { compact: true })

function hasData(datasets) {
  return datasets.some((d) => (d.data || []).some((v) => Number(v) > 0))
}

function ChartEmpty({ height }) {
  return <div style={{ minHeight: height }} className="grid"><EmptyState title="No data for this period yet" description="This chart fills in as the platform records real activity." className="py-8" /></div>
}

/** labels: string[]; series: [{ label, data: number[], color? }] */
export function TrendChart({ labels, series, height = 260, currency = true, area = true }) {
  if (!hasData(series)) return <ChartEmpty height={height} />
  return <div style={{ height }}>
    <Line
      data={{ labels, datasets: series.map((s, i) => ({
        label: s.label, data: s.data, borderColor: s.color || SERIES[i], backgroundColor: `${s.color || SERIES[i]}22`,
        fill: area && i === 0, tension: 0.3, cubicInterpolationMode: 'monotone', pointRadius: 3, pointHoverRadius: 5, borderWidth: 2,
      })) }}
      options={{
        responsive: true, maintainAspectRatio: false, animation: reduced ? false : { duration: 600 },
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
          tooltip: { ...tooltip, callbacks: { label: (c) => ` ${c.dataset.label}: ${currency ? inr(c.parsed.y) : c.parsed.y}` } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (v) => (currency ? money(v) : v) } } },
      }} />
  </div>
}

export function BarChart({ labels, series, height = 260, currency = false, horizontal = false, stacked = false }) {
  if (!hasData(series)) return <ChartEmpty height={height} />
  return <div style={{ height }}>
    <Bar
      data={{ labels, datasets: series.map((s, i) => ({ label: s.label, data: s.data, backgroundColor: s.color || SERIES[i], borderRadius: 6, maxBarThickness: 36 })) }}
      options={{
        indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false, animation: reduced ? false : { duration: 600 },
        plugins: { legend: { display: series.length > 1, position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } },
          tooltip: { ...tooltip, callbacks: { label: (c) => ` ${c.dataset.label}: ${currency ? inr(c.parsed[horizontal ? 'x' : 'y']) : c.parsed[horizontal ? 'x' : 'y']}` } } },
        scales: {
          x: { stacked, grid: { display: horizontal }, ticks: horizontal && currency ? { callback: (v) => money(v) } : {} },
          y: { stacked, beginAtZero: true, grid: { display: !horizontal }, ticks: !horizontal && currency ? { callback: (v) => money(v) } : {} },
        },
      }} />
  </div>
}

export function DonutChart({ labels, data, height = 240, currency = false }) {
  if (!data.some((v) => Number(v) > 0)) return <ChartEmpty height={height} />
  return <div style={{ height }}>
    <Doughnut
      data={{ labels, datasets: [{ data, backgroundColor: SERIES, borderColor: '#0B2438', borderWidth: 3, hoverOffset: 6 }] }}
      options={{
        responsive: true, maintainAspectRatio: false, cutout: '68%', animation: reduced ? false : { duration: 600 },
        plugins: { legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true, padding: 12 } },
          tooltip: { ...tooltip, callbacks: { label: (c) => ` ${c.label}: ${currency ? inr(c.parsed) : c.parsed}` } } },
      }} />
  </div>
}
