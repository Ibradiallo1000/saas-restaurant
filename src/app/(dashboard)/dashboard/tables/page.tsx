"use client"

import * as React from "react"
import Link from "next/link"
import {
  CheckCircle2,
  Download,
  Monitor,
  Plus,
  Printer,
  Table2,
  Unlock,
  XCircle,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"
import { PageHeader } from "@/design-system/components"
import {
  closeActiveTableSession,
  createRestaurantTablesBatch,
  type RestaurantTableRecord,
} from "@/services/table-session.service"

type SessionMetric = {
  orderCount: number
  totalAmount: number
  startedAt?: unknown
}

export default function DashboardTablesPage() {
  const db = useFirestore()
  const { restaurantId, restaurant } = useRestaurant()
  const {
    activeOrders,
    isLoadingTables: isLoading,
    tableSessions: sessions,
    tables,
  } = useRestaurantLiveData()
  const { toast } = useToast()

  const [zoneMode, setZoneMode] = React.useState<"existing" | "new">("new")
  const [selectedZone, setSelectedZone] = React.useState("")
  const [newZone, setNewZone] = React.useState("Terrasse")
  const [tableCount, setTableCount] = React.useState(10)
  const [prefix, setPrefix] = React.useState("T")
  const [isSaving, setIsSaving] = React.useState(false)
  const [releasingTableId, setReleasingTableId] = React.useState<string | null>(null)

  const zones = React.useMemo(() => {
    return Array.from(new Set((tables || []).map((table) => table.zoneId || "Zone")))
      .filter(Boolean)
      .sort((first, second) => first.localeCompare(second, "fr"))
  }, [tables])

  React.useEffect(() => {
    if (selectedZone || zones.length === 0) return
    setSelectedZone(zones[0])
  }, [selectedZone, zones])

  const tablesByZone = React.useMemo(() => {
    return (tables || []).reduce<Record<string, RestaurantTableRecord[]>>((acc, table) => {
      const zone = table.zoneId || "Zone"
      acc[zone] = acc[zone] || []
      acc[zone].push(table)
      return acc
    }, {})
  }, [tables])

  const sessionMetrics = React.useMemo(() => {
    const metrics = new Map<string, SessionMetric>()

    for (const session of sessions || []) {
      metrics.set(session.id, {
        orderCount: 0,
        totalAmount: 0,
        startedAt: session.startedAt,
      })
    }

    for (const order of activeOrders || []) {
      if (!order.sessionId) continue

      const current = metrics.get(order.sessionId) || {
        orderCount: 0,
        totalAmount: 0,
        startedAt: undefined,
      }

      current.orderCount += 1
      current.totalAmount += Number(order.total ?? order.totalAmount ?? 0)
      metrics.set(order.sessionId, current)
    }

    return metrics
  }, [activeOrders, sessions])

  const publicBaseUrl = React.useMemo(() => {
    if (typeof window === "undefined") return ""
    return window.location.origin
  }, [])

  const slug = restaurant?.slug || restaurantId || ""

  const createTables = async () => {
    if (!db || !restaurantId) return

    const zoneId = zoneMode === "new" ? newZone.trim() : selectedZone.trim()
    if (!zoneId) {
      toast({
        variant: "destructive",
        title: "Zone requise",
        description: "Choisissez ou creez une zone.",
      })
      return
    }

    setIsSaving(true)
    try {
      const existingNames = (tables || [])
        .filter((table) => table.zoneId === zoneId)
        .map((table) => table.name)

      const createdNames = await createRestaurantTablesBatch(db, restaurantId, {
        zoneId,
        count: tableCount,
        prefix,
        existingNames,
      })

      setSelectedZone(zoneId)
      setZoneMode("existing")
      toast({
        title: "Tables creees",
        description: `${createdNames.length} table(s) ajoutee(s) dans ${zoneId}.`,
      })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de creer les tables.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const releaseTable = async (table: RestaurantTableRecord, metric?: SessionMetric) => {
    if (!db || !restaurantId || releasingTableId) return
    const hasActiveBusiness = Boolean(table.currentSessionId) && (Number(metric?.orderCount || 0) > 0 || Number(metric?.totalAmount || 0) > 0)
    if (hasActiveBusiness && !window.confirm([`Libérer ${table.name} ?`, `Session active : ${table.currentSessionId}`, `Commandes actives : ${metric?.orderCount || 0}`, `Montant actif : ${Number(metric?.totalAmount || 0).toLocaleString("fr-FR")} FCFA`, "La session sera clôturée avec le fonctionnement actuel."].join("\n"))) return
    setReleasingTableId(table.id)
    try {
      await closeActiveTableSession(db, restaurantId, table.id)
      toast({ title: "Table liberee" })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de liberer cette table.",
      })
    } finally {
      setReleasingTableId(null)
    }
  }

  if (!restaurantId) {
    return <div className="p-6">Restaurant non disponible.</div>
  }

  return (
    <main className="space-y-6 pb-20">
      <PageHeader
        icon={Table2}
        title="Tables & QR"
        subtitle="Generez les tables par zone, imprimez les QR et suivez l'etat en temps reel."
        action={
          <Button onClick={() => document.getElementById("add-tables")?.scrollIntoView({ behavior: "smooth" })}>
            <Plus className="h-4 w-4" />
            Ajouter des tables
          </Button>
        }
      />

      <AddTablesCard
        id="add-tables"
        zoneMode={zoneMode}
        zones={zones}
        selectedZone={selectedZone}
        newZone={newZone}
        tableCount={tableCount}
        prefix={prefix}
        isSaving={isSaving}
        onZoneModeChange={setZoneMode}
        onSelectedZoneChange={setSelectedZone}
        onNewZoneChange={setNewZone}
        onTableCountChange={setTableCount}
        onPrefixChange={setPrefix}
        onCreate={createTables}
      />

      {isLoading ? (
        <TablesLoading />
      ) : (
        <div className="space-y-8">
          {Object.keys(tablesByZone).length === 0 ? (
            <EmptyStarter />
          ) : null}

          {Object.entries(tablesByZone).map(([zone, zoneTables]) => (
            <section key={zone} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase text-muted-foreground">
                  Zone : {zone}
                </h2>
                <span className="text-xs font-bold text-muted-foreground">
                  {zoneTables.length} table(s)
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {zoneTables.map((table) => {
                  const qrUrl = `${publicBaseUrl}/${slug}?t=${encodeURIComponent(table.id)}`
                  const metric = table.currentSessionId
                    ? sessionMetrics.get(table.currentSessionId)
                    : undefined

                  return (
                    <TableQrCard
                      key={table.id}
                      table={table}
                      qrUrl={qrUrl}
                      metric={metric}
                      releasing={releasingTableId === table.id}
                      onRelease={() => releaseTable(table, metric)}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}

function AddTablesCard({
  id,
  zoneMode,
  zones,
  selectedZone,
  newZone,
  tableCount,
  prefix,
  isSaving,
  onZoneModeChange,
  onSelectedZoneChange,
  onNewZoneChange,
  onTableCountChange,
  onPrefixChange,
  onCreate,
}: {
  id: string
  zoneMode: "existing" | "new"
  zones: string[]
  selectedZone: string
  newZone: string
  tableCount: number
  prefix: string
  isSaving: boolean
  onZoneModeChange: (value: "existing" | "new") => void
  onSelectedZoneChange: (value: string) => void
  onNewZoneChange: (value: string) => void
  onTableCountChange: (value: number) => void
  onPrefixChange: (value: string) => void
  onCreate: () => void
}) {
  return (
    <Card id={id} className="rounded-xl">
      <CardHeader>
        <CardTitle className="text-base">Ajouter des tables</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
        <div className="space-y-2">
          <Label>Zone</Label>
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <Select value={zoneMode} onValueChange={(value) => onZoneModeChange(value as "existing" | "new")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Nouvelle</SelectItem>
                <SelectItem value="existing" disabled={zones.length === 0}>
                  Existante
                </SelectItem>
              </SelectContent>
            </Select>

            {zoneMode === "existing" ? (
              <Select value={selectedZone} onValueChange={onSelectedZoneChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={newZone}
                onChange={(event) => onNewZoneChange(event.target.value)}
                placeholder="Terrasse, Salle principale, Rooftop"
              />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nombre de tables</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={tableCount}
            onChange={(event) => onTableCountChange(Number(event.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label>Prefixe</Label>
          <Input
            value={prefix}
            maxLength={6}
            onChange={(event) => onPrefixChange(event.target.value)}
            placeholder="T"
          />
        </div>

        <div className="flex items-end">
          <Button className="w-full" onClick={onCreate} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            {isSaving ? "Creation..." : "Creer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TableQrCard({
  table,
  qrUrl,
  metric,
  releasing,
  onRelease,
}: {
  table: RestaurantTableRecord
  qrUrl: string
  metric?: SessionMetric
  releasing: boolean
  onRelease: () => void
}) {
  const occupied = table.status === "occupied"
  const qrId = React.useId()

  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black">{table.name}</h3>
            <p className="text-xs font-semibold text-muted-foreground">{table.zoneId}</p>
          </div>
          <Badge
            className={
              occupied
                ? "bg-red-100 text-red-700 hover:bg-red-100"
                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
            }
          >
            {occupied ? <XCircle className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
            {occupied ? "Occupee" : "Libre"}
          </Badge>
        </div>

        <div className="flex justify-center rounded-lg border bg-background p-3">
          <QRCodeSVG id={qrId} value={qrUrl} size={150} includeMargin />
        </div>

        <p className="break-all rounded-lg bg-muted px-3 py-2 text-[11px] font-semibold text-muted-foreground">
          {qrUrl}
        </p>

        {occupied ? (
          <div className="rounded-lg bg-muted px-3 py-2">
            <p className="text-xs font-bold text-muted-foreground">Session active</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-sm font-black">{metric?.orderCount || 0} commande(s)</span>
              <span className="text-sm font-black text-primary">
                {(metric?.totalAmount || 0).toLocaleString()} FCFA
              </span>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="primary" onClick={() => printQr(table.name, qrUrl, qrId)}>
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
          <Button type="button" variant="primary" onClick={() => downloadQr(table.name, qrId)}>
            <Download className="h-4 w-4" />
            Telecharger
          </Button>
          <Button asChild type="button" variant="primary">
            <Link href={`/pos?tableId=${encodeURIComponent(table.id)}`}>
              <Monitor className="h-4 w-4" />
              POS
            </Link>
          </Button>
          <Button type="button" variant="primary" disabled={!occupied || releasing} onClick={onRelease}>
            <Unlock className="h-4 w-4" />
            {releasing ? "Libération..." : "Libérer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyStarter() {
  return (
    <div className="rounded-xl border border-dashed bg-card p-8 text-center">
      <Table2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <h2 className="text-lg font-black">Commencez par generer vos tables</h2>
      <p className="mt-1 text-sm font-medium text-muted-foreground">
        Exemple : Zone Terrasse, 10 tables, prefixe T donnera T1 a T10.
      </p>
    </div>
  )
}

function TablesLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-80 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  )
}

function getQrSvg(qrId: string): SVGElement {
  const element = document.getElementById(qrId)
  if (!(element instanceof SVGElement)) {
    throw new Error("QR introuvable.")
  }
  return element
}

/**
 * Imprime un QR code en utilisant l'API DOM.
 * La construction sécurisée évite les vulnérabilités XSS.
 */
function printQr(tableName: string, qrUrl: string, qrId: string) {
  // Récupérer l'élément SVG source
  const sourceSvg = getQrSvg(qrId)
  
  // Cloner le SVG pour éviter de modifier l'original
  const clonedSvg = sourceSvg.cloneNode(true) as SVGElement
  
  // Ouvrir la fenêtre d'impression
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=420,height=620")
  if (!printWindow) {
    console.error("Impossible d'ouvrir la fenêtre d'impression")
    return
  }

  const doc = printWindow.document

  // Construire le document avec l'API DOM (sécurisé)
  const html = doc.createElement("html")
  const head = doc.createElement("head")
  const title = doc.createElement("title")
  title.textContent = `QR ${tableName}`
  head.appendChild(title)

  const style = doc.createElement("style")
  style.textContent = `
    body { font-family: Arial, sans-serif; margin: 0; padding: 32px; text-align: center; }
    h1 { font-size: 42px; margin: 0 0 24px; }
    .qr { display: inline-flex; border: 1px solid #ddd; padding: 18px; }
    p { margin-top: 18px; font-size: 12px; color: #555; word-break: break-all; }
    @media print { button { display: none; } }
  `
  head.appendChild(style)

  const body = doc.createElement("body")
  
  const heading = doc.createElement("h1")
  heading.textContent = tableName
  body.appendChild(heading)

  const qrContainer = doc.createElement("div")
  qrContainer.className = "qr"
  
  // ✅ SOLUTION SÉCURISÉE : Utiliser appendChild au lieu de innerHTML
  // Cela évite les risques XSS car le SVG est un élément DOM, pas une chaîne HTML
  qrContainer.appendChild(clonedSvg)
  body.appendChild(qrContainer)

  const urlParagraph = doc.createElement("p")
  urlParagraph.textContent = qrUrl
  body.appendChild(urlParagraph)

  html.appendChild(head)
  html.appendChild(body)
  doc.appendChild(html)

  // Fonction de gestionnaire d'impression
  const handlePrint = () => {
    printWindow.focus()
    printWindow.print()
  }

  // Fonction de gestionnaire de nettoyage
  const cleanup = () => {
    printWindow.onafterprint = null
    doc.removeEventListener("DOMContentLoaded", handlePrint)
  }

  // Ajouter l'écouteur avec nettoyage
  doc.addEventListener("DOMContentLoaded", handlePrint)

  // Gérer l'événement afterprint pour nettoyer et fermer
  printWindow.onafterprint = () => {
    cleanup()
    printWindow.close()
  }

  // Fallback si DOMContentLoaded est déjà passé
  if (doc.readyState === "complete" || doc.readyState === "interactive") {
    doc.removeEventListener("DOMContentLoaded", handlePrint)
    handlePrint()
  }
}

/**
 * Télécharge un QR code.
 * Le nom de fichier est nettoyé pour éviter les problèmes de sécurité.
 */
function downloadQr(tableName: string, qrId: string) {
  const svg = getQrSvg(qrId)
  const serialized = new XMLSerializer().serializeToString(svg)
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${sanitizeFileName(tableName)}-qr.svg`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Nettoie un nom de fichier en supprimant les caractères dangereux.
 */
function sanitizeFileName(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "table"
}