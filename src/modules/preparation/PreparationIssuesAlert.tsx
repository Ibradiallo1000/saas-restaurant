"use client"
import * as React from "react"
import { collection,limit,query,where } from "firebase/firestore"
import { AlertTriangle } from "lucide-react"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useCollection,useFirestore,useMemoFirebase } from "@/firebase"
import { playNewOrderNotificationSound } from "@/services/notification-sound.service"
export function PreparationIssuesAlert(){const db=useFirestore(),{restaurantId}=useRestaurant(),seen=React.useRef(new Set<string>());const ref=useMemoFirebase(()=>db&&restaurantId?query(collection(db,"restaurants",restaurantId,"preparationIssues"),where("status","==","OPEN"),limit(100)):null,[db,restaurantId]);const result=useCollection<any>(ref),issues=result.data||[];React.useEffect(()=>{const current=new Set(issues.map((i:any)=>i.id));if(seen.current.size&&issues.some((i:any)=>!seen.current.has(i.id)))playNewOrderNotificationSound();seen.current=current},[issues]);if(!issues.length)return null;return <div role="alert" className="m-2 flex items-start gap-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"><AlertTriangle className="h-5 w-5 shrink-0"/><div><b>{issues.length} problème{issues.length>1?"s":""} de préparation</b>{issues.slice(0,3).map((issue:any)=><p key={issue.id}>{issue.preparationStationName} · {issue.productName} · {issue.comment||issue.reason}</p>)}</div></div>}
