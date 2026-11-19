import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Download,
  Eye,
  FilePlus2,
  Pencil,
  Users,
} from 'lucide-react';
import type {
  AppSection,
  InstitutionalConfig,
  LibraryItem,
  StudentRosterEntry,
  SupportPlan,
} from '../types.ts';
import {
  INSTITUTIONAL_LOGO_URL,
  downloadSinglePlanDocx,
  formatDateSpanish,
} from '../utils/docxGenerator.ts';

interface DashboardViewProps {
  config: InstitutionalConfig;
  plans: SupportPlan[];
  library: LibraryItem[];
  rosters: StudentRosterEntry[];
  onNavigate: (section: AppSection) => void;
  onPreviewPlan: (plan: SupportPlan) => void;
  onEditPlan: (plan: SupportPlan) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  config,
  plans,
  library,
  rosters,
  onNavigate,
  onPreviewPlan,
  onEditPlan,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const uniqueStudents = new Set(
      plans
        .map((p) => p.studentName.trim().toUpperCase())
        .filter(Boolean)
    );

    const byGradeMap = new Map<string, number>();
    for (const g of config.grades) {
      byGradeMap.set(g, 0);
    }
    for (const p of plans) {
      byGradeMap.set(p.grade, (byGradeMap.get(p.grade) || 0) + 1);
    }

    const bySubjectMap = new Map<string, number>();
    for (const s of config.subjects) {
      bySubjectMap.set(s, 0);
    }
    for (const p of plans) {
      bySubjectMap.set(p.subject, (bySubjectMap.get(p.subject) || 0) + 1);
    }

    const maxGradeCount = Math.max(1, ...Array.from(byGradeMap.values()));
    const maxSubjectCount = Math.max(1, ...Array.from(bySubjectMap.values()));
    const lowPerfRosterCount = rosters.filter((r) => r.needsSupport).length;

    return {
      totalPlans: plans.length,
      uniqueStudentsCount: uniqueStudents.size,
      totalLibrary: library.length,
      lowPerfRosterCount,
      byGrade: Array.from(byGradeMap.entries()),
      bySubject: Array.from(bySubjectMap.entries()),
      maxGradeCount,
      maxSubjectCount,
    };
  }, [plans, library, rosters, config]);

  const recentPlans = useMemo(() => {
    return [...plans]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);
  }, [plans]);

  const handleDownload = async (plan: SupportPlan) => {
    setDownloadingId(plan.id);
    try {
      await downloadSinglePlanDocx(plan, config.institutionalFooterNote);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Institutional Welcome Banner */}
      <section className="rounded-xl border border-[#8CB89C]/60 bg-white p-6">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#FAF6D8] p-1.5 ring-1 ring-[#0D7136]/25">
              <img
                src={INSTITUTIONAL_LOGO_URL}
                alt="Escudo Institución Educativa CASD José Prudencio Padilla"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#0D7136]">
                {config.institutionName} · {config.city || 'Barrancabermeja'}
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 text-balance">
                Gestión de Planes de Apoyo Académico
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>Docente: {config.teacherName}</span>
                <span aria-hidden="true">·</span>
                <span>Área: {config.area}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Año académico {config.academicYear}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('batch')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-[#EAF4EE] whitespace-nowrap shrink-0"
            >
              <Users className="h-4 w-4 text-[#0D7136]" />
              Generar para varios estudiantes
            </button>
            <button
              type="button"
              onClick={() => onNavigate('create')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D7136] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#095528] whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="h-4 w-4" />
              Crear nuevo plan
            </button>
          </div>
        </div>
      </section>

      {/* 4 KPI Summary Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Planes elaborados</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">
            {stats.totalPlans}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Documentos guardados en historial
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Estudiantes registrados en planes
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">
            {stats.uniqueStudentsCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {stats.lowPerfRosterCount} en alerta de desempeño bajo en planillas
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Contenidos en biblioteca
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">
            {stats.totalLibrary}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Actividades listas para reutilizar
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Grados configurados
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">
            {config.grades.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 truncate">
            {config.grades.join(' · ')}
          </p>
        </div>
      </section>

      {/* Distribution Breakdown: By Grade & By Subject */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Planes por grado
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              Total: {stats.totalPlans}
            </span>
          </div>

          <div className="mt-5 space-y-3.5">
            {stats.byGrade.map(([grade, count]) => {
              const pct = Math.round((count / stats.maxGradeCount) * 100);
              return (
                <div key={grade} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      Grado {grade}
                    </span>
                    <span className="font-mono font-medium text-slate-900 tabular-nums">
                      {count} {count === 1 ? 'plan' : 'planes'}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#0D7136] transition-all duration-300"
                      style={{ width: `${count > 0 ? Math.max(pct, 6) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Planes por asignatura
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#0D7136] hover:underline"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Ir a biblioteca
            </button>
          </div>

          <div className="mt-5 space-y-3.5">
            {stats.bySubject.map(([subject, count]) => {
              const pct = Math.round((count / stats.maxSubjectCount) * 100);
              return (
                <div key={subject} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate pr-4">
                      {subject}
                    </span>
                    <span className="font-mono font-medium text-slate-900 tabular-nums shrink-0">
                      {count} {count === 1 ? 'plan' : 'planes'}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-700 transition-all duration-300"
                      style={{ width: `${count > 0 ? Math.max(pct, 6) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recent Plans Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Últimos documentos creados
            </h3>
            <p className="text-xs text-slate-500">
              Acceso rápido para visualizar, editar o descargar en formato Word (.docx).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D7136] hover:underline whitespace-nowrap shrink-0"
          >
            Ver historial completo
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentPlans.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              Aún no hay planes de apoyo guardados.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Crea tu primer plan individual o genera planes para varios estudiantes a la vez.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('create')}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0D7136] px-4 py-2 text-xs font-medium text-white hover:bg-[#095528]"
            >
              <FilePlus2 className="h-4 w-4" />
              Crear primer plan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-6 py-3 font-semibold">Código</th>
                  <th className="px-4 py-3 font-semibold">Estudiante</th>
                  <th className="px-4 py-3 font-semibold">Grado / Curso</th>
                  <th className="px-4 py-3 font-semibold">Asignatura</th>
                  <th className="px-4 py-3 font-semibold">Entrega</th>
                  <th className="px-6 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3 font-mono text-[11px] font-medium text-slate-600 tabular-nums whitespace-nowrap">
                      {plan.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {plan.studentName?.trim() || (
                        <span className="text-slate-500 italic font-normal">
                          Formato abierto (sin estudiante)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                      {plan.grade} · {plan.course}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {plan.subject} ({plan.period === 'Final' ? 'Nivelación anual' : `P${plan.period}`})
                    </td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateSpanish(plan.deliveryDate)}
                    </td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPreviewPlan(plan)}
                          title="Vista previa del documento"
                          className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditPlan(plan)}
                          title="Editar plan"
                          className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(plan)}
                          disabled={downloadingId === plan.id}
                          title="Descargar Word (.docx)"
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#0D7136] transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {downloadingId === plan.id ? 'Generando...' : '.docx'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
