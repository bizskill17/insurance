import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../config/api";

const iso = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const today = () => iso(new Date());
const display = s => s ? s.slice(0,10).split("-").reverse().join("/") : "—";
let checklistActorId = '';
const post = data => ({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
async function request(path,options) {
  const response=await fetch(API_BASE+"/checklists/"+path,{...options,headers:{...(options?.headers||{}),"X-Checklist-Actor-Id":checklistActorId}});
  const result=await response.json();
  if(!response.ok) throw Error(result.message||"Request failed");
  return result.data;
}
const frequencies=["daily","weekly","monthly","quarterly","annually"];
const weekdays=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
export default function ChecklistPage({mode,currentUser}) {
  const [lists,setLists]=useState([]),[tasks,setTasks]=useState([]),[users,setUsers]=useState([]);
  const [items,setItems]=useState([]),[name,setName]=useState("");
  const [selectedList,setSelectedList]=useState(""),[title,setTitle]=useState("");
  const [assigned,setAssigned]=useState(""),[frequency,setFrequency]=useState("daily");
  const [start,setStart]=useState(today()),[excludeSundays,setExcludeSundays]=useState(false);
  const [weekday,setWeekday]=useState("1"),[monthDay,setMonthDay]=useState("1"),[quarterOffset,setQuarterOffset]=useState("0"),[annualMonth,setAnnualMonth]=useState("1"),[sundayAction,setSundayAction]=useState("skip");
  const [from,setFrom]=useState(iso(new Date(new Date().getFullYear(),new Date().getMonth(),1)));
  const [to,setTo]=useState(today()),[employee,setEmployee]=useState("");
  const [error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const [editingTaskId,setEditingTaskId]=useState(null); const [modal,setModal]=useState(""),[search,setSearch]=useState(""),[filterEmployee,setFilterEmployee]=useState(""),[filterFrequency,setFilterFrequency]=useState("");
  const [openChecklist,setOpenChecklist]=useState("");
  const [taskToDelete,setTaskToDelete]=useState(null);
  const [listToDelete,setListToDelete]=useState(null);
  const admin=Boolean(currentUser?.can_manage_organizations||(currentUser?.views||[]).includes("/masters/users"));
  const myId=String(currentUser?.id||"");
  checklistActorId=myId;
  const [history,setHistory]=useState([]);
  const [historyDeleteId,setHistoryDeleteId]=useState(null);
  const [historyEmployee,setHistoryEmployee]=useState(""),[historyChecklist,setHistoryChecklist]=useState(""),[historyAction,setHistoryAction]=useState(""),[historyPage,setHistoryPage]=useState(1);
  const reload=async()=>{const [a,b,c]=await Promise.all([request("lists"),request("tasks"),request("users")]);setLists(a);setTasks(b);setUsers(c);};
  const reloadItems=async()=>setItems(await request("occurrences?from="+from+"&to="+to));
  useEffect(()=>{if(mode!=="history")reload().catch(e=>setError(e.message));},[mode]);
  useEffect(()=>{if(mode==="history"){setError("");request("history?from="+from+"&to="+to).then(setHistory).catch(e=>setError(e.message));}},[mode,from,to]);
  useEffect(()=>{setHistoryPage(1);},[search,historyEmployee,historyChecklist,historyAction,from,to]);
  useEffect(()=>{if(mode!=="master"&&mode!=="history")reloadItems().catch(e=>setError(e.message));},[from,to,mode]);
  const run=async fn=>{setBusy(true);setError("");setMessage("");try{await fn();setMessage("Saved successfully.");}catch(e){setError(e.message);}finally{setBusy(false);}};
  const visible=useMemo(()=>items.filter(i=>(!["mine","scoreboard-mine"].includes(mode)||String(i.assigned_user_id)===myId)&&(!employee||String(i.assigned_user_id)===employee)),[items,mode,myId,employee]);
  const due=visible.filter(i=>i.due_date<=today()),completed=due.filter(i=>i.completed_at),pending=due.filter(i=>!i.completed_at);
  const filteredTasks=useMemo(()=>tasks.filter(t=>(!search||[t.checklist_name,t.title,t.employee_name].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase())))&&(!filterEmployee||String(t.assigned_user_id)===filterEmployee)&&(!filterFrequency||t.frequency===filterFrequency)),[tasks,search,filterEmployee,filterFrequency]);
  const visibleLists=useMemo(()=>lists.filter(l=>!search||String(l.title||"").toLowerCase().includes(search.toLowerCase())||filteredTasks.some(t=>String(t.checklist_id)===String(l.id))),[lists,search,filteredTasks]);
  const openTaskEdit=t=>{
    setEditingTaskId(Number(t.id));setSelectedList(String(t.checklist_id));setTitle(t.title||"");
    setAssigned(String(t.assigned_user_id));setFrequency(t.frequency||"daily");
    setStart(String(t.start_date||"").slice(0,10));setExcludeSundays(Boolean(Number(t.exclude_sundays)));
    setWeekday(String(t.weekday_num||1));setMonthDay(String(t.month_day||1));
    setQuarterOffset(String(t.quarter_offset??0));setAnnualMonth(String(t.annual_month||1));
    setSundayAction(t.sunday_action||"skip");setError("");setMessage("");setModal("task");
  };
  const openTaskAdd=()=>{setEditingTaskId(null);setSelectedList("");setTitle("");setAssigned("");setFrequency("daily");setStart(today());setExcludeSundays(false);setWeekday("1");setMonthDay("1");setQuarterOffset("0");setAnnualMonth("1");setSundayAction("skip");setError("");setMessage("");setModal("task");};
  const [detail,setDetail]=useState("all");
  const shown=detail==="completed"?completed:detail==="pending"?pending:visible;
  return <div className="check-page">
    <section className="check-card">
      {!["history","master","mine","tracker"].includes(mode)&&<h2>{mode==="scoreboard-mine"?"My Scoreboard":"Team Scoreboard"}</h2>}
      {error&&<p className="check-error" role="alert">{error}</p>}{message&&<p className="check-success">{message}</p>}
      {mode==="history"&&historyDeleteId!==null&&<div className="check-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setHistoryDeleteId(null);}}>
        <section className="check-modal" role="dialog" aria-modal="true" aria-label="Delete update history record">
          <div className="check-modal-header"><h3>Delete History Record</h3><button type="button" disabled={busy} onClick={()=>setHistoryDeleteId(null)}>×</button></div>
          <p>Delete this update history record permanently? The original checklist task and its completion status will remain unchanged.</p>
          <div className="check-modal-footer"><button type="button" disabled={busy} onClick={()=>setHistoryDeleteId(null)}>Cancel</button><button type="button" disabled={busy} className="check-history-delete" onClick={()=>run(async()=>{await request("history",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:historyDeleteId})});setHistory(current=>current.filter(h=>String(h.id)!==String(historyDeleteId)));setHistoryDeleteId(null);})}>Delete Record</button></div>
        </section>
      </div>}
      {mode==="history" ? (admin ? <HistoryTable history={history} from={from} to={to} setFrom={setFrom} setTo={setTo} search={search} setSearch={setSearch} employee={historyEmployee} setEmployee={setHistoryEmployee} checklist={historyChecklist} setChecklist={setHistoryChecklist} action={historyAction} setAction={setHistoryAction} page={historyPage} setPage={setHistoryPage} onDelete={id=>setHistoryDeleteId(id)}/> : <p>Access restricted to administrators.</p>) : mode==="master" ? (admin ? <>
        <div className="check-master-toolbar">
          <div className="check-master-actions">
            <button type="button" onClick={()=>{setError("");setMessage("");setModal("checklist");}}>+ Add Checklist</button>
            <button type="button" onClick={openTaskAdd}>+ Add Task</button>
          </div>
          <div className="check-master-filters">
            <input aria-label="Search checklists and tasks" placeholder="Search checklist or task..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <select aria-label="Filter employee" value={filterEmployee} onChange={e=>setFilterEmployee(e.target.value)}><option value="">All Employees</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select>
            <select aria-label="Filter frequency" value={filterFrequency} onChange={e=>setFilterFrequency(e.target.value)}><option value="">All Frequencies</option>{frequencies.map(f=><option key={f} value={f}>{f[0].toUpperCase()+f.slice(1)}</option>)}</select>
          </div>
        </div>
        <div className="check-group-list" aria-label="Checklist groups">
          {visibleLists.map((l,index)=>{
            const rows=filteredTasks.filter(t=>String(t.checklist_id)===String(l.id));
            const expanded=openChecklist===String(l.id);
            const hasTasks=tasks.some(t=>String(t.checklist_id)===String(l.id));
            return <div key={l.id} className="check-group-entry"><button type="button" className={"check-group-button check-group-button--"+(index%8)+(expanded?" is-selected":"")} aria-expanded={expanded} onClick={()=>setOpenChecklist(expanded?"":String(l.id))}>
              <span aria-hidden="true">☷</span><span>{l.title}</span><span className="check-group-count">{rows.length}</span>
            </button>{!hasTasks&&<button type="button" className="check-group-delete" disabled={busy} title={"Delete "+l.title} aria-label={"Delete checklist "+l.title} onClick={()=>{setListToDelete(l);setError("");}}>Delete</button>}</div>;
          })}
        </div>
        {visibleLists.length===0&&<p>No matching checklists.</p>}
        {visibleLists.filter(l=>String(l.id)===openChecklist).map(l=>{
          const rows=filteredTasks.filter(t=>String(t.checklist_id)===String(l.id));
          return <div key={l.id} className={"check-group-details check-group-details--"+(visibleLists.findIndex(x=>String(x.id)===String(l.id))%8)}>
            <div className="check-group-heading"><h3>☷ &nbsp;{l.title} — Tasks</h3><span>{rows.length} task{rows.length===1?"":"s"}</span></div>
            <div className="check-table-wrap"><table><thead><tr><th>#</th><th>Task</th><th>Employee</th><th>Frequency</th><th>Effective From</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((t,i)=><tr key={t.id}><td>{i+1}</td><td>{t.title}</td><td>{t.employee_name}</td><td><span className="check-frequency-pill">{t.frequency}</span></td><td>{display(t.start_date)}</td><td><span className={"check-status-pill"+(Number(t.active)&&Number(t.checklist_active)?"":" is-inactive")}>{Number(t.active)&&Number(t.checklist_active)?"Active":"Inactive"}</span></td><td><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><button type="button" disabled={busy} onClick={()=>openTaskEdit(t)}>Edit</button><button type="button" disabled={busy} onClick={()=>run(async()=>{await request("tasks",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id,active:!Number(t.active)})});await reload();})}>{Number(t.active)?"Deactivate":"Activate"}</button><button type="button" disabled={busy} style={{color:"#c81919",border:"1px solid #ef4444",background:"#fff5f5"}} onClick={()=>{setTaskToDelete(t);setModal("delete");setError("");}}>Delete</button></div></td></tr>)}</tbody></table>{rows.length===0&&<p>No matching tasks in this checklist.</p>}</div>
          </div>;
        })}
        {listToDelete&&<div className="check-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setListToDelete(null);}}>
          <section className="check-modal" role="dialog" aria-modal="true" aria-label="Delete checklist">
            <div className="check-modal-header"><h3>Delete Checklist</h3><button type="button" disabled={busy} onClick={()=>setListToDelete(null)}>×</button></div>
            <p>Delete checklist <strong>{listToDelete.title}</strong>? This is permanent. Checklist update history will be retained.</p>
            <div className="check-modal-footer"><button type="button" disabled={busy} onClick={()=>setListToDelete(null)}>Cancel</button><button type="button" disabled={busy} className="check-history-delete" onClick={()=>run(async()=>{await request("lists",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:listToDelete.id})});if(openChecklist===String(listToDelete.id))setOpenChecklist("");setListToDelete(null);await reload();})}>Delete Checklist</button></div>
          </section>
        </div>}
        {modal==="delete"&&taskToDelete&&<div className="check-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy){setModal("");setTaskToDelete(null);}}}>
          <section className="check-modal" role="dialog" aria-modal="true" aria-label="Delete checklist task">
            <div className="check-modal-header"><h3>Delete Task</h3><button type="button" disabled={busy} onClick={()=>{setModal("");setTaskToDelete(null);}}>×</button></div>
            <p>Choose how to delete <strong>{taskToDelete.title}</strong>.</p>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:16}}>
              <button type="button" disabled={busy} onClick={()=>run(async()=>{await request("tasks",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:taskToDelete.id,mode:"task_only"})});setModal("");setTaskToDelete(null);await reload();})}>Delete Task Only — Keep History</button>
              <button type="button" disabled={busy} style={{color:"#c81919",border:"1px solid #ef4444",background:"#fff5f5"}} onClick={()=>run(async()=>{await request("tasks",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:taskToDelete.id,mode:"with_history"})});setModal("");setTaskToDelete(null);await reload();})}>Delete Task with History — Permanent</button>
              <button type="button" disabled={busy} onClick={()=>{setModal("");setTaskToDelete(null);}}>Cancel</button>
            </div>
          </section>
        </div>}
        {modal&&modal!=="delete"&&<div className="check-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setModal("");}}>
          <section className="check-modal" role="dialog" aria-modal="true" aria-label={modal==="checklist"?"Add Checklist":editingTaskId?"Edit Recurring Task":"Add Recurring Task"}>
            <div className="check-modal-header"><h3>{modal==="checklist"?"Add Checklist":editingTaskId?"Edit Recurring Task":"Add Recurring Task"}</h3><button type="button" aria-label="Close form" onClick={()=>setModal("")} disabled={busy}>×</button></div>
            {modal==="checklist"?
              <form onSubmit={e=>{e.preventDefault();run(async()=>{await request("lists",post({title:name}));setName("");await reload();setModal("");});}}>
                <label>Checklist Name *<input required autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Enter checklist name"/></label>
                <div className="check-modal-footer"><button type="button" onClick={()=>setModal("")} disabled={busy}>Cancel</button><button disabled={busy}>Save Checklist</button></div>
              </form>:
              <form onSubmit={e=>{e.preventDefault();run(async()=>{await request("tasks",editingTaskId?{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:editingTaskId,edit_details:true,checklist_id:selectedList,title,assigned_user_id:assigned,frequency,start_date:start,exclude_sundays:excludeSundays,weekday_num:Number(weekday),month_day:Number(monthDay),quarter_offset:Number(quarterOffset),annual_month:Number(annualMonth),sunday_action:sundayAction})}:post({checklist_id:selectedList,title,assigned_user_id:assigned,frequency,start_date:start,exclude_sundays:excludeSundays,weekday_num:Number(weekday),month_day:Number(monthDay),quarter_offset:Number(quarterOffset),annual_month:Number(annualMonth),sunday_action:sundayAction}));setTitle("");await reload();setModal("");});}}>
                <div className="check-modal-fields">
                  <label>Checklist *<select required value={selectedList} onChange={e=>setSelectedList(e.target.value)}><option value="">Select Checklist</option>{lists.filter(x=>Number(x.active)).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
                  <label>Task *<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task description"/></label>
                  <label>Assigned User *<select required value={assigned} onChange={e=>setAssigned(e.target.value)}><option value="">Select User</option>{users.map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></label>
                  <label>Frequency *<select value={frequency} onChange={e=>setFrequency(e.target.value)}>{frequencies.map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}</select></label>
                  {frequency==="weekly"&&<label>Week Day *<select value={weekday} onChange={e=>setWeekday(e.target.value)}>{weekdays.map((d,i)=><option key={d} value={i+1}>{d}</option>)}</select></label>}
                  {frequency==="monthly"&&<label>Day of Month *<select value={monthDay} onChange={e=>setMonthDay(e.target.value)}>{Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>}
                  {frequency==="quarterly"&&<label>Days After Quarter Ending *<input type="number" min="0" max="365" required value={quarterOffset} onChange={e=>setQuarterOffset(e.target.value)}/></label>}
                  {frequency==="annually"&&<>
                    <label>Month *<select value={annualMonth} onChange={e=>setAnnualMonth(e.target.value)}>{months.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select></label>
                    <label>Day *<select value={monthDay} onChange={e=>setMonthDay(e.target.value)}>{Array.from({length:new Date(2024,Number(annualMonth),0).getDate()},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
                  </>}
                  <label>Effective Start Date *<input type="date" required value={start} onChange={e=>setStart(e.target.value)}/></label>
                  <label className="check-checkbox"><input type="checkbox" checked={excludeSundays} onChange={e=>setExcludeSundays(e.target.checked)}/>Exclude Sundays</label>
                  {excludeSundays&&<label>When due on Sunday<select value={sundayAction} onChange={e=>setSundayAction(e.target.value)}><option value="skip">Skip occurrence</option><option value="monday">Move to Monday</option></select></label>}
                </div>
                <div className="check-modal-footer"><button type="button" onClick={()=>setModal("")} disabled={busy}>Cancel</button><button disabled={busy}>{editingTaskId?"Update Task":"Save Task"}</button></div>
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

function HistoryTable({history,from,to,setFrom,setTo,search,setSearch,employee,setEmployee,checklist,setChecklist,action,setAction,page,setPage,onDelete}) {
  const employees=[...new Set(history.map(h=>h.employee_name).filter(Boolean))].sort();
  const checklists=[...new Set(history.map(h=>h.checklist_name).filter(Boolean))].sort();
  const actions=[...new Set(history.map(h=>h.action).filter(Boolean))].sort();
  const filtered=history.filter(h=>(!employee||h.employee_name===employee)&&(!checklist||h.checklist_name===checklist)&&(!action||h.action===action)&&(!search||[h.checklist_name,h.task_title,h.employee_name,h.action,h.updated_by,h.details].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase()))));
  const pages=Math.max(1,Math.ceil(filtered.length/20));
  const current=Math.min(page,pages);
  const rows=filtered.slice((current-1)*20,current*20);
  const actionTone=value=>{const v=String(value||"").toLowerCase();return v.includes("delet")?"deleted":v.includes("complet")?"completed":v.includes("creat")?"created":v.includes("edit")||v.includes("updat")?"edited":v.includes("deactiv")?"deleted":"other";};
  return <>
    <div className="check-history-intro"><span className="check-history-symbol" aria-hidden="true">▤</span><div><strong>Update History</strong><p>All checklist and task updates (create, edit, complete, activate, deactivate and delete).</p></div></div>
    <div className="check-history-filters">
      <label>From Date<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label>To Date<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      <label>Employee<select aria-label="Employee" value={employee} onChange={e=>setEmployee(e.target.value)}><option value="">All Employees</option>{employees.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Checklist<select aria-label="Checklist" value={checklist} onChange={e=>setChecklist(e.target.value)}><option value="">All Checklists</option>{checklists.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Action<select aria-label="Action" value={action} onChange={e=>setAction(e.target.value)}><option value="">All Actions</option>{actions.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Search<input placeholder="Search task or checklist..." aria-label="Search history" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    </div>
    <div className="check-history-table-wrap"><table className="check-history-table"><thead><tr><th>#</th><th>Update Date &amp; Time</th><th>Checklist</th><th>Task</th><th>Employee</th><th>Action</th><th>Details</th><th>Updated By</th><th>Action</th></tr></thead><tbody>{rows.map((h,i)=><tr key={h.id}><td>{(current-1)*20+i+1}</td><td className="check-history-date">{h.updated_at?display(h.updated_at.slice(0,10))+" "+h.updated_at.slice(11,16):"—"}</td><td><span className="check-history-checklist">{h.checklist_name||"—"}</span></td><td>{h.task_title||"—"}</td><td>{h.employee_name||"—"}</td><td><span className={"check-history-pill check-history-pill--"+actionTone(h.action)}>{h.action}</span></td><td>{h.details||(h.due_date?"Task date: "+display(h.due_date):"—")}</td><td>{h.updated_by||"Not recorded"}</td><td><button type="button" className="check-history-delete" onClick={()=>onDelete(h.id)}>Delete</button></td></tr>)}</tbody></table></div>
    {!filtered.length&&<p>No update records found for the selected period and filters. Earlier changes made before history tracking was enabled are not available.</p>}
    <div className="check-history-footer">
      <span>Showing {filtered.length?(current-1)*20+1:0}–{Math.min(current*20,filtered.length)} of {filtered.length} records</span>
      <div className="check-history-pagination"><button type="button" disabled={current<=1} onClick={()=>setPage(current-1)}>Previous</button><span className="check-history-page">{current}</span><span>of {pages}</span><button type="button" disabled={current>=pages} onClick={()=>setPage(current+1)}>Next</button></div>
    </div>
  </>;
}
