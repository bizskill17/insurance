import {useEffect,useMemo,useState} from "react";
import {useNavigate} from "react-router-dom";
import {API_BASE} from "../config/api";
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const dateOnly=v=>typeof v==="string"?v.slice(0,10):"";
const sources=[
  {name:"Policy Expiry",url:"/policies?limit=50000",date:["expiry_date","policy_expiry_date","end_date","expiry"],title:["policy_number","customer_name","full_name"],path:"/policies/all"},
  {name:"Task",url:"/tasks?view=all",date:["due_date","task_due_date"],title:["description","task_name","title"],path:"/tasks/all"},
  {name:"Claim",url:"/masters/claims?limit=50000",date:["follow_up_date","due_date","next_followup_date"],title:["claim_number","customer_name"],path:"/claims/master"},
  {name:"Follow-up Call",url:"/calling/entries",date:["next_followup_date","scheduled_date"],title:["customer_name"],path:"/calling/list"}
];
const pick=(o,keys)=>keys.map(k=>o?.[k]).find(x=>x!==undefined&&x!==null&&x!=="")||"";
export default function CalendarPage(){
 const navigate=useNavigate();
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [selected,setSelected]=useState(iso(new Date()));
 const [events,setEvents]=useState([]),[types,setTypes]=useState([]),[error,setError]=useState("");
 const first=iso(new Date(month.getFullYear(),month.getMonth(),1));
 const last=iso(new Date(month.getFullYear(),month.getMonth()+1,0));
 useEffect(()=>{let active=true;const load=async()=>{
  const all=await Promise.allSettled([
    ...sources.map(async s=>{const r=await fetch(API_BASE+s.url);if(!r.ok)throw Error(s.name+" unavailable");const j=await r.json();return (j.data||[]).map(x=>({date:dateOnly(pick(x,s.date)),type:s.name,title:String(pick(x,s.title)||s.name),path:s.path}));}),
    (async()=>{const r=await fetch(API_BASE+"/checklists/occurrences?from="+first+"&to="+last);if(!r.ok)throw Error("Checklist unavailable");const j=await r.json();return (j.data||[]).map(x=>({date:x.due_date,type:"Checklist",title:x.title+" — "+x.employee_name,path:"/checklists/mine"}));})()
  ]);
  if(active){setEvents(all.filter(x=>x.status==="fulfilled").flatMap(x=>x.value));setError(all.some(x=>x.status==="rejected")?"Some event sources could not be loaded.":"");}
 };load();return()=>{active=false};},[first,last]);
 const allTypes=["Policy Expiry","Task","Claim","Follow-up Call","Checklist"];
 const dayEvents=useMemo(()=>events.filter(e=>e.date===selected&&(types.length===0||types.includes(e.type))),[events,selected,types]);
 const counts=useMemo(()=>{const m={};events.forEach(e=>{if(types.length&& !types.includes(e.type))return;m[e.date]=(m[e.date]||0)+1;});return m;},[events,types]);
 const offset=(month.getDay()+6)%7;const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 return <div className="check-page"><section className="check-card">
  <h2>Calendar</h2>
  {error&&<p className="check-error">{error}</p>}
  <div className="check-calendar-toolbar"><button onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}>‹ Previous</button><h3>{month.toLocaleString("en-IN",{month:"long",year:"numeric"})}</h3><button onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}>Next ›</button></div>
  <div className="check-filters">{allTypes.map(t=><label key={t} className="check-checkbox"><input type="checkbox" checked={!types.length||types.includes(t)} onChange={()=>setTypes(old=>old.length===0?allTypes.filter(x=>x!==t):old.includes(t)?old.filter(x=>x!==t):[...old,t])}/>{t}</label>)}<button onClick={()=>setTypes([])}>All</button></div>
  <div className="check-calendar-grid">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><strong key={d}>{d}</strong>)}{Array.from({length:offset},(_,i)=><span key={"blank"+i}/>)}{Array.from({length:days},(_,i)=>{const date=iso(new Date(month.getFullYear(),month.getMonth(),i+1));return <button key={date} className={selected===date?"selected":""} onClick={()=>setSelected(date)}><span>{i+1}</span>{counts[date]>0&&<small>{counts[date]} event{counts[date]===1?"":"s"}</small>}</button>})}</div>
  <h3>Events on {selected.split("-").reverse().join("/")}</h3>
  <div className="check-table-wrap"><table><thead><tr><th>Category</th><th>Details</th><th>Open</th></tr></thead><tbody>{dayEvents.map((e,i)=><tr key={i}><td>{e.type}</td><td>{e.title}</td><td><button onClick={()=>navigate(e.path)}>View</button></td></tr>)}</tbody></table>{!dayEvents.length&&<p>No events on this date.</p>}</div>
 </section></div>;
}
