"use client"

import * as React from "react"
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { Plus, Power } from "lucide-react"
import { DashboardWidget, DashboardWidgetHeader } from "@/components/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"

type Station = { id:string; name:string; code:string; type:string; isActive:boolean; acceptsOrders:boolean; displayOrder:number }
type Staff = { id:string; role?:string; name?:string; nomComplet?:string; email?:string; allowedPreparationStationIds?:string[]; allowedPosStationIds?:string[]; defaultPosStationId?:string|null }
type CatalogItem = { id:string; name?:string; preparationStationId?:string|null }

export function PreparationStationsSettings() {
  const db=useFirestore(), {restaurantId}=useRestaurant(), {user}=useTenant(), {toast}=useToast()
  const [form,setForm]=React.useState({name:"",code:"",type:"kitchen"}); const [saving,setSaving]=React.useState<string|null>(null)
  const q=(name:string)=>db&&restaurantId?collection(db,"restaurants",restaurantId,name):null
  const stationResult=useCollection<any>(useMemoFirebase(()=>q("preparationStations"),[db,restaurantId]))
  const staffResult=useCollection<any>(useMemoFirebase(()=>q("staff"),[db,restaurantId]))
  const categoryResult=useCollection<any>(useMemoFirebase(()=>q("categories"),[db,restaurantId]))
  const productResult=useCollection<any>(useMemoFirebase(()=>q("products"),[db,restaurantId]))
  const stations=React.useMemo(()=>([...(stationResult.data||[])] as Station[]).sort((a,b)=>(a.displayOrder||0)-(b.displayOrder||0)),[stationResult.data])
  async function createStation(){if(!db||!restaurantId||!user||!form.name.trim()||!form.code.trim())return;setSaving("create");try{await addDoc(collection(db,"restaurants",restaurantId,"preparationStations"),{name:form.name.trim(),code:form.code.trim().toUpperCase(),type:form.type.trim().toLowerCase(),isActive:true,acceptsOrders:true,displayOrder:stations.length,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:user.uid,updatedBy:user.uid});setForm({name:"",code:"",type:"kitchen"});toast({title:"Poste créé"})}catch(e:any){toast({variant:"destructive",title:"Création impossible",description:e?.message})}finally{setSaving(null)}}
  async function patch(path:string[],values:Record<string,unknown>,key:string){if(!db||!restaurantId||!user)return;setSaving(key);try{await updateDoc(doc(db,"restaurants",restaurantId,...path),{...values,updatedAt:serverTimestamp(),...(path[0]==="preparationStations"?{updatedBy:user.uid}:{})});toast({title:"Modification enregistrée"})}catch(e:any){toast({variant:"destructive",title:"Modification impossible",description:e?.message})}finally{setSaving(null)}}
  const kitchenStaff=(staffResult.data||[]).filter((s:Staff)=>s.role==="kitchen") as Staff[]
  return <div className="space-y-5"><div><h1 className="text-2xl font-black">Postes de préparation</h1><p className="text-sm text-muted-foreground">Destinations génériques, indépendantes des postes de caisse.</p></div>
    <DashboardWidget><DashboardWidgetHeader title="Nouveau poste" description="Le type libre permet d’ajouter une pâtisserie ou une boulangerie sans modifier preparationMode."/><div className="grid gap-3 p-4 md:grid-cols-[1fr_180px_180px_auto] md:items-end"><Field label="Nom"><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label="Code"><Input value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></Field><Field label="Type"><Input value={form.type} onChange={e=>setForm({...form,type:e.target.value})}/></Field><Button onClick={createStation} disabled={saving==="create"}><Plus className="mr-2 h-4 w-4"/>Créer</Button></div></DashboardWidget>
    <DashboardWidget><DashboardWidgetHeader title="Postes configurés" description="Sans poste, Cuisine principale et Bar principal restent disponibles virtuellement."/><div className="divide-y">{stations.map(s=><StationRow key={s.id} station={s} saving={saving===s.id} save={v=>patch(["preparationStations",s.id],v,s.id)}/>)}{!stationResult.isLoading&&!stations.length?<p className="p-4 text-sm text-muted-foreground">Aucun poste configuré : compatibilité historique active.</p>:null}</div></DashboardWidget>
    <DashboardWidget><DashboardWidgetHeader title="Affectations Cuisine" description="Une affectation explicite limite strictement les postes accessibles."/><div className="divide-y">{kitchenStaff.map(member=><StaffRow key={member.id} member={member} stations={stations.filter(s=>s.isActive)} saving={saving===`staff-${member.id}`} save={ids=>patch(["staff",member.id],{allowedPreparationStationIds:ids,allowedPosStationIds:member.allowedPosStationIds||[],defaultPosStationId:member.defaultPosStationId??null},`staff-${member.id}`)}/>)}</div></DashboardWidget>
    <DashboardWidget><DashboardWidgetHeader title="Routage du catalogue" description="Produit prioritaire, puis catégorie, puis type compatible."/><div className="grid gap-6 p-4 lg:grid-cols-2"><CatalogAssignments title="Catégories" prefix="category" items={categoryResult.data||[]} stations={stations} saving={saving} save={(i,id)=>patch(["categories",i.id],{preparationStationId:id||null},`category-${i.id}`)}/><CatalogAssignments title="Produits" prefix="product" items={productResult.data||[]} stations={stations} saving={saving} save={(i,id)=>patch(["products",i.id],{preparationStationId:id||null},`product-${i.id}`)}/></div></DashboardWidget>
  </div>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-1"><Label>{label}</Label>{children}</div>}
function StationRow({station,saving,save}:{station:Station;saving:boolean;save:(v:Record<string,unknown>)=>void}){const [name,setName]=React.useState(station.name);return <div className="grid gap-3 p-4 md:grid-cols-[1fr_100px_130px_auto_auto] md:items-center"><Input value={name} onChange={e=>setName(e.target.value)}/><b>{station.code}</b><span className="text-sm text-muted-foreground">{station.type}</span><Button variant="outline" disabled={saving||name.trim()===station.name} onClick={()=>save({name:name.trim()})}>Renommer</Button><Button variant="outline" disabled={saving} onClick={()=>save({isActive:!station.isActive,acceptsOrders:!station.isActive})}><Power className="mr-2 h-4 w-4"/>{station.isActive?"Suspendre":"Activer"}</Button></div>}
function StaffRow({member,stations,saving,save}:{member:Staff;stations:Station[];saving:boolean;save:(ids:string[])=>void}){const ids=member.allowedPreparationStationIds||[];return <div className="space-y-2 p-4"><b>{member.nomComplet||member.name||member.email||member.id}</b><div className="flex flex-wrap gap-2">{stations.map(s=><label key={s.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm"><input type="checkbox" disabled={saving} checked={ids.includes(s.id)} onChange={e=>save(e.target.checked?[...ids,s.id]:ids.filter(id=>id!==s.id))}/>{s.name}</label>)}</div></div>}
function CatalogAssignments({title,prefix,items,stations,saving,save}:{title:string;prefix:string;items:CatalogItem[];stations:Station[];saving:string|null;save:(item:CatalogItem,id:string)=>void}){return <div className="space-y-2"><h3 className="font-black">{title}</h3>{items.map(i=><div key={i.id} className="grid grid-cols-[1fr_190px] items-center gap-2"><span className="truncate text-sm">{i.name||i.id}</span><select className="h-9 rounded border bg-background px-2 text-sm" disabled={saving===`${prefix}-${i.id}`} value={i.preparationStationId||""} onChange={e=>save(i,e.target.value)}><option value="">Mode compatible</option>{stations.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>)}</div>}
