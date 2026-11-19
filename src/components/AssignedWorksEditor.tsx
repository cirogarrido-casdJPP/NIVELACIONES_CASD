import React from 'react';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import type { AcademicContentRow, AssignedWork } from '../types.ts';

export function createEmptyAssignedWork(): AssignedWork {
  return {
    id: `work-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: '',
    description: '',
    deliveryFormat: '',
    dueDate: '',
  };
}

interface AssignedWorksEditorProps {
  works: AssignedWork[];
  onChange: (works: AssignedWork[]) => void;
  academicRows?: AcademicContentRow[];
  titleLabel?: string;
  subtitleLabel?: string;
}

export const AssignedWorksEditor: React.FC<AssignedWorksEditorProps> = ({
  works,
  onChange,
  academicRows = [],
  titleLabel = 'C. Trabajos o talleres asignados para realizar',
  subtitleLabel = 'Especifica los trabajos, talleres o productos concretos que el estudiante debe elaborar y entregar. Si dejas un bloque vacío, no se imprimirá en el documento.',
}) => {
  const handleAddWork = () => {
    onChange([...works, createEmptyAssignedWork()]);
  };

  const handleUpdateWork = (
    id: string,
    field: keyof Omit<AssignedWork, 'id'>,
    value: string
  ) => {
    onChange(works.map((w) => (w.id === id ? { ...w, [field]: value } : w)));
  };

  const handleRemoveWork = (id: string) => {
    if (works.length <= 1) {
      onChange([createEmptyAssignedWork()]);
      return;
    }
    onChange(works.filter((w) => w.id !== id));
  };

  const handlePrefillFromActivities = () => {
    const activitiesText = academicRows
      .map((r) => r.activities.trim())
      .filter(Boolean)
      .join('\n');
    const firstTopic = academicRows
      .map((r) => r.topics.split('\n')[0]?.replace(/^[•\-\d.\s]+/, '').trim())
      .find(Boolean);

    if (!activitiesText) return;

    const hasOnlyEmpty =
      works.length === 1 &&
      !works[0].title.trim() &&
      !works[0].description.trim() &&
      !(works[0].deliveryFormat || '').trim();

    const newWork: AssignedWork = {
      id: `work-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: firstTopic
        ? `Taller de nivelación: ${firstTopic.slice(0, 75)}`
        : 'Trabajo / Taller práctico de nivelación',
      description: activitiesText,
      deliveryFormat: 'Trabajo escrito o digital y sustentación presencial',
      dueDate: '',
    };

    onChange(hasOnlyEmpty ? [newWork] : [...works, newWork]);
  };

  const hasAcademicActivities = academicRows.some((r) => r.activities.trim());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{titleLabel}</h3>
          <p className="text-xs text-slate-500">{subtitleLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {hasAcademicActivities && (
            <button
              type="button"
              onClick={handlePrefillFromActivities}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <ClipboardList className="h-3.5 w-3.5 text-[#0D7136]" />
              Traer desde actividades del plan
            </button>
          )}
          <button
            type="button"
            onClick={handleAddWork}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D7136] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#095528] whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Agregar trabajo
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {works.map((work, index) => (
          <div
            key={work.id}
            className="rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 rounded-t-xl">
              <span className="text-xs font-semibold text-[#0D7136] tabular-nums">
                Trabajo asignado #{index + 1}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveWork(work.id)}
                title={works.length <= 1 ? 'Limpiar campos de este trabajo' : 'Eliminar trabajo'}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {works.length <= 1 ? 'Limpiar' : 'Quitar'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Nombre del trabajo / taller a realizar
                </label>
                <input
                  type="text"
                  value={work.title}
                  onChange={(e) => handleUpdateWork(work.id, 'title', e.target.value)}
                  placeholder="Ej. Taller escrito sobre dispositivos y práctica de digitación en Word"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Forma o medio de entrega
                </label>
                <input
                  type="text"
                  value={work.deliveryFormat || ''}
                  onChange={(e) => handleUpdateWork(work.id, 'deliveryFormat', e.target.value)}
                  placeholder="Ej. Impreso / Archivo digital en sala"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Fecha límite del trabajo (opcional)
                </label>
                <input
                  type="date"
                  value={work.dueDate || ''}
                  onChange={(e) => handleUpdateWork(work.id, 'dueDate', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4">
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Indicaciones, puntos o ejercicios que debe realizar el estudiante
                </label>
                <textarea
                  rows={3}
                  value={work.description}
                  onChange={(e) => handleUpdateWork(work.id, 'description', e.target.value)}
                  placeholder="Detalla paso a paso los puntos del taller, archivo a entregar, normas de presentación o ejercicios que debe desarrollar el estudiante..."
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#0D7136] focus:outline-none focus:ring-2 focus:ring-[#0D7136]/15"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
