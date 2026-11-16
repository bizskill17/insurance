import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";
import SearchableSelect from "./SearchableSelect";

const ruleLabels = {
  attempted: "Call Attempted (₹ per call)", connected: "Connected (₹ per call)",
  interested: "Customer Interested (₹ per call)", followup: "Successful Follow-up (₹ per call)",
  converted: "Policy Converted (₹ per call)", premium_percent: "Premium (%)",
  target_bonus: "Daily Target Bonus (₹)", monthly_bonus: "Monthly Bonus (₹)"
};
const today = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"); };
const dateText = value => value ? value.slice(0,10).split("-").reverse().join("/") : "—";
async function api(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const json = await response.json();
  if (!response.ok) throw new Error(json.message || "Request failed");
  return json.data ?? json;
}
const post = (data, method="POST") => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export default function CallingPage({ mode, currentUser }) {
  const [entries,setEntries] = useState([]);
  const [users,setUsers] = useState([]);
  const [customers,setCustomers] = useState([]);
  const [settings,setSettings] = useState({ daily_target:30,rules:[] });
  const [form,setForm] = useState({ assigned_user_id:"",customer_id:"",customer_name:"",mobile:"",call_type:"New",scheduled_date:today() });
  const [editing,setEditing] = useState(null);
  const [result,setResult] = useState({status:"Connected",outcome:"",remarks:"",next_followup_date:""});
  const [search,setSearch] = useState("");
  const [employee,setEmployee] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [ruleValues,setRuleValues] = useState({});
  const load = async () => {
    const [rows,people,config] = await Promise.all([
      api("/calling/entries"),api("/calling/users"),api("/calling/settings")
    ]);
    setEntries(rows);setUsers(people);setSettings(config);
    setRuleValues(Object.fromEntries((config.rules||[]).map(r=>[r.rule_type,{enabled:Boolean(Number(r.enabled)),rate:String(r.rate)}])));
  };
  useEffect(()=>{let live=true;Promise.all([load(),api("/masters/customers?limit=500000")]).then(([,c])=>{if(live)setCustomers(c);}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return ()=>{live=false};},[]);
  const submit = async fn => {setSaving(true);setError("");setNotice("");try{await fn();await load();setNotice("Saved successfully.");}catch(e){setError(e.message)}finally{setSaving(false)}};
  const todayEntries = entries.filter(e=>e.scheduled_date===today() && String(e.assigned_user_id)===String(employee||currentUser?.id));
  const todayDone = todayEntries.filter(e=>e.status!=="Pending").length;
  const target = Number(settings.daily_target)||30;
  const selectedRows = useMemo(()=>entries.filter(e=>(!employee||String(e.assigned_user_id)===employee)&&
    [e.customer_name,e.mobile,e.employee_name,e.status,e.outcome].join(" ").toLowerCase().includes(search.toLowerCase())),[entries,employee,search]);
  const rules = Object.fromEntries((settings.rules||[]).map(r=>[r.rule_type,r]));
  const rate = key => Number(rules[key]?.enabled) ? Number(rules[key]?.rate)||0 : 0;
  const incentive = e => {
    if(e.status==="Pending")return 0;
    const candidates=[rate("attempted")];
    if(e.status==="Connected")candidates.push(rate("connected"));
    if(e.outcome==="Interested")candidates.push(rate("interested"));
    if(e.call_type==="Follow-up"&&e.outcome==="Follow-up")candidates.push(rate("followup"));
    if(e.outcome==="Converted")candidates.push(rate("converted"));
    return Math.max(...candidates);
  };
  const money = value => "₹"+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2,minimumFractionDigits:2});
  const saveSettings = () => submit(()=>api("/calling/settings",post({daily_target:target,rules:ruleValues})));
  const exportCsv = () => {
    const rows=[["Employee","Customer","Mobile","Call Type","Scheduled","Status","Outcome","Follow-up","Incentive"],...selectedRows.map(e=>[e.employee_name,e.customer_name,e.mobile,e.call_type,e.scheduled_date,e.status,e.outcome,e.next_followup_date,incentive(e)])];
    const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\r\n");
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv"}));link.download="calling-report.csv";link.click();URL.revokeObjectURL(link.href);
  };
  return <div className="master-page">
    <section className="master-card" style={{padding:16}}>
      <h2>{mode==="settings"?"Incentive Settings":mode==="tracker"?"Call Tracker & Incentive":"Call List"}</h2>
      {error&&<p className="feedback feedback--error">{error}</p>}
      {notice&&<p className="feedback">{notice}</p>}
      {loading?<p>Loading...</p>:<>
        {mode==="settings"?<>
          <div className="form-field"><label>Daily Call Target Per User</label><input type="number" min="1" value={target} onChange={e=>setSettings(s=>({...s,daily_target:Number(e.target.value)}))}/></div>
          <div className="master-form" style={{marginTop:16}}>
            {Object.entries(ruleLabels).map(([key,label])=><div className="form-field" key={key}>
              <label style={{display:"flex",alignItems:"center",justifyContent:"flex-start",gap:8,width:"100%",marginBottom:6}}><input type="checkbox" style={{width:16,height:16,flex:"0 0 16px",margin:0}} checked={Boolean(ruleValues[key]?.enabled)} onChange={e=>setRuleValues(v=>({...v,[key]:{...v[key],enabled:e.target.checked}}))}/><span>{label}</span></label>
              <input type="text" inputMode="decimal" placeholder="Rate not set" value={ruleValues[key]?.rate??""} onChange={e=>{if (/^\\d*(?:\\.\\d{0,2})?$/.test(e.target.value)) setRuleValues(v=>({...v,[key]:{...v[key],rate:e.target.value}}));}}/>
            </div>)}
          </div>
          <div style={{ display:"flex", justifyContent:"flex-start", marginTop:24, paddingTop:8, clear:"both" }}><button type="button" className="btn btn--primary" disabled={saving} onClick={saveSettings}>Save Settings</button></div>
        </>:<>
          <p>Daily target: <strong>{target}</strong> calls per user (new + follow-up). Today's completed calls for selected user: <strong>{todayDone}</strong>. Remaining: <strong>{Math.max(0,target-todayDone)}</strong>.</p>
          {mode==="list"&&<form className="master-form" onSubmit={e=>{e.preventDefault();submit(async()=>{await api("/calling/entries",post(form));setForm(f=>({...f,customer_id:"",customer_name:"",mobile:""}))})}}>
            <div className="form-field"><label>Assigned User *</label><SearchableSelect value={form.assigned_user_id} onChange={e=>setForm(f=>({...f,assigned_user_id:e.target.value}))}><option value="">Select User</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</SearchableSelect></div>
            <div className="form-field"><label>Customer Name *</label><SearchableSelect value={form.customer_id} onChange={e=>{const c=customers.find(x=>String(x.id)===e.target.value);setForm(f=>({...f,customer_id:e.target.value,customer_name:c?.full_name||"",mobile:c?.mobile||""}))}}><option value="">Select Customer</option>{[...customers].sort((a,b)=>a.full_name.localeCompare(b.full_name)).map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</SearchableSelect></div>
            <div className="form-field"><label>Mobile</label><input value={form.mobile} readOnly/></div>
            <div className="form-field"><label>Call Type</label><select value={form.call_type} onChange={e=>setForm(f=>({...f,call_type:e.target.value}))}><option>New</option><option>Follow-up</option></select></div>
            <div className="form-field"><label>Call Date</label><input type="date" required value={form.scheduled_date} onChange={e=>setForm(f=>({...f,scheduled_date:e.target.value}))}/></div>
            <button disabled={saving||!form.customer_name||!form.assigned_user_id}>Add to Call List</button>
          </form>}
          <div className="data-toolbar" style={{display:"flex",gap:8,flexWrap:"wrap",margin:"14px 0"}}>
            <input placeholder="Search calls..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <select value={employee} onChange={e=>setEmployee(e.target.value)}><option value="">All Users</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select>
            <button type="button" onClick={exportCsv}>Export Excel (CSV)</button>
          </div>
          {mode==="tracker"&&<p><strong>Completed Calls:</strong> {selectedRows.filter(e=>e.status!=="Pending").length} | <strong>Estimated Per-Call Incentive:</strong> {money(selectedRows.reduce((sum,e)=>sum+incentive(e),0))}</p>}
          <div className="table-wrap"><table className="master-table"><thead><tr>{["Date","Employee","Customer","Mobile","Type","Status","Outcome","Follow-up","Incentive","Action"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{selectedRows.map(e=><tr key={e.id}><td>{dateText(e.scheduled_date)}</td><td>{e.employee_name}</td><td>{e.customer_name}</td><td>{e.mobile||"—"}</td><td>{e.call_type}</td><td>{e.status}</td><td>{e.outcome||"—"}</td><td>{dateText(e.next_followup_date)}</td><td>{money(incentive(e))}</td><td>{e.status==="Pending"?<button type="button" onClick={()=>{setEditing(e);setResult({status:"Connected",outcome:"",remarks:"",next_followup_date:""})}}>Record Call</button>:"Completed"}</td></tr>)}</tbody></table></div>
          {editing&&<div className="master-modal" role="dialog" aria-modal="true"><div className="master-modal__backdrop" onClick={()=>setEditing(null)}/><section className="master-card master-modal__panel" style={{padding:20}}><h3>Record Call — {editing.customer_name}</h3><form className="master-form" onSubmit={e=>{e.preventDefault();submit(async()=>{await api("/calling/entries/"+editing.id,post(result,"PUT"));setEditing(null)})}}>
            <div className="form-field"><label>Call Status</label><select value={result.status} onChange={e=>setResult(v=>({...v,status:e.target.value}))}>{["Connected","Not Answered","Busy","Switched Off","Wrong Number"].map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="form-field"><label>Outcome</label><select value={result.outcome} onChange={e=>setResult(v=>({...v,outcome:e.target.value}))}>{["","Interested","Not Interested","Follow-up","Converted"].map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="form-field"><label>Next Follow-up</label><input type="date" value={result.next_followup_date} onChange={e=>setResult(v=>({...v,next_followup_date:e.target.value}))}/></div>
            <div className="form-field"><label>Remarks</label><textarea value={result.remarks} onChange={e=>setResult(v=>({...v,remarks:e.target.value}))}/></div>
            <button disabled={saving}>Save Call</button><button type="button" onClick={()=>setEditing(null)}>Cancel</button>
          </form></section></div>}
        </>}
      </>}
    </section>
  </div>;
}
