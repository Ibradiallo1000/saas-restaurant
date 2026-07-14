"use client"

import * as React from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { PublicIconButton } from "./public-icon-button"

export interface PublicModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  showCloseButton?: boolean
  closeLabel?: string
  closeOnOverlayClick?: boolean
  initialFocusRef?: React.RefObject<HTMLElement | null>
  maxWidth?: "sm" | "md" | "lg"
  className?: string
  contentClassName?: string
  footerClassName?: string
  headerContent?: React.ReactNode
  headerClassName?: string
  closeButtonClassName?: string
}

const modalWidths = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-[576px]" }

export function PublicModal({
  children, className, closeButtonClassName, closeLabel = "Fermer", closeOnOverlayClick = true, contentClassName,
  description, footer, footerClassName, headerClassName, headerContent, initialFocusRef, maxWidth = "lg", onOpenChange,
  open, showCloseButton = true, title,
}: PublicModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="public-reduced-motion fixed inset-0 z-50 bg-[var(--overlay-modal)] backdrop-blur-[2px] [animation-duration:var(--motion-public-modal)] [animation-timing-function:var(--motion-public-ease)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        <Dialog.Content
          aria-modal="true"
          className={cn(
            "public-reduced-motion fixed inset-x-0 bottom-0 z-50 flex max-h-[min(90dvh,720px)] flex-col rounded-t-[var(--radius-public-2xl)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-elevated)] font-publicBody text-[var(--text-primary)] shadow-[var(--shadow-public-lg)] outline-none [animation-duration:var(--motion-public-modal)] [animation-timing-function:var(--motion-public-ease)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom motion-reduce:animate-none sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-public-2xl)] sm:data-[state=open]:fade-in-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:fade-out-0 sm:data-[state=closed]:zoom-out-95",
            modalWidths[maxWidth], className
          )}
          onOpenAutoFocus={(event) => {
            if (initialFocusRef?.current) {
              event.preventDefault()
              initialFocusRef.current.focus()
            }
          }}
          onPointerDownOutside={(event) => { if (!closeOnOverlayClick) event.preventDefault() }}
        >
          <header className={cn("relative border-b border-[var(--border-public-subtle)] px-[var(--space-5)] py-[var(--space-4)] pr-16", headerClassName)}>
            {headerContent ? (
              <>
                <Dialog.Title className="sr-only">{title}</Dialog.Title>
                {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}
                {headerContent}
              </>
            ) : (
              <>
                <Dialog.Title className="text-public-heading-2 font-public-bold">{title}</Dialog.Title>
                {description && <Dialog.Description className="mt-1 text-public-sm text-[var(--text-secondary)]">{description}</Dialog.Description>}
              </>
            )}
            {showCloseButton && (
              <Dialog.Close asChild>
                <PublicIconButton aria-label={closeLabel} variant="ghost" size="compact" className={cn("absolute right-3 top-3", closeButtonClassName)}><X /></PublicIconButton>
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
