import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CopyPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { InstitutionalConfig, LibraryItem } from '../types.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

interface LibraryViewProps {
  config: InstitutionalConfig;
  library: LibraryItem[];
  onCreateItem: (item: Partial<LibraryItem>) => Promise<LibraryItem>;
  onUpdateItem: (id: string, item: Partial<LibraryItem>) => Promise<LibraryItem>;
  onDeleteItem: (id: string) => Promise<void>;
  onInsertIntoNewPlan: (item: LibraryItem) => void;
}

interface LibraryFormState {
  id?: string;
  grade: string;
  subject: string;
  period: string;
  topic: string;
  academicYear: number;
  competency: string;
  topics: string;
  activities: string;
  evaluationCriteria: string;
  bibliography: string;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  config,
  library,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onInsertIntoNewPlan,
}) => {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<LibraryFormState>({
    grade: config.grades[0] || '6°',
    subject: config.subjects[0] || 'Informática',
    period: '1',
    topic: '',
    academicYear: config.academicYear,
    competency: '',
    topics: '',
    activities: '',
    evaluationCriteria: '',
    bibliography: '',
  });

  const [itemToDelete, setItemToDelete] = useState<LibraryItem | null>(null);

  const yearsAvailable = useMemo(() => {
    const set = new Set(library.map((i) => i.academicYear));
    set.add(config.academicYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [library, config.academicYear]);

  const gradesAvailable = useMemo(() => {
    return Array.from(new Set([...config.grades, ...library.map((i) => i.grade)]));
  }, [config.grades, library]);

  const subjectsAvailable = useMemo(() => {
    return Array.from(new Set([...config.subjects, ...library.map((i) => i.subject)]));
  }, [config.subjects, library]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library.filter((item) => {
      if (gradeFilter !== 'ALL' && item.grade !== gradeFilter) return false;
      if (subjectFilter !== 'ALL' && item.subject !== subjectFilter) return false;
      if (periodFilter !== 'ALL' && (item.period || '') !== periodFilter) return false;
      if (yearFilter !== 'ALL' && String(item.academicYear) !== yearFilter) return false;
      if (!q) return true;
      return (
        item.topic.toLowerCase().includes(q) ||
        item.competency.toLowerCase().includes(q) ||
        item.topics.toLowerCase().includes(q) ||
        item.activities.toLowerCase().includes(q) ||
        item.bibliography.toLowerCase().includes(q)
      );
    });
  }, [library, search, gradeFilter, subjectFilter, periodFilter, yearFilter]);

  const openCreateModal = () => {
    setFormState({
      grade: config.grades[0] || '6°',
      subject: config.subjects[0] || 'Informática',
      period: '1',
      topic: '',
      academicYear: config.academicYear,
      competency: '',
      topics: '',
      activities: '',
      evaluationCriteria: '',
      bibliography: '',
    });
    setFormOpen(true);
  };

  const openEditModal = (item: LibraryItem) => {
    setFormState({
      id: item.id,
      grade: item.grade,
      subject: item.subject,
      period: item.period || '',
      topic: item.topic,
      academicYear: item.academicYear,
      competency: item.competency,
      topics: item.topics,
      activities: item.activities,
      evaluationCriteria: item.evaluationCriteria,
      bibliography: item.bibliography,
    });
    setFormOpen(true);
  };

  const handleReuseForCurrentYear = async (item: LibraryItem) => {
    await onCreateItem({
      grade: item.grade,
      subject: item.subject,
      period: item.period,
      topic: `${item.topic} (${config.academicYear})`,
      academicYear: config.academicYear,
      competency: item.competency,
      topics: item.topics,
      activities: item.activities,
      evaluationCriteria: item.evaluationCriteria,
      bibliography: item.bibliography,
    });
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (formState.id) {
        await onUpdateItem(formState.id, formState);
      } else {
        await onCreateItem(formState);
      }
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Biblioteca de actividades y contenidos
          </h2>
          <p className="text-xs text-slate-500">
            Almacena, organiza y reutiliza competencias, temas, actividades, criterios y bibliografía entre periodos y años académicos.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0D7136] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#095528] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nuevo contenido académico
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tema, competencia, actividad o enlace..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
          />
        </div>

        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0D7136] focus:outline-none"
        >
          <option value="ALL">Todos los grados</option>
          {gradesAvailable.map((g) => (
            <option key={g} value={g}>
              Grado {g}
            </option>
          ))}
        </select>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0D7136] focus:outline-none"
        >
          <option value="ALL">Todas las asignaturas</option>
          {subjectsAvailable.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0D7136] focus:outline-none"
        >
          <option value="ALL">Todos los periodos</option>
          <option value="1">Periodo 1</option>
          <option value="2">Periodo 2</option>
          <option value="3">Periodo 3</option>
          <option value="4">Periodo 4</option>
        </select>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:border-[#0D7136] focus:outline-none"
        >
          <option value="ALL">Todos los años</option>
          {yearsAvailable.map((y) => (
            <option key={y} value={String(y)}>
              Año {y}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-700">
            No se encontraron contenidos con los filtros actuales.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Crea un nuevo contenido académico o ajusta los filtros de búsqueda.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0D7136] px-4 py-2 text-xs font-medium text-white hover:bg-[#095528]"
          >
            <Plus className="h-4 w-4" />
            Crear primer contenido
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredItems.map((item) => (
            <article
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <span className="font-semibold text-[#0D7136]">
                        Grado {item.grade}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.subject}</span>
                      {item.period && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Periodo {item.period}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>Año {item.academicYear}</span>
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">
                      {item.topic}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      title="Editar contenido"
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      title="Eliminar contenido"
                      className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <dl className="mt-4 space-y-2.5 text-xs">
                  <div>
                    <dt className="font-semibold text-slate-700">
                      Competencias / Desempeños:
                    </dt>
                    <dd className="mt-0.5 text-slate-600 whitespace-pre-line line-clamp-3">
                      {item.competency || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">
                      Temas - Subtemas:
                    </dt>
                    <dd className="mt-0.5 text-slate-600 whitespace-pre-line line-clamp-3">
                      {item.topics || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">
                      Acciones / Actividades:
                    </dt>
                    <dd className="mt-0.5 text-slate-600 whitespace-pre-line line-clamp-3">
                      {item.activities || '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
                {item.academicYear !== config.academicYear ? (
                  <button
                    type="button"
                    onClick={() => handleReuseForCurrentYear(item)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                  >
                    <CopyPlus className="h-3.5 w-3.5" />
                    Reutilizar en {config.academicYear}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleReuseForCurrentYear(item)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <CopyPlus className="h-3.5 w-3.5" />
                    Duplicar plantilla
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onInsertIntoNewPlan(item)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D7136] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#095528] whitespace-nowrap shrink-0"
                >
                  Insertar en nuevo plan
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal: Create / Edit Library Item */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveForm}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {formState.id
                  ? 'Editar contenido de la biblioteca'
                  : 'Guardar nuevo contenido en la biblioteca'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Grado *
                  </label>
                  <select
                    value={formState.grade}
                    onChange={(e) =>
                      setFormState({ ...formState, grade: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
                  >
                    {gradesAvailable.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Asignatura *
                  </label>
                  <select
                    value={formState.subject}
                    onChange={(e) =>
                      setFormState({ ...formState, subject: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
                  >
                    {subjectsAvailable.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Periodo
                  </label>
                  <select
                    value={formState.period}
                    onChange={(e) =>
                      setFormState({ ...formState, period: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
                  >
                    <option value="">General</option>
                    <option value="1">Periodo 1</option>
                    <option value="2">Periodo 2</option>
                    <option value="3">Periodo 3</option>
                    <option value="4">Periodo 4</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Año académico *
                  </label>
                  <input
                    type="number"
                    required
                    value={formState.academicYear}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        academicYear: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Tema principal / Título identificador *
                </label>
                <input
                  type="text"
                  required
                  value={formState.topic}
                  onChange={(e) =>
                    setFormState({ ...formState, topic: e.target.value })
                  }
                  placeholder="Ej. Procesador de texto Microsoft Word y folletos"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  1. Competencias / Desempeños a evaluar *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formState.competency}
                  onChange={(e) =>
                    setFormState({ ...formState, competency: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  2. Temas - Subtemas *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formState.topics}
                  onChange={(e) =>
                    setFormState({ ...formState, topics: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  3. Acciones / Actividades a realizar *
                </label>
                <textarea
                  rows={4}
                  required
                  value={formState.activities}
                  onChange={(e) =>
                    setFormState({ ...formState, activities: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    4. Criterios de evaluación *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formState.evaluationCriteria}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        evaluationCriteria: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    5. Bibliografía / Webgrafía
                  </label>
                  <textarea
                    rows={3}
                    value={formState.bibliography}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        bibliography: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#0D7136] px-5 py-2 text-xs font-semibold text-white hover:bg-[#095528] disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Guardar contenido'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={Boolean(itemToDelete)}
        title="Eliminar contenido de la biblioteca"
        description={`¿Estás seguro de eliminar "${itemToDelete?.topic}"? Esta acción no afectará a los planes ya generados en el historial.`}
        confirmLabel="Sí, eliminar"
        onConfirm={async () => {
          if (itemToDelete) {
            await onDeleteItem(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
