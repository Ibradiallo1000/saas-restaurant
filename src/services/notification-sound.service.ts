const NEW_ORDER_SOUND_PATH = "/sounds/son.mp3"
const MIN_PLAY_INTERVAL_MS = 1200

let lastPlayedAt = 0

export function playNewOrderNotificationSound() {
  if (typeof window === "undefined") return

  const now = Date.now()
  if (now - lastPlayedAt < MIN_PLAY_INTERVAL_MS) return

  lastPlayedAt = now

  const audio = new Audio(NEW_ORDER_SOUND_PATH)
  audio.volume = 0.85

  void audio.play().catch(() => {
    // Browsers can block audio until the first user interaction.
  })
}
