import type { StudentRosterEntry } from '../types.ts';

export interface ParsedIntegraSheet {
  teacherName: string;
  course: string;
  grade: string;
  subject: string;
  period: string;
  academicYear: number;
  lowPerformanceDescription: string;
  students: StudentRosterEntry[];
}

function normalizeGradeFromCourse(course: string): string {
  const match = /^0?(\d{1,2})/.exec(course.trim());
  if (!match) return '6°';
  const num = Number(match[1]);
  if (Number.isNaN(num)) return '6°';
  return `${num}°`;
}

export function parseIntegraHtmlPlanilla(
  htmlContent: string,
  passingScore = 35
): ParsedIntegraSheet {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const layoutTd = doc.querySelector('table.tabla_layout td');
  const rawInfoText = layoutTd?.textContent || '';

  const teacherMatch = /Docente\s+([A-ZÁÉÍÓÚÑ\s]+?)\s+Grupo/i.exec(rawInfoText);
  const groupMatch = /Grupo\s+([^\s(]+)/i.exec(rawInfoText);
  const yearMatch = /\((\d{4})->/i.exec(rawInfoText);
  const subjectMatch = /Asignatura\s+([^\n(]+)/i.exec(rawInfoText);
  const periodMatch = /Periodo\s+(\d+)/i.exec(rawInfoText);

  const teacherName = teacherMatch ? teacherMatch[1].trim() : 'Ciro Antonio Garrido Rocha';
  const course = groupMatch ? groupMatch[1].trim() : '06-5';
  const grade = normalizeGradeFromCourse(course);
  const subject = subjectMatch ? subjectMatch[1].trim() : 'Informática';
  const period = periodMatch ? periodMatch[1].trim() : '4';
  const academicYear = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

  // Extract D4 (Bajo) competency description if available
  const desHeaders = Array.from(doc.querySelectorAll('#notas_tabla_competencias th.tnc_des'));
  const d4Header = desHeaders[desHeaders.length - 1];
  const lowPerformanceDescription = d4Header?.getAttribute('title')?.trim() || '';

  // Identify column indices in #notas_tabla_competencias row 2 for Periodo columns
  const studentCells = Array.from(doc.querySelectorAll('#notas_tabla_estudiantes tr td'));
  const noteRows = Array.from(doc.querySelectorAll('#notas_tabla_notas tr'));

  const students: StudentRosterEntry[] = studentCells.map((cell, index) => {
    const code = cell.getAttribute('data-codigo')?.trim() || String(index + 1);
    const name = (cell.getAttribute('data-estudiante') || cell.textContent || '')
      .replace(/^\d+-\d+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    const row = noteRows[index];
    let periodScore: number | null = null;
    let finalScore: number | null = null;
    let performanceLevel = '';

    if (row) {
      const periodCells = Array.from(row.querySelectorAll('td.tnna_periodo, td.tnna_error'));
      // Looking at Integra HTML structure:
      // P1(Nota,Rec), P2(Nota,Rec), P3(Nota,Rec), P4(Nota,Rec), FINAL(Nota,Rec), NotaMinima
      // Find cells with performance tags (DS, DA, DB, BJ)
      const scoredCells = periodCells
        .map((td) => {
          const text = td.textContent?.replace(/\s+/g, ' ').trim() || '';
          const numMatch = /^(\d{1,3})\s*(DS|DA|DB|BJ)?$/i.exec(text);
          if (!numMatch) return null;
          return {
            score: Number(numMatch[1]),
            level: (numMatch[2] || '').toUpperCase(),
          };
        })
        .filter((x): x is { score: number; level: string } => x !== null);

      if (scoredCells.length > 0) {
        const pIdx = Math.min(Math.max(Number(period) - 1, 0), scoredCells.length - 1);
        const currentPeriodEntry = scoredCells[pIdx];
        const finalEntry = scoredCells.length >= 5 ? scoredCells[4] : scoredCells[scoredCells.length - 1];
        periodScore = currentPeriodEntry?.score ?? null;
        finalScore = finalEntry?.score ?? null;
        performanceLevel = currentPeriodEntry?.level || finalEntry?.level || '';
      }
    }

    const hasErrorClass = cell.classList.contains('tabla_estudiantes_error');
    const needsSupport =
      hasErrorClass ||
      performanceLevel === 'BJ' ||
      (periodScore !== null && periodScore < passingScore) ||
      (finalScore !== null && finalScore < passingScore);

    return {
      id: `r-${course}-${code}`,
      code,
      name,
      grade,
      course,
      subject,
      period,
      academicYear,
      periodScore,
      finalScore,
      performanceLevel: performanceLevel || (needsSupport ? 'BJ' : ''),
      needsSupport,
    };
  });

  return {
    teacherName,
    course,
    grade,
    subject,
    period,
    academicYear,
    lowPerformanceDescription,
    students: students.filter((s) => s.name.length > 0),
  };
}
