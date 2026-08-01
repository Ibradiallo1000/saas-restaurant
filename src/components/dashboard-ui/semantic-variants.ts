export type DashboardSemanticVariant = "neutral" | "info" | "activity" | "finance" | "success" | "warning" | "danger" | "stock"

export const semanticSurfaceClasses: Record<DashboardSemanticVariant, string> = {
  neutral: "border-slate-200/80 bg-slate-50/70 dark:border-slate-700/80 dark:bg-slate-900/45",
  info: "border-cyan-200/80 bg-cyan-50/65 dark:border-cyan-900/70 dark:bg-cyan-950/30",
  activity: "border-blue-200/80 bg-blue-50/70 dark:border-blue-900/70 dark:bg-blue-950/30",
  finance: "border-violet-200/80 bg-violet-50/70 dark:border-violet-900/70 dark:bg-violet-950/30",
  success: "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/30",
  warning: "border-amber-200/90 bg-amber-50/75 dark:border-amber-900/70 dark:bg-amber-950/30",
  danger: "border-rose-200/90 bg-rose-50/75 dark:border-rose-900/70 dark:bg-rose-950/30",
  stock: "border-orange-200/90 bg-orange-50/70 dark:border-orange-900/70 dark:bg-orange-950/30",
}

export const semanticIconClasses: Record<DashboardSemanticVariant, string> = {
  neutral: "bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  info: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/70 dark:text-cyan-200",
  activity: "bg-blue-100 text-blue-700 dark:bg-blue-900/70 dark:text-blue-200",
  finance: "bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-200",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-200",
  stock: "bg-orange-100 text-orange-700 dark:bg-orange-900/70 dark:text-orange-200",
}

export const semanticHoverClasses: Record<DashboardSemanticVariant, string> = {
  neutral: "hover:border-slate-300 hover:bg-slate-100/80 dark:hover:border-slate-600 dark:hover:bg-slate-900/70",
  info: "hover:border-cyan-300 hover:bg-cyan-100/70 dark:hover:border-cyan-800 dark:hover:bg-cyan-950/50",
  activity: "hover:border-blue-300 hover:bg-blue-100/70 dark:hover:border-blue-800 dark:hover:bg-blue-950/50",
  finance: "hover:border-violet-300 hover:bg-violet-100/70 dark:hover:border-violet-800 dark:hover:bg-violet-950/50",
  success: "hover:border-emerald-300 hover:bg-emerald-100/70 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/50",
  warning: "hover:border-amber-300 hover:bg-amber-100/70 dark:hover:border-amber-800 dark:hover:bg-amber-950/50",
  danger: "hover:border-rose-300 hover:bg-rose-100/70 dark:hover:border-rose-800 dark:hover:bg-rose-950/50",
  stock: "hover:border-orange-300 hover:bg-orange-100/70 dark:hover:border-orange-800 dark:hover:bg-orange-950/50",
}

export const semanticAccentClasses: Record<DashboardSemanticVariant, string> = {
  neutral: "bg-slate-400 dark:bg-slate-500",
  info: "bg-cyan-500 dark:bg-cyan-400",
  activity: "bg-blue-500 dark:bg-blue-400",
  finance: "bg-violet-500 dark:bg-violet-400",
  success: "bg-emerald-500 dark:bg-emerald-400",
  warning: "bg-amber-500 dark:bg-amber-400",
  danger: "bg-rose-500 dark:bg-rose-400",
  stock: "bg-orange-500 dark:bg-orange-400",
}

export const semanticBeforeAccentClasses: Record<DashboardSemanticVariant, string> = {
  neutral: "before:bg-slate-400 dark:before:bg-slate-500",
  info: "before:bg-cyan-500 dark:before:bg-cyan-400",
  activity: "before:bg-blue-500 dark:before:bg-blue-400",
  finance: "before:bg-violet-500 dark:before:bg-violet-400",
  success: "before:bg-emerald-500 dark:before:bg-emerald-400",
  warning: "before:bg-amber-500 dark:before:bg-amber-400",
  danger: "before:bg-rose-500 dark:before:bg-rose-400",
  stock: "before:bg-orange-500 dark:before:bg-orange-400",
}
