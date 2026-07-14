"use client"

import * as React from "react"

import { PublicModal, type PublicModalProps } from "./public-modal"

export interface PublicCheckoutModalProps extends Omit<PublicModalProps, "maxWidth"> {
  stepLabel?: React.ReactNode
}

/** Shared visual shell for public checkout and payment flows. */
export function PublicCheckoutModal({
  contentClassName,
  description,
  headerContent,
  stepLabel,
  title,
  ...props
}: PublicCheckoutModalProps) {
  return (
    <PublicModal
      {...props}
      title={title}
      description={description}
      maxWidth="lg"
      contentClassName={contentClassName}
      headerContent={
        headerContent ?? (
          <div className="min-w-0 space-y-1">
            {stepLabel ? (
              <p className="text-public-xs font-public-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {stepLabel}
              </p>
            ) : null}
            <h2 className="text-[22px] font-public-extrabold leading-7 text-[var(--text-primary)] sm:text-[28px] sm:leading-[34px]">
              {title}
            </h2>
            {description ? (
              <p className="text-public-sm leading-5 text-[var(--text-secondary)]">{description}</p>
            ) : null}
          </div>
        )
      }
    />
  )
}
