"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { DashboardEmptyState, DashboardLoadingState } from "./dashboard-feedback"
import { DashboardChart } from "./dashboard-chart"

export type DashboardChartPoint = { label: string; value: number; secondary?: number }
type SharedProps = { data: DashboardChartPoint[]; label: string; description: string; loading?: boolean; partial?: boolean }
const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#e11d48", "#0891b2"]

function ChartState({ data, loading }: Pick<SharedProps, "data" | "loading">) {
  if (loading) return <DashboardLoadingState compact label="Chargement du graphique" />
  if (!data.length || data.every((point) => point.value === 0 && !point.secondary)) return <DashboardEmptyState className="min-h-32" title="Données insuffisantes" description="Le graphique apparaîtra dès que des données fiables seront disponibles." />
  return null
}

export function TrendChart({ data, description, label, loading, partial }: SharedProps) {
  const empty = !data.length || data.every((point) => point.value === 0)
  return <DashboardChart className="min-h-44" label={label} description={`${description}${partial ? " Données partielles." : ""}`}>{loading || empty ? <ChartState data={data} loading={loading} /> : <ResponsiveContainer width="100%" height={176}><LineChart data={data.slice(-14)} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="currentColor" opacity={0.1}/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip/><Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={false}/></LineChart></ResponsiveContainer>}</DashboardChart>
}

export function ComparisonChart({ data, description, label, loading, partial }: SharedProps) {
  const empty = !data.length || data.every((point) => point.value === 0 && !point.secondary)
  return <DashboardChart className="min-h-44" label={label} description={`${description}${partial ? " Données partielles." : ""}`}>{loading || empty ? <ChartState data={data} loading={loading}/> : <ResponsiveContainer width="100%" height={176}><BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid vertical={false} stroke="currentColor" opacity={0.1}/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip/><Legend verticalAlign="top" height={28}/><Bar name="Entrées" dataKey="value" fill="#0891b2" radius={[5,5,0,0]}/>{data.some((point) => point.secondary !== undefined) ? <Bar name="Sorties" dataKey="secondary" fill="#7c3aed" radius={[5,5,0,0]}/> : null}</BarChart></ResponsiveContainer>}</DashboardChart>
}

export function DistributionChart({ data, description, label, loading, partial }: SharedProps) {
  const empty = !data.length || data.every((point) => point.value === 0)
  return <DashboardChart className="min-h-44" label={label} description={`${description}${partial ? " Données partielles." : ""}`}>{loading || empty ? <ChartState data={data} loading={loading}/> : <ResponsiveContainer width="100%" height={176}><PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius={42} outerRadius={66} paddingAngle={2}>{data.map((point, index) => <Cell key={point.label} fill={COLORS[index % COLORS.length]}/>)}</Pie><Tooltip/><Legend verticalAlign="bottom" height={28}/></PieChart></ResponsiveContainer>}</DashboardChart>
}
