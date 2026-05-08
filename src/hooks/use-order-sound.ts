"use client"

import * as React from "react"

export function useOrderSound(src?: string) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const lastPlayedAtRef = React.useRef(0)

  React.useEffect(() => {
    if (!src) return

    audioRef.current = new Audio(src)
    audioRef.current.preload = "auto"

    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [src])

  const play = React.useCallback(() => {
    const now = Date.now()
    if (now - lastPlayedAtRef.current < 1500) return
    lastPlayedAtRef.current = now

    const audio = audioRef.current
    if (!audio) {
      playBeep()
      return
    }

    audio.currentTime = 0
    void audio.play().catch(() => {
      // Browsers can block audio until the first user gesture.
    })
  }, [])

  return { play }
}

function playBeep() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return

  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = "sine"
  oscillator.frequency.setValueAtTime(880, context.currentTime)
  gain.gain.setValueAtTime(0.001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.24)
}
