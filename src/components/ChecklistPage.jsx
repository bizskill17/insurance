import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";

const iso = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const today = () => iso(new Date());
const display = s => s ? s.slice(0,10).split("-").reverse().join("/") : "—";
const post = data => ({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
async function request(path,options) {
  const response=await fetch(API_BASE+"/checklists/"+path,options);
  const result=await response.json();
  if(!response.ok) throw Error(result.message||"Request failed");
  return result.data;
}
const frequencies=["daily","weekly","monthly","quarterly","annually"];
export default function ChecklistPage({mode,currentUser}) {
  const [lists,setLists]=useState([]),[tasks,setTasks]=useState([]),[users,setUsers]=useState([]);
  const [items,setItems]=useState([]),[name,setName]=useState("");
  const [selectedList,setSelectedList]=useState(""),[title,setTitle]=useState("");
  const [assigned,setAssigned]=useState(""),[frequency,setFrequency]=useState("daily");
  const [start,setStart]=useState(today()),[excludeSundays,setExcludeSundays]=useState(false);
  const [from,setFrom]=useState(iso(new Date(new Date().getFullYear(),new Date().getMonth(),1)));
  const [to,setTo]=useState(today()),[employee,setEmployee]=useState("");
  const [error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const [modal,setModal]=useState(""),[search,setSearch]=useState(""),[filterEmployee,setFilterEmployee]=useState(""),[filterFrequency,setFilterFrequency]=useState("");
  const admin=Boolean(currentUser?.can_manage_organizations||(currentUser?.views||[]).includes("/masters/users"));
  const myId=String(currentUser?.id||"");
  const reload=async()=>{const [a,b,c]=await Promise.all([request("lists"),request("tasks"),request("users")]);setLists(a);setTasks(b);setUsers(c);};
  const reloadItems=async()=>setItems(await request("occurrences?from="+from+"&to="+to));
  useEffect(()=>{reload().catch(e=>setError(e.message));},[]);
  useEffect(()=>{if(mode!=="master")reloadItems().catch(e=>setError(e.message));},[from,to,mode]);
  const run=async fn=>{setBusy(true);setError("");setMessage("");try{await fn();setMessage("Saved successfully.");}catch(e){setError(e.message);}finally{setBusy(false);}};
  const visible=useMemo(()=>items.filter(i=>(!["mine","scoreboard-mine"].includes(mode)||String(i.assigned_user_id)===myId)&&(!employee||String(i.assigned_user_id)===employee)),[items,mode,myId,employee]);
  const due=visible.filter(i=>i.due_date<=today()),completed=due.filter(i=>i.completed_at),pending=due.filter(i=>!i.completed_at);
  const filteredTasks=useMemo(()=>tasks.filter(t=>(!search||[t.checklist_name,t.title,t.employee_name].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase())))&&(!filterEmployee||String(t.assigned_user_id)===filterEmployee)&&(!filterFrequency||t.frequency===filterFrequency)),[tasks,search,filterEmployee,filterFrequency]);
  const [detail,setDetail]=useState("all");
  const shown=detail==="completed"?completed:detail==="pending"?pending:visible;
  return <div className="check-page">
    <section className="check-card">
      <h2>{mode==="master"?"Checklist Master":mode==="mine"?"My Checklist":mode==="tracker"?"Checklist Tracker":mode==="scoreboard-mine"?"My Scoreboard":"Team Scoreboard"}</h2>
      {error&&<p className="check-error" role="alert">{error}</p>}{message&&<p className="check-success">{message}</p>}
      {mode==="master" ? (admin ? <>
        <div className="check-master-toolbar">
          <div className="check-master-actions">
            <button type="button" onClick={()=>{setError("");setMessage("");setModal("checklist");}}>+ Add Checklist</button>
            <button type="button" onClick={()=>{setError("");setMessage("");setModal("task");}}>+ Add Task</button>
          </div>
          <div className="check-master-filters">
            <input aria-label="Search checklists and tasks" placeholder="Search checklist or task..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <select aria-label="Filter employee" value={filterEmployee} onChange={e=>setFilterEmployee(e.target.value)}><option value="">All Employees</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select>
            <select aria-label="Filter frequency" value={filterFrequency} onChange={e=>setFilterFrequency(e.target.value)}><option value="">All Frequencies</option>{frequencies.map(f=><option key={f} value={f}>{f[0].toUpperCase()+f.slice(1)}</option>)}</select>
          </div>
        </div>
        <div className="check-table-wrap"><table><thead><tr><th>Checklist</th><th>Task</th><th>Employee</th><th>Frequency</th><th>Effective From</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredTasks.map(t=><tr key={t.id}><td>{t.checklist_name}</td><td>{t.title}</td><td>{t.employee_name}</td><td>{t.frequency}</td><td>{display(t.start_date)}</td><td>{Number(t.active)&&Number(t.checklist_active)?"Active":"Inactive"}</td><td><button type="button" disabled={busy} onClick={()=>run(async()=>{await request("tasks",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,active:!Number(t.active)})});await reload();})}>{Number(t.active)?"Deactivate":"Activate"}</button></td></tr>)}</tbody></table>{!filteredTasks.length&&<p>No matching checklist tasks.</p>}</div>
        {modal&&<div className="check-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setModal("");}}>
          <section className="check-modal" role="dialog" aria-modal="true" aria-label={modal==="checklist"?"Add Checklist":"Add Recurring Task"}>
            <div className="check-modal-header"><h3>{modal==="checklist"?"Add Checklist":"Add Recurring Task"}</h3><button type="button" aria-label="Close form" onClick={()=>setModal("")} disabled={busy}>×</button></div>
            {modal==="checklist"?
              <form onSubmit={e=>{e.preventDefault();run(async()=>{await request("lists",post({title:name}));setName("");await reload();setModal("");});}}>
                <label>Checklist Name *<input required autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Enter checklist name"/></label>
                <div className="check-modal-footer"><button type="button" onClick={()=>setModal("")} disabled={busy}>Cancel</button><button disabled={busy}>Save Checklist</button></div>
              </form>:
              <form onSubmit={e=>{e.preventDefault();run(async()=>{await request("tasks",post({checklist_id:selectedList,title,assigned_user_id:assigned,frequency,start_date:start,exclude_sundays:excludeSundays}));setTitle("");await reload();setModal("");});}}>
                <div className="check-modal-fields">
                  <label>Checklist *<select required value={selectedList} onChange={e=>setSelectedList(e.target.value)}><option value="">Select Checklist</option>{lists.filter(x=>Number(x.active)).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
                  <label>Task *<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task description"/></label>
                  <label>Assigned User *<select required value={assigned} onChange={e=>setAssigned(e.target.value)}><option value="">Select User</option>{users.map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></label>
                  <label>Frequency *<select value={frequency} onChange={e=>setFrequency(e.target.value)}>{frequencies.map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}</select></label>
                  <label>Effective Start Date *<input type="date" required value={start} onChange={e=>setStart(e.target.value)}/></label>
                  <label className="check-checkbox"><input type="checkbox" checked={excludeSundays} onChange={e=>setExcludeSundays(e.target.checked)}/>Exclude Sundays</label>
                </div>
                <div className="check-modal-footer"><button type="button" onClick={()=>setModal("")} disabled={busy}>Cancel</button><button disabled={busy}>Save Task</button></div>
              </form>
            }
            {error&&<p className="check-error" role="alert">{error}</p>}
          </section>
        </div>}
      </>:<p>Checklist management is available to authorised administrators.</p>) : <>
        <div className="check-filters">
          <label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
          <label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
          {!["mine","scoreboard-mine"].includes(mode)&&<label>Employee<select value={employee} onChange={e=>setEmployee(e.target.value)}><option value="">All Employees</option>{users.map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></label>}
        </div>
        <div className="check-stats">
          <button onClick={()=>setDetail("all")}>Due <strong>{due.length}</strong></button>
          <button onClick={()=>setDetail("completed")}>Completed <strong>{completed.length}</strong></button>
          <button onClick={()=>setDetail("pending")}>Not Done <strong>{pending.length}</strong></button>
          <div>Completion Score <strong>{due.length?Math.round(completed.length/due.length*100):0}%</strong></div>
        </div>
        {["scoreboard","scoreboard-mine"].includes(mode)&&<div className="check-table-wrap"><table><thead><tr><th>Employee</th><th>Due</th><th>Completed</th><th>Not Done</th><th>Score</th></tr></thead><tbody>{users.filter(u=>(mode!=="scoreboard-mine"||String(u.id)===myId)&&(!employee||String(u.id)===employee)).map(u=>{const rows=due.filter(i=>String(i.assigned_user_id)===String(u.id));const done=rows.filter(i=>i.completed_at).length;return <tr key={u.id}><td>{u.full_name}</td><td>{rows.length}</td><td>{done}</td><td>{rows.length-done}</td><td>{rows.length?Math.round(done/rows.length*100):0}%</td></tr>})}</tbody></table></div>}
        <h3>{detail==="pending"?"Not Done Tasks":detail==="completed"?"Completed Tasks":"Task Details"}</h3>
        <div className="check-table-wrap"><table><thead><tr><th>Due Date</th><th>Checklist</th><th>Task</th><th>Employee</th><th>Frequency</th><th>Status</th>{mode==="mine"&&<th>Action</th>}</tr></thead><tbody>{shown.map(i=><tr key={i.task_id+"-"+i.due_date}><td>{display(i.due_date)}</td><td>{i.checklist_name}</td><td>{i.title}</td><td>{i.employee_name}</td><td>{i.frequency}</td><td>{i.status}</td>{mode==="mine"&&<td>{!i.completed_at&&i.due_date<=today()&&<button disabled={busy} onClick={()=>run(async()=>{await request("complete",post({task_id:i.task_id,due_date:i.due_date}));await reloadItems();})}>Complete</button>}</td>}</tr>)}</tbody></table>{!shown.length&&<p>No checklist tasks found for this period.</p>}</div>
      </>}
    </section>
  </div>;
}
