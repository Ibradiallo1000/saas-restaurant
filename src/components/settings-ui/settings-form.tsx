import * as React from "react"
import { cn } from "@/lib/utils"

export interface SettingsFormProps extends React.FormHTMLAttributes<HTMLFormElement> { saving?: boolean; dirty?: boolean; disabled?: boolean; error?: React.ReactNode }
export const SettingsForm = React.forwardRef<HTMLFormElement, SettingsFormProps>(({ children, className, dirty, disabled, error, saving, ...props }, ref) => <form ref={ref} aria-busy={saving || undefined} data-dirty={dirty || undefined} className={cn("mx-auto w-full max-w-[var(--settings-form-max)] space-y-5", disabled && "opacity-70", className)} {...props}><fieldset disabled={disabled || saving} className="min-w-0 space-y-5">{error ? <div role="alert" className="rounded-[var(--radius-dashboard-widget)] bg-[var(--settings-state-error-bg)] p-3 text-sm text-[var(--settings-state-error-fg)]">{error}</div> : null}{children}</fieldset></form>)
SettingsForm.displayName = "SettingsForm"

export interface SettingsFieldGroupProps extends Omit<React.HTMLAttributes<HTMLFieldSetElement>, "title"> { title?: React.ReactNode; description?: React.ReactNode; columns?: "one" | "two" | "adaptive" }
export const SettingsFieldGroup = React.forwardRef<HTMLFieldSetElement, SettingsFieldGroupProps>(({ children, className, columns = "adaptive", description, title, ...props }, ref) => <fieldset ref={ref} className={cn("min-w-0", className)} {...props}>{title ? <legend className="text-sm font-semibold text-[var(--dashboard-title)]">{title}</legend> : null}{description ? <p className="mt-1 text-xs leading-4 text-[var(--settings-muted)]">{description}</p> : null}<div className={cn("mt-3 grid min-w-0 gap-4", columns === "two" && "sm:grid-cols-2", columns === "adaptive" && "md:grid-cols-2")}>{children}</div></fieldset>)
SettingsFieldGroup.displayName = "SettingsFieldGroup"
