import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import JSZip from 'jszip';
import type { SupportPlan } from '../types.ts';

export const INSTITUTIONAL_LOGO_URL = '/assets/aistudio/NuevoLOGOv2_9a8694b5.png';

let cachedLogoBytesPromise: Promise<Uint8Array | undefined> | null = null;

export async function loadInstitutionalLogoBytes(): Promise<Uint8Array | undefined> {
  if (typeof fetch === 'undefined') return undefined;
  if (!cachedLogoBytesPromise) {
    cachedLogoBytesPromise = fetch(INSTITUTIONAL_LOGO_URL)
      .then(async (res) => {
        if (!res.ok) return undefined;
        const buf = await res.arrayBuffer();
        return new Uint8Array(buf);
      })
      .catch(() => undefined);
  }
  return cachedLogoBytesPromise;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Paleta institucional extraída del escudo CASD José Prudencio Padilla
const BRAND_GREEN = '0D7136';
const BRAND_GREEN_DARK = '095528';
const BRAND_CREAM = 'FAF6D8';
const SUBHEADER_BG = 'EAF4EE';
const ALT_ROW_BG = 'F7FBF8';
const BORDER_COLOR = '8CB89C';

const thinBorder = {
  style: BorderStyle.SINGLE,
  size: 6,
  color: BORDER_COLOR,
};

const tableBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
  insideHorizontal: thinBorder,
  insideVertical: thinBorder,
};

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function multilineParagraphs(
  text: string,
  options?: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] }
): Paragraph[] {
  const clean = (text || '').trim();
  const lines = clean ? clean.split(/\r?\n/) : ['—'];
  return lines.map(
    (line) =>
      new Paragraph({
        alignment: options?.align ?? AlignmentType.LEFT,
        spacing: { before: 30, after: 30, line: 260 },
        children: [
          new TextRun({
            text: line,
            bold: options?.bold ?? false,
            size: options?.size ?? 18, // 9pt
            color: options?.color ?? '0F172A',
            font: 'Calibri',
          }),
        ],
      })
  );
}

function infoCell(label: string, value: string, widthPct: number, colSpan = 1): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    columnSpan: colSpan,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        spacing: { before: 20, after: 20 },
        children: [
          new TextRun({
            text: `${label}: `,
            bold: true,
            size: 18,
            color: BRAND_GREEN_DARK,
            font: 'Calibri',
          }),
          new TextRun({
            text: value || '—',
            size: 18,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function academicHeaderCell(title: string, widthPct: number): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    shading: { fill: BRAND_GREEN, type: ShadingType.CLEAR, color: 'auto' },
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: 20 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 18,
            color: 'FFFFFF',
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

export function formatDateSpanish(isoDate: string): string {
  if (!isoDate) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, y, m, d] = match;
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const monthName = months[Number(m) - 1] || m;
  return `${Number(d)} de ${monthName} de ${y}`;
}

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export function buildPlanFilename(plan: SupportPlan): string {
  const course = sanitizeFileName(plan.course || plan.grade || 'Curso');
  const student = sanitizeFileName(plan.studentName?.trim() || 'Formato_Abierto');
  const subject = sanitizeFileName(plan.subject || 'Asignatura');
  return `Plan_Apoyo_${course}_${student}_${subject}_${plan.academicYear}.docx`;
}

export function createSupportPlanDocument(
  plan: SupportPlan,
  institutionalFooterNote?: string,
  logoBytes?: Uint8Array
): Document {
  const cityLabel = plan.city || 'Barrancabermeja';

  const titleParagraphs = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 20 },
      children: [
        new TextRun({
          text: plan.institutionName.toUpperCase(),
          bold: true,
          size: 23,
          color: 'FFFFFF',
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 30 },
      children: [
        new TextRun({
          text: cityLabel,
          bold: true,
          size: 18,
          color: BRAND_CREAM,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 20, after: 20 },
      children: [
        new TextRun({
          text: 'PLAN DE APOYO ACADÉMICO',
          bold: true,
          size: 26,
          color: 'FFFFFF',
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          text: `Área de ${plan.area} · Año Académico ${plan.academicYear} · Código ${plan.code}`,
          size: 17,
          color: BRAND_CREAM,
          font: 'Calibri',
        }),
      ],
    }),
  ];

  const headerCells: TableCell[] = [];
  if (logoBytes && logoBytes.length > 0) {
    headerCells.push(
      new TableCell({
        width: { size: 17, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: BRAND_CREAM, type: ShadingType.CLEAR, color: 'auto' },
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new ImageRun({
                type: 'png',
                data: logoBytes,
                transformation: {
                  width: 68,
                  height: 68,
                },
              }),
            ],
          }),
        ],
      })
    );
  }

  headerCells.push(
    new TableCell({
      width: { size: logoBytes && logoBytes.length > 0 ? 83 : 100, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      shading: { fill: BRAND_GREEN, type: ShadingType.CLEAR, color: 'auto' },
      margins: { top: 110, bottom: 110, left: 150, right: 150 },
      children: titleParagraphs,
    })
  );

  const headerBanner = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        cantSplit: true,
        children: headerCells,
      }),
    ],
  });

  const metadataTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            columnSpan: 3,
            shading: { fill: SUBHEADER_BG, type: ShadingType.CLEAR, color: 'auto' },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: '1. DATOS GENERALES E IDENTIFICACIÓN INSTITUCIONAL',
                    bold: true,
                    size: 18,
                    color: BRAND_GREEN_DARK,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          infoCell('Área', plan.area, 38),
          infoCell('Asignatura', plan.subject, 37),
          infoCell('Año académico', String(plan.academicYear), 25),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          infoCell('Docente', plan.teacherName, 38),
          infoCell('Grado', plan.grade, 37),
          infoCell('Curso', plan.course, 25),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          infoCell(
            'Estudiante',
            plan.studentName?.trim()
              ? plan.studentCode
                ? `${plan.studentName} (Cód. ${plan.studentCode})`
                : plan.studentName
              : '__________________________________________',
            50,
            2
          ),
          infoCell(
            'Periodo',
            plan.period === 'Final' ? 'Final / Nivelación anual' : `Periodo ${plan.period}`,
            50
          ),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          infoCell('Fecha de entrega al estudiante', formatDateSpanish(plan.deliveryDate), 50, 2),
          infoCell(
            'Fecha límite de sustentación',
            plan.supportDeadline ? formatDateSpanish(plan.supportDeadline) : 'Según cronograma institucional',
            50
          ),
        ],
      }),
    ],
  });

  const introParagraph = new Paragraph({
    spacing: { before: 140, after: 120, line: 260 },
    children: [
      new TextRun({
        text: 'Propósito del plan: ',
        bold: true,
        size: 18,
        color: BRAND_GREEN_DARK,
        font: 'Calibri',
      }),
      new TextRun({
        text: 'El presente Plan de Apoyo Académico tiene como finalidad orientar al estudiante y a su familia en la superación de los desempeños pendientes mediante el desarrollo, entrega y sustentación de las actividades académicas establecidas a continuación.',
        size: 18,
        color: '334155',
        font: 'Calibri',
      }),
    ],
  });

  const contentRows = plan.rows.length > 0
    ? plan.rows
    : [
        {
          id: 'empty',
          competency: '—',
          topics: '—',
          activities: '—',
          evaluationCriteria: '—',
          bibliography: '—',
        },
      ];

  const academicTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: [
          academicHeaderCell('Competencias / Desempeños a evaluar', 21),
          academicHeaderCell('Temas - Subtemas', 18),
          academicHeaderCell('Acciones / Actividades a realizar', 27),
          academicHeaderCell('Criterios de evaluación', 19),
          academicHeaderCell('Bibliografía / Webgrafía', 15),
        ],
      }),
      ...contentRows.map((row, idx) => {
        const bg = idx % 2 === 1 ? ALT_ROW_BG : 'FFFFFF';
        const makeCell = (text: string, widthPct: number) =>
          new TableCell({
            width: { size: widthPct, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.TOP,
            shading: { fill: bg, type: ShadingType.CLEAR, color: 'auto' },
            margins: { top: 80, bottom: 80, left: 90, right: 90 },
            children: multilineParagraphs(text, { size: 17 }),
          });

        return new TableRow({
          children: [
            makeCell(row.competency, 21),
            makeCell(row.topics, 18),
            makeCell(row.activities, 27),
            makeCell(row.evaluationCriteria, 19),
            makeCell(row.bibliography, 15),
          ],
        });
      }),
    ],
  });

  const filledWorks = (plan.assignedWorks || []).filter(
    (w) =>
      w.title.trim() ||
      w.description.trim() ||
      (w.deliveryFormat || '').trim()
  );

  const assignedWorksBlocks: (Paragraph | Table)[] = [];
  if (filledWorks.length > 0) {
    assignedWorksBlocks.push(
      new Paragraph({
        spacing: { before: 140, after: 80 },
        children: [
          new TextRun({
            text: '3. TRABAJOS Y TALLERES A REALIZAR POR EL ESTUDIANTE',
            bold: true,
            size: 19,
            color: BRAND_GREEN_DARK,
            font: 'Calibri',
          }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: [
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: [
              academicHeaderCell('N°', 7),
              academicHeaderCell('Trabajo / Taller a realizar', 26),
              academicHeaderCell('Indicaciones y puntos a desarrollar', 44),
              academicHeaderCell('Forma de entrega y fecha', 23),
            ],
          }),
          ...filledWorks.map((work, idx) => {
            const bg = idx % 2 === 1 ? ALT_ROW_BG : 'FFFFFF';
            const deliveryLines = [
              work.deliveryFormat?.trim() || 'Entrega presencial / según indicación docente',
              work.dueDate ? `Fecha límite: ${formatDateSpanish(work.dueDate)}` : '',
            ]
              .filter(Boolean)
              .join('\n');

            return new TableRow({
              children: [
                new TableCell({
                  width: { size: 7, type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.TOP,
                  shading: { fill: bg, type: ShadingType.CLEAR, color: 'auto' },
                  margins: { top: 80, bottom: 80, left: 70, right: 70 },
                  children: multilineParagraphs(String(idx + 1), {
                    bold: true,
                    size: 17,
                    color: BRAND_GREEN_DARK,
                    align: AlignmentType.CENTER,
                  }),
                }),
                new TableCell({
                  width: { size: 26, type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.TOP,
                  shading: { fill: bg, type: ShadingType.CLEAR, color: 'auto' },
                  margins: { top: 80, bottom: 80, left: 90, right: 90 },
                  children: multilineParagraphs(work.title || 'Trabajo asignado', {
                    bold: true,
                    size: 17,
                  }),
                }),
                new TableCell({
                  width: { size: 44, type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.TOP,
                  shading: { fill: bg, type: ShadingType.CLEAR, color: 'auto' },
                  margins: { top: 80, bottom: 80, left: 90, right: 90 },
                  children: multilineParagraphs(work.description || '—', { size: 17 }),
                }),
                new TableCell({
                  width: { size: 23, type: WidthType.PERCENTAGE },
                  verticalAlign: VerticalAlign.TOP,
                  shading: { fill: bg, type: ShadingType.CLEAR, color: 'auto' },
                  margins: { top: 80, bottom: 80, left: 90, right: 90 },
                  children: multilineParagraphs(deliveryLines, { size: 17 }),
                }),
              ],
            });
          }),
        ],
      })
    );
  }

  const signatureSectionNumber = filledWorks.length > 0 ? '4' : '3';

  const observationsBlocks: (Paragraph | Table)[] = [];
  if (plan.observations && plan.observations.trim()) {
    observationsBlocks.push(
      new Paragraph({ spacing: { before: 140, after: 40 }, children: [] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                shading: { fill: SUBHEADER_BG, type: ShadingType.CLEAR, color: 'auto' },
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'OBSERVACIONES Y COMPROMISOS ADICIONALES',
                        bold: true,
                        size: 17,
                        color: BRAND_GREEN_DARK,
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: multilineParagraphs(plan.observations, { size: 18 }),
              }),
            ],
          }),
        ],
      })
    );
  }

  const signatureCell = (title: string, subtitle: string) =>
    new TableCell({
      width: { size: 33, type: WidthType.PERCENTAGE },
      margins: { top: 240, bottom: 60, left: 100, right: 100 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({
              text: '____________________________________',
              size: 18,
              color: '334155',
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 20, after: 20 },
          children: [
            new TextRun({
              text: title,
              bold: true,
              size: 18,
              color: BRAND_GREEN_DARK,
              font: 'Calibri',
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({
              text: subtitle,
              size: 16,
              color: '475569',
              font: 'Calibri',
            }),
          ],
        }),
      ],
    });

  const signaturesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          signatureCell(
            'Firma del Docente',
            `${plan.teacherName}\n${plan.teacherRole || `Docente de ${plan.area}`}`
          ),
          signatureCell('Firma Padre de Familia / Acudiente', 'Nombre y C.C.: ______________________'),
          signatureCell(
            'Firma del Estudiante',
            plan.studentName?.trim() || 'Nombre y Curso: ______________________'
          ),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: plan.teacherName,
    title: `Plan de Apoyo Académico - ${plan.studentName?.trim() || plan.course || plan.grade}`,
    description: `${plan.institutionName} (${cityLabel}) - ${plan.subject} (${plan.grade} ${plan.course})`,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240, // 8.5 in (Carta)
              height: 15840, // 11 in
            },
            margin: {
              top: 850,
              right: 850,
              bottom: 850,
              left: 850,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${plan.institutionName} · ${cityLabel} · Plan de Apoyo Académico (${plan.academicYear})`,
                    size: 16,
                    color: '64748B',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${institutionalFooterNote || `${plan.institutionName} · ${cityLabel} · Área de ${plan.area}`}   |   Página `,
                    size: 16,
                    color: '64748B',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '64748B',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 16,
                    color: '64748B',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '64748B',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          headerBanner,
          new Paragraph({ spacing: { before: 100, after: 40 }, children: [] }),
          metadataTable,
          introParagraph,
          new Paragraph({
            spacing: { before: 60, after: 80 },
            children: [
              new TextRun({
                text: '2. CONTENIDO ACADÉMICO Y PLAN DE ACTIVIDADES',
                bold: true,
                size: 19,
                color: BRAND_GREEN_DARK,
                font: 'Calibri',
              }),
            ],
          }),
          academicTable,
          ...assignedWorksBlocks,
          ...observationsBlocks,
          new Paragraph({ spacing: { before: 160, after: 40 }, children: [] }),
          new Paragraph({
            spacing: { before: 60, after: 20 },
            children: [
              new TextRun({
                text: `${signatureSectionNumber}. CONSTANCIA DE ENTREGA Y COMPROMISO`,
                bold: true,
                size: 18,
                color: BRAND_GREEN_DARK,
                font: 'Calibri',
              }),
            ],
          }),
          signaturesTable,
        ],
      },
    ],
  });

  return doc;
}

export async function generatePlanDocxBlob(
  plan: SupportPlan,
  institutionalFooterNote?: string,
  logoBytes?: Uint8Array
): Promise<Blob> {
  const resolvedLogo = logoBytes ?? (await loadInstitutionalLogoBytes());
  const doc = createSupportPlanDocument(plan, institutionalFooterNote, resolvedLogo);
  return Packer.toBlob(doc);
}

export async function downloadSinglePlanDocx(
  plan: SupportPlan,
  institutionalFooterNote?: string
): Promise<void> {
  const blob = await generatePlanDocxBlob(plan, institutionalFooterNote);
  triggerBlobDownload(blob, buildPlanFilename(plan));
}

export async function downloadBatchPlansZip(
  plans: SupportPlan[],
  zipLabel: string,
  institutionalFooterNote?: string
): Promise<void> {
  const zip = new JSZip();
  const usedNames = new Map<string, number>();
  const resolvedLogo = await loadInstitutionalLogoBytes();

  for (const plan of plans) {
    const blob = await generatePlanDocxBlob(plan, institutionalFooterNote, resolvedLogo);
    let fileName = buildPlanFilename(plan);
    const count = usedNames.get(fileName) || 0;
    if (count > 0) {
      fileName = fileName.replace(/\.docx$/i, `_${count + 1}.docx`);
    }
    usedNames.set(buildPlanFilename(plan), count + 1);
    zip.file(fileName, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const safeZip = sanitizeFileName(zipLabel || 'Planes_Apoyo_CASD');
  triggerBlobDownload(content, `${safeZip}.zip`);
}
