import React, { useState } from 'react';
import { CloudUpload, Download, Printer, X, FileText, Pencil } from 'lucide-react';
import type { SupportPlan } from '../types.ts';
import {
  INSTITUTIONAL_LOGO_URL,
  downloadSinglePlanDocx,
  formatDateSpanish,
} from '../utils/docxGenerator.ts';

interface PlanDocumentPreviewProps {
  plan: SupportPlan | null;
  footerNote?: string;
  onClose: () => void;
  onEdit?: (plan: SupportPlan) => void;
  onUploadToDrive?: (plan: SupportPlan) => void;
}

export const PlanDocumentPreview: React.FC<PlanDocumentPreviewProps> = ({
  plan,
  footerNote,
  onClose,
  onEdit,
  onUploadToDrive,
}) => {
  const [downloading, setDownloading] = useState(false);

  if (!plan) return null;

  const cityLabel = plan.city || 'Barrancabermeja';
  const filledWorks = (plan.assignedWorks || []).filter(
    (w) =>
      w.title.trim() ||
      w.description.trim() ||
      (w.deliveryFormat || '').trim()
  );
  const signatureSectionNumber = filledWorks.length > 0 ? '4' : '3';

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadSinglePlanDocx(plan, footerNote);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa del Plan de Apoyo Académico"
    >
      {/* Top toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 bg-slate-900 px-6 py-3 text-white">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-5 w-5 text-[#86EFAC] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              Vista previa institucional · {plan.studentName?.trim() || 'Formato abierto (sin estudiante)'}
            </p>
            <p className="text-xs text-slate-400 truncate tabular-nums">
              {plan.code} · {plan.grade} ({plan.course}) · {plan.subject} · Año {plan.academicYear}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(plan);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar plan
            </button>
          )}
          {onUploadToDrive && (
            <button
              type="button"
              onClick={() => onUploadToDrive(plan)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <CloudUpload className="h-3.5 w-3.5 text-[#86EFAC]" />
              Subir a Drive
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0D7136] px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-[#095528] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? 'Generando .docx...' : 'GENERAR Y DESCARGAR PLAN DE APOYO'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="Cerrar vista previa"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable paper sheet */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="mx-auto w-full max-w-[880px] rounded-sm border border-slate-300 bg-white p-6 sm:p-10 text-slate-900 shadow-2xl">
          {/* Institutional Header Box matching Word template */}
          <div className="grid grid-cols-1 sm:grid-cols-[128px_1fr] border border-[#8CB89C]">
            <div className="flex items-center justify-center bg-[#FAF6D8] p-3 border-b sm:border-b-0 sm:border-r border-[#8CB89C]">
              <img
                src={INSTITUTIONAL_LOGO_URL}
                alt="Escudo Institución Educativa CASD José Prudencio Padilla"
                className="h-20 w-20 object-contain"
              />
            </div>
            <div className="bg-[#0D7136] px-5 py-4 text-center text-white flex flex-col justify-center">
              <p className="text-sm font-bold tracking-wide uppercase">
                {plan.institutionName}
              </p>
              <p className="text-xs font-semibold text-[#FAF6D8]">
                {cityLabel}
              </p>
              <h1 className="mt-1 text-lg font-bold tracking-wider uppercase">
                PLAN DE APOYO ACADÉMICO
              </h1>
              <p className="mt-1 text-xs text-[#FAF6D8] tabular-nums">
                Área de {plan.area} · Año Académico {plan.academicYear} · Código {plan.code}
              </p>
            </div>
          </div>

          {/* 1. Datos Generales */}
          <table className="mt-4 w-full border-collapse border border-[#8CB89C] text-xs">
            <thead>
              <tr>
                <th
                  colSpan={3}
                  className="border border-[#8CB89C] bg-[#EAF4EE] px-3 py-1.5 text-left font-bold text-[#095528]"
                >
                  1. DATOS GENERALES E IDENTIFICACIÓN INSTITUCIONAL
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="w-[38%] border border-[#8CB89C] px-3 py-2">
                  <span className="font-semibold text-[#095528]">Área: </span>
                  {plan.area}
                </td>
                <td className="w-[37%] border border-[#8CB89C] px-3 py-2">
                  <span className="font-semibold text-[#095528]">Asignatura: </span>
                  {plan.subject}
                </td>
                <td className="w-[25%] border border-[#8CB89C] px-3 py-2 tabular-nums">
                  <span className="font-semibold text-[#095528]">Año académico: </span>
                  {plan.academicYear}
                </td>
              </tr>
              <tr>
                <td className="border border-[#8CB89C] px-3 py-2">
                  <span className="font-semibold text-[#095528]">Docente: </span>
                  {plan.teacherName}
                </td>
                <td className="border border-[#8CB89C] px-3 py-2">
                  <span className="font-semibold text-[#095528]">Grado: </span>
                  {plan.grade}
                </td>
                <td className="border border-[#8CB89C] px-3 py-2">
                  <span className="font-semibold text-[#095528]">Curso: </span>
                  {plan.course || '—'}
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-[#8CB89C] px-3 py-2">
                  <span className="font-semibold text-[#095528]">Estudiante: </span>
                  {plan.studentName?.trim() ? (
                    <span className="font-semibold">{plan.studentName}</span>
                  ) : (
                    <span className="inline-block min-w-[240px] border-b border-slate-600 align-baseline">
                      &nbsp;
                    </span>
                  )}
                  {plan.studentCode ? (
                    <span className="ml-2 text-slate-600 tabular-nums">
                      (Cód. {plan.studentCode})
                    </span>
                  ) : null}
                </td>
                <td className="border border-[#8CB89C] px-3 py-2">
                  <span className="font-semibold text-[#095528]">Periodo: </span>
                  {plan.period === 'Final' ? 'Final / Nivelación anual' : `Periodo ${plan.period}`}
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-[#8CB89C] px-3 py-2">
                  <span className="font-semibold text-[#095528]">Fecha de entrega al estudiante: </span>
                  {formatDateSpanish(plan.deliveryDate)}
                </td>
                <td className="border border-[#8CB89C] px-3 py-2">
                  <span className="font-semibold text-[#095528]">Fecha límite: </span>
                  {plan.supportDeadline
                    ? formatDateSpanish(plan.supportDeadline)
                    : 'Según cronograma institucional'}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mt-4 text-xs leading-relaxed text-slate-700">
            <span className="font-semibold text-[#095528]">Propósito del plan: </span>
            El presente Plan de Apoyo Académico tiene como finalidad orientar al estudiante y a su familia en la superación de los desempeños pendientes mediante el desarrollo, entrega y sustentación de las actividades académicas establecidas a continuación.
          </p>

          {/* 2. Contenido Académico */}
          <h2 className="mt-4 mb-2 text-xs font-bold uppercase tracking-wide text-[#095528]">
            2. CONTENIDO ACADÉMICO Y PLAN DE ACTIVIDADES
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-[#8CB89C] text-[11px] leading-relaxed">
              <thead>
                <tr className="bg-[#0D7136] text-white">
                  <th className="w-[21%] border border-[#8CB89C] px-2.5 py-2 text-center font-semibold">
                    Competencias / Desempeños a evaluar
                  </th>
                  <th className="w-[18%] border border-[#8CB89C] px-2.5 py-2 text-center font-semibold">
                    Temas - Subtemas
                  </th>
                  <th className="w-[27%] border border-[#8CB89C] px-2.5 py-2 text-center font-semibold">
                    Acciones / Actividades a realizar
                  </th>
                  <th className="w-[19%] border border-[#8CB89C] px-2.5 py-2 text-center font-semibold">
                    Criterios de evaluación
                  </th>
                  <th className="w-[15%] border border-[#8CB89C] px-2.5 py-2 text-center font-semibold">
                    Bibliografía / Webgrafía
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border border-[#8CB89C] px-3 py-4 text-center text-slate-500">
                      Sin filas académicas registradas.
                    </td>
                  </tr>
                ) : (
                  plan.rows.map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 1 ? 'bg-[#F7FBF8]' : 'bg-white'}>
                      <td className="border border-[#8CB89C] px-2.5 py-2 align-top whitespace-pre-line">
                        {row.competency || '—'}
                      </td>
                      <td className="border border-[#8CB89C] px-2.5 py-2 align-top whitespace-pre-line">
                        {row.topics || '—'}
                      </td>
                      <td className="border border-[#8CB89C] px-2.5 py-2 align-top whitespace-pre-line">
                        {row.activities || '—'}
                      </td>
                      <td className="border border-[#8CB89C] px-2.5 py-2 align-top whitespace-pre-line">
                        {row.evaluationCriteria || '—'}
                      </td>
                      <td className="border border-[#8CB89C] px-2.5 py-2 align-top whitespace-pre-line break-words">
                        {row.bibliography || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filledWorks.length > 0 && (
            <>
              <h2 className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-[#095528]">
                3. TRABAJOS Y TALLERES A REALIZAR POR EL ESTUDIANTE
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-[#8CB89C] text-[11px] leading-relaxed">
                  <thead>
                    <tr className="bg-[#0D7136] text-white">
                      <th className="w-[7%] border border-[#8CB89C] px-2 py-2 text-center font-semibold">
                        N°
                      </th>
                      <th className="w-[26%] border border-[#8CB89C] px-2.5 py-2 text-center font-semibold">
                        Trabajo / Taller a realizar
                      </th>
                      <th className="w-[44%] border border-[#8CB89C] px-2.5 py-2 text-center font-semibold">
                        Indicaciones y puntos a desarrollar
                      </th>
                      <th className="w-[23%] border border-[#8CB89C] px-2.5 py-2 text-center font-semibold">
                        Forma de entrega y fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filledWorks.map((work, idx) => (
                      <tr key={work.id} className={idx % 2 === 1 ? 'bg-[#F7FBF8]' : 'bg-white'}>
                        <td className="border border-[#8CB89C] px-2 py-2 text-center font-semibold text-[#095528] tabular-nums align-top">
                          {idx + 1}
                        </td>
                        <td className="border border-[#8CB89C] px-2.5 py-2 align-top font-semibold text-slate-900">
                          {work.title || 'Trabajo asignado'}
                        </td>
                        <td className="border border-[#8CB89C] px-2.5 py-2 align-top whitespace-pre-line">
                          {work.description || '—'}
                        </td>
                        <td className="border border-[#8CB89C] px-2.5 py-2 align-top whitespace-pre-line">
                          {work.deliveryFormat || 'Entrega presencial / según indicación docente'}
                          {work.dueDate ? `\nFecha límite: ${formatDateSpanish(work.dueDate)}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {plan.observations && plan.observations.trim() && (
            <table className="mt-4 w-full border-collapse border border-[#8CB89C] text-xs">
              <thead>
                <tr>
                  <th className="border border-[#8CB89C] bg-[#EAF4EE] px-3 py-1.5 text-left font-bold text-[#095528]">
                    OBSERVACIONES Y COMPROMISOS ADICIONALES
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-[#8CB89C] px-3 py-2 whitespace-pre-line">
                    {plan.observations}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* Firmas */}
          <h2 className="mt-6 mb-2 text-xs font-bold uppercase tracking-wide text-[#095528]">
            {signatureSectionNumber}. CONSTANCIA DE ENTREGA Y COMPROMISO
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3 text-center text-xs">
            <div>
              <div className="mx-auto w-4/5 border-t border-slate-700 pt-2">
                <p className="font-semibold text-[#095528]">Firma del Docente</p>
                <p className="mt-0.5 text-slate-800">{plan.teacherName}</p>
                <p className="text-[11px] text-slate-500">
                  {plan.teacherRole || `Docente de ${plan.area}`}
                </p>
              </div>
            </div>
            <div>
              <div className="mx-auto w-4/5 border-t border-slate-700 pt-2">
                <p className="font-semibold text-[#095528]">Firma Padre de Familia</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Nombre y C.C.: ________________</p>
              </div>
            </div>
            <div>
              <div className="mx-auto w-4/5 border-t border-slate-700 pt-2">
                <p className="font-semibold text-[#095528]">Firma del Estudiante</p>
                <p className="mt-0.5 text-slate-800">
                  {plan.studentName?.trim() || 'Nombre y Curso: ______________________'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-500">
            {footerNote ||
              `${plan.institutionName} · ${cityLabel} · Área de ${plan.area} · Documento listo para imprimir`}
          </div>
        </div>
      </div>
    </div>
  );
};
