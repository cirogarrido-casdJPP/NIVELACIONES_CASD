import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import type {
  AppDatabase,
  InstitutionalConfig,
  LibraryItem,
  StudentRosterEntry,
  SupportPlan,
} from './src/types.ts';
import { INITIAL_DATABASE } from './src/data/seedData.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'casd_support_plans.json');

let writeQueue: Promise<void> = Promise.resolve();

async function ensureDbFile(): Promise<AppDatabase> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppDatabase>;
    let dirty = false;

    const mergedConfig: InstitutionalConfig = {
      ...INITIAL_DATABASE.config,
      ...(parsed.config || {}),
      city: parsed.config?.city || INITIAL_DATABASE.config.city || 'Barrancabermeja',
    };

    // Ensure core subjects exist
    const subjectSet = new Set(mergedConfig.subjects);
    for (const reqSubj of INITIAL_DATABASE.config.subjects) {
      if (!subjectSet.has(reqSubj)) {
        mergedConfig.subjects.push(reqSubj);
        dirty = true;
      }
    }
    if (!parsed.config?.city) dirty = true;

    const legacyIds = new Set([
      'lib-word-06',
      'lib-excel-08',
      'lib-algo-09',
      'lib-web-10',
      'lib-seg-11',
    ]);

    let library: LibraryItem[] = Array.isArray(parsed.library)
      ? parsed.library
      : [...INITIAL_DATABASE.library];

    // Remove Turn-1 generic placeholders if official curriculum items are not yet loaded
    const hasOfficial = library.some((item) => item.id.startsWith('lib-inf-') || item.id.startsWith('lib-tec-'));
    if (!hasOfficial) {
      library = library.filter((item) => !legacyIds.has(item.id));
      dirty = true;
    }

    const existingLibIds = new Set(library.map((item) => item.id));
    const missingCurriculum = INITIAL_DATABASE.library.filter((item) => !existingLibIds.has(item.id));
    if (missingCurriculum.length > 0) {
      library = [...library, ...missingCurriculum];
      dirty = true;
    }

    const plans = (Array.isArray(parsed.plans) ? parsed.plans : INITIAL_DATABASE.plans).map((p) =>
      p.city ? p : { ...p, city: mergedConfig.city }
    );

    const db: AppDatabase = {
      config: mergedConfig,
      plans,
      library,
      rosters: Array.isArray(parsed.rosters) ? parsed.rosters : INITIAL_DATABASE.rosters,
    };

    if (dirty) {
      await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    }

    return db;
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(INITIAL_DATABASE, null, 2), 'utf-8');
    return structuredClone(INITIAL_DATABASE);
  }
}

function withDbLock<T>(fn: (db: AppDatabase) => Promise<{ result: T; nextDb?: AppDatabase }>): Promise<T> {
  const next = writeQueue.then(async () => {
    const current = await ensureDbFile();
    const { result, nextDb } = await fn(current);
    if (nextDb) {
      const tmpFile = `${DB_FILE}.tmp`;
      await fs.writeFile(tmpFile, JSON.stringify(nextDb, null, 2), 'utf-8');
      await fs.rename(tmpFile, DB_FILE);
    }
    return result;
  });
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function buildPlanCode(year: number, course: string, sequence: number): string {
  const cleanCourse = (course || 'GRAL').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'GRAL';
  const padded = String(sequence).padStart(3, '0');
  return `CASD-${year}-${cleanCourse}-${padded}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/state', async (_req, res) => {
    try {
      const db = await withDbLock(async (current) => ({ result: current }));
      res.json(db);
    } catch (error) {
      console.error('Error reading state:', error);
      res.status(500).json({ error: 'No se pudo cargar la base de datos institucional.' });
    }
  });

  app.put('/api/config', async (req, res) => {
    try {
      const incoming = req.body as Partial<InstitutionalConfig>;
      const updated = await withDbLock(async (db) => {
        const nextConfig: InstitutionalConfig = {
          ...db.config,
          ...incoming,
          subjects: Array.isArray(incoming.subjects) && incoming.subjects.length > 0
            ? incoming.subjects
            : db.config.subjects,
          grades: Array.isArray(incoming.grades) && incoming.grades.length > 0
            ? incoming.grades
            : db.config.grades,
          academicYear: Number(incoming.academicYear) || db.config.academicYear,
          passingScore: Number(incoming.passingScore) || db.config.passingScore,
        };
        return {
          result: nextConfig,
          nextDb: { ...db, config: nextConfig },
        };
      });
      res.json(updated);
    } catch (error) {
      console.error('Error updating config:', error);
      res.status(500).json({ error: 'Error al guardar la configuración institucional.' });
    }
  });

  app.post('/api/plans', async (req, res) => {
    try {
      const payload = req.body as { plans?: Partial<SupportPlan>[] } | Partial<SupportPlan>;
      const items = 'plans' in payload && Array.isArray(payload.plans)
        ? payload.plans
        : [payload as Partial<SupportPlan>];

      if (items.length === 0) {
        res.status(400).json({ error: 'No se recibieron planes para guardar.' });
        return;
      }

      const created = await withDbLock(async (db) => {
        const now = new Date().toISOString();
        let seq = db.plans.length + 1;
        const newPlans: SupportPlan[] = items.map((item, idx) => {
          const year = Number(item.academicYear) || db.config.academicYear;
          const course = (item.course || '').trim() || 'Sin curso';
          const id = item.id || `plan-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
          const code = item.code || buildPlanCode(year, course, seq++);
          return {
            id,
            code,
            institutionName: item.institutionName || db.config.institutionName,
            city: item.city || db.config.city || 'Barrancabermeja',
            teacherName: item.teacherName || db.config.teacherName,
            teacherRole: item.teacherRole || db.config.teacherRole,
            area: item.area || db.config.area,
            subject: item.subject || db.config.subjects[0] || 'Informática',
            grade: item.grade || db.config.grades[0] || '6°',
            course,
            period: item.period || '4',
            academicYear: year,
            studentName: (item.studentName || '').trim(),
            studentCode: (item.studentCode || '').trim(),
            deliveryDate: item.deliveryDate || now.slice(0, 10),
            supportDeadline: item.supportDeadline || '',
            observations: item.observations || '',
            rows: Array.isArray(item.rows) ? item.rows : [],
            assignedWorks: Array.isArray(item.assignedWorks) ? item.assignedWorks : [],
            createdAt: now,
            updatedAt: now,
            batchId: item.batchId,
          };
        });

        return {
          result: newPlans,
          nextDb: { ...db, plans: [...newPlans, ...db.plans] },
        };
      });

      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating plan:', error);
      res.status(500).json({ error: 'No se pudo guardar el plan en el historial.' });
    }
  });

  app.put('/api/plans/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const incoming = req.body as Partial<SupportPlan>;
      const updated = await withDbLock(async (db) => {
        const idx = db.plans.findIndex((p) => p.id === id);
        if (idx === -1) {
          return { result: null };
        }
        const existing = db.plans[idx];
        const nextPlan: SupportPlan = {
          ...existing,
          ...incoming,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        };
        const nextPlans = [...db.plans];
        nextPlans[idx] = nextPlan;
        return {
          result: nextPlan,
          nextDb: { ...db, plans: nextPlans },
        };
      });

      if (!updated) {
        res.status(404).json({ error: 'Plan no encontrado.' });
        return;
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating plan:', error);
      res.status(500).json({ error: 'No se pudo actualizar el plan.' });
    }
  });

  app.delete('/api/plans/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const removed = await withDbLock(async (db) => {
        const nextPlans = db.plans.filter((p) => p.id !== id);
        if (nextPlans.length === db.plans.length) {
          return { result: false };
        }
        return {
          result: true,
          nextDb: { ...db, plans: nextPlans },
        };
      });

      if (!removed) {
        res.status(404).json({ error: 'Plan no encontrado.' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Error deleting plan:', error);
      res.status(500).json({ error: 'No se pudo eliminar el plan.' });
    }
  });

  app.post('/api/library', async (req, res) => {
    try {
      const item = req.body as Partial<LibraryItem>;
      const created = await withDbLock(async (db) => {
        const now = new Date().toISOString();
        const newItem: LibraryItem = {
          id: item.id || `lib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          grade: item.grade || db.config.grades[0] || '6°',
          subject: item.subject || db.config.subjects[0] || 'Informática',
          period: item.period ? String(item.period) : '',
          topic: (item.topic || '').trim() || 'Actividad académica',
          academicYear: Number(item.academicYear) || db.config.academicYear,
          competency: item.competency || '',
          topics: item.topics || '',
          activities: item.activities || '',
          evaluationCriteria: item.evaluationCriteria || '',
          bibliography: item.bibliography || '',
          createdAt: now,
          updatedAt: now,
        };
        return {
          result: newItem,
          nextDb: { ...db, library: [newItem, ...db.library] },
        };
      });
      res.status(201).json(created);
    } catch (error) {
      console.error('Error creating library item:', error);
      res.status(500).json({ error: 'No se pudo guardar el contenido en la biblioteca.' });
    }
  });

  app.put('/api/library/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const incoming = req.body as Partial<LibraryItem>;
      const updated = await withDbLock(async (db) => {
        const idx = db.library.findIndex((item) => item.id === id);
        if (idx === -1) {
          return { result: null };
        }
        const existing = db.library[idx];
        const nextItem: LibraryItem = {
          ...existing,
          ...incoming,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        };
        const nextLibrary = [...db.library];
        nextLibrary[idx] = nextItem;
        return {
          result: nextItem,
          nextDb: { ...db, library: nextLibrary },
        };
      });
      if (!updated) {
        res.status(404).json({ error: 'Elemento de biblioteca no encontrado.' });
        return;
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating library item:', error);
      res.status(500).json({ error: 'No se pudo actualizar el contenido de la biblioteca.' });
    }
  });

  app.delete('/api/library/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const removed = await withDbLock(async (db) => {
        const nextLibrary = db.library.filter((item) => item.id !== id);
        if (nextLibrary.length === db.library.length) {
          return { result: false };
        }
        return {
          result: true,
          nextDb: { ...db, library: nextLibrary },
        };
      });
      if (!removed) {
        res.status(404).json({ error: 'Elemento de biblioteca no encontrado.' });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Error deleting library item:', error);
      res.status(500).json({ error: 'No se pudo eliminar el contenido.' });
    }
  });

  app.post('/api/rosters/import', async (req, res) => {
    try {
      const { entries, replaceMatchingCourse } = req.body as {
        entries: StudentRosterEntry[];
        replaceMatchingCourse?: boolean;
      };
      if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: 'Lista de estudiantes vacía.' });
        return;
      }
      const result = await withDbLock(async (db) => {
        let base = db.rosters;
        if (replaceMatchingCourse) {
          const keys = new Set(
            entries.map((e) => `${e.course}|${e.subject}|${e.period}|${e.academicYear}`)
          );
          base = base.filter(
            (r) => !keys.has(`${r.course}|${r.subject}|${r.period}|${r.academicYear}`)
          );
        }
        const existingIds = new Set(base.map((r) => r.id));
        const merged = [
          ...entries.filter((e) => !existingIds.has(e.id)),
          ...base,
        ];
        return {
          result: merged,
          nextDb: { ...db, rosters: merged },
        };
      });
      res.json(result);
    } catch (error) {
      console.error('Error importing rosters:', error);
      res.status(500).json({ error: 'No se pudo importar la lista de estudiantes.' });
    }
  });

  app.get('/api/backup/export', async (_req, res) => {
    try {
      const db = await withDbLock(async (current) => ({ result: current }));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="respaldo-planes-casd-${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.send(JSON.stringify(db, null, 2));
    } catch (error) {
      console.error('Error exporting backup:', error);
      res.status(500).json({ error: 'No se pudo exportar la copia de seguridad.' });
    }
  });

  app.post('/api/backup/restore', async (req, res) => {
    try {
      const incoming = req.body as Partial<AppDatabase>;
      if (!incoming || !incoming.config || !Array.isArray(incoming.plans) || !Array.isArray(incoming.library)) {
        res.status(400).json({ error: 'El archivo de respaldo no tiene una estructura válida.' });
        return;
      }
      const restored = await withDbLock(async () => {
        const nextDb: AppDatabase = {
          config: { ...INITIAL_DATABASE.config, ...incoming.config },
          plans: incoming.plans || [],
          library: incoming.library || [],
          rosters: Array.isArray(incoming.rosters) ? incoming.rosters : [],
        };
        return { result: nextDb, nextDb };
      });
      res.json(restored);
    } catch (error) {
      console.error('Error restoring backup:', error);
      res.status(500).json({ error: 'No se pudo restaurar la copia de seguridad.' });
    }
  });

  // Vite dev middleware or static serving in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor CASD Planes de Apoyo ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

startServer();
