"use client"

import * as React from "react"
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { ChevronDown, Loader2, Monitor, Plus, Power, Store } from "lucide-react"

import { DashboardWidget, DashboardWidgetHeader } from "@/components/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useToast } from "@/hooks/use-toast"
import { DEFAULT_POS_STATION } from "@/lib/pos-stations"
import { POS_STATION_TEMPLATES, QUICK_STATION_SCENARIOS, suggestCategoryIds, uniqueStationCode } from "@/lib/station-setup"
import { PageHeader, QuickSetupCard, QuickSetupGrid, getQuickSetupVisual } from "@/design-system/components"

type StationRecord = { id:string; name:string; code:string; isActive:boolean; activeSessionId?:string|null; catalogMode:"ALL"|"RESTRICTED"; allowedCategoryIds:string[]; allowedProductIds:string[]; excludedProductIds:string[] }
type StaffRecord = { id:string; role?:string; name?:string; nomComplet?:string; email?:string; allowedPosStationIds?:string[]; defaultPosStationId?:string|null }
type CatalogRecord = { id:string; name?:string; categoryId?:string }
type SaleScope = "ALL" | "CATEGORIES" | "CUSTOM"

const initialWizard = { templateId:"main", name:"Caisse principale", code:"MAIN", scope:"ALL" as SaleScope, categoryIds:[] as string[], productIds:[] as string[], cashierIds:[] as string[], defaultCashierId:"" }

export function PosStationsSettings() {
  const db=useFirestore(), {restaurantId}=useRestaurant(), {user}=useTenant(), {toast}=useToast()
  const [wizard,setWizard]=React.useState(initialWizard); const [savingKey,setSavingKey]=React.useState<string|null>(null)
  const [quickScenario,setQuickScenario]=React.useState<(typeof QUICK_STATION_SCENARIOS)[number]|null>(null)
  const q=(name:string)=>db&&restaurantId?collection(db,"restaurants",restaurantId,name):null
  const stationsResult=useCollection<any>(useMemoFirebase(()=>q("posStations"),[db,restaurantId]))
  const staffResult=useCollection<any>(useMemoFirebase(()=>q("staff"),[db,restaurantId]))
  const categoryResult=useCollection<any>(useMemoFirebase(()=>q("categories"),[db,restaurantId]))
  const productResult=useCollection<any>(useMemoFirebase(()=>q("products"),[db,restaurantId]))
  const stations=React.useMemo(()=>([...(stationsResult.data||[])] as StationRecord[]).sort((a,b)=>String(a.name).localeCompare(String(b.name))),[stationsResult.data])
  const cashiers=React.useMemo(()=>(staffResult.data||[]).filter((m:StaffRecord)=>m.role==="cashier") as StaffRecord[],[staffResult.data])
  const categories=(categoryResult.data||[]) as CatalogRecord[], products=(productResult.data||[]) as CatalogRecord[]
  const template=POS_STATION_TEMPLATES.find(item=>item.id===wizard.templateId)||POS_STATION_TEMPLATES[0]
  const resolvedCode=uniqueStationCode(wizard.code,stations.map(s=>s.code))

  function selectTemplate(templateId:string){
    const next=POS_STATION_TEMPLATES.find(item=>item.id===templateId)||POS_STATION_TEMPLATES[0]
    const suggested=suggestCategoryIds(next,categories)
    setWizard({...initialWizard,templateId:next.id,name:next.name,code:next.code,scope:suggested.length?"CATEGORIES":"ALL",categoryIds:suggested})
  }
  async function createStation(){
    if(!db||!restaurantId||!user||!wizard.name.trim())return
    setSavingKey("create")
    try{
      const ref=await addDoc(collection(db,"restaurants",restaurantId,"posStations"),stationPayload(wizard.name,resolvedCode,wizard.scope,wizard.categoryIds,wizard.productIds,user.uid))
      for(const cashierId of wizard.cashierIds){
        const cashier=cashiers.find(c=>c.id===cashierId); if(!cashier)continue
        const allowed=[...new Set([...(cashier.allowedPosStationIds||[]),ref.id])]
        await updateDoc(doc(db,"restaurants",restaurantId,"staff",cashier.id),{allowedPosStationIds:allowed,defaultPosStationId:wizard.defaultCashierId===cashier.id?ref.id:(cashier.defaultPosStationId||allowed[0]),updatedAt:serverTimestamp()})
      }
      setWizard(initialWizard); toast({title:"Poste créé",description:`Code interne : ${resolvedCode}`})
    }catch(error:any){toast({variant:"destructive",title:"Création impossible",description:error?.message})}finally{setSavingKey(null)}
  }
  async function applyQuickScenario(){
    if(!db||!restaurantId||!user||!quickScenario)return
    setSavingKey("quick")
    try{
      const existingTemplateIds=new Set(stations.map(s=>s.code.replace(/\d+$/,"")))
      let created=0; const codes=[...stations.map(s=>s.code)]
      for(const id of quickScenario.pos){const item=POS_STATION_TEMPLATES.find(t=>t.id===id);if(!item||existingTemplateIds.has(item.code))continue;const code=uniqueStationCode(item.code,codes);await addDoc(collection(db,"restaurants",restaurantId,"posStations"),stationPayload(item.name,code,"ALL",[],[],user.uid));codes.push(code);created++}
      toast({title:created?`${created} poste(s) créé(s)`:"Configuration déjà présente",description:"Aucun doublon n’a été créé."});setQuickScenario(null)
    }catch(error:any){toast({variant:"destructive",title:"Configuration impossible",description:error?.message})}finally{setSavingKey(null)}
  }
  async function updateStation(station:StationRecord,values:Record<string,unknown>){if(!db||!restaurantId||!user)return;setSavingKey(station.id);try{await updateDoc(doc(db,"restaurants",restaurantId,"posStations",station.id),{...values,updatedAt:serverTimestamp(),updatedBy:user.uid});toast({title:"Poste mis à jour"})}catch(error:any){toast({variant:"destructive",title:"Modification impossible",description:error?.message})}finally{setSavingKey(null)}}
  async function updateAssignment(cashier:StaffRecord,allowedIds:string[],defaultId:string|null){if(!db||!restaurantId)return;setSavingKey(`staff-${cashier.id}`);try{const normalized=defaultId&&allowedIds.includes(defaultId)?defaultId:allowedIds[0]??null;await updateDoc(doc(db,"restaurants",restaurantId,"staff",cashier.id),{allowedPosStationIds:allowedIds,defaultPosStationId:normalized,updatedAt:serverTimestamp()});toast({title:"Affectation mise à jour"})}catch(error:any){toast({variant:"destructive",title:"Affectation impossible",description:error?.message})}finally{setSavingKey(null)}}
  const isLoading=stationsResult.isLoading||staffResult.isLoading||categoryResult.isLoading||productResult.isLoading
  return <div className="min-w-0 space-y-5"><PageHeader icon={Monitor} title="Postes de caisse" subtitle="Créez des caisses adaptées à votre organisation sans exposer les réglages techniques." />
    <DashboardWidget><DashboardWidgetHeader title="Configuration rapide" description="Choisissez un scénario. Un résumé sera affiché avant toute création."/><QuickSetupGrid className="p-4">{QUICK_STATION_SCENARIOS.map(s=>{const visual=getQuickSetupVisual(s.id);return <QuickSetupCard key={s.id} title={s.name} description={s.description} icon={visual.icon} variant={visual.variant} selected={quickScenario?.id===s.id} onClick={()=>setQuickScenario(s)}/>})}<QuickSetupCard title="Configuration personnalisée" description="Créer un poste librement" {...getQuickSetupVisual("custom")} selected={wizard.templateId==="custom"} onClick={()=>selectTemplate("custom")}/></QuickSetupGrid></DashboardWidget>
    <DashboardWidget><DashboardWidgetHeader title="Créer un poste" description="Sélectionnez un modèle, son périmètre de vente puis les caissiers autorisés."/><div className="space-y-5 p-4">
      <Field label="Modèle"><select className="h-11 w-full rounded-md border bg-background px-3" value={wizard.templateId} onChange={e=>selectTemplate(e.target.value)}>{POS_STATION_TEMPLATES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      <Field label="Nom"><Input value={wizard.name} onChange={e=>setWizard({...wizard,name:e.target.value})}/></Field>
      <fieldset className="space-y-2"><legend className="font-bold">Que peut vendre cette caisse ?</legend><div className="grid gap-2 sm:grid-cols-3">{([['ALL','Tout le catalogue'],['CATEGORIES','Certaines catégories'],['CUSTOM','Sélection personnalisée']] as const).map(([value,label])=><label key={value} className="flex min-h-11 items-center gap-2 rounded-lg border px-3"><input type="radio" checked={wizard.scope===value} onChange={()=>setWizard({...wizard,scope:value})}/>{label}</label>)}</div></fieldset>
      {wizard.scope!=="ALL"?<SelectionList title="Catégories autorisées" items={categories} selected={wizard.categoryIds} onChange={ids=>setWizard({...wizard,categoryIds:ids})}/>:null}
      {wizard.scope==="CUSTOM"?<SelectionList title="Produits autorisés" items={products} selected={wizard.productIds} onChange={ids=>setWizard({...wizard,productIds:ids})}/>:null}
      <SelectionList title="Quels caissiers peuvent utiliser ce poste ?" items={cashiers.map(c=>({id:c.id,name:c.nomComplet||c.name||c.email||"Caissier"}))} selected={wizard.cashierIds} onChange={ids=>setWizard({...wizard,cashierIds:ids,defaultCashierId:ids.includes(wizard.defaultCashierId)?wizard.defaultCashierId:""})}/>
      {wizard.cashierIds.length?<Field label="Utiliser comme poste par défaut pour"><select className="h-10 w-full rounded-md border bg-background px-3" value={wizard.defaultCashierId} onChange={e=>setWizard({...wizard,defaultCashierId:e.target.value})}><option value="">Ne pas modifier les postes par défaut</option>{cashiers.filter(c=>wizard.cashierIds.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.nomComplet||c.name||c.email}</option>)}</select></Field>:null}
      <details className="rounded-lg border p-3"><summary className="flex cursor-pointer items-center gap-2 font-bold">Configuration avancée <ChevronDown className="h-4 w-4"/></summary><div className="mt-3 space-y-1"><Label htmlFor="station-code">Code interne</Label><Input id="station-code" value={wizard.code} onChange={e=>setWizard({...wizard,code:e.target.value})}/><p className="text-xs text-muted-foreground">Code disponible : {resolvedCode}</p></div></details>
      <Button onClick={createStation} disabled={savingKey==="create"||!wizard.name.trim()}><Plus className="mr-2 h-4 w-4"/>Enregistrer</Button>
    </div></DashboardWidget>
    <DashboardWidget><DashboardWidgetHeader title="Postes configurés" description={`${DEFAULT_POS_STATION.name} reste disponible lorsque le restaurant n’a aucun poste configuré.`}/><div className="divide-y">{isLoading?<div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Chargement…</div>:null}{stations.map(s=><StationRow key={s.id} station={s} categories={categories} products={products} saving={savingKey===s.id} onSave={updateStation}/>)}{!isLoading&&!stations.length?<div className="flex items-center gap-3 p-4 text-sm text-muted-foreground"><Store className="h-5 w-5"/>Aucun poste configuré : Caisse principale vend tout le catalogue.</div>:null}</div></DashboardWidget>
    <DashboardWidget><DashboardWidgetHeader title="Affectations des caissiers" description="Sans affectation explicite, le caissier utilise Caisse principale."/><div className="divide-y">{cashiers.map(c=><CashierAssignment key={c.id} cashier={c} stations={stations} saving={savingKey===`staff-${c.id}`} onSave={updateAssignment}/>)}{!isLoading&&!cashiers.length?<p className="p-4 text-sm text-muted-foreground">Aucun caissier à affecter.</p>:null}</div></DashboardWidget>
    <Dialog open={Boolean(quickScenario)} onOpenChange={open=>{if(!open)setQuickScenario(null)}}><DialogContent><DialogHeader><DialogTitle>Résumé de la configuration</DialogTitle><DialogDescription>Seuls les postes absents seront créés. Les sessions et affectations existantes resteront intactes.</DialogDescription></DialogHeader><ul className="space-y-2">{quickScenario?.pos.map(id=>{const t=POS_STATION_TEMPLATES.find(x=>x.id===id);const exists=stations.some(s=>s.code.replace(/\d+$/,'')===t?.code);return <li key={id} className="rounded border p-3"><b>{t?.name}</b><span className="ml-2 text-xs text-muted-foreground">{exists?'déjà présent':'à créer'}</span></li>})}</ul><DialogFooter><Button variant="outline" onClick={()=>setQuickScenario(null)}>Annuler</Button><Button disabled={savingKey==="quick"} onClick={applyQuickScenario}>Appliquer</Button></DialogFooter></DialogContent></Dialog>
  </div>
}

function stationPayload(name:string,code:string,scope:SaleScope,categoryIds:string[],productIds:string[],uid:string){return{name:name.trim(),code,isActive:true,catalogMode:scope==="ALL"?"ALL":"RESTRICTED",allowedCategoryIds:scope==="ALL"?[]:categoryIds,allowedProductIds:scope==="CUSTOM"?productIds:[],excludedProductIds:[],activeSessionId:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:uid,updatedBy:uid}}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-1"><Label>{label}</Label>{children}</div>}
function SelectionList({title,items,selected,onChange}:{title:string;items:{id:string;name?:string}[];selected:string[];onChange:(ids:string[])=>void}){return <fieldset className="space-y-2"><legend className="font-bold">{title}</legend><div className="grid max-h-52 gap-2 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">{items.map(i=><label key={i.id} className="flex min-h-10 items-center gap-2 rounded-md px-2 hover:bg-muted"><input type="checkbox" checked={selected.includes(i.id)} onChange={e=>onChange(e.target.checked?[...selected,i.id]:selected.filter(id=>id!==i.id))}/><span className="min-w-0 break-words text-sm">{i.name||"Sans nom"}</span></label>)}{!items.length?<p className="p-2 text-sm text-muted-foreground">Aucun élément disponible.</p>:null}</div></fieldset>}
function StationRow({station,categories,products,saving,onSave}:{station:StationRecord;categories:CatalogRecord[];products:CatalogRecord[];saving:boolean;onSave:(station:StationRecord,values:Record<string,unknown>)=>Promise<void>}){const [name,setName]=React.useState(station.name);const [mode,setMode]=React.useState<"ALL"|"RESTRICTED">(station.catalogMode||"ALL");const [allowedCategories,setAllowedCategories]=React.useState(station.allowedCategoryIds||[]);const [allowedProducts,setAllowedProducts]=React.useState(station.allowedProductIds||[]);const [excluded,setExcluded]=React.useState(station.excludedProductIds||[]);React.useEffect(()=>setName(station.name),[station.name]);return <div className="space-y-3 p-4"><div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center"><Input value={name} onChange={e=>setName(e.target.value)} aria-label={`Nom du poste ${station.name}`}/><Button variant="outline" disabled={saving||!name.trim()||name.trim()===station.name} onClick={()=>onSave(station,{name:name.trim()})}>Renommer</Button><Button variant={station.isActive?"outline":"default"} disabled={saving||Boolean(station.activeSessionId)} onClick={()=>onSave(station,{isActive:!station.isActive})}><Power className="mr-2 h-4 w-4"/>{station.isActive?"Désactiver":"Activer"}</Button></div>{station.activeSessionId?<p className="text-xs text-amber-700">Une session est ouverte : ce poste ne peut pas être désactivé.</p>:null}<details className="rounded-lg border p-3"><summary className="cursor-pointer font-bold">Périmètre de vente et configuration avancée</summary><div className="mt-3 space-y-3"><Field label="Catalogue"><select className="h-10 w-full rounded-md border bg-background px-3" value={mode} onChange={e=>setMode(e.target.value as any)}><option value="ALL">Tout le catalogue</option><option value="RESTRICTED">Sélection personnalisée</option></select></Field>{mode==="RESTRICTED"?<><SelectionList title="Catégories autorisées" items={categories} selected={allowedCategories} onChange={setAllowedCategories}/><SelectionList title="Produits autorisés" items={products} selected={allowedProducts} onChange={setAllowedProducts}/></>:null}<SelectionList title="Produits exclus" items={products} selected={excluded} onChange={setExcluded}/><p className="text-xs text-muted-foreground">Code interne : {station.code}</p><Button variant="outline" disabled={saving} onClick={()=>onSave(station,{catalogMode:mode,allowedCategoryIds:mode==="ALL"?[]:allowedCategories,allowedProductIds:mode==="ALL"?[]:allowedProducts,excludedProductIds:excluded})}>Enregistrer le périmètre</Button>{station.activeSessionId?<p className="text-xs text-muted-foreground">La session ouverte conserve son périmètre actuel. Le changement s’appliquera à la prochaine ouverture.</p>:null}</div></details></div>}
function CashierAssignment({cashier,stations,saving,onSave}:{cashier:StaffRecord;stations:StationRecord[];saving:boolean;onSave:(cashier:StaffRecord,allowed:string[],defaultId:string|null)=>Promise<void>}){const current=Array.isArray(cashier.allowedPosStationIds)?cashier.allowedPosStationIds:[];const active=stations.filter(s=>s.isActive);const label=cashier.nomComplet||cashier.name||cashier.email||"Caissier";return <div className="space-y-3 p-4"><div className="flex justify-between gap-2"><b className="break-words">{label}</b><span className="text-xs text-muted-foreground">{current.length?`${current.length} poste(s)`:"Caisse principale"}</span></div><div className="flex flex-wrap gap-2">{active.map(s=><label key={s.id} className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={current.includes(s.id)} disabled={saving} onChange={e=>{const next=e.target.checked?[...current,s.id]:current.filter(id=>id!==s.id);void onSave(cashier,next,cashier.defaultPosStationId??null)}}/>{s.name}</label>)}</div>{current.length?<div className="flex flex-wrap items-end gap-2"><Field label="Poste par défaut"><select className="h-10 rounded-md border bg-background px-3" value={cashier.defaultPosStationId||current[0]} onChange={e=>void onSave(cashier,current,e.target.value)}>{active.filter(s=>current.includes(s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Button variant="ghost" disabled={saving} onClick={()=>onSave(cashier,[],null)}>Utiliser Caisse principale</Button></div>:null}</div>}
