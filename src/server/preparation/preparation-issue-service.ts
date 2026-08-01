import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore"
import { resolveAllowedPreparationStationIds, VIRTUAL_PREPARATION_STATIONS } from "../../lib/preparation-stations.ts"

export const PREPARATION_ISSUE_REASONS = ["PRODUCT_UNAVAILABLE", "MISSING_INGREDIENT", "ORDER_ERROR", "EQUIPMENT_UNAVAILABLE", "OTHER"] as const
export type PreparationIssueReason = typeof PREPARATION_ISSUE_REASONS[number]
export class PreparationIssueError extends Error { readonly code:string; constructor(code:string,message:string){super(message);this.code=code} }

export async function executePreparationIssueCommand(input:{db:Firestore;restaurantId:string;actor:{uid:string;role:string};command:any}) {
  const {db,restaurantId,actor,command}=input
  if(!command || !["REPORT","RESOLVE"].includes(command.type)) throw new PreparationIssueError("INVALID_COMMAND","Commande invalide.")
  if(typeof command.orderId!=="string"||typeof command.orderItemId!=="string") throw new PreparationIssueError("INVALID_COMMAND","Ligne obligatoire.")
  const restaurant=db.collection("restaurants").doc(restaurantId), itemRef=restaurant.collection("orders").doc(command.orderId).collection("orderItems").doc(command.orderItemId)
  const issueRef=restaurant.collection("preparationIssues").doc(`${command.orderId}--${command.orderItemId}`)
  return db.runTransaction(async transaction=>{
    const [itemSnapshot,staffSnapshot,issueSnapshot]=await Promise.all([transaction.get(itemRef),transaction.get(restaurant.collection("staff").doc(actor.uid)),transaction.get(issueRef)])
    if(!itemSnapshot.exists) throw new PreparationIssueError("ITEM_NOT_FOUND","Ligne introuvable.")
    const item=itemSnapshot.data()||{}, stationId=typeof item.preparationStationId==="string"?item.preparationStationId:item.preparationMode==="bar"?VIRTUAL_PREPARATION_STATIONS.bar.id:item.preparationMode==="kitchen"?VIRTUAL_PREPARATION_STATIONS.kitchen.id:""
    const privileged=["owner","manager"].includes(actor.role), allowed=new Set(resolveAllowedPreparationStationIds(staffSnapshot.data()))
    if(!stationId||(!privileged&&!allowed.has(stationId))) throw new PreparationIssueError("FORBIDDEN","Poste non affecté.")
    const now=Timestamp.now()
    if(command.type==="REPORT"){
      if(!PREPARATION_ISSUE_REASONS.includes(command.reason)||typeof command.comment!=="string"||command.comment.length>500) throw new PreparationIssueError("INVALID_COMMAND","Motif invalide.")
      transaction.set(issueRef,{restaurantId,orderId:command.orderId,orderItemId:command.orderItemId,productId:String(item.productId||""),productName:String(item.nameSnapshot||item.name||"Produit"),preparationStationId:stationId,preparationStationName:String(item.preparationStationName||"Poste de préparation"),preparationStationCode:String(item.preparationStationCode||""),reason:command.reason,comment:command.comment.trim(),status:"OPEN",createdAt:issueSnapshot.exists?(issueSnapshot.data()?.createdAt||now):now,createdBy:issueSnapshot.exists?(issueSnapshot.data()?.createdBy||actor.uid):actor.uid,updatedAt:now,updatedBy:actor.uid,resolvedAt:null,resolvedBy:null,version:FieldValue.increment(1)},{merge:true})
    } else {
      if(!issueSnapshot.exists||issueSnapshot.data()?.status!=="OPEN") throw new PreparationIssueError("ISSUE_NOT_OPEN","Aucun signalement actif.")
      if(!privileged&&issueSnapshot.data()?.preparationStationId!==stationId) throw new PreparationIssueError("FORBIDDEN","Signalement d’un autre poste.")
      transaction.update(issueRef,{status:"RESOLVED",resolvedAt:now,resolvedBy:actor.uid,updatedAt:now,updatedBy:actor.uid,version:FieldValue.increment(1)})
    }
    return {ok:true,issueId:issueRef.id,status:command.type==="REPORT"?"OPEN":"RESOLVED"}
  })
}
