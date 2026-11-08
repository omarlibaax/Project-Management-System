import { useState } from 'react';

export default function ExecutionCharts({ tasks }: { tasks: { id: number; title: string; progress: string; weight: string }[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const task = tasks.find(t => t.id === selected);
  return <section className="panel"><h2>Task completion</h2><p className="muted">Approved progress per task. Project progress also accounts for each task's relative weight.</p>
    <div className="task-chart">{tasks.map(t => <button type="button" className="task-chart-row" key={t.id} onClick={() => setSelected(t.id)} aria-pressed={selected === t.id}><span>{t.title}</span><progress max={100} value={Number(t.progress)} aria-label={`${t.title} approved progress`} /><strong>{t.progress}%</strong></button>)}</div>
    {task && <p role="status">{task.title}: {task.progress}% approved · relative weight {task.weight}</p>}
  </section>;
}
