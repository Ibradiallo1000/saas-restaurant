"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn("rounded-2xl border-none bg-white p-6 shadow-sm", className)}
      {...props}
    />
  )
}
