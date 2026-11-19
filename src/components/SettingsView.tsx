import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  DatabaseBackup,
  Download,
  Plus,
  Save,
  Upload,
  X,
} from 'lucide-react';
import type {
  AppDatabase,
  InstitutionalConfig,
  StudentRosterEntry,
  WorkspaceLinks,
} from '../types.ts';
import { ConfirmModal } from './ConfirmModal.tsx';
import { CloudWorkspacePanel } from './CloudWorkspacePanel.tsx';
import { parseIntegraHtmlPlanilla } from '../utils/integraParser.ts';

interface SettingsViewProps {
  db: AppDatabase;
  config: InstitutionalConfig;
  rosters: StudentRosterEntry[];
  onUpdateConfig: (next: Partial<InstitutionalConfig>) => Promise<InstitutionalConfig>;
  onImportRoster: (entries: StudentRosterEntry[]) => Promise<void>;
  onRestoreBackup: (backup: AppDatabase) => Promise<void>;
  authUser: User | null;
  accessToken: string | null;
  isLoggingIn: boolean;
  workspaceLinks: WorkspaceLinks;
  hasPendingSheetSync: boolean;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  onUpdateWorkspaceLinks: (next: WorkspaceLinks) => void;
  onReplaceDatabaseFromSheets: (nextDb: AppDatabase) => Promise<void>;
  onMarkSheetSynced: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  db,
  config,
  rosters,
  onUpdateConfig,
  onImportRoster,
  onRestoreBackup,
  authUser,
  accessToken,
  isLoggingIn,
  workspaceLinks,
  hasPendingSheetSync,
  onGoogleLogin,
  onGoogleLogout,
  onUpdateWorkspaceLinks,
  onReplaceDatabaseFromSheets,
  onMarkSheetSynced,
}) => {
  const [form, setForm] = useState<InstitutionalConfig>(config);
  const [newSubject, setNewSubject] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<AppDatabase | null>(null);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setErrorMsg(null);
    try {
      const updated = await onUpdateConfig(form);
      setForm(updated);
      setMessage('Configuración institucional guardada correctamente.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar configuración.');
    } finally {
      setSaving(false);
    }
  };

  const addSubject = () => {
    const clean = newSubject.trim();
    if (!clean || form.subjects.includes(clean)) return;
    setForm({ ...form, subjects: [...form.subjects, clean] });
    setNewSubject('');
  };

  const removeSubject = (subj: string) => {
    if (form.subjects.length <= 1) return;
    setForm({ ...form, subjects: form.subjects.filter((s) => s !== subj) });
  };

  const addGrade = () => {
    const clean = newGrade.trim();
    if (!clean || form.grades.includes(clean)) return;
    setForm({ ...form, grades: [...form.grades, clean] });
    setNewGrade('');
  };

  const removeGrade = (g: string) => {
    if (form.grades.length <= 1) return;
    setForm({ ...form, grades: form.grades.filter((item) => item !== g) });
  };

  const handleImportPlanilla = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setMessage(null);
    try {
      const html = await file.text();
      const parsed = parseIntegraHtmlPlanilla(html, form.passingScore);
      if (parsed.students.length === 0) {
        setErrorMsg('No se detectaron estudiantes válidos en la planilla HTML.');
        return;
      }
      await onImportRoster(parsed.students);
      setMessage(
        `Planilla ${parsed.course} (${parsed.subject}, Periodo ${parsed.period}) importada con ${parsed.students.length} estudiantes.`
      );
    } catch {
      setErrorMsg('Error al procesar el archivo HTML de Plataforma Integra.');
    } finally {
      e.target.value = '';
    }
  };

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppDatabase;
      if (!parsed.config || !Array.isArray(parsed.plans) || !Array.isArray(parsed.library)) {
        setErrorMsg('El archivo seleccionado no es una copia de seguridad válida.');
        return;
      }
      setPendingBackup(parsed);
    } catch {
      setErrorMsg('No se pudo leer el archivo JSON de copia de seguridad.');
    } finally {
      e.target.value = '';
    }
  };

  const rosterSummary = React.useMemo(() => {
    const map = new Map<string, { course: string; subject: string; period: string; year: number; total: number; low: number }>();
    for (const r of rosters) {
      const key = `${r.course}|${r.subject}|${r.period}|${r.academicYear}`;
      if (!map.has(key)) {
        map.set(key, {
          course: r.course,
          subject: r.subject,
          period: r.period,
          year: r.academicYear,
          total: 1,
          low: r.needsSupport ? 1 : 0,
        });
      } else {
        const curr = map.get(key)!;
        curr.total += 1;
        if (r.needsSupport) curr.low += 1;
      }
    }
    return Array.from(map.values());
  }, [rosters]);

  const handleExportBackupJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `respaldo_casd_planes_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4">
        <h2 className="text-lg font-bold text-slate-900">
          Configuración institucional, nube y publicación
        </h2>
        <p className="text-xs text-slate-500">
          Conecta Google Sheets y Google Drive como respaldo en la nube, configura los datos institucionales predeterminados e importa planillas.
        </p>
      </div>

      {/* Cloud Backend: Google Sheets, Drive Folder & GitHub Pages Guide */}
      <CloudWorkspacePanel
        db={db}
        user={authUser}
        accessToken={accessToken}
        isLoggingIn={isLoggingIn}
        links={workspaceLinks}
        hasPendingSheetSync={hasPendingSheetSync}
        onLogin={onGoogleLogin}
        onLogout={onGoogleLogout}
        onUpdateLinks={onUpdateWorkspaceLinks}
        onReplaceDatabaseFromSheets={onReplaceDatabaseFromSheets}
        onMarkSynced={onMarkSheetSynced}
      />

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm font-medium">{message}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {/* Institutional Defaults Form */}
      <form
        onSubmit={handleSaveConfig}
        className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
      >
        <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
          Datos institucionales y del docente
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Institución educativa *
            </label>
            <input
              type="text"
              required
              value={form.institutionName}
              onChange={(e) =>
                setForm({ ...form, institutionName: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Ciudad / Municipio *
            </label>
            <input
              type="text"
              required
              value={form.city || 'Barrancabermeja'}
              onChange={(e) =>
                setForm({ ...form, city: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Área académica *
            </label>
            <input
              type="text"
              required
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Nombre completo del docente *
            </label>
            <input
              type="text"
              required
              value={form.teacherName}
              onChange={(e) => setForm({ ...form, teacherName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Cargo del docente (para firma en Word) *
            </label>
            <input
              type="text"
              required
              value={form.teacherRole}
              onChange={(e) => setForm({ ...form, teacherRole: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Año académico predeterminado *
            </label>
            <input
              type="number"
              required
              min={2020}
              max={2040}
              value={form.academicYear}
              onChange={(e) =>
                setForm({ ...form, academicYear: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Nota mínima aprobatoria (escala Integra)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.passingScore}
              onChange={(e) =>
                setForm({ ...form, passingScore: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Pie de página institucional en documentos Word
            </label>
            <input
              type="text"
              value={form.institutionalFooterNote}
              onChange={(e) =>
                setForm({ ...form, institutionalFooterNote: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>
        </div>

        {/* Grados & Asignaturas */}
        <div className="grid grid-cols-1 gap-6 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">
              Grados habilitados
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {form.grades.map((g) => (
                <span
                  key={g}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
                >
                  {g}
                  {form.grades.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGrade(g)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`Quitar grado ${g}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                placeholder="Ej. 7°"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-[#0D7136] focus:outline-none"
              />
              <button
                type="button"
                onClick={addGrade}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">
              Asignaturas habilitadas
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {form.subjects.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
                >
                  {s}
                  {form.subjects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSubject(s)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`Quitar asignatura ${s}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Ej. Diseño Web"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-[#0D7136] focus:outline-none"
              />
              <button
                type="button"
                onClick={addSubject}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0D7136] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#095528] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar configuración institucional'}
          </button>
        </div>
      </form>

      {/* Rosters & Integra Import */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Planillas de estudiantes (Plataforma Integra)
            </h3>
            <p className="text-xs text-slate-500">
              Importa planillas HTML descargadas de Integra para agilizar la selección de estudiantes con desempeño bajo.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0">
            <Upload className="h-4 w-4 text-[#0D7136]" />
            Importar planilla HTML
            <input
              type="file"
              accept=".html,.htm"
              onChange={handleImportPlanilla}
              className="hidden"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-4 py-2.5 font-semibold">Curso</th>
                <th className="px-4 py-2.5 font-semibold">Asignatura</th>
                <th className="px-4 py-2.5 font-semibold">Periodo / Año</th>
                <th className="px-4 py-2.5 font-semibold">Total estudiantes</th>
                <th className="px-4 py-2.5 font-semibold">Con desempeño bajo (BJ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rosterSummary.map((item) => (
                <tr key={`${item.course}-${item.subject}-${item.period}`}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{item.course}</td>
                  <td className="px-4 py-2.5 text-slate-700">{item.subject}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600 tabular-nums">
                    P{item.period} · {item.year}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-700 tabular-nums">
                    {item.total}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-red-600 tabular-nums">
                    {item.low}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Backups */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <DatabaseBackup className="mt-0.5 h-5 w-5 text-[#0D7136] shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Copias de seguridad y exportación de datos
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Descarga un respaldo completo en formato JSON con todos tus planes guardados, biblioteca de actividades, listas de estudiantes y configuración.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExportBackupJson}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4 text-[#0D7136]" />
              Exportar copia (.json)
            </button>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0">
              <Upload className="h-4 w-4" />
              Restaurar copia (.json)
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleBackupFileSelected}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </section>

      <ConfirmModal
        open={Boolean(pendingBackup)}
        title="Restaurar copia de seguridad"
        description={`Se reemplazarán los datos actuales con la copia de seguridad (${pendingBackup?.plans.length || 0} planes y ${pendingBackup?.library.length || 0} actividades). ¿Deseas continuar?`}
        confirmLabel="Sí, restaurar respaldo"
        variant="primary"
        onConfirm={async () => {
          if (pendingBackup) {
            await onRestoreBackup(pendingBackup);
            setPendingBackup(null);
            setMessage('Copia de seguridad restaurada exitosamente.');
          }
        }}
        onCancel={() => setPendingBackup(null)}
      />
    </div>
  );
};
