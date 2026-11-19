import type { AcademicContentRow, LibraryItem } from '../types.ts';

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateCleanly(text: string, maxLength: number): string {
  const clean = normalizeWhitespace(text);
  if (clean.length <= maxLength) return clean;
  const slice = clean.slice(0, maxLength);
  const lastPeriod = slice.lastIndexOf('.');
  if (lastPeriod > maxLength * 0.55) {
    return slice.slice(0, lastPeriod + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = lastSpace > 40 ? slice.slice(0, lastSpace) : slice;
  return `${trimmed.replace(/[,;:\-]+$/, '').trim()}.`;
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^\s*(?:[•\-\*]|\d+[.)])\s*/, '').trim();
}

/**
 * Extrae el desempeño más básico o un breve resumen de una competencia/desempeño
 * extenso para planes de nivelación final o anual.
 */
export function extractBasicCompetency(competencyText: string, maxLength = 190): string {
  const lines = (competencyText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';

  // 1. Priorizar "Indicador de desempeño" / "Indicadores" / "Desempeño"
  const indicatorLine = lines.find((line) =>
    /indicador(?:es)?(?:\s+de\s+desempe[ñn]o|\s*\([^)]+\))?\s*:/i.test(line)
  );
  if (indicatorLine) {
    const afterColon = indicatorLine.replace(/^[^:]+:\s*/, '');
    return truncateCleanly(afterColon, maxLength);
  }

  // 2. Si no hay indicador explícito, priorizar Competencia(s) y tomar la idea básica principal
  const compLine = lines.find((line) => /competencias?\s*:/i.test(line));
  if (compLine) {
    const afterColon = compLine.replace(/^[^:]+:\s*/, '');
    const firstClause = afterColon.split(/[.;]\s+/)[0] || afterColon;
    return truncateCleanly(firstClause.endsWith('.') ? firstClause : `${firstClause}.`, maxLength);
  }

  // 3. Tomar estándar o primera línea esencial
  const stdLine = lines.find((line) => /est[áa]ndar(?:es)?\s*:/i.test(line)) || lines[0];
  const cleaned = stripBulletPrefix(stdLine).replace(/^[^:]+:\s*/, '');
  return truncateCleanly(cleaned, maxLength);
}

/**
 * Resume temas y subtemas a los puntos esenciales para evitar sobrecarga en nivelación anual.
 */
export function summarizeTopics(topicsText: string, maxItems = 3): string {
  const rawLines = (topicsText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) return '';

  // Filtrar encabezados tipo "UNIDAD 1: EXCEL:" si hay subelementos debajo
  const detailLines = rawLines.filter((line, idx) => {
    const isAllCapsHeading =
      idx === 0 &&
      rawLines.length > 1 &&
      /^[A-ZÁÉÍÓÚÑ0-9\s:()\-]+:$/.test(line);
    return !isAllCapsHeading;
  });

  const selected = detailLines
    .slice(0, maxItems)
    .map((line) => truncateCleanly(stripBulletPrefix(line), 110))
    .filter(Boolean);

  return selected.map((item) => `• ${item}`).join('\n');
}

/**
 * Resume actividades o criterios conservando las acciones esenciales.
 */
export function summarizeListLines(text: string, maxItems = 2, maxLenPerItem = 150): string {
  const lines = (text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return '';

  return lines
    .slice(0, maxItems)
    .map((line, idx) => {
      const clean = stripBulletPrefix(line);
      return `${idx + 1}. ${truncateCleanly(clean, maxLenPerItem)}`;
    })
    .join('\n');
}

/**
 * Convierte un registro completo de biblioteca en una versión breve con el desempeño básico
 * para usar en Nivelación Final / Anual.
 */
export function summarizeLibraryItemForAnnual(item: LibraryItem): AcademicContentRow {
  const periodPrefix = item.period ? `P${item.period}: ` : '';
  const basicComp = extractBasicCompetency(item.competency, 190);
  const firstBib =
    (item.bibliography || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)[0] || '';

  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    competency: basicComp ? `${periodPrefix}${basicComp}` : item.topic,
    topics: summarizeTopics(item.topics, 3) || item.topic,
    activities: summarizeListLines(item.activities, 2, 160),
    evaluationCriteria: summarizeListLines(item.evaluationCriteria, 2, 130),
    bibliography: firstBib,
  };
}

/**
 * Resume una fila ya escrita en el editor conservando lo más básico para nivelación final.
 */
export function summarizeExistingRowForFinal(row: AcademicContentRow): AcademicContentRow {
  const firstBib =
    (row.bibliography || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join('\n');

  return {
    ...row,
    competency: extractBasicCompetency(row.competency, 200) || row.competency,
    topics: summarizeTopics(row.topics, 3) || row.topics,
    activities: summarizeListLines(row.activities, 2, 165) || row.activities,
    evaluationCriteria: summarizeListLines(row.evaluationCriteria, 2, 140) || row.evaluationCriteria,
    bibliography: firstBib || row.bibliography,
  };
}

/**
 * Construye una síntesis anual consolidada en un solo bloque compacto con el desempeño básico
 * de cada periodo del grado y asignatura seleccionados, evitando exceso de contenido.
 */
export function buildConsolidatedAnnualRow(
  library: LibraryItem[],
  grade: string,
  subject: string
): AcademicContentRow | null {
  const cleanGrade = grade.trim();
  const cleanSubject = subject.trim().toLowerCase();

  let candidates = library.filter(
    (item) =>
      item.grade === cleanGrade &&
      item.subject.toLowerCase() === cleanSubject
  );

  // Si la asignatura es integrada ("Tecnología e Informática"), combinar las unidades del grado
  if (candidates.length === 0 && cleanSubject.includes('tecnolog') && cleanSubject.includes('inform')) {
    candidates = library.filter((item) => item.grade === cleanGrade);
  }

  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    const pa = Number(a.period || 99);
    const pb = Number(b.period || 99);
    if (pa !== pb) return pa - pb;
    return b.academicYear - a.academicYear;
  });

  // Evitar duplicados por periodo+asignatura tomando los más recientes (máximo 4 bloques)
  const seenKey = new Set<string>();
  const uniqueUnits: LibraryItem[] = [];
  for (const item of sorted) {
    const key = `${item.subject}|${item.period || item.id}`;
    if (!seenKey.has(key)) {
      seenKey.add(key);
      uniqueUnits.push(item);
    }
  }
  const picked = uniqueUnits.slice(0, 4);

  const competencyLines = picked.map((item) => {
    const prefix = item.period ? `P${item.period}` : item.subject;
    const basic = extractBasicCompetency(item.competency, 145);
    return `• ${prefix}: ${basic || item.topic}`;
  });

  const topicLines = picked.map((item) => {
    const prefix = item.period ? `P${item.period}` : item.subject;
    const shortTopic = item.topic.replace(/^Unidad\s+\d+\s*:\s*/i, '');
    return `• ${prefix}: ${truncateCleanly(shortTopic, 95)}`;
  });

  const activities = [
    '1. Desarrollar los trabajos y talleres prácticos asignados sobre los temas esenciales del año escolar.',
    '2. Presentar sustentación escrita y/o práctica en sala demostrando el dominio de los desempeños básicos.',
  ].join('\n');

  const evaluationCriteria = [
    '• Entrega puntual y completa de los trabajos asignados (50%).',
    '• Sustentación práctica o evaluación básica de conocimientos (50%).',
  ].join('\n');

  const firstBib =
    picked[0]?.bibliography
      ?.split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)[0] ||
    `• Plan de Área de ${subject} (${grade}) – I.E. CASD José Prudencio Padilla.`;

  return {
    id: `row-${Date.now()}-anual`,
    competency: competencyLines.join('\n'),
    topics: topicLines.join('\n'),
    activities,
    evaluationCriteria,
    bibliography: firstBib,
  };
}
