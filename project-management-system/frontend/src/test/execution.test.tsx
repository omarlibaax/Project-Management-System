import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Execution from '../pages/Execution';
import { api } from '../api';
import type { Project } from '../types';

vi.mock('../api', () => ({ api: { get: vi.fn(), request: vi.fn() }, csrf: async () => ({ 'X-CSRF-TOKEN': 'test' }), message: () => 'Request could not be saved' }));
const user = { id: 2, employeeCode: 'ENG-2', fullName: 'Engineer', email: 'engineer@example.test', roles: ['ENGINEER'] };
const project = { id: 1, status: 'IN_PROGRESS', archived: false, approvedBudget: '1000.00', actualExpenditure: '0.00', plannedStartDate: '2026-11-01', plannedEndDate: '2026-12-01' } as Project;
const workspace = { assignments: [], tasks: [], resources: [], requests: [], evidence: [] };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.get).mockResolvedValue({ data: workspace }); });
afterEach(cleanup);
it('lets managers choose a trade or enter a custom labor type', async () => {
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: url === '/engineers' ? { items: [] } : workspace }));
  show(project, ['ADMIN']);
  await screen.findByLabelText('Labor type');
  await userEvent.selectOptions(screen.getByLabelText('Labor type'), 'Electrician');
  await userEvent.type(screen.getByLabelText('Unit (hours, bags, etc.)'), 'hours');
  await userEvent.type(screen.getByLabelText('Planned quantity'), '8');
  await userEvent.type(screen.getByLabelText('Unit cost', { exact: true }), '500');
  await userEvent.click(screen.getByRole('button', { name: 'Plan resource' }));
  await waitFor(() => expect(api.request).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: 'LABOR', name: 'Electrician', planned: '8', unitCost: '500' }) })));
  await userEvent.selectOptions(screen.getByLabelText('Labor type'), '__custom__');
  expect(screen.getByLabelText('Custom labor type')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Resource type'), 'MATERIAL');
  expect(screen.getByLabelText('Resource name')).toBeInTheDocument();
  expect(screen.queryByLabelText('Labor type')).not.toBeInTheDocument();
});
function show(p = project, roles = user.roles) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><Execution project={p} user={{ ...user, roles }} /></MemoryRouter></QueryClientProvider>);
}
it('engineer can request an expense but cannot administer assignments or budgets', async () => {
  show(); await screen.findByRole('heading', { name: 'Project execution' });
  expect(screen.queryByRole('button', { name: 'Assign engineer' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Budget approval / revision' })).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Request type'), 'EXPENSE');
  await userEvent.type(screen.getByLabelText('Amount'), '12.01');
  await userEvent.type(screen.getByLabelText('Reason / explanation'), 'Cement delivery');
  await userEvent.click(screen.getByRole('button', { name: 'Submit request' }));
  await waitFor(() => expect(api.request).toHaveBeenCalledWith(expect.objectContaining({ url: '/projects/1/requests', data: expect.objectContaining({ kind: 'EXPENSE', amount: '12.01', reason: 'Cement delivery' }) })));
});
it('failed requests display an error and preserve entered values for correction', async () => {
  vi.mocked(api.request).mockRejectedValue(new Error('conflict')); show();
  await screen.findByRole('heading', { name: 'Project execution' });
  await userEvent.selectOptions(screen.getByLabelText('Request type'), 'EXPENSE');
  await userEvent.type(screen.getByLabelText('Amount'), '19.99');
  await userEvent.type(screen.getByLabelText('Reason / explanation'), 'Delivery charge');
  await userEvent.click(screen.getByRole('button', { name: 'Submit request' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Request could not be saved');
  expect(screen.getByLabelText('Reason / explanation')).toHaveValue('Delivery charge');
});
it('completed projects expose reports while preventing new execution changes', async () => {
  show({ ...project, status: 'COMPLETED' }, ['ADMIN']);
  expect(await screen.findByRole('link', { name: 'Export Excel' })).toHaveAttribute('href', '/api/projects/1/report.xlsx');
  expect(screen.queryByRole('button', { name: 'Submit request' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create task' })).not.toBeInTheDocument();
});
