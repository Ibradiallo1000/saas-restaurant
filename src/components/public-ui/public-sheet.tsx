"use client"

import * as React from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { PublicIconButton } from "./public-icon-button"

export interface PublicSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  closeLabel?: string
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  initialFocusRef?: React.RefObject<HTMLElement | null>
  maxWidth?: "sm" | "md" | "lg"
  className?: string
  contentClassName?: string
  footerClassName?: string
}

const sheetWidths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-[576px]" }

export function PublicSheet({
  children, className, closeLabel = "Fermer", closeOnOverlayClick = true, contentClassName,
  description, footer, footerClassName, initialFocusRef, maxWidth = "lg", onOpenChange,
  open, showCloseButton = true, title,
}: PublicSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="public-reduced-motion fixed inset-0 z-50 bg-[var(--overlay-modal)] backdrop-blur-[2px] [animation-duration:var(--motion-public-sheet)] [animation-timing-function:var(--motion-public-ease)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        <Dialog.Content
          aria-modal="true"
          className={cn(
            "public-reduced-motion fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[min(92dvh,800px)] flex-col rounded-t-[var(--radius-public-2xl)] border border-b-0 border-[var(--border-public-subtle)] bg-[var(--surface-public-elevated)] font-publicBody text-[var(--text-primary)] shadow-[var(--shadow-public-top)] outline-none [animation-duration:var(--motion-public-sheet)] [animation-timing-function:var(--motion-public-ease)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 motion-reduce:animate-none",
            sheetWidths[maxWidth], className
          )}
          onOpenAutoFocus={(event) => {
            if (initialFocusRef?.current) {
              event.preventDefault()
              initialFocusRef.current.focus()
            }
          }}
          onPointerDownOutside={(event) => { if (!closeOnOverlayClick) event.preventDefault() }}
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--border-public-strong)]" />
          <header className="relative border-b border-[var(--border-public-subtle)] px-[var(--space-5)] py-[var(--space-4)] pr-16">
            <Dialog.Title className="text-public-heading-2 font-public-bold">{title}</Dialog.Title>
            {description && <Dialog.Description className="mt-1 text-public-sm text-[var(--text-secondary)]">{description}</Dialog.Description>}
            {showCloseButton && (
              <Dialog.Close asChild>
                <PublicIconButton aria-label={closeLabel} variant="ghost" size="compact" className="absolute right-3 top-2"><X /></PublicIconButton>
              </Dialog.Close>
            )}
          </header>
          <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--space-5)] py-[var(--space-4)]", contentClassName)}>{children}</div>
          {footer && <footer className={cn("shrink-0 border-t border-[var(--border-public-subtle)] bg-[var(--surface-public-elevated)] px-[var(--space-5)] pt-[var(--space-4)] pb-[max(var(--space-4),env(safe-area-inset-bottom))]", footerClassName)}>{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
