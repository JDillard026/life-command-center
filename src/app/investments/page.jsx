"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function InvestmentsPage(){

const [assets,setAssets] = useState([])
const [txns,setTxns] = useState([])
const [prices,setPrices] = useState({})
const [tab,setTab] = useState("overview")

/* LOAD DATA */

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

const {data:priceRows} = await supabase
.from("investment_prices")
.select("*")
.eq("user_id",user.id)

const priceMap = {}

for(const p of priceRows || []){

priceMap[p.price_key] = Number(p.price)

}

setAssets(assetRows || [])
setTxns(txnRows || [])
setPrices(priceMap)

}

load()

},[])

/* PORTFOLIO CALC */

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

const key = `${a.asset_type}:${a.symbol}`

const price = prices[key] || 0

const value = shares * price

totalValue += value
totalCost += cost

holdings.push({

...a,
shares,
price,
value,
cost

})

}

const pnl = totalValue - totalCost

return {holdings,totalValue,totalCost,pnl}

},[assets,txns,prices])

/* UI */

return(

<main className="container">

<h1>Investments</h1>

<div style={{display:"flex",gap:10,marginBottom:20}}>

<button onClick={()=>setTab("overview")}>Overview</button>
<button onClick={()=>setTab("holdings")}>Holdings</button>
<button onClick={()=>setTab("transactions")}>Transactions</button>
<button onClick={()=>setTab("market")}>Market</button>

</div>

{tab==="overview" && (

<div>

<h2>Portfolio</h2>

<div>Total Value: ${portfolio.totalValue.toFixed(2)}</div>
<div>Total Cost: ${portfolio.totalCost.toFixed(2)}</div>
<div>P/L: ${portfolio.pnl.toFixed(2)}</div>

</div>

)}

{tab==="holdings" && (

<div>

<h2>Holdings</h2>

{portfolio.holdings.map(h=>(

<div key={h.id} style={{padding:10,borderBottom:"1px solid #333"}}>

<div>{h.symbol} • {h.account}</div>
<div>Shares: {h.shares}</div>
<div>Price: ${h.price}</div>
<div>Value: ${h.value.toFixed(2)}</div>

</div>

))}

</div>

)}

{tab==="transactions" && (

<div>

<h2>Transactions</h2>

{txns.map(t=>(

<div key={t.id} style={{padding:10,borderBottom:"1px solid #333"}}>

<div>{t.txn_type}</div>
<div>{t.txn_date}</div>
<div>Qty: {t.qty}</div>
<div>Price: {t.price}</div>

</div>

))}

</div>

)}

{tab==="market" && (

<div>

<h2>Market (coming soon)</h2>

</div>

)}

</main>

)

}