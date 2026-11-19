import type {
  AppDatabase,
  InstitutionalConfig,
  LibraryItem,
  StudentRosterEntry,
  SupportPlan,
} from '../types.ts';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    let message = 'Error en la comunicación con el servidor.';
    try {
      const errBody = (await response.json()) as { error?: string };
      if (errBody.error) message = errBody.error;
    } catch {
      // ignore json parse failure
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  getState: () => requestJson<AppDatabase>('/api/state'),

  updateConfig: (config: Partial<InstitutionalConfig>) =>
    requestJson<InstitutionalConfig>('/api/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  createPlans: (plans: Partial<SupportPlan>[]) =>
    requestJson<SupportPlan[]>('/api/plans', {
      method: 'POST',
      body: JSON.stringify({ plans }),
    }),

  updatePlan: (id: string, plan: Partial<SupportPlan>) =>
    requestJson<SupportPlan>(`/api/plans/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    }),

  deletePlan: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/plans/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  createLibraryItem: (item: Partial<LibraryItem>) =>
    requestJson<LibraryItem>('/api/library', {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  updateLibraryItem: (id: string, item: Partial<LibraryItem>) =>
    requestJson<LibraryItem>(`/api/library/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    }),

  deleteLibraryItem: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/library/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  importRosters: (entries: StudentRosterEntry[], replaceMatchingCourse = true) =>
    requestJson<StudentRosterEntry[]>('/api/rosters/import', {
      method: 'POST',
      body: JSON.stringify({ entries, replaceMatchingCourse }),
    }),

  restoreBackup: (backup: AppDatabase) =>
    requestJson<AppDatabase>('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify(backup),
    }),
};
