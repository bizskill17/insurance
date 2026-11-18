import {useEffect,useMemo,useState} from "react";
import {useNavigate} from "react-router-dom";
import {API_BASE} from "../config/api";
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const dateOnly=v=>typeof v==="string"?v.slice(0,10):"";
const pick=(o,keys)=>keys.map(k=>o?.[k]).find(x=>x!==undefined&&x!==null&&x!=="")||"";
export default function CalendarPage(){
 const navigate=useNavigate();
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [selected,setSelected]=useState(iso(new Date()));
 const [events,setEvents]=useState([]),[error,setError]=useState("");
 const first=iso(new Date(month.getFullYear(),month.getMonth(),1));
 const last=iso(new Date(month.getFullYear(),month.getMonth()+1,0));
 useEffect(()=>{let active=true;const load=async()=>{
  try{const r=await fetch(API_BASE+"/checklists/occurrences?from="+first+"&to="+last);if(!r.ok){let detail="";try{const failure=await r.json();detail=failure.message||failure.error||"";}catch{}throw Error(`Checklist request failed (${r.status})${detail?": "+detail:""}`);}const j=await r.json();if(active){setEvents((j.data||[]).map(x=>({date:x.due_date,type:"Checklist",title:x.title+" — "+(x.employee_name||"Unassigned"),status:x.status,path:"/checklists/tracker"})));setError("");}}catch(e){if(active){setEvents([]);setError(`Checklist events could not be loaded. ${e.message||"Please retry."}`);}}
 };load();return()=>{active=false};},[first,last]);
 const dayEvents=useMemo(()=>events.filter(e=>e.date===selected),[events,selected]);
 const checklistByDay=useMemo(()=>{const m={};events.forEach(e=>{(m[e.date]??=[]).push(e);});return m;},[events]);
 const offset=(month.getDay()+6)%7;const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 return <div className="check-page"><section className="check-card">
  <h2>Calendar</h2>
  {error&&<p className="check-error">{error}</p>}
  <div className="check-calendar-toolbar"><button onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}>‹ Previous</button><h3>{month.toLocaleString("en-IN",{month:"long",year:"numeric"})}</h3><button onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}>Next ›</button></div>

  <div className="check-calendar-grid">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><strong key={d}>{d}</strong>)}{Array.from({length:offset},(_,i)=><span key={"blank"+i}/>)}{Array.from({length:days},(_,i)=>{const date=iso(new Date(month.getFullYear(),month.getMonth(),i+1));return <button key={date} className={selected===date?"selected":""} onClick={()=>setSelected(date)}><span>{i+1}</span>{(checklistByDay[date]||[]).slice(0,2).map((e,j)=><span key={j} className={"check-calendar-task "+(e.status==="Completed"?"is-done":"")} title={e.title}>{e.status==="Completed"?"✓ ":"☐ "}{e.title}</span>)}{(checklistByDay[date]||[]).length>2&&<small>+{checklistByDay[date].length-2} checklist tasks</small>}</button>})}</div>
  <h3>Checklist Tasks on {selected.split("-").reverse().join("/")}</h3>
  <div className="check-table-wrap"><table><thead><tr><th>Checklist</th><th>Task</th><th>Open</th></tr></thead><tbody>{dayEvents.map((e,i)=><tr key={i}><td>{e.type}</td><td>{e.title}{e.type==="Checklist"&&e.status?` (${e.status})`:""}</td><td><button onClick={()=>navigate(e.path)}>View</button></td></tr>)}</tbody></table>{!dayEvents.length&&<p>No checklist tasks on this date.</p>}</div>
 </section></div>;
}
