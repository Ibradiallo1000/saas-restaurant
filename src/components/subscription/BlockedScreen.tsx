export function BlockedScreen({ expired }: { expired: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <h1 className="text-2xl font-bold">
        {expired ? "Abonnement expiré" : "Accès restreint"}
      </h1>

      <p className="text-muted-foreground">
        Veuillez choisir un plan pour continuer.
      </p>

      <button className="px-6 py-2 bg-primary text-white rounded-lg">
        Choisir un plan
      </button>
    </div>
  )
}