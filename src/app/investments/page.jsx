"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function InvestmentsPage() {

const [assets,setAssets] = useState([])
const [txns,setTxns] = useState([])
const [prices,setPrices] = useState({})
const [tab,setTab] = useState("overview")

const [symbol,setSymbol] = useState("")
const [txnAsset,setTxnAsset] = useState("")
const [txnQty,setTxnQty] = useState("")
const [txnPrice,setTxnPrice] = useState("")

/* ---------------- LOAD DATA ---------------- */

useEffect(()=>{

async function load(){

const {data:{user}} = await supabase.auth.getUser()
if(!user) return

const {data:assetRows} = await supabase
.from("investment_assets")
.select("*")
.eq("user_id",user.id)

const {data:txnRows} = await supabase
.from("investment_transactions")
.select("*")
.eq("user_id",user.id)

setAssets(assetRows || [])
setTxns(txnRows || [])

}

load()

},[])

/* ---------------- ADD ASSET ---------------- */

async function addAsset(){

if(!symbol) return

const {data:{user}} = await supabase.auth.getUser()

const {data} = await supabase
.from("investment_assets")
.insert({
user_id:user.id,
asset_type:"stock",
symbol:symbol.toUpperCase(),
account:"Main"
})
.select()
.single()

setAssets(prev=>[data,...prev])
setSymbol("")

}

/* ---------------- ADD TRADE ---------------- */

async function addTrade(){

if(!txnAsset) return

const {data:{user}} = await supabase.auth.getUser()

const {data} = await supabase
.from("investment_transactions")
.insert({

user_id:user.id,
asset_id:txnAsset,
txn_type:"BUY",
txn_date:new Date().toISOString().slice(0,10),
qty:Number(txnQty),
price:Number(txnPrice)

})
.select()
.single()

setTxns(prev=>[data,...prev])

setTxnQty("")
setTxnPrice("")

}

/* ---------------- PORTFOLIO CALC ---------------- */

const portfolio = useMemo(()=>{

let totalValue = 0
let totalCost = 0

const holdings = []

for(const a of assets){

const list = txns.filter(t=>t.asset_id === a.id)

let shares = 0
let cost = 0

for(const t of list){

if(t.txn_type === "BUY"){

shares += Number(t.qty)
cost += Number(t.qty) * Number(t.price)

}

if(t.txn_type === "SELL"){

shares -= Number(t.qty)

}

}

const value = shares * 0

totalValue += value
totalCost += cost

holdings.push({
...a,
shares,
cost,
value
})

}

const pnl = totalValue - totalCost

return {holdings,totalValue,totalCost,pnl}

},[assets,txns])

/* ---------------- UI ---------------- */

return(

<main style={{
padding:"40px",
maxWidth:"1100px",
margin:"0 auto"
}}>

{/* HEADER */}

<div style={{
display:"flex",
justifyContent:"space-between",
alignItems:"center",
marginBottom:"30px"
}}>

<h1 style={{fontSize:"28px",fontWeight:"600"}}>Investments</h1>

<div style={{display:"flex",gap:"10px"}}>

<button onClick={()=>setTab("overview")}>Overview</button>
<button onClick={()=>setTab("holdings")}>Holdings</button>
<button onClick={()=>setTab("transactions")}>Transactions</button>

</div>

</div>

{/* OVERVIEW */}

{tab==="overview" && (

<div style={{
display:"grid",
gridTemplateColumns:"repeat(3,1fr)",
gap:"20px"
}}>

<div className="card">

<h3>Total Value</h3>
<div>${portfolio.totalValue.toFixed(2)}</div>

</div>

<div className="card">

<h3>Total Cost</h3>
<div>${portfolio.totalCost.toFixed(2)}</div>

</div>

<div className="card">

<h3>P/L</h3>
<div>${portfolio.pnl.toFixed(2)}</div>

</div>

</div>

)}

{/* HOLDINGS */}

{tab==="holdings" && (

<div>

<div style={{
display:"flex",
gap:"10px",
marginBottom:"25px"
}}>

<input
placeholder="Symbol (VOO, QQQ)"
value={symbol}
onChange={e=>setSymbol(e.target.value)}
/>

<button onClick={addAsset}>
Add Asset
</button>

</div>

<div style={{
borderTop:"1px solid #2a2a2a"
}}>

{portfolio.holdings.map(h=>(

<div key={h.id} style={{
display:"grid",
gridTemplateColumns:"2fr 1fr 1fr",
padding:"14px 0",
borderBottom:"1px solid #2a2a2a"
}}>

<div>{h.symbol}</div>
<div>{h.shares} shares</div>
<div>${h.cost.toFixed(2)}</div>

</div>

))}

</div>

</div>

)}

{/* TRANSACTIONS */}

{tab==="transactions" && (

<div>

<div style={{
display:"flex",
gap:"10px",
marginBottom:"25px"
}}>

<select
value={txnAsset}
onChange={e=>setTxnAsset(e.target.value)}
>

<option value="">Select Asset</option>

{assets.map(a=>(
<option key={a.id} value={a.id}>
{a.symbol}
</option>
))}

</select>

<input
placeholder="Qty"
value={txnQty}
onChange={e=>setTxnQty(e.target.value)}
/>

<input
placeholder="Price"
value={txnPrice}
onChange={e=>setTxnPrice(e.target.value)}
/>

<button onClick={addTrade}>
Add Trade
</button>

</div>

<div>

{txns.map(t=>(

<div key={t.id} style={{
display:"grid",
gridTemplateColumns:"2fr 1fr 1fr",
padding:"14px 0",
borderBottom:"1px solid #2a2a2a"
}}>

<div>{t.txn_type}</div>
<div>{t.qty}</div>
<div>${t.price}</div>

</div>

))}

</div>

</div>

)}

</main>

)

}