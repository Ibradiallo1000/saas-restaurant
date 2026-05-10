"use client"

import * as React from "react"

import { ErrorState } from "@/components/layout/app-states"

type AppErrorBoundaryState = {
  error: Error | null
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error("Application shell error:", error)
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="Erreur d'affichage"
          description="La page n'a pas pu etre affichee correctement."
          actionLabel="Recharger"
          onAction={() => this.setState({ error: null })}
        />
      )
    }

    return this.props.children
  }
}
