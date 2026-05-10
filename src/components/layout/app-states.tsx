import { AlertTriangle, LockKeyhole, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"

type StateProps = {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, description, actionLabel, onAction }: StateProps) {
  return (
    <StateFrame
      icon={<SearchX className="h-6 w-6" />}
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  )
}

export function ErrorState({ title, description, actionLabel, onAction }: StateProps) {
  return (
    <StateFrame
      icon={<AlertTriangle className="h-6 w-6" />}
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  )
}

export function PermissionDenied() {
  return (
    <StateFrame
      icon={<LockKeyhole className="h-6 w-6" />}
      title="Acces non autorise"
      description="Votre compte n'a pas les droits necessaires pour acceder a cet espace."
    />
  )
}

function StateFrame({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: StateProps & { icon: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="mt-5 text-xl font-black tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm font-medium text-muted-foreground">{description}</p>
        ) : null}
        {actionLabel && onAction ? (
          <Button type="button" className="mt-6 rounded-xl font-bold" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
