import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileArchive,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import type {
  AcademicContentRow,
  AssignedWork,
  InstitutionalConfig,
  LibraryItem,
  StudentRosterEntry,
  SupportPlan,
} from '../types.ts';
import { AcademicTableEditor, createEmptyAcademicRow } from './AcademicTableEditor.tsx';
import { AssignedWorksEditor, createEmptyAssignedWork } from './AssignedWorksEditor.tsx';
import {
  downloadBatchPlansZip,
  downloadSinglePlanDocx,
} from '../utils/docxGenerator.ts';
import { parseIntegraHtmlPlanilla } from '../utils/integraParser.ts';

interface BatchStudentItem {
  id: string;
  name: string;
  code: string;
  performanceLevel?: string;
  periodScore?: number | null;
  needsSupport?: boolean;
  selected: boolean;
}

interface BatchPlansViewProps {
  config: InstitutionalConfig;
  library: LibraryItem[];
  rosters: StudentRosterEntry[];
  existingPlans: SupportPlan[];
  onCreateBatchPlans: (plans: Partial<SupportPlan>[]) => Promise<SupportPlan[]>;
  onImportRoster: (entries: StudentRosterEntry[]) => Promise<void>;
  onPreview: (plan: SupportPlan) => void;
  onSaveRowToLibrary: (
    row: AcademicContentRow,
    topicTitle: string,
    grade: string,
    subject: string,
    year: number
  ) => Promise<void>;
}

export const BatchPlansView: React.FC<BatchPlansViewProps> = ({
  config,
  library,
  rosters,
  existingPlans,
  onCreateBatchPlans,
  onImportRoster,
  onPreview,
  onSaveRowToLibrary,
}) => {
  const today = new Date().toISOString().slice(0, 10);

  const [subject, setSubject] = useState(config.subjects[0] || 'Informática');
  const [grade, setGrade] = useState(config.grades[0] || '6°');
  const [course, setCourse] = useState('06-5');
  const [period, setPeriod] = useState('4');
  const [academicYear, setAcademicYear] = useState(config.academicYear);
  const [deliveryDate, setDeliveryDate] = useState(today);
  const [supportDeadline, setSupportDeadline] = useState('');
  const [observations, setObservations] = useState('');
  const [rows, setRows] = useState<AcademicContentRow[]>([createEmptyAcademicRow()]);
  const [assignedWorks, setAssignedWorks] = useState<AssignedWork[]>([
    createEmptyAssignedWork(),
  ]);

  const [students, setStudents] = useState<BatchStudentItem[]>(() =>
    rosters
      .filter((r) => r.course === '06-5')
      .map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        performanceLevel: r.performanceLevel,
        periodScore: r.periodScore,
        needsSupport: r.needsSupport,
        selected: r.needsSupport,
      }))
  );

  const [manualName, setManualName] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulkPaste, setShowBulkPaste] = useState(false);

  const [generatedPlans, setGeneratedPlans] = useState<SupportPlan[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [downloadingOne, setDownloadingOne] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedStudents = useMemo(
    () => students.filter((s) => s.selected),
    [students]
  );

  const availableRosterGroups = useMemo(() => {
    const groups = new Map<string, { course: string; subject: string; period: string; grade: string; year: number; count: number }>();
    for (const r of rosters) {
      const key = `${r.course}|${r.subject}|${r.period}|${r.academicYear}`;
      if (!groups.has(key)) {
        groups.set(key, {
          course: r.course,
          subject: r.subject,
          period: r.period,
          grade: r.grade,
          year: r.academicYear,
          count: 1,
        });
      } else {
        groups.get(key)!.count += 1;
      }
    }
    return Array.from(groups.entries());
  }, [rosters]);

  const handleLoadRosterGroup = (key: string) => {
    const [rCourse, rSubject, rPeriod, rYear] = key.split('|');
    const matched = rosters.filter(
      (r) =>
        r.course === rCourse &&
        r.subject === rSubject &&
        r.period === rPeriod &&
        String(r.academicYear) === rYear
    );
    if (matched.length === 0) return;
    setCourse(rCourse);
    setGrade(matched[0].grade);
    setSubject(rSubject);
    setPeriod(rPeriod);
    setAcademicYear(matched[0].academicYear);
    setStudents(
      matched.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        performanceLevel: r.performanceLevel,
        periodScore: r.periodScore,
        needsSupport: r.needsSupport,
        selected: r.needsSupport,
      }))
    );
    setStatusMessage(
      `Se cargaron ${matched.length} estudiantes de ${rCourse} (${matched.filter((m) => m.needsSupport).length} marcados en desempeño bajo).`
    );
  };

  const handleUploadIntegraHtml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseIntegraHtmlPlanilla(text, config.passingScore);
      if (parsed.students.length === 0) {
        setErrors(['No se encontraron estudiantes en el archivo HTML seleccionado.']);
        return;
      }
      await onImportRoster(parsed.students);
      setCourse(parsed.course);
      setGrade(parsed.grade);
      setSubject(parsed.subject);
      setPeriod(parsed.period);
      setAcademicYear(parsed.academicYear);
      setStudents(
        parsed.students.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          performanceLevel: s.performanceLevel,
          periodScore: s.periodScore,
          needsSupport: s.needsSupport,
          selected: s.needsSupport,
        }))
      );
      setErrors([]);
      setStatusMessage(
        `Planilla Integra "${file.name}" importada: ${parsed.students.length} estudiantes (${parsed.students.filter((s) => s.needsSupport).length} en desempeño bajo).`
      );
    } catch {
      setErrors(['Error al leer el archivo HTML de la planilla.']);
    } finally {
      e.target.value = '';
    }
  };

  const handleAddManualStudent = () => {
    const cleanName = manualName.trim();
    if (!cleanName) return;
    setStudents((prev) => [
      {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName.toUpperCase(),
        code: manualCode.trim(),
        selected: true,
      },
      ...prev,
    ]);
    setManualName('');
    setManualCode('');
  };

  const handleAddBulkPaste = () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const added: BatchStudentItem[] = lines.map((line, i) => {
      const parts = line.split(/[-,;|\t]+/).map((p) => p.trim());
      const looksLikeCodeFirst = parts.length >= 2 && /^\d+$/.test(parts[0]);
      return {
        id: `bulk-${Date.now()}-${i}`,
        code: looksLikeCodeFirst ? parts[0] : '',
        name: (looksLikeCodeFirst ? parts.slice(1).join(' ') : line).toUpperCase(),
        selected: true,
      };
    });

    setStudents((prev) => [...added, ...prev]);
    setBulkText('');
    setShowBulkPaste(false);
  };

  const toggleStudent = (id: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  };

  const selectAll = (val: boolean) => {
    setStudents((prev) => prev.map((s) => ({ ...s, selected: val })));
  };

  const selectOnlyLowPerformance = () => {
    setStudents((prev) =>
      prev.map((s) => ({ ...s, selected: Boolean(s.needsSupport) }))
    );
  };

  const removeStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const copyFromExistingPlan = (planId: string) => {
    const found = existingPlans.find((p) => p.id === planId);
    if (!found) return;
    setRows(
      found.rows.map((r) => ({
        ...r,
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      }))
    );
    setSubject(found.subject);
    setGrade(found.grade);
    setCourse(found.course);
    setPeriod(found.period);
    if (found.observations) setObservations(found.observations);
    if (found.assignedWorks && found.assignedWorks.length > 0) {
      setAssignedWorks(
        found.assignedWorks.map((w) => ({
          ...w,
          id: `work-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        }))
      );
    }
  };

  const validateBatch = (): string[] => {
    const errs: string[] = [];
    if (!subject.trim()) errs.push('Selecciona la asignatura.');
    if (!grade.trim()) errs.push('Selecciona el grado.');
    if (!course.trim()) errs.push('Ingresa el curso.');
    if (!deliveryDate) errs.push('Selecciona la fecha de entrega.');
    const hasValidRow = rows.some(
      (r) =>
        r.competency.trim() ||
        r.topics.trim() ||
        r.activities.trim() ||
        r.evaluationCriteria.trim()
    );
    if (!hasValidRow) {
      errs.push('Diligencia al menos una fila en el contenido académico base.');
    }
    if (selectedStudents.length === 0) {
      errs.push('Selecciona al menos un estudiante para generar los planes.');
    }
    return errs;
  };

  const handleGenerateBatch = async () => {
    const errs = validateBatch();
    setErrors(errs);
    if (errs.length > 0) return;

    setGenerating(true);
    setStatusMessage(null);
    try {
      const batchId = `batch-${Date.now()}`;
      const payloads: Partial<SupportPlan>[] = selectedStudents.map((st) => ({
        institutionName: config.institutionName,
        city: config.city || 'Barrancabermeja',
        teacherName: config.teacherName,
        teacherRole: config.teacherRole,
        area: config.area,
        subject,
        grade,
        course,
        period,
        academicYear,
        studentName: st.name,
        studentCode: st.code,
        deliveryDate,
        supportDeadline,
        observations,
        rows,
        assignedWorks,
        batchId,
      }));

      const saved = await onCreateBatchPlans(payloads);
      setGeneratedPlans(saved);
      setStatusMessage(
        `Se generaron y guardaron ${saved.length} planes individuales en el historial. Ya puedes descargarlos individualmente o en un archivo ZIP.`
      );
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Error al generar el lote de planes.']);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadZip = async () => {
    if (generatedPlans.length === 0) return;
    setZipping(true);
    try {
      await downloadBatchPlansZip(
        generatedPlans,
        `Planes_Apoyo_${course}_${subject}_${academicYear}`,
        config.institutionalFooterNote
      );
    } finally {
      setZipping(false);
    }
  };

  const handleDownloadOne = async (plan: SupportPlan) => {
    setDownloadingOne(plan.id);
    try {
      await downloadSinglePlanDocx(plan, config.institutionalFooterNote);
    } finally {
      setDownloadingOne(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Generación de planes para varios estudiantes
          </h2>
          <p className="text-xs text-slate-500">
            Diligencia una sola vez el contenido académico, selecciona los estudiantes y descarga documentos Word individuales o en archivo ZIP.
          </p>
        </div>

        {existingPlans.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) copyFromExistingPlan(e.target.value);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-[#0D7136] focus:outline-none"
            >
              <option value="" disabled>
                Copiar contenido de un plan guardado...
              </option>
              {existingPlans.slice(0, 15).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.grade} ({p.course}) · {p.studentName?.trim() || 'Formato abierto'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-semibold">Corrige lo siguiente para continuar:</p>
              <ul className="mt-1.5 list-disc pl-5 text-xs space-y-1">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm font-medium">{statusMessage}</p>
          </div>
        </div>
      )}

      {/* Step 1: Base Metadata */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
          1. Plan base — Datos generales del grupo
        </h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Asignatura *
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
            >
              {Array.from(new Set([...config.subjects, subject].filter(Boolean))).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Grado *
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
            >
              {Array.from(new Set([...config.grades, grade].filter(Boolean))).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Curso(s) *
            </label>
            <input
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="Ej. 06-5"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Periodo *
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
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
              Año académico *
            </label>
            <input
              type="number"
              value={academicYear}
              onChange={(e) => setAcademicYear(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Fecha de entrega *
            </label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Fecha límite (opcional)
            </label>
            <input
              type="date"
              value={supportDeadline}
              onChange={(e) => setSupportDeadline(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Observaciones generales
            </label>
            <input
              type="text"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Aplica a todos los estudiantes del lote"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Step 2: Base Academic Content */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <AcademicTableEditor
          rows={rows}
          onChange={setRows}
          library={library}
          currentGrade={grade}
          currentSubject={subject}
          isAnnualLeveling={period === 'Final'}
          onSaveRowToLibrary={(row, topicTitle) =>
            onSaveRowToLibrary(row, topicTitle, grade, subject, academicYear)
          }
        />
      </section>

      {/* Step 2B: Assigned Works */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <AssignedWorksEditor
          works={assignedWorks}
          onChange={setAssignedWorks}
          academicRows={rows}
          titleLabel="C. Trabajos o talleres asignados para realizar (aplica al grupo)"
        />
      </section>

      {/* Step 3: Students Selection */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              2. Selección de estudiantes ({selectedStudents.length} seleccionados de {students.length})
            </h3>
            <p className="text-xs text-slate-500">
              Agrega estudiantes manualmente, pega una lista o importa una planilla HTML de Plataforma Integra.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {availableRosterGroups.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) handleLoadRosterGroup(e.target.value);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-[#0D7136] focus:outline-none"
              >
                <option value="" disabled>
                  Cargar planilla guardada...
                </option>
                {availableRosterGroups.map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.course} · {info.subject} (P{info.period} - {info.count} est.)
                  </option>
                ))}
              </select>
            )}

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0">
              <Upload className="h-3.5 w-3.5 text-[#0D7136]" />
              Importar Planilla Integra (.html)
              <input
                type="file"
                accept=".html,.htm"
                onChange={handleUploadIntegraHtml}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Add manual student or paste list */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Nombre completo del estudiante
            </label>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddManualStudent();
                }
              }}
              placeholder="Ej. PÉREZ GÓMEZ JUAN CAMILO"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Código (opcional)
            </label>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddManualStudent();
                }
              }}
              placeholder="Ej. 14359"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleAddManualStudent}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar estudiante
          </button>
          <button
            type="button"
            onClick={() => setShowBulkPaste((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Pegar lista rápida
          </button>
        </div>

        {showBulkPaste && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-medium text-slate-700">
              Pega un estudiante por línea (puedes incluir código al inicio, ej. <span className="font-mono">14040 - FONTECHA GONZALEZ THALIANA</span>):
            </p>
            <textarea
              rows={4}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'ACOSTA JIMENEZ ALAN DAVID\n14040 - FONTECHA GONZALEZ THALIANA'}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkPaste(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddBulkPaste}
                className="rounded-lg bg-[#0D7136] px-3 py-1.5 text-xs font-medium text-white"
              >
                Agregar lista
              </button>
            </div>
          </div>
        )}

        {/* Quick selection filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectOnlyLowPerformance}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100"
            >
              Seleccionar solo Desempeño Bajo (BJ)
            </button>
            <button
              type="button"
              onClick={() => selectAll(true)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={() => selectAll(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Limpiar selección
            </button>
          </div>
          <span className="text-xs font-medium text-[#0D7136] tabular-nums">
            {selectedStudents.length} seleccionados para generación
          </span>
        </div>

        {/* Students Table */}
        <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="w-10 px-4 py-2.5 text-center">Sel.</th>
                <th className="px-3 py-2.5 font-semibold">Código</th>
                <th className="px-3 py-2.5 font-semibold">Nombre del estudiante</th>
                <th className="px-3 py-2.5 font-semibold">Desempeño / Nota</th>
                <th className="px-4 py-2.5 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No hay estudiantes en la lista. Agrega estudiantes manualmente o carga una planilla.
                  </td>
                </tr>
              ) : (
                students.map((st) => (
                  <tr
                    key={st.id}
                    className={`transition-colors ${
                      st.selected ? 'bg-slate-50/90' : 'bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={st.selected}
                        onChange={() => toggleStudent(st.id)}
                        aria-label={`Seleccionar a ${st.name}`}
                        className="h-4 w-4 rounded border-slate-300 text-[#0D7136] cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500 tabular-nums">
                      {st.code || '—'}
                    </td>
                    <td
                      className="px-3 py-2 font-medium text-slate-900 cursor-pointer"
                      onClick={() => toggleStudent(st.id)}
                    >
                      {st.name}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {st.performanceLevel ? (
                        <span
                          className={`font-mono font-semibold ${
                            st.needsSupport ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {st.performanceLevel}
                          {st.periodScore !== undefined && st.periodScore !== null
                            ? ` · P${period}: ${st.periodScore}`
                            : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">Manual</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          onPreview({
                            id: 'preview-batch-student',
                            code: `CASD-${academicYear}-${course.replace(/[^a-zA-Z0-9]/g, '')}`,
                            institutionName: config.institutionName,
                            city: config.city || 'Barrancabermeja',
                            teacherName: config.teacherName,
                            teacherRole: config.teacherRole,
                            area: config.area,
                            subject,
                            grade,
                            course,
                            period,
                            academicYear,
                            studentName: st.name,
                            studentCode: st.code,
                            deliveryDate,
                            supportDeadline,
                            observations,
                            rows,
                            assignedWorks,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          })
                        }
                        title="Vista previa para este estudiante"
                        className="mr-1 rounded-md p-1 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStudent(st.id)}
                        title="Quitar de la lista"
                        className="rounded-md p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Main Batch Generate Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <p className="text-xs text-slate-500">
            Se creará un documento independiente y un registro en el historial por cada estudiante seleccionado.
          </p>
          <button
            type="button"
            onClick={handleGenerateBatch}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0D7136] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#095528] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Users className="h-4 w-4" />
            {generating
              ? 'Generando planes...'
              : `Generar planes para ${selectedStudents.length} estudiante(s)`}
          </button>
        </div>
      </section>

      {/* Step 4: Generated Batch Download Panel */}
      {generatedPlans.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                3. Documentos generados listos para descargar ({generatedPlans.length})
              </h3>
              <p className="text-xs text-slate-500">
                Descarga cada plan Word (.docx) por separado o empaqueta todos los archivos en un ZIP.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={zipping}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <FileArchive className="h-4 w-4" />
              {zipping
                ? 'Comprimiendo archivo ZIP...'
                : `Descargar todos en ZIP (${generatedPlans.length} archivos .docx)`}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {generatedPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {plan.studentName}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                    {plan.code} · {plan.course}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPreview(plan)}
                    className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    title="Vista previa"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadOne(plan)}
                    disabled={downloadingOne === plan.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#0D7136] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#095528] disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloadingOne === plan.id ? 'Generando...' : 'Descargar .docx'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
