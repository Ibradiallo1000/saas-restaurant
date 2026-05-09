"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type DashboardSalesChartProps = {
  data: any[]
}

export default function DashboardSalesChart({ data }: DashboardSalesChartProps) {
  const [isLowDevice, setIsLowDevice] = React.useState(false)

  React.useEffect(() => {
    setIsLowDevice((navigator.hardwareConcurrency || 8) <= 4)
  }, [])

  if (isLowDevice) {
    const total = data.reduce((sum, item) => sum + Number(item.total || 0), 0)
    return (
      <div className="flex h-full flex-col justify-center rounded-xl bg-muted/40 p-6">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Mode lite
        </p>
        <p className="mt-2 text-3xl font-black text-primary">
          {total.toLocaleString()} FCFA
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Graphique désactivé sur appareil faible.
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--bg-secondary)" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ borderRadius: "12px", border: "none" }} />
        <Area
          type="monotone"
          dataKey="total"
          stroke="var(--primary)"
          fill="var(--primary)"
          fillOpacity={0.1}
          strokeWidth={3}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
