import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FilePlus,
  RotateCcw,
  Save,
  UserCheck,
} from 'lucide-react';
import type {
  AcademicContentRow,
  InstitutionalConfig,
  LibraryItem,
  PlanDraft,
  StudentRosterEntry,
  SupportPlan,
} from '../types.ts';
import { AcademicTableEditor, createEmptyAcademicRow } from './AcademicTableEditor.tsx';
import { AssignedWorksEditor, createEmptyAssignedWork } from './AssignedWorksEditor.tsx';
import { ConfirmModal } from './ConfirmModal.tsx';
import { downloadSinglePlanDocx } from '../utils/docxGenerator.ts';

interface PlanEditorViewProps {
  config: InstitutionalConfig;
  draft: PlanDraft;
  lastDraftSavedAt: string | null;
  library: LibraryItem[];
  rosters: StudentRosterEntry[];
  onChangeDraft: (next: PlanDraft) => void;
  onResetDraft: () => void;
  onSavePlan: (planToSave: PlanDraft) => Promise<SupportPlan>;
  onPreview: (plan: SupportPlan) => void;
  onSaveRowToLibrary: (row: AcademicContentRow, topicTitle: string, grade: string, subject: string, year: number) => Promise<void>;
}

export function createInitialDraft(config: InstitutionalConfig): PlanDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    institutionName: config.institutionName,
    city: config.city || 'Barrancabermeja',
    teacherName: config.teacherName,
    teacherRole: config.teacherRole,
    area: config.area,
    subject: config.subjects[0] || 'Informática',
    grade: config.grades[0] || '6°',
    course: '06-5',
    period: '4',
    academicYear: config.academicYear,
    studentName: '',
    studentCode: '',
    deliveryDate: today,
    supportDeadline: '',
    observations: '',
    rows: [createEmptyAcademicRow()],
    assignedWorks: [createEmptyAssignedWork()],
  };
}

export const PlanEditorView: React.FC<PlanEditorViewProps> = ({
  config,
  draft,
  lastDraftSavedAt,
  library,
  rosters,
  onChangeDraft,
  onResetDraft,
  onSavePlan,
  onPreview,
  onSaveRowToLibrary,
}) => {
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [rosterPickerOpen, setRosterPickerOpen] = useState(false);
  const [rosterFilterOnlyLow, setRosterFilterOnlyLow] = useState(true);

  const matchingRoster = useMemo(() => {
    return rosters.filter((r) => {
      const matchesCourse = !draft.course.trim() || r.course === draft.course.trim() || r.grade === draft.grade;
      const matchesLow = !rosterFilterOnlyLow || r.needsSupport;
      return matchesCourse && matchesLow;
    });
  }, [rosters, draft.course, draft.grade, rosterFilterOnlyLow]);

  const updateField = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => {
    onChangeDraft({ ...draft, [key]: value });
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!draft.subject.trim()) errs.push('Selecciona o ingresa la asignatura.');
    if (!draft.grade.trim()) errs.push('Selecciona el grado.');
    if (!draft.course.trim()) errs.push('Ingresa el curso (ej. 06-5).');
    if (!draft.academicYear || draft.academicYear < 2000) errs.push('Ingresa un año académico válido.');
    if (!draft.deliveryDate.trim()) errs.push('Selecciona la fecha de entrega al estudiante.');

    const hasValidRow = draft.rows.some(
      (r) =>
        r.competency.trim() ||
        r.topics.trim() ||
        r.activities.trim() ||
        r.evaluationCriteria.trim()
    );
    if (!hasValidRow) {
      errs.push('Diligencia al menos una fila en la tabla de contenido académico.');
    }
    return errs;
  };

  const buildPreviewPlan = (): SupportPlan => {
    const now = new Date().toISOString();
    return {
      id: draft.editingPlanId || 'preview-draft',
      code: draft.editingPlanId
        ? `EDIT-${draft.academicYear}`
        : `CASD-${draft.academicYear}-${(draft.course || 'GRAL').replace(/[^a-zA-Z0-9]/g, '')}`,
      institutionName: draft.institutionName,
      city: draft.city || config.city || 'Barrancabermeja',
      teacherName: draft.teacherName,
      teacherRole: draft.teacherRole,
      area: draft.area,
      subject: draft.subject,
      grade: draft.grade,
      course: draft.course,
      period: draft.period,
      academicYear: draft.academicYear,
      studentName: draft.studentName.trim(),
      studentCode: draft.studentCode,
      deliveryDate: draft.deliveryDate,
      supportDeadline: draft.supportDeadline,
      observations: draft.observations,
      rows: draft.rows,
      assignedWorks: draft.assignedWorks,
      createdAt: now,
      updatedAt: now,
    };
  };

  const handleSaveOnly = async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setSaving(true);
    setStatusMessage(null);
    try {
      const saved = await onSavePlan(draft);
      onChangeDraft({ ...draft, editingPlanId: saved.id });
      setStatusMessage(`Plan ${saved.code} guardado correctamente en el historial.`);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Error al guardar el plan.']);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAndDownload = async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setGenerating(true);
    setStatusMessage(null);
    try {
      const saved = await onSavePlan(draft);
      onChangeDraft({ ...draft, editingPlanId: saved.id });
      await downloadSinglePlanDocx(saved, config.institutionalFooterNote);
      setStatusMessage(
        `Plan ${saved.code} guardado y documento Word (.docx) descargado exitosamente.`
      );
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'No se pudo generar el documento Word.']);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenPreview = () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;
    onPreview(buildPreviewPlan());
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Auto-save Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{draft.institutionName}</span>
            <span aria-hidden="true">·</span>
            <span>Docente: {draft.teacherName}</span>
            {lastDraftSavedAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 font-medium tabular-nums">
                  Borrador guardado automáticamente ({lastDraftSavedAt})
                </span>
              </>
            )}
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            {draft.editingPlanId
              ? 'Editando Plan de Apoyo Académico guardado'
              : 'Crear nuevo Plan de Apoyo Académico'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {draft.editingPlanId ? (
              <>
                <FilePlus className="h-3.5 w-3.5" />
                Iniciar nuevo plan
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                Limpiar formulario
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleOpenPreview}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Eye className="h-3.5 w-3.5" />
            Vista previa
          </button>
          <button
            type="button"
            onClick={handleSaveOnly}
            disabled={saving || generating}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Guardando...' : 'Guardar en historial'}
          </button>
        </div>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold">
                Por favor verifica los campos obligatorios:
              </p>
              <ul className="mt-1.5 list-disc pl-5 text-xs space-y-1">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Success Status */}
      {statusMessage && (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
          role="status"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm font-medium">{statusMessage}</p>
          </div>
        </div>
      )}

      {/* Section A: Datos Generales */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              A. Datos generales del estudiante e identificación
            </h3>
            <p className="text-xs text-slate-500">
              Los datos de la institución ({config.institutionName}) y del docente ({config.teacherName}) se incluyen automáticamente.
            </p>
          </div>

          {rosters.length > 0 && (
            <button
              type="button"
              onClick={() => setRosterPickerOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-[#0D7136] transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              <UserCheck className="h-3.5 w-3.5" />
              {rosterPickerOpen ? 'Ocultar lista de planilla' : 'Seleccionar estudiante de planilla'}
            </button>
          )}
        </div>

        {/* Optional Quick Student Picker from Integra Roster */}
        {rosterPickerOpen && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-slate-800">
                Estudiantes cargados en planillas ({matchingRoster.length})
              </p>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rosterFilterOnlyLow}
                  onChange={(e) => setRosterFilterOnlyLow(e.target.checked)}
                  className="rounded border-slate-300 text-[#0D7136]"
                />
                Mostrar solo estudiantes con desempeño Bajo (BJ)
              </label>
            </div>
            <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {matchingRoster.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    onChangeDraft({
                      ...draft,
                      studentName: st.name,
                      studentCode: st.code,
                      grade: st.grade,
                      course: st.course,
                      subject: st.subject,
                      period: st.period,
                      academicYear: st.academicYear,
                    });
                    setRosterPickerOpen(false);
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs transition-colors hover:border-[#0D7136] hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{st.name}</p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      Cód. {st.code} · {st.course}
                    </p>
                  </div>
                  {st.performanceLevel && (
                    <span
                      className={`text-[11px] font-mono font-semibold shrink-0 ${
                        st.needsSupport ? 'text-red-600' : 'text-slate-600'
                      }`}
                    >
                      {st.performanceLevel}
                      {st.periodScore !== null ? ` (${st.periodScore})` : ''}
                    </span>
                  )}
                </button>
              ))}
              {matchingRoster.length === 0 && (
                <p className="col-span-full py-3 text-center text-xs text-slate-500">
                  No hay estudiantes para este filtro de curso/desempeño.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Nombre del estudiante (opcional · dejar vacío para formato abierto)
            </label>
            <input
              type="text"
              value={draft.studentName}
              onChange={(e) => updateField('studentName', e.target.value)}
              placeholder="Déjalo vacío para entregar en blanco o escribe el nombre del estudiante"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Código del estudiante (opcional)
            </label>
            <input
              type="text"
              value={draft.studentCode}
              onChange={(e) => updateField('studentCode', e.target.value)}
              placeholder="Ej. 14040"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Año académico *
            </label>
            <input
              type="number"
              min={2020}
              max={2040}
              value={draft.academicYear}
              onChange={(e) => updateField('academicYear', Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Asignatura *
            </label>
            <select
              value={draft.subject}
              onChange={(e) => updateField('subject', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
            >
              {Array.from(new Set([...config.subjects, draft.subject].filter(Boolean))).map(
                (subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Grado *
            </label>
            <select
              value={draft.grade}
              onChange={(e) => updateField('grade', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
            >
              {Array.from(new Set([...config.grades, draft.grade].filter(Boolean))).map(
                (grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Curso(s) *
            </label>
            <input
              type="text"
              value={draft.course}
              onChange={(e) => updateField('course', e.target.value)}
              placeholder="Ej. 06-5 o 10-1, 10-2"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Periodo académico *
            </label>
            <select
              value={draft.period}
              onChange={(e) => updateField('period', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
            >
              <option value="1">Periodo 1</option>
              <option value="2">Periodo 2</option>
              <option value="3">Periodo 3</option>
              <option value="4">Periodo 4</option>
              <option value="Final">Final / Nivelación anual</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Fecha de entrega al estudiante *
            </label>
            <input
              type="date"
              value={draft.deliveryDate}
              onChange={(e) => updateField('deliveryDate', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Fecha límite de sustentación (opcional)
            </label>
            <input
              type="date"
              value={draft.supportDeadline}
              onChange={(e) => updateField('supportDeadline', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Observaciones o compromisos adicionales (opcional)
            </label>
            <input
              type="text"
              value={draft.observations}
              onChange={(e) => updateField('observations', e.target.value)}
              placeholder="Ej. Entregar trabajos impresos y presentar sustentación práctica en horario de clase."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
            />
          </div>
        </div>
      </section>

      {/* Section B: Contenido Académico */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <AcademicTableEditor
          rows={draft.rows}
          onChange={(nextRows) => updateField('rows', nextRows)}
          library={library}
          currentGrade={draft.grade}
          currentSubject={draft.subject}
          isAnnualLeveling={draft.period === 'Final'}
          onSaveRowToLibrary={(row, topicTitle) =>
            onSaveRowToLibrary(row, topicTitle, draft.grade, draft.subject, draft.academicYear)
          }
        />
      </section>

      {/* Section C: Trabajos o talleres asignados */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <AssignedWorksEditor
          works={draft.assignedWorks || [createEmptyAssignedWork()]}
          onChange={(nextWorks) => updateField('assignedWorks', nextWorks)}
          academicRows={draft.rows}
        />
      </section>

      {/* Bottom Primary Generation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs text-slate-500">
          El documento se genera en formato Microsoft Word real (<span className="font-mono">.docx</span>), totalmente editable y listo para imprimir con espacios para firmas.
        </p>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenPreview}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Eye className="h-4 w-4" />
            Vista previa
          </button>
          <button
            type="button"
            onClick={handleGenerateAndDownload}
            disabled={generating || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0D7136] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#095528] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            {generating
              ? 'Generando Word (.docx)...'
              : 'GENERAR Y DESCARGAR PLAN DE APOYO'}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmResetOpen}
        title={draft.editingPlanId ? 'Iniciar un nuevo plan en blanco' : 'Limpiar formulario actual'}
        description="Se limpiarán los campos del formulario actual para iniciar un nuevo plan. Los planes ya guardados en el historial no serán modificados."
        confirmLabel="Sí, iniciar en blanco"
        variant="primary"
        onConfirm={() => {
          onResetDraft();
          setErrors([]);
          setStatusMessage(null);
          setConfirmResetOpen(false);
        }}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
};
