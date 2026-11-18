import {useEffect,useMemo,useState} from "react";
import {API_BASE} from "../config/api";

const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const displayDate=s=>s.split("-").reverse().join("/");
const today=()=>iso(new Date());
export default function CalendarPage({currentUser}){
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const [selected,setSelected]=useState(today());
 const [open,setOpen]=useState(false);
 const [events,setEvents]=useState([]),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [busy,setBusy]=useState(false),[checked,setChecked]=useState({});
 const admin=Boolean(currentUser?.can_manage_organizations||(currentUser?.views||[]).includes("/masters/users"));
 const myId=String(currentUser?.id||"");
 const first=iso(new Date(month.getFullYear(),month.getMonth(),1));
 const last=iso(new Date(month.getFullYear(),month.getMonth()+1,0));
 const load=async()=>{
  const r=await fetch(API_BASE+"/checklists/occurrences?from="+first+"&to="+last);
  const raw=await r.text();let j;try{j=JSON.parse(raw);}catch{throw Error("Checklist server returned an invalid response.");}
  if(!r.ok)throw Error(j.message||"Checklist events could not be loaded.");
  setEvents(j.data||[]);setError("");
 };
 useEffect(()=>{let active=true;(async()=>{try{const r=await fetch(API_BASE+"/checklists/occurrences?from="+first+"&to="+last);const raw=await r.text();let j;try{j=JSON.parse(raw);}catch{throw Error("Checklist server returned an invalid response.");}if(!r.ok)throw Error(j.message||"Checklist events could not be loaded.");if(active){setEvents(j.data||[]);setError("");}}catch(e){if(active){setEvents([]);setError(e.message);}}})();return()=>{active=false};},[first,last]);
 const visible=useMemo(()=>events.filter(e=>admin||String(e.assigned_user_id)===myId),[events,admin,myId]);
 const dayEvents=useMemo(()=>visible.filter(e=>e.due_date===selected),[visible,selected]);
 const checklistByDay=useMemo(()=>{const m={};visible.forEach(e=>{(m[e.due_date]??=[]).push(e);});return m;},[visible]);
 const openDay=date=>{setSelected(date);setChecked({});setError("");setMessage("");setOpen(true);};
 const toggle=(key,value)=>setChecked(old=>({...old,[key]:value}));
 const isChecked=e=>checked[e.task_id+"|"+e.due_date]??Boolean(e.completed_at);
 const save=async()=>{
  const pending=dayEvents.filter(e=>!e.completed_at&&isChecked(e));
  if(!pending.length){setOpen(false);return;}
  setBusy(true);setError("");setMessage("");
  try{
   for(const e of pending){
    const r=await fetch(API_BASE+"/checklists/complete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task_id:e.task_id,due_date:e.due_date})});
    const raw=await r.text();let j;try{j=JSON.parse(raw);}catch{throw Error("Server returned an invalid response.");}
    if(!r.ok)throw Error(j.message||"Could not update task.");
   }
   await load();setOpen(false);setMessage(pending.length+" task"+(pending.length===1?"":"s")+" completed successfully.");
  }catch(e){setError(e.message);try{await load();}catch{}}finally{setBusy(false);}
 };
 const offset=(month.getDay()+6)%7;const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const eligible=dayEvents.filter(e=>!e.completed_at&&e.due_date<=today());
 const allSelected=eligible.length>0&&eligible.every(isChecked);
 return <div className="check-page"><section className="check-card">
  <h2>Calendar</h2>
  {error&&<p className="check-error" role="alert">{error}</p>}
  {message&&<p className="check-success">{message}</p>}
  <div className="check-calendar-toolbar"><button onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}>‹ Previous</button><h3>{month.toLocaleString("en-IN",{month:"long",year:"numeric"})}</h3><button onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}>Next ›</button></div>
  <div className="check-calendar-grid">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=><strong key={d}>{d}</strong>)}{Array.from({length:offset},(_,i)=><span key={"blank"+i}/>)}{Array.from({length:days},(_,i)=>{const date=iso(new Date(month.getFullYear(),month.getMonth(),i+1));const rows=checklistByDay[date]||[];return <button key={date} type="button" className={[selected===date?"selected":"",date===today()?"is-today":"",date<today()&&rows.some(e=>!e.completed_at)?"is-overdue":""].filter(Boolean).join(" ")} onClick={()=>openDay(date)}><span>{i+1}</span>{rows.slice(0,2).map(e=><span key={e.task_id} className={"check-calendar-task "+(e.completed_at?"is-done":"")} title={e.title+" — "+(e.employee_name||"Unassigned")}>{e.completed_at?"✓ ":"☐ "}{e.title} — {e.employee_name||"Unassigned"}</span>)}{rows.length>2&&<small>+{rows.length-2} checklist tasks</small>}{rows.length>0&&<span className="check-calendar-hover" aria-hidden="true"><strong>{displayDate(date)}</strong>{rows.map(e=><span key={e.task_id+"|"+e.due_date} className="check-calendar-hover-row"><span>{e.completed_at?"✓":"☐"} {e.title}</span><small>{e.checklist_name} · {e.employee_name||"Unassigned"} · {e.completed_at?"Completed":"Pending"}</small></span>)}</span>}</button>})}</div>
 </section>
 {open&&<div className="check-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false);}}>
  <section className="check-modal" role="dialog" aria-modal="true" aria-label={"Checklist Tasks on "+displayDate(selected)} style={{maxWidth:760,width:"min(760px,calc(100vw - 32px))"}}>
   <div className="check-modal-header"><h3>Checklist Tasks — {displayDate(selected)}</h3><button type="button" aria-label="Close" disabled={busy} onClick={()=>setOpen(false)}>×</button></div>
   {eligible.length>1&&<label className="check-checkbox" style={{display:"flex",alignItems:"center",gap:8,margin:"12px 0"}}><input type="checkbox" checked={allSelected} disabled={busy} onChange={e=>{const next={...checked};eligible.forEach(x=>{next[x.task_id+"|"+x.due_date]=e.target.checked;});setChecked(next);}}/>Select All Tasks</label>}
   <div className="check-table-wrap"><table><thead><tr><th>Done</th><th>Checklist</th><th>Task</th><th>Employee</th></tr></thead><tbody>{dayEvents.map(e=><tr key={e.task_id+"|"+e.due_date}><td><input type="checkbox" aria-label={"Complete "+e.title} checked={isChecked(e)} disabled={busy||Boolean(e.completed_at)||e.due_date>today()} onChange={x=>toggle(e.task_id+"|"+e.due_date,x.target.checked)}/></td><td>{e.checklist_name}</td><td>{e.title}</td><td>{e.employee_name||"Unassigned"}</td></tr>)}</tbody></table>{!dayEvents.length&&<p>No checklist tasks on this date.</p>}</div>
   {selected>today()&&dayEvents.length>0&&<p>Future tasks can be marked complete on or after their due date.</p>}
   {error&&<p className="check-error" role="alert">{error}</p>}
   <div className="check-modal-footer"><button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button type="button" disabled={busy||!eligible.some(isChecked)} onClick={save}>{busy?"Updating...":"Update Task(s)"}</button></div>
  </section>
 </div>}
 </div>;
}
