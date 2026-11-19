import { INITIAL_DATABASE } from '../data/seedData.ts';
import type {
  AppDatabase,
  InstitutionalConfig,
  LibraryItem,
  StudentRosterEntry,
  SupportPlan,
} from '../types.ts';

const LOCAL_DB_KEY = 'casd_db_local_v1';

let storageMode: 'server' | 'static' = 'server';

function loadLocalDb(): AppDatabase {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppDatabase;
      if (parsed && parsed.config && Array.isArray(parsed.plans)) {
        return {
          config: parsed.config,
          plans: parsed.plans || [],
          library: parsed.library || [],
          rosters: parsed.rosters || [],
        };
      }
    }
  } catch {
    // ignore corrupt localStorage
  }
  saveLocalDb(INITIAL_DATABASE);
  return INITIAL_DATABASE;
}

function saveLocalDb(db: AppDatabase): void {
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  } catch {
    // ignore storage quota errors
  }
}

function generateCode(
  academicYear: number,
  course: string,
  plansCount: number
): string {
  const cleanCourse = (course || 'GRAL')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase();
  const seq = String(plansCount + 1).padStart(3, '0');
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `CASD-${academicYear}-${cleanCourse || 'GRAL'}-${seq}${suffix}`;
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    let message = 'Error en la comunicación con el servidor.';
    if (contentType.includes('application/json')) {
      try {
        const errBody = (await response.json()) as { error?: string };
        if (errBody.error) message = errBody.error;
      } catch {
        // ignore json parse failure
      }
    }
    throw new Error(message);
  }

  if (!contentType.includes('application/json')) {
    throw new Error('STATIC_HOSTING');
  }
  return response.json() as Promise<T>;
}

export const api = {
  getStorageMode: () => storageMode,

  saveLocalSnapshot: (db: AppDatabase) => {
    saveLocalDb(db);
  },

  getState: async (): Promise<AppDatabase> => {
    try {
      const remote = await requestJson<AppDatabase>('/api/state');
      storageMode = 'server';
      saveLocalDb(remote);
      return remote;
    } catch {
      storageMode = 'static';
      return loadLocalDb();
    }
  },

  updateConfig: async (
    config: Partial<InstitutionalConfig>
  ): Promise<InstitutionalConfig> => {
    if (storageMode === 'server') {
      try {
        const updated = await requestJson<InstitutionalConfig>('/api/config', {
          method: 'PUT',
          body: JSON.stringify(config),
        });
        const db = loadLocalDb();
        saveLocalDb({ ...db, config: updated });
        return updated;
      } catch {
        storageMode = 'static';
      }
    }
    const db = loadLocalDb();
    const updated = { ...db.config, ...config };
    saveLocalDb({ ...db, config: updated });
    return updated;
  },

  createPlans: async (
    plansPayload: Partial<SupportPlan>[]
  ): Promise<SupportPlan[]> => {
    if (storageMode === 'server') {
      try {
        const created = await requestJson<SupportPlan[]>('/api/plans', {
          method: 'POST',
          body: JSON.stringify({ plans: plansPayload }),
        });
        const db = loadLocalDb();
        saveLocalDb({ ...db, plans: [...created, ...db.plans] });
        return created;
      } catch {
        storageMode = 'static';
      }
    }

    const db = loadLocalDb();
    const now = new Date().toISOString();
    const created: SupportPlan[] = plansPayload.map((p, idx) => ({
      id: p.id || `plan-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      code:
        p.code ||
        generateCode(
          p.academicYear || db.config.academicYear,
          p.course || p.grade || 'GRAL',
          db.plans.length + idx
        ),
      institutionName: p.institutionName || db.config.institutionName,
      city: p.city || db.config.city || 'Barrancabermeja',
      teacherName: p.teacherName || db.config.teacherName,
      teacherRole: p.teacherRole || db.config.teacherRole,
      area: p.area || db.config.area,
      subject: p.subject || db.config.subjects[0] || 'Informática',
      grade: p.grade || db.config.grades[0] || '6°',
      course: p.course || '',
      period: p.period || '4',
      academicYear: p.academicYear || db.config.academicYear,
      studentName: p.studentName || '',
      studentCode: p.studentCode || '',
      deliveryDate: p.deliveryDate || now.slice(0, 10),
      supportDeadline: p.supportDeadline || '',
      observations: p.observations || '',
      rows: p.rows || [],
      assignedWorks: p.assignedWorks || [],
      createdAt: now,
      updatedAt: now,
      batchId: p.batchId,
    }));

    saveLocalDb({ ...db, plans: [...created, ...db.plans] });
    return created;
  },

  updatePlan: async (
    id: string,
    plan: Partial<SupportPlan>
  ): Promise<SupportPlan> => {
    if (storageMode === 'server') {
      try {
        const updated = await requestJson<SupportPlan>(
          `/api/plans/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            body: JSON.stringify(plan),
          }
        );
        const db = loadLocalDb();
        saveLocalDb({
          ...db,
          plans: db.plans.map((p) => (p.id === id ? updated : p)),
        });
        return updated;
      } catch {
        storageMode = 'static';
      }
    }

    const db = loadLocalDb();
    const existing = db.plans.find((p) => p.id === id);
    const updated: SupportPlan = {
      ...(existing || ({} as SupportPlan)),
      ...plan,
      id,
      updatedAt: new Date().toISOString(),
    };
    saveLocalDb({
      ...db,
      plans: existing
        ? db.plans.map((p) => (p.id === id ? updated : p))
        : [updated, ...db.plans],
    });
    return updated;
  },

  deletePlan: async (id: string): Promise<{ ok: boolean }> => {
    if (storageMode === 'server') {
      try {
        const res = await requestJson<{ ok: boolean }>(
          `/api/plans/${encodeURIComponent(id)}`,
          { method: 'DELETE' }
        );
        const db = loadLocalDb();
        saveLocalDb({ ...db, plans: db.plans.filter((p) => p.id !== id) });
        return res;
      } catch {
        storageMode = 'static';
      }
    }
    const db = loadLocalDb();
    saveLocalDb({ ...db, plans: db.plans.filter((p) => p.id !== id) });
    return { ok: true };
  },

  createLibraryItem: async (
    item: Partial<LibraryItem>
  ): Promise<LibraryItem> => {
    if (storageMode === 'server') {
      try {
        const created = await requestJson<LibraryItem>('/api/library', {
          method: 'POST',
          body: JSON.stringify(item),
        });
        const db = loadLocalDb();
        saveLocalDb({ ...db, library: [created, ...db.library] });
        return created;
      } catch {
        storageMode = 'static';
      }
    }
    const db = loadLocalDb();
    const now = new Date().toISOString();
    const created: LibraryItem = {
      id: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      grade: item.grade || db.config.grades[0] || '6°',
      subject: item.subject || db.config.subjects[0] || 'Informática',
      period: item.period,
      topic: item.topic || 'Contenido académico',
      academicYear: item.academicYear || db.config.academicYear,
      competency: item.competency || '',
      topics: item.topics || '',
      activities: item.activities || '',
      evaluationCriteria: item.evaluationCriteria || '',
      bibliography: item.bibliography || '',
      createdAt: now,
      updatedAt: now,
    };
    saveLocalDb({ ...db, library: [created, ...db.library] });
    return created;
  },

  updateLibraryItem: async (
    id: string,
    item: Partial<LibraryItem>
  ): Promise<LibraryItem> => {
    if (storageMode === 'server') {
      try {
        const updated = await requestJson<LibraryItem>(
          `/api/library/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            body: JSON.stringify(item),
          }
        );
        const db = loadLocalDb();
        saveLocalDb({
          ...db,
          library: db.library.map((l) => (l.id === id ? updated : l)),
        });
        return updated;
      } catch {
        storageMode = 'static';
      }
    }
    const db = loadLocalDb();
    const existing = db.library.find((l) => l.id === id);
    const updated: LibraryItem = {
      ...(existing || ({} as LibraryItem)),
      ...item,
      id,
      updatedAt: new Date().toISOString(),
    };
    saveLocalDb({
      ...db,
      library: db.library.map((l) => (l.id === id ? updated : l)),
    });
    return updated;
  },

  deleteLibraryItem: async (id: string): Promise<{ ok: boolean }> => {
    if (storageMode === 'server') {
      try {
        const res = await requestJson<{ ok: boolean }>(
          `/api/library/${encodeURIComponent(id)}`,
          { method: 'DELETE' }
        );
        const db = loadLocalDb();
        saveLocalDb({ ...db, library: db.library.filter((l) => l.id !== id) });
        return res;
      } catch {
        storageMode = 'static';
      }
    }
    const db = loadLocalDb();
    saveLocalDb({ ...db, library: db.library.filter((l) => l.id !== id) });
    return { ok: true };
  },

  importRosters: async (
    entries: StudentRosterEntry[],
    replaceMatchingCourse = true
  ): Promise<StudentRosterEntry[]> => {
    if (storageMode === 'server') {
      try {
        const updatedRoster = await requestJson<StudentRosterEntry[]>(
          '/api/rosters/import',
          {
            method: 'POST',
            body: JSON.stringify({ entries, replaceMatchingCourse }),
          }
        );
        const db = loadLocalDb();
        saveLocalDb({ ...db, rosters: updatedRoster });
        return updatedRoster;
      } catch {
        storageMode = 'static';
      }
    }
    const db = loadLocalDb();
    let nextRosters = [...db.rosters];
    if (replaceMatchingCourse && entries.length > 0) {
      const keys = new Set(
        entries.map(
          (e) => `${e.course}|${e.subject}|${e.period}|${e.academicYear}`
        )
      );
      nextRosters = nextRosters.filter(
        (r) =>
          !keys.has(`${r.course}|${r.subject}|${r.period}|${r.academicYear}`)
      );
    }
    nextRosters = [...entries, ...nextRosters];
    saveLocalDb({ ...db, rosters: nextRosters });
    return nextRosters;
  },

  restoreBackup: async (backup: AppDatabase): Promise<AppDatabase> => {
    if (storageMode === 'server') {
      try {
        const restored = await requestJson<AppDatabase>('/api/backup/restore', {
          method: 'POST',
          body: JSON.stringify(backup),
        });
        saveLocalDb(restored);
        return restored;
      } catch {
        storageMode = 'static';
      }
    }
    saveLocalDb(backup);
    return backup;
  },
};
