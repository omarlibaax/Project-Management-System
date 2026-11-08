import { lazy, Suspense, useId, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api, csrf, message, type Profile } from '../api';
import type { Project, Page, User } from '../types';
import { Button } from '../components/ui/button';
import { Badge, Empty, ErrorNotice, Loading } from '../components/shared';

type Assignment = { id: number; engineer_id: number; full_name: string; assigned_at: string; revoked_at: string | null };
type Task = { id: number; title: string; engineer_id: number; full_name: string; start_date: string; due_date: string; planned_budget: string; authorized_plan: string | null; weight: string; progress: string; version: number };
type Resource = { id: number; task_id: number | null; name: string; kind: string; unit: string; planned: string; used: string; unit_cost: string; variance: string; usage_cost: string; version: number };
type Request = { id: number; kind: string; task_id: number | null; amount: string | null; requested_date: string | null; reason: string; submitted_by: number; full_name: string; submitted_at: string; state: string; review_note: string | null; reviewer_name: string | null; evidence_count: number; plan_snapshot: string | null };
type Evidence = { id: number; request_id: number; name: string };
type Workspace = { assignments: Assignment[]; tasks: Task[]; resources: Resource[]; requests: Request[]; evidence: Evidence[] };
type Values = Record<string, FormDataEntryValue>;
const ExecutionCharts = lazy(() => import('../components/ExecutionCharts'));
const standardLaborTypes = ['General laborer', 'Mason', 'Carpenter', 'Electrician', 'Plumber', 'Painter', 'Steel fixer', 'Welder', 'Machine operator', 'Foreman', 'Surveyor', 'Driver', 'Roofer', 'Tiler'];

function Field({ name, title, type = 'text', children, ...props }: { name: string; title: string; type?: string; children?: ReactNode; min?: string; max?: string; step?: string; defaultValue?: string; maxLength?: number; required?: boolean }) {
  const id = useId();
  return <div className="execution-field"><label htmlFor={id}>{title}</label>{children ? <select id={id} name={name} required {...props}>{children}</select> : <input id={id} name={name} type={type} required {...props} />}</div>;
}
function ActionForm({ title, busy, submit, children }: { title: string; busy: boolean; submit: (values: Values) => Promise<boolean>; children: ReactNode }) {
  return <form className="execution-form" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget;
    if (await submit(Object.fromEntries(new FormData(form)))) form.reset();
  }}><h3>{title}</h3><div className="form-grid">{children}</div><Button disabled={busy}>{busy ? 'Saving…' : title}</Button></form>;
}

export default function Execution({ project, user }: { project: Project; user: Profile }) {
  const id = project.id;
  const manager = user.roles.some(r => ['ADMIN', 'SUPER_ADMIN'].includes(r));
  const writable = !project.archived && !['COMPLETED', 'CANCELLED', 'PENDING_APPROVAL'].includes(project.status);
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [kind, setKind] = useState('WORK_PLAN');
  const [resourceKind, setResourceKind] = useState('LABOR');
  const [laborType, setLaborType] = useState('');
  const query = useQuery({ queryKey: ['execution', id], queryFn: async () => (await api.get<Workspace>(`/projects/${id}/execution`)).data });
  const [engineerSearch, setEngineerSearch] = useState('');
  const engineers = useQuery({ queryKey: ['execution-engineers', engineerSearch], enabled: manager && writable,
    queryFn: async () => (await api.get<Page<User>>('/engineers', { params: { size: 100, search: engineerSearch } })).data });
  async function run(path: string, payload?: unknown, method: 'post' | 'patch' | 'delete' = 'post') {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.request({ method, url: `/projects/${id}/${path}`, data: payload, headers: await csrf() });
      await Promise.all(['execution', 'project', 'projects', 'schedule', 'dashboard', 'notifications'].map(key => client.invalidateQueries({ queryKey: key === 'project' || key === 'schedule' || key === 'execution' ? [key, id] : [key] })));
      setNotice('Saved successfully.'); return true;
    } catch (e) { setError(message(e)); return false; }
    finally { setBusy(false); }
  }
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNotice error={query.error} retry={() => query.refetch()} />;
  const data = query.data;
  const active = data.assignments.filter(a => !a.revoked_at);
  const laborTypes = [...new Set([...standardLaborTypes, ...data.resources.filter(r => r.kind === 'LABOR').map(r => r.name)])].sort((a, b) => a.localeCompare(b));
  const owners = <><option value="">Select assigned engineer</option>{active.map(a => <option key={a.id} value={a.engineer_id}>{a.full_name}</option>)}</>;
  return <div className="execution">
    <section className="panel">
      <div className="form-footer"><h2>Project execution</h2><a className="text-link" href={`/api/projects/${id}/report.xlsx`}>Export Excel</a><a className="text-link" href={`/api/projects/${id}/report.pdf`}>Export PDF</a><a className="text-link" href={`/api/projects/${id}/report.csv`}>CSV</a><Button variant="outline" onClick={() => window.print()}>Print</Button></div>
      <dl className="detail-list"><div><dt>Approved budget</dt><dd>{project.approvedBudget}</dd></div><div><dt>Approved expenditure</dt><dd>{project.actualExpenditure}</dd></div><div><dt>Current deadline</dt><dd>{project.revisedEndDate ?? project.plannedEndDate}</dd></div></dl>
      {error && <p role="alert" className="notice error">{error}</p>}{notice && <p role="status">{notice}</p>}
      {project.scheduleCondition === 'DELAYED' && writable && <p className="notice">This project is delayed. Engineers must submit a Delay explanation before further progress or completion. An explanation does not change the deadline.</p>}
      <h3>Engineer assignments</h3>
      {data.assignments.length === 0 ? <p>No engineers assigned.</p> : <ul>{data.assignments.map(a => <li key={a.id}>{a.full_name} · {a.revoked_at ? 'Revoked' : 'Active'} · {new Date(a.assigned_at).toLocaleDateString()}{manager && writable && !a.revoked_at && <Button variant="outline" disabled={busy} onClick={() => run(`assignments/${a.id}`, undefined, 'delete')}>Revoke</Button>}</li>)}</ul>}
      {manager && writable && <>
        <label>Find engineer<input value={engineerSearch} onChange={e => setEngineerSearch(e.target.value)} placeholder="Search the engineer directory" /></label>
        {engineers.isError && <ErrorNotice error={engineers.error} retry={() => engineers.refetch()} />}
        <ActionForm title="Assign engineer" busy={busy || engineers.isPending} submit={v => run('assignments', { engineerId: Number(v.engineerId) })}>
          <Field name="engineerId" title="Engineer"><option value="">Select engineer</option>{engineers.data?.items.filter(e => e.active && !active.some(a => a.engineer_id === e.id)).map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}</Field>
        </ActionForm>
      </>}
    </section>
    <section className="panel"><h2>Tasks & weighted progress</h2>
      {data.tasks.length === 0 ? <p>No tasks yet.</p> : <div className="table-scroll"><table><thead><tr><th>Task</th><th>Owner</th><th>Due</th><th>Weight</th><th>Approved progress</th>{manager && writable && <th>Transfer</th>}</tr></thead><tbody>{data.tasks.map(t => <tr key={t.id}><td>{t.title}</td><td>{t.full_name}</td><td>{t.due_date}</td><td>{t.weight}</td><td>{t.progress}%</td>{manager && writable && <td><ActionForm title="Transfer task" busy={busy} submit={v => run(`tasks/${t.id}/owner`, { engineerId: Number(v.engineerId) }, 'patch')}><Field name="engineerId" title={`New owner for ${t.title}`}>{owners}</Field></ActionForm></td>}</tr>)}</tbody></table></div>}
      {manager && writable && <ActionForm title="Create task" busy={busy} submit={v => run('tasks', { ...v, engineerId: Number(v.engineerId) })}>
        <Field name="title" title="Task title" maxLength={240} /><Field name="engineerId" title="Task owner">{owners}</Field><Field name="startDate" title="Work start date" type="date" min={project.plannedStartDate} max={project.revisedEndDate ?? project.plannedEndDate} defaultValue={project.plannedStartDate} /><Field name="dueDate" title="Due date" type="date" min={project.plannedStartDate} max={project.revisedEndDate ?? project.plannedEndDate} /><Field name="weight" title="Relative weight" type="number" min="0.01" max="9999999.99" step="0.01" /><Field name="plannedBudget" title="Work budget allocation" type="number" min="0" step="0.01" defaultValue="0" />
      </ActionForm>}
    </section>
    {data.tasks.length > 0 && <section className="panel"><h2>Upcoming work plans</h2><p>Review each work item's dates, budget breakdown, labor and materials before deciding whether it can proceed.</p>{data.tasks.map(t => <article className="request-card" key={t.id}><h3>{t.title}</h3><p>{t.start_date} to {t.due_date} · Budget: {t.planned_budget} · {t.authorized_plan ? 'Approved to proceed' : 'Manager approval required'}</p><div className="actions"><a className="text-link" href={`/api/projects/${id}/report.pdf?taskId=${t.id}`}>Work plan PDF</a><a className="text-link" href={`/api/projects/${id}/report.xlsx?taskId=${t.id}`}>Work plan Excel</a></div></article>)}</section>}
    {manager && writable && data.tasks.length > 0 && <section className="panel"><h2>Revise work plans</h2>{data.tasks.map(t => <details key={t.id}><summary>Revise work plan: {t.title}</summary><ActionForm title="Save work plan revision" busy={busy} submit={v => run(`tasks/${t.id}/plan`, { ...v, version: t.version }, 'patch')}><Field name="startDate" title={`Revised start: ${t.title}`} type="date" defaultValue={t.start_date} /><Field name="dueDate" title={`Revised end: ${t.title}`} type="date" defaultValue={t.due_date} /><Field name="plannedBudget" title={`Revised budget: ${t.title}`} type="number" min="0" step="0.01" defaultValue={t.planned_budget} /><Field name="reason" title="Work revision reason" maxLength={1000} /></ActionForm></details>)}</section>}
    {data.tasks.length > 0 && <Suspense fallback={<Loading />}><ExecutionCharts tasks={data.tasks} /></Suspense>}
    <section className="panel"><h2>Labor & materials</h2><p className="muted">Usage costs are estimates. Approved expense requests form the expenditure ledger.</p>
      <p role="status">{data.resources.filter(r => Number(r.used) !== Number(r.planned)).length} resource records differ from the plan. Completion stays blocked until they match.</p>
      {data.resources.length === 0 ? <p>No resources planned.</p> : <div className="table-scroll"><table><thead><tr><th>Resource</th><th>Planned</th><th>Used</th><th>Variance</th><th>Unit cost</th><th>Usage cost</th>{writable && <th>Record usage</th>}</tr></thead><tbody>{data.resources.map(r => <tr key={r.id}><td>{r.name}<small>{r.kind} / {r.unit}</small></td><td>{r.planned}</td><td>{r.used}</td><td>{r.variance}</td><td>{r.unit_cost}</td><td>{r.usage_cost}</td>{writable && <td><ActionForm title="Save usage" busy={busy} submit={v => run(`resources/${r.id}`, { used: v.used, version: r.version }, 'patch')}><Field name="used" title={`Total used: ${r.name}`} type="number" min="0" step="0.01" defaultValue={r.used} /></ActionForm></td>}</tr>)}</tbody></table></div>}
      {manager && writable && <ActionForm title="Plan resource" busy={busy} submit={async v => {
        const saved = await run('resources', { name: resourceKind === 'LABOR' && laborType !== '__custom__' ? laborType : v.name, kind: resourceKind, unit: v.unit, planned: v.planned, unitCost: v.unitCost, taskId: v.taskId ? Number(v.taskId) : null });
        if (saved) { setResourceKind('LABOR'); setLaborType(''); }
        return saved;
      }}>
        <div className="execution-field"><label htmlFor="resource-kind">Resource type</label><select id="resource-kind" value={resourceKind} onChange={e => setResourceKind(e.target.value)}><option value="LABOR">Labor</option><option value="MATERIAL">Material</option></select></div>
        {resourceKind === 'LABOR' && <div className="execution-field"><label htmlFor="labor-type">Labor type</label><select id="labor-type" value={laborType} onChange={e => setLaborType(e.target.value)} required><option value="">Choose labor type</option>{laborTypes.map(type => <option key={type} value={type}>{type}</option>)}<option value="__custom__">Add custom labor type</option></select></div>}
        {resourceKind === 'LABOR' && laborType === '__custom__' && <Field name="name" title="Custom labor type" maxLength={240} />}
        {resourceKind === 'MATERIAL' && <Field name="name" title="Resource name" maxLength={240} />}
        <Field name="taskId" title="Resource work item" required={false}><option value="">Project-wide resource</option>{data.tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</Field><Field name="unit" title="Unit (hours, bags, etc.)" maxLength={40} /><Field name="planned" title="Planned quantity" type="number" min="0" step="0.01" /><Field name="unitCost" title="Unit cost" type="number" min="0" step="0.01" />
      </ActionForm>}
      {manager && writable && data.resources.map(r => <details key={r.id}><summary>Revise resource plan: {r.name}</summary><ActionForm title="Revise resource plan" busy={busy} submit={v => run(`resources/${r.id}/plan`, { ...v, version: r.version }, 'patch')}><Field name="planned" title={`Revised quantity: ${r.name}`} type="number" min="0" step="0.01" defaultValue={r.planned} /><Field name="unitCost" title={`Revised unit cost: ${r.name}`} type="number" min="0" step="0.01" defaultValue={r.unit_cost} /><Field name="reason" title="Revision reason" maxLength={1000} /></ActionForm></details>)}
    </section>
    <section className="panel"><h2>Requests & approvals</h2><p className="muted">Submit a work plan for the manager's approval before recording progress. A different manager reviews each request. Completion requires all resource quantities to match the plan and a PNG/JPEG finish photo. On supported phones, the photo field opens the camera.</p>
      {writable && <ActionForm title="Submit request" busy={busy} submit={v => run('requests', { ...v, kind, taskId: v.taskId ? Number(v.taskId) : null, amount: v.amount || null, requestedDate: v.requestedDate || null })}>
        <div className="execution-field"><label htmlFor="request-type">Request type</label><select id="request-type" value={kind} onChange={e => setKind(e.target.value)}><option value="WORK_PLAN">Work plan — permission to proceed</option><option value="PROGRESS">Task progress</option><option value="EXPENSE">Expense</option>{manager && <option value="BUDGET">Budget approval / revision</option>}<option value="DELAY_REASON">Delay explanation</option><option value="EXTENSION">Deadline extension</option><option value="COMPLETION">Project completion</option></select></div>
        {['PROGRESS','WORK_PLAN'].includes(kind) && <Field name="taskId" title="Task"><option value="">Select task</option>{data.tasks.filter(t => manager || t.engineer_id === user.id).map(t => <option key={t.id} value={t.id}>{t.title} ({t.progress}%)</option>)}</Field>}
        {['PROGRESS', 'BUDGET', 'EXPENSE'].includes(kind) && <Field name="amount" title={kind === 'PROGRESS' ? 'Progress (%)' : 'Amount'} type="number" min="0.01" step="0.01" max={kind === 'PROGRESS' ? '100' : undefined} />}
        {kind === 'EXTENSION' && <Field name="requestedDate" title="Requested deadline" type="date" min={project.revisedEndDate ?? project.plannedEndDate} />}
        <Field name="reason" title="Reason / explanation" maxLength={1000} />
      </ActionForm>}
      {data.requests.length === 0 && <Empty title="No requests yet" />}
      {data.requests.map(r => <article className="request-card" key={r.id}><h3>#{r.id} · {r.kind} <Badge value={r.state} /></h3><p>{r.reason}</p><p>{r.amount !== null && `Value: ${r.amount} · `}{r.requested_date && `Deadline: ${r.requested_date} · `}Submitted by {r.full_name} · {new Date(r.submitted_at).toLocaleString()}</p>
        {r.review_note && <p>Review by {r.reviewer_name}: {r.review_note}</p>}
        {r.plan_snapshot && <details><summary>Submitted work plan (dates, budget, labor and materials)</summary><pre className="plan-snapshot">{JSON.stringify(JSON.parse(r.plan_snapshot), null, 2)}</pre></details>}
        <ul>{data.evidence.filter(e => e.request_id === r.id).map(e => <li key={e.id}><a className="text-link" href={`/api/projects/${id}/evidence/${e.id}`}>{e.name}</a></li>)}</ul>
        {r.state === 'PENDING' && r.submitted_by === user.id && !project.archived && !['COMPLETED', 'CANCELLED'].includes(project.status) && <ActionForm title="Attach evidence" busy={busy} submit={v => { const form = new FormData(); form.append('file', v.file); return run(`requests/${r.id}/evidence`, form); }}><label className="execution-field"><span>Evidence file for request #{r.id}</span><input name="file" type="file" accept={r.kind === 'COMPLETION' ? 'image/png,image/jpeg' : 'application/pdf,image/png,image/jpeg'} capture={r.kind === 'COMPLETION' ? 'environment' : undefined} required /></label></ActionForm>}
        {manager && r.state === 'PENDING' && r.submitted_by !== user.id && !project.archived && !['COMPLETED', 'CANCELLED'].includes(project.status) && <ActionForm title="Review request" busy={busy} submit={v => run(`requests/${r.id}/review`, { approve: v.decision === 'approve', note: v.note })}><Field name="decision" title="Decision"><option value="approve">Approve</option><option value="reject">Reject</option></Field><Field name="note" title="Review explanation" maxLength={2000} /></ActionForm>}
      </article>)}
    </section>
  </div>;
}

type Notification = { id: number; project_id: number; message: string; created_at: string; read_at: string | null };
export function Notifications() {
  const client = useQueryClient(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ['notifications'], queryFn: async () => (await api.get<Notification[]>('/notifications')).data });
  return <section className="panel"><h1>Notifications</h1>{error && <p role="alert" className="error">{error}</p>}{query.isPending ? <Loading /> : query.isError ? <ErrorNotice error={query.error} retry={() => query.refetch()} /> : query.data.length === 0 ? <Empty title="You're all caught up" /> : query.data.map(n => <article className="request-card" key={n.id}><p>{n.message}</p><small>{new Date(n.created_at).toLocaleString()}</small><div className="form-footer"><Link className="text-link" to={`/projects/${n.project_id}`}>View project</Link>{!n.read_at && <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await api.patch(`/notifications/${n.id}/read`, {}, { headers: await csrf() }); await client.invalidateQueries({ queryKey: ['notifications'] }); } catch (e) { setError(message(e)); } finally { setBusy(false); } }}>Mark read</Button>}</div></article>)}</section>;
}
