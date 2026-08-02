import Image from "next/image"

export function AppSplashScreen() {
  return (
    <main
      className="app-splash-screen"
      role="status"
      aria-live="polite"
      aria-label="Chargement de Oordera"
    >
      <div className="app-splash-content">
        <div className="app-splash-logo-wrap" aria-hidden="true">
          <span className="app-splash-glow" />
          <Image
            className="app-splash-logo"
            src="/icons/icon-512.png"
            alt=""
            width={112}
            height={112}
            priority
            sizes="112px"
          />
        </div>
        <h1 className="app-splash-name">Oordera</h1>
        <span className="sr-only">Chargement de l’application</span>
      </div>
    </main>
  )
}
