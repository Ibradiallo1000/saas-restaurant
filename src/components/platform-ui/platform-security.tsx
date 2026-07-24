"use client"

import * as React from "react"
import { SettingsConfirmationDialog, SettingsDangerZone, SettingsPermissionNotice, type SettingsConfirmationDialogProps, type SettingsDangerZoneProps } from "@/components/settings-ui"
import type { PlatformPermissionState } from "./platform-foundations"

export interface PlatformPermissionNoticeProps extends Omit<React.ComponentProps<typeof SettingsPermissionNotice>, "state"> { state: Exclude<PlatformPermissionState, "editable" | "hidden"> }
export const PlatformPermissionNotice = React.forwardRef<HTMLElement, PlatformPermissionNoticeProps>(({ state, ...props }, ref) => <SettingsPermissionNotice ref={ref} state={state === "unknown" ? "unavailable" : state} {...props} />)
PlatformPermissionNotice.displayName = "PlatformPermissionNotice"
export const PlatformDangerZone = React.forwardRef<HTMLElement, SettingsDangerZoneProps>((props, ref) => <SettingsDangerZone ref={ref} {...props} />)
PlatformDangerZone.displayName = "PlatformDangerZone"
export function PlatformConfirmationDialog({ loading, onConfirm, onOpenChange, open, ...props }: SettingsConfirmationDialogProps) {
  const submissionLock = React.useRef(false)
  React.useEffect(() => { if (!open || !loading) submissionLock.current = false }, [loading, open])
  const handleConfirm = React.useCallback(() => {
    if (submissionLock.current) return
    submissionLock.current = true
    onConfirm?.()
  }, [onConfirm])
  return <SettingsConfirmationDialog {...props} open={open} loading={loading} onOpenChange={onOpenChange} onConfirm={handleConfirm} />
}
