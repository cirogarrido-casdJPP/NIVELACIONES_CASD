import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  BookOpen,
  Minimize2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { AcademicContentRow, LibraryItem } from '../types.ts';
import {
  buildConsolidatedAnnualRow,
  summarizeExistingRowForFinal,
  summarizeLibraryItemForAnnual,
} from '../utils/levelingHelper.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

interface AcademicTableEditorProps {
  rows: AcademicContentRow[];
  onChange: (rows: AcademicContentRow[]) => void;
  library: LibraryItem[];
  currentGrade: string;
  currentSubject: string;
  isAnnualLeveling?: boolean;
  onSaveRowToLibrary?: (row: AcademicContentRow, topicTitle: string) => Promise<void>;
}

export function createEmptyAcademicRow(): AcademicContentRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    competency: '',
    topics: '',
    activities: '',
    evaluationCriteria: '',
    bibliography: '',
  };
}

export const AcademicTableEditor: React.FC<AcademicTableEditorProps> = ({
  rows,
  onChange,
  library,
  currentGrade,
  currentSubject,
  isAnnualLeveling = false,
  onSaveRowToLibrary,
}) => {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libSearch, setLibSearch] = useState('');
  const [libGradeFilter, setLibGradeFilter] = useState<string>('ALL');
  const [libSubjectFilter, setLibSubjectFilter] = useState<string>('ALL');
  const [libPeriodFilter, setLibPeriodFilter] = useState<string>('ALL');
  const [compactInsertMode, setCompactInsertMode] = useState<boolean>(isAnnualLeveling);
  const [annualHint, setAnnualHint] = useState<string | null>(null);
  const [rowToDelete, setRowToDelete] = useState<AcademicContentRow | null>(null);

  const [saveRowModal, setSaveRowModal] = useState<AcademicContentRow | null>(null);
  const [saveTopicTitle, setSaveTopicTitle] = useState('');
  const [savingToLib, setSavingToLib] = useState(false);

  const updateRowField = (
    id: string,
    field: keyof Omit<AcademicContentRow, 'id'>,
    value: string
  ) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleAddRow = () => {
    onChange([...rows, createEmptyAcademicRow()]);
  };

  const handleRemoveRow = (row: AcademicContentRow) => {
    const hasContent =
      row.competency.trim() ||
      row.topics.trim() ||
      row.activities.trim() ||
      row.evaluationCriteria.trim() ||
      row.bibliography.trim();

    if (hasContent) {
      setRowToDelete(row);
    } else {
      onChange(rows.filter((r) => r.id !== row.id));
    }
  };

  const confirmDeleteRow = () => {
    if (!rowToDelete) return;
    onChange(rows.filter((r) => r.id !== rowToDelete.id));
    setRowToDelete(null);
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const copy = [...rows];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    onChange(copy);
  };

  const insertFromLibrary = (item: LibraryItem) => {
    const newRow: AcademicContentRow = compactInsertMode
      ? summarizeLibraryItemForAnnual(item)
      : {
          id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          competency: item.competency,
          topics: item.topics,
          activities: item.activities,
          evaluationCriteria: item.evaluationCriteria,
          bibliography: item.bibliography,
        };
    const isSingleEmpty =
      rows.length === 1 &&
      !rows[0].competency.trim() &&
      !rows[0].topics.trim() &&
      !rows[0].activities.trim() &&
      !rows[0].evaluationCriteria.trim() &&
      !rows[0].bibliography.trim();

    onChange(isSingleEmpty ? [newRow] : [...rows, newRow]);
    setLibraryOpen(false);
  };

  const handleLoadAnnualSynthesis = () => {
    const summaryRow = buildConsolidatedAnnualRow(library, currentGrade, currentSubject);
    if (!summaryRow) {
      setAnnualHint(
        `No hay unidades guardadas en la biblioteca para ${currentSubject} (${currentGrade}). Puedes resumir las filas actuales o insertar desde la biblioteca.`
      );
      return;
    }
    setAnnualHint(
      `Se cargó la síntesis anual con los desempeños básicos de ${currentSubject} (${currentGrade}).`
    );
    onChange([summaryRow]);
  };

  const handleSummarizeCurrentRows = () => {
    const hasContent = rows.some(
      (r) =>
        r.competency.trim() ||
        r.topics.trim() ||
        r.activities.trim() ||
        r.evaluationCriteria.trim()
    );
    if (!hasContent) {
      setAnnualHint('Agrega o inserta primero algún desempeño para poder resumirlo.');
      return;
    }
    onChange(rows.map(summarizeExistingRowForFinal));
    setAnnualHint(
      'Contenido resumido al desempeño más básico para mantener la nivelación anual breve y clara.'
    );
  };

  const filteredLibrary = library.filter((item) => {
    const matchesGrade = libGradeFilter === 'ALL' || item.grade === libGradeFilter;
    const matchesSubject =
      libSubjectFilter === 'ALL' || item.subject === libSubjectFilter;
    const matchesPeriod =
      libPeriodFilter === 'ALL' || (item.period || '') === libPeriodFilter;
    const q = libSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.topic.toLowerCase().includes(q) ||
      item.competency.toLowerCase().includes(q) ||
      item.topics.toLowerCase().includes(q) ||
      item.activities.toLowerCase().includes(q) ||
      item.subject.toLowerCase().includes(q);
    return matchesGrade && matchesSubject && matchesPeriod && matchesSearch;
  });

  const handleConfirmSaveToLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveRowModal || !onSaveRowToLibrary) return;
    setSavingToLib(true);
    try {
      await onSaveRowToLibrary(
        saveRowModal,
        saveTopicTitle.trim() || `Contenido ${currentGrade} - ${currentSubject}`
      );
      setSaveRowModal(null);
      setSaveTopicTitle('');
    } finally {
      setSavingToLib(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            B. Contenido académico del plan
          </h3>
          <p className="text-xs text-slate-500">
            Organiza competencias, temas, actividades, criterios y bibliografía. Puedes agregar filas ilimitadas y escribir textos extensos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setLibGradeFilter(currentGrade || 'ALL');
              setLibSubjectFilter('ALL');
              setLibPeriodFilter('ALL');
              setCompactInsertMode(Boolean(isAnnualLeveling));
              setLibraryOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <BookOpen className="h-4 w-4 text-[#0D7136]" />
            Insertar desde biblioteca
          </button>
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0D7136] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#095528] whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Agregar fila de competencia
          </button>
        </div>
      </div>

      {isAnnualLeveling && (
        <div className="rounded-xl border border-[#8CB89C] bg-[#EAF4EE]/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-[#095528]">
                Nivelación Final / Anual: desempeño básico y resumen breve
              </p>
              <p className="text-xs text-slate-700">
                Para evitar documentos demasiado extensos, sintetiza los desempeños del grado al indicador más básico o resume las filas actuales.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLoadAnnualSynthesis}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D7136] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#095528] whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Cargar síntesis anual (desempeño básico)
              </button>
              <button
                type="button"
                onClick={handleSummarizeCurrentRows}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#8CB89C] bg-white px-3.5 py-2 text-xs font-medium text-[#095528] transition-colors hover:bg-[#F7FBF8] whitespace-nowrap shrink-0"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                Resumir contenido actual
              </button>
            </div>
          </div>

          {annualHint && (
            <p className="text-xs font-medium text-[#095528]">{annualHint}</p>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            No hay filas académicas agregadas todavía.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Agrega una fila manualmente o inserta un contenido guardado de tu biblioteca de actividades.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <BookOpen className="h-4 w-4" />
              Explorar biblioteca
            </button>
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D7136] px-4 py-2 text-xs font-medium text-white hover:bg-[#095528]"
            >
              <Plus className="h-4 w-4" />
              Agregar primera fila
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="rounded-xl border border-slate-200 bg-white shadow-xs"
            >
              {/* Row Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 rounded-t-xl">
                <span className="text-xs font-semibold text-[#0D7136] tabular-nums">
                  Competencia / Bloque #{index + 1}
                </span>

                <div className="flex items-center gap-1.5">
                  {onSaveRowToLibrary && (
                    <button
                      type="button"
                      onClick={() => {
                        setSaveRowModal(row);
                        setSaveTopicTitle(
                          row.topics.split('\n')[0]?.slice(0, 80) ||
                            `${currentSubject} ${currentGrade}`
                        );
                      }}
                      title="Guardar este bloque en la biblioteca para reutilizarlo"
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5 text-[#0D7136]" />
                      Guardar en biblioteca
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => moveRow(index, -1)}
                    disabled={index === 0}
                    title="Subir fila"
                    className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-35"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(index, 1)}
                    disabled={index === rows.length - 1}
                    title="Bajar fila"
                    className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-35"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row)}
                    title="Eliminar fila"
                    className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 5 Editable Fields */}
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2 xl:grid-cols-5">
                <div className="flex flex-col">
                  <label className="mb-1.5 text-xs font-semibold text-slate-700">
                    1. Competencias / Desempeños a evaluar
                  </label>
                  <textarea
                    rows={6}
                    value={row.competency}
                    onChange={(e) =>
                      updateRowField(row.id, 'competency', e.target.value)
                    }
                    placeholder="Describe las competencias o desempeños pendientes que debe alcanzar el estudiante..."
                    className="w-full flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-xs font-semibold text-slate-700">
                    2. Temas - Subtemas
                  </label>
                  <textarea
                    rows={6}
                    value={row.topics}
                    onChange={(e) =>
                      updateRowField(row.id, 'topics', e.target.value)
                    }
                    placeholder="Lista los temas y subtemas a estudiar o reforzar..."
                    className="w-full flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-xs font-semibold text-slate-700">
                    3. Acciones / Actividades a realizar
                  </label>
                  <textarea
                    rows={6}
                    value={row.activities}
                    onChange={(e) =>
                      updateRowField(row.id, 'activities', e.target.value)
                    }
                    placeholder="Detalla paso a paso los talleres, trabajos prácticos, ejercicios o productos a entregar..."
                    className="w-full flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-xs font-semibold text-slate-700">
                    4. Criterios de evaluación
                  </label>
                  <textarea
                    rows={6}
                    value={row.evaluationCriteria}
                    onChange={(e) =>
                      updateRowField(row.id, 'evaluationCriteria', e.target.value)
                    }
                    placeholder="Porcentajes, rúbrica de entrega, sustentación y calidad..."
                    className="w-full flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-xs font-semibold text-slate-700">
                    5. Bibliografía / Webgrafía
                  </label>
                  <textarea
                    rows={6}
                    value={row.bibliography}
                    onChange={(e) =>
                      updateRowField(row.id, 'bibliography', e.target.value)
                    }
                    placeholder="Guías de clase, libros, sitios web o enlaces de apoyo..."
                    className="w-full flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Insert from Library */}
      {libraryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Insertar contenido desde la Biblioteca de Actividades
                </h3>
                <p className="text-xs text-slate-500">
                  Selecciona un registro guardado para agregarlo como fila en el plan actual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLibraryOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-6 py-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                  placeholder="Buscar por tema, competencia o actividad..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
                />
              </div>

              <select
                value={libGradeFilter}
                onChange={(e) => setLibGradeFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0D7136] focus:outline-none"
              >
                <option value="ALL">Todos los grados</option>
                {Array.from(new Set(library.map((l) => l.grade))).map((g) => (
                  <option key={g} value={g}>
                    Grado {g}
                  </option>
                ))}
              </select>

              <select
                value={libSubjectFilter}
                onChange={(e) => setLibSubjectFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0D7136] focus:outline-none"
              >
                <option value="ALL">Todas las asignaturas</option>
                {Array.from(new Set(library.map((l) => l.subject))).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={libPeriodFilter}
                onChange={(e) => setLibPeriodFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0D7136] focus:outline-none"
              >
                <option value="ALL">Todos los periodos</option>
                <option value="1">Periodo 1</option>
                <option value="2">Periodo 2</option>
                <option value="3">Periodo 3</option>
                <option value="4">Periodo 4</option>
              </select>

              <label className="flex w-full items-center gap-2 pt-1 text-xs font-medium text-[#095528] cursor-pointer">
                <input
                  type="checkbox"
                  checked={compactInsertMode}
                  onChange={(e) => setCompactInsertMode(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0D7136]"
                />
                Insertar resumen breve (escoger solo el desempeño más básico para nivelación final / anual)
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {filteredLibrary.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No se encontraron actividades en la biblioteca con ese filtro.
                </div>
              ) : (
                filteredLibrary.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50/60 sm:flex-row sm:items-start"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                        <span className="font-semibold text-[#0D7136]">Grado {item.grade}</span>
                        <span>·</span>
                        <span>{item.subject}</span>
                        {item.period && (
                          <>
                            <span>·</span>
                            <span>Periodo {item.period}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>Año {item.academicYear}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {item.topic}
                      </h4>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        <span className="font-medium text-slate-800">Competencia: </span>
                        {item.competency}
                      </p>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        <span className="font-medium text-slate-800">Actividades: </span>
                        {item.activities}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => insertFromLibrary(item)}
                      className="rounded-lg bg-[#0D7136] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#095528] whitespace-nowrap shrink-0"
                    >
                      Insertar al plan
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Save Row to Library */}
      {saveRowModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmSaveToLibrary}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Guardar fila en la Biblioteca de Actividades
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Podrás reutilizar este bloque en futuros planes de {currentGrade} ({currentSubject}) u otros años académicos.
            </p>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Nombre o tema identificador *
              </label>
              <input
                type="text"
                required
                value={saveTopicTitle}
                onChange={(e) => setSaveTopicTitle(e.target.value)}
                placeholder="Ej. Diseño de folletos en Microsoft Word"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D7136] focus:outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSaveRowModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingToLib}
                className="rounded-lg bg-[#0D7136] px-4 py-2 text-xs font-medium text-white hover:bg-[#095528] disabled:opacity-60"
              >
                {savingToLib ? 'Guardando...' : 'Guardar en biblioteca'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={Boolean(rowToDelete)}
        title="Eliminar fila académica"
        description="Esta fila contiene texto diligenciado. ¿Deseas eliminarla de este plan de apoyo?"
        confirmLabel="Sí, eliminar fila"
        onConfirm={confirmDeleteRow}
        onCancel={() => setRowToDelete(null)}
      />
    </div>
  );
};
