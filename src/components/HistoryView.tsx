import React, { useMemo, useState } from 'react';
import {
  Copy,
  Download,
  Eye,
  FileArchive,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import type { InstitutionalConfig, SupportPlan } from '../types.ts';
import {
  downloadBatchPlansZip,
  downloadSinglePlanDocx,
  formatDateSpanish,
} from '../utils/docxGenerator.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

interface HistoryViewProps {
  config: InstitutionalConfig;
  plans: SupportPlan[];
  onPreviewPlan: (plan: SupportPlan) => void;
  onEditPlan: (plan: SupportPlan) => void;
  onDuplicatePlan: (plan: SupportPlan) => Promise<void>;
  onDeletePlan: (id: string) => Promise<void>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  config,
  plans,
  onPreviewPlan,
  onEditPlan,
  onDuplicatePlan,
  onDeletePlan,
}) => {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<SupportPlan | null>(null);

  const filterOptions = useMemo(() => {
    const grades = Array.from(new Set(plans.map((p) => p.grade))).sort();
    const subjects = Array.from(new Set(plans.map((p) => p.subject))).sort();
    const courses = Array.from(new Set(plans.map((p) => p.course))).sort();
    const years = Array.from(new Set(plans.map((p) => p.academicYear))).sort(
      (a, b) => b - a
    );
    return { grades, subjects, courses, years };
  }, [plans]);

  const filteredPlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...plans]
      .filter((p) => {
        if (gradeFilter !== 'ALL' && p.grade !== gradeFilter) return false;
        if (subjectFilter !== 'ALL' && p.subject !== subjectFilter) return false;
        if (courseFilter !== 'ALL' && p.course !== courseFilter) return false;
        if (yearFilter !== 'ALL' && String(p.academicYear) !== yearFilter) return false;
        if (!q) return true;
        return (
          p.studentName.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.studentCode || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [plans, search, gradeFilter, subjectFilter, courseFilter, yearFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (
      filteredPlans.length > 0 &&
      filteredPlans.every((p) => selectedIds.has(p.id))
    ) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPlans.map((p) => p.id)));
    }
  };

  const handleDownloadOne = async (plan: SupportPlan) => {
    setDownloadingId(plan.id);
    try {
      await downloadSinglePlanDocx(plan, config.institutionalFooterNote);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadSelectedZip = async () => {
    const selectedPlans = plans.filter((p) => selectedIds.has(p.id));
    if (selectedPlans.length === 0) return;
    setZipping(true);
    try {
      await downloadBatchPlansZip(
        selectedPlans,
        `Historial_Planes_CASD_${new Date().toISOString().slice(0, 10)}`,
        config.institutionalFooterNote
      );
    } finally {
      setZipping(false);
    }
  };

  const formatCreatedAt = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Historial de planes</h2>
          <p className="text-xs text-slate-500">
            Consulta, filtra, visualiza, edita, duplica o descarga nuevamente los Planes de Apoyo Académico guardados.
          </p>
        </div>

        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={handleDownloadSelectedZip}
            disabled={zipping}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <FileArchive className="h-4 w-4" />
            {zipping
              ? 'Generando ZIP...'
              : `Descargar ${selectedIds.size} seleccionado(s) en ZIP`}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por estudiante o código de plan..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
          />
        </div>

        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0D7136] focus:outline-none"
        >
          <option value="ALL">Todos los grados</option>
          {filterOptions.grades.map((g) => (
            <option key={g} value={g}>
              Grado {g}
            </option>
          ))}
        </select>

        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0D7136] focus:outline-none"
        >
          <option value="ALL">Todos los cursos</option>
          {filterOptions.courses.map((c) => (
            <option key={c} value={c}>
              Curso {c}
            </option>
          ))}
        </select>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0D7136] focus:outline-none"
        >
          <option value="ALL">Todas las asignaturas</option>
          {filterOptions.subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:border-[#0D7136] focus:outline-none"
        >
          <option value="ALL">Todos los años</option>
          {filterOptions.years.map((y) => (
            <option key={y} value={String(y)}>
              Año {y}
            </option>
          ))}
        </select>
      </div>

      {/* Plans Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="w-10 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredPlans.length > 0 &&
                      filteredPlans.every((p) => selectedIds.has(p.id))
                    }
                    onChange={toggleSelectAllFiltered}
                    aria-label="Seleccionar todos los planes filtrados"
                    className="h-4 w-4 rounded border-slate-300 text-[#0D7136]"
                  />
                </th>
                <th className="px-3 py-3 font-semibold">Código único</th>
                <th className="px-3 py-3 font-semibold">Estudiante</th>
                <th className="px-3 py-3 font-semibold">Grado / Curso</th>
                <th className="px-3 py-3 font-semibold">Asignatura</th>
                <th className="px-3 py-3 font-semibold">Año</th>
                <th className="px-3 py-3 font-semibold">Entrega</th>
                <th className="px-3 py-3 font-semibold">Creación</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No se encontraron planes de apoyo con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => (
                  <tr
                    key={plan.id}
                    className={`transition-colors ${
                      selectedIds.has(plan.id)
                        ? 'bg-slate-50'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(plan.id)}
                        onChange={() => toggleSelect(plan.id)}
                        aria-label={`Seleccionar plan de ${plan.studentName || 'formato abierto'}`}
                        className="h-4 w-4 rounded border-slate-300 text-[#0D7136]"
                      />
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] font-medium text-[#0D7136] tabular-nums whitespace-nowrap">
                      {plan.code}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">
                        {plan.studentName?.trim() || (
                          <span className="text-slate-500 italic font-normal">
                            Formato abierto (sin estudiante)
                          </span>
                        )}
                      </p>
                      {plan.studentCode && (
                        <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                          Cód. {plan.studentCode}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-700 tabular-nums whitespace-nowrap">
                      {plan.grade} · {plan.course}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {plan.subject} · {plan.period === 'Final' ? 'Nivelación anual' : `P${plan.period}`}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-700 tabular-nums">
                      {plan.academicYear}
                    </td>
                    <td className="px-3 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateSpanish(plan.deliveryDate)}
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                      {formatCreatedAt(plan.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onPreviewPlan(plan)}
                          title="Abrir / Visualizar documento"
                          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditPlan(plan)}
                          title="Editar plan guardado"
                          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDuplicatePlan(plan)}
                          title="Duplicar plan"
                          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadOne(plan)}
                          disabled={downloadingId === plan.id}
                          title="Descargar Word (.docx)"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#0D7136] hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {downloadingId === plan.id ? '...' : '.docx'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlanToDelete(plan)}
                          title="Eliminar plan"
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(planToDelete)}
        title="Eliminar plan del historial"
        description={`¿Deseas eliminar permanentemente el plan ${planToDelete?.code} (${planToDelete?.studentName?.trim() || 'Formato abierto'})? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar plan"
        onConfirm={async () => {
          if (planToDelete) {
            await onDeletePlan(planToDelete.id);
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(planToDelete.id);
              return next;
            });
            setPlanToDelete(null);
          }
        }}
        onCancel={() => setPlanToDelete(null)}
      />
    </div>
  );
};
