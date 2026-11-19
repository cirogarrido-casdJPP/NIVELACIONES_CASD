import { INITIAL_DATABASE } from '../data/seedData.ts';
import type {
  AcademicContentRow,
  AppDatabase,
  AssignedWork,
  DriveFileEntry,
  InstitutionalConfig,
  LibraryItem,
  StudentRosterEntry,
  SupportPlan,
  WorkspaceLinks,
} from '../types.ts';

const LINKS_STORAGE_KEY = 'casd_workspace_links_v1';

const TAB_CONFIG = 'Configuracion';
const TAB_PLANS = 'Planes';
const TAB_LIBRARY = 'Biblioteca';
const TAB_ROSTERS = 'Estudiantes';

const REQUIRED_TABS = [TAB_CONFIG, TAB_PLANS, TAB_LIBRARY, TAB_ROSTERS];

export function loadWorkspaceLinks(): WorkspaceLinks {
  try {
    const raw = localStorage.getItem(LINKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<WorkspaceLinks>;
      return {
        spreadsheetId: parsed.spreadsheetId || '',
        spreadsheetTitle: parsed.spreadsheetTitle || '',
        driveFolderId: parsed.driveFolderId || '',
        driveFolderName: parsed.driveFolderName || '',
        lastSyncedAt: parsed.lastSyncedAt || '',
      };
    }
  } catch {
    // ignore invalid local json
  }
  return {
    spreadsheetId: '',
    spreadsheetTitle: '',
    driveFolderId: '',
    driveFolderName: '',
    lastSyncedAt: '',
  };
}

export function saveWorkspaceLinks(links: WorkspaceLinks): void {
  try {
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
  } catch {
    // ignore quota error
  }
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(trimmed);
  return match ? match[1] : trimmed;
}

export function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  const folderMatch = /\/folders\/([a-zA-Z0-9-_]+)/.exec(trimmed);
  if (folderMatch) return folderMatch[1];
  const idMatch = /[?&]id=([a-zA-Z0-9-_]+)/.exec(trimmed);
  return idMatch ? idMatch[1] : trimmed;
}

async function googleApiFetch<T>(
  url: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let errorMessage = `Error de Google (${res.status})`;
    try {
      const data = (await res.json()) as {
        error?: { message?: string; status?: string };
      };
      if (data?.error?.message) {
        errorMessage = data.error.message;
      }
    } catch {
      // ignore non-json error
    }
    if (res.status === 401) {
      throw new Error(
        'La sesión de Google expiró o requiere volver a conectar. Haz clic en "Conectar con Google".'
      );
    }
    if (res.status === 403 || res.status === 404) {
      throw new Error(
        `${errorMessage}. Verifica que la hoja o carpeta exista y haya sido creada o autorizada desde esta aplicación.`
      );
    }
    throw new Error(errorMessage);
  }

  if (res.status === 204) {
    return {} as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

interface SpreadsheetMetadata {
  spreadsheetId: string;
  properties?: { title?: string };
  sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  return googleApiFetch<SpreadsheetMetadata>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title)`,
    accessToken
  );
}

async function styleHeaderRows(
  accessToken: string,
  spreadsheetId: string,
  sheetIds: number[]
): Promise<void> {
  if (sheetIds.length === 0) return;
  const requests = sheetIds.flatMap((sheetId) => [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.051, green: 0.443, blue: 0.212 }, // #0D7136 CASD Green
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
  ]);

  await googleApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    }
  );
}

export async function ensureCasdSpreadsheetStructure(
  accessToken: string,
  spreadsheetId: string
): Promise<{ title: string; sheetNames: string[] }> {
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const existingTitles = new Set(
    (meta.sheets || []).map((s) => s.properties?.title).filter(Boolean) as string[]
  );

  const missingTabs = REQUIRED_TABS.filter((tab) => !existingTitles.has(tab));
  if (missingTabs.length > 0) {
    const addRequests = missingTabs.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    }));

    const batchRes = await googleApiFetch<{
      replies?: Array<{ addSheet?: { properties?: { sheetId?: number } } }>;
    }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: addRequests }),
      }
    );

    const newIds = (batchRes.replies || [])
      .map((r) => r.addSheet?.properties?.sheetId)
      .filter((id): id is number => typeof id === 'number');

    await styleHeaderRows(accessToken, spreadsheetId, newIds);
  }

  const updatedMeta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  return {
    title: updatedMeta.properties?.title || 'Base de Datos CASD',
    sheetNames: (updatedMeta.sheets || [])
      .map((s) => s.properties?.title || '')
      .filter(Boolean),
  };
}

export async function createCasdSpreadsheet(
  accessToken: string,
  title = 'CASD - Base de Datos Planes de Apoyo'
): Promise<{ spreadsheetId: string; title: string }> {
  const created = await googleApiFetch<SpreadsheetMetadata>(
    'https://sheets.googleapis.com/v4/spreadsheets',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title, locale: 'es_CO' },
        sheets: REQUIRED_TABS.map((tabTitle) => ({
          properties: {
            title: tabTitle,
            gridProperties: { frozenRowCount: 1 },
          },
        })),
      }),
    }
  );

  const sheetIds = (created.sheets || [])
    .map((s) => s.properties?.sheetId)
    .filter((id): id is number => typeof id === 'number');
  await styleHeaderRows(accessToken, created.spreadsheetId, sheetIds);

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title || title,
  };
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeDatabaseToSheets(
  accessToken: string,
  spreadsheetId: string,
  db: AppDatabase,
  links?: Partial<WorkspaceLinks>
): Promise<{ title: string; syncedAt: string }> {
  const structure = await ensureCasdSpreadsheetStructure(accessToken, spreadsheetId);

  const configRows: (string | number)[][] = [
    ['Campo', 'Valor'],
    ['institutionName', db.config.institutionName],
    ['city', db.config.city || 'Barrancabermeja'],
    ['teacherName', db.config.teacherName],
    ['teacherRole', db.config.teacherRole],
    ['area', db.config.area],
    ['subjects', JSON.stringify(db.config.subjects)],
    ['grades', JSON.stringify(db.config.grades)],
    ['academicYear', String(db.config.academicYear)],
    ['passingScore', String(db.config.passingScore)],
    ['institutionalHeaderNote', db.config.institutionalHeaderNote || ''],
    ['institutionalFooterNote', db.config.institutionalFooterNote || ''],
    ['driveFolderId', links?.driveFolderId || ''],
    ['driveFolderName', links?.driveFolderName || ''],
  ];

  const planRows: (string | number)[][] = [
    [
      'ID',
      'Codigo',
      'Anio',
      'Grado',
      'Curso',
      'Asignatura',
      'Periodo',
      'Estudiante',
      'Codigo_Estudiante',
      'Fecha_Entrega',
      'Fecha_Limite',
      'Docente',
      'Cargo_Docente',
      'Area',
      'Institucion',
      'Ciudad',
      'Observaciones',
      'Resumen_Temas',
      'Filas_JSON',
      'Trabajos_JSON',
      'Creado',
      'Actualizado',
      'Batch_ID',
    ],
    ...db.plans.map((p) => [
      p.id,
      p.code,
      p.academicYear,
      p.grade,
      p.course,
      p.subject,
      p.period,
      p.studentName || '',
      p.studentCode || '',
      p.deliveryDate,
      p.supportDeadline || '',
      p.teacherName,
      p.teacherRole,
      p.area,
      p.institutionName,
      p.city || 'Barrancabermeja',
      p.observations || '',
      p.rows
        .map((r) => r.topics || r.competency)
        .filter(Boolean)
        .join(' | ')
        .slice(0, 300),
      JSON.stringify(p.rows || []),
      JSON.stringify(p.assignedWorks || []),
      p.createdAt,
      p.updatedAt,
      p.batchId || '',
    ]),
  ];

  const libraryRows: (string | number)[][] = [
    [
      'ID',
      'Grado',
      'Asignatura',
      'Periodo',
      'Tema',
      'Anio',
      'Competencias',
      'Temas_Subtemas',
      'Actividades',
      'Criterios_Evaluacion',
      'Bibliografia',
      'Creado',
      'Actualizado',
    ],
    ...db.library.map((l) => [
      l.id,
      l.grade,
      l.subject,
      l.period || '',
      l.topic,
      l.academicYear,
      l.competency,
      l.topics,
      l.activities,
      l.evaluationCriteria,
      l.bibliography,
      l.createdAt,
      l.updatedAt,
    ]),
  ];

  const rosterRows: (string | number)[][] = [
    [
      'ID',
      'Codigo',
      'Nombre',
      'Grado',
      'Curso',
      'Asignatura',
      'Periodo',
      'Anio',
      'Nota_Periodo',
      'Nota_Final',
      'Desempeno',
      'Requiere_Apoyo',
    ],
    ...db.rosters.map((r) => [
      r.id,
      r.code,
      r.name,
      r.grade,
      r.course,
      r.subject,
      r.period,
      r.academicYear,
      r.periodScore === null ? '' : r.periodScore,
      r.finalScore === null ? '' : r.finalScore,
      r.performanceLevel,
      r.needsSupport ? 'SI' : 'NO',
    ]),
  ];

  await googleApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ranges: [
          `${TAB_CONFIG}!A:Z`,
          `${TAB_PLANS}!A:Z`,
          `${TAB_LIBRARY}!A:Z`,
          `${TAB_ROSTERS}!A:Z`,
        ],
      }),
    }
  );

  await googleApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: `${TAB_CONFIG}!A1`, values: configRows },
          { range: `${TAB_PLANS}!A1`, values: planRows },
          { range: `${TAB_LIBRARY}!A1`, values: libraryRows },
          { range: `${TAB_ROSTERS}!A1`, values: rosterRows },
        ],
      }),
    }
  );

  return {
    title: structure.title,
    syncedAt: new Date().toISOString(),
  };
}

export async function readDatabaseFromSheets(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  db: AppDatabase;
  title: string;
  driveFolderId?: string;
  driveFolderName?: string;
}> {
  const structure = await ensureCasdSpreadsheetStructure(accessToken, spreadsheetId);
  const ranges = REQUIRED_TABS.map((t) => `ranges=${encodeURIComponent(`${t}!A:Z`)}`).join('&');
  const res = await googleApiFetch<{
    valueRanges?: Array<{ values?: string[][] }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${ranges}`,
    accessToken
  );

  const [configRange, plansRange, libraryRange, rostersRange] = res.valueRanges || [];

  const configMap = new Map<string, string>();
  for (const row of (configRange?.values || []).slice(1)) {
    if (row[0]) configMap.set(row[0], row[1] || '');
  }

  const baseConfig = INITIAL_DATABASE.config;
  const config: InstitutionalConfig = {
    institutionName: configMap.get('institutionName') || baseConfig.institutionName,
    city: configMap.get('city') || baseConfig.city,
    teacherName: configMap.get('teacherName') || baseConfig.teacherName,
    teacherRole: configMap.get('teacherRole') || baseConfig.teacherRole,
    area: configMap.get('area') || baseConfig.area,
    subjects: safeJsonParse<string[]>(
      configMap.get('subjects'),
      baseConfig.subjects
    ),
    grades: safeJsonParse<string[]>(configMap.get('grades'), baseConfig.grades),
    academicYear: Number(configMap.get('academicYear')) || baseConfig.academicYear,
    passingScore: Number(configMap.get('passingScore')) || baseConfig.passingScore,
    institutionalHeaderNote:
      configMap.get('institutionalHeaderNote') || baseConfig.institutionalHeaderNote,
    institutionalFooterNote:
      configMap.get('institutionalFooterNote') || baseConfig.institutionalFooterNote,
  };

  const plans: SupportPlan[] = (plansRange?.values || [])
    .slice(1)
    .filter((row) => row[0] || row[1])
    .map((row) => ({
      id: row[0] || `plan-${Math.random().toString(36).slice(2, 8)}`,
      code: row[1] || 'CASD-PLAN',
      academicYear: Number(row[2]) || config.academicYear,
      grade: row[3] || config.grades[0] || '6°',
      course: row[4] || '',
      subject: row[5] || config.subjects[0] || 'Informática',
      period: row[6] || '4',
      studentName: row[7] || '',
      studentCode: row[8] || '',
      deliveryDate: row[9] || new Date().toISOString().slice(0, 10),
      supportDeadline: row[10] || '',
      teacherName: row[11] || config.teacherName,
      teacherRole: row[12] || config.teacherRole,
      area: row[13] || config.area,
      institutionName: row[14] || config.institutionName,
      city: row[15] || config.city,
      observations: row[16] || '',
      rows: safeJsonParse<AcademicContentRow[]>(row[18], []),
      assignedWorks: safeJsonParse<AssignedWork[]>(row[19], []),
      createdAt: row[20] || new Date().toISOString(),
      updatedAt: row[21] || new Date().toISOString(),
      batchId: row[22] || undefined,
    }));

  const library: LibraryItem[] = (libraryRange?.values || [])
    .slice(1)
    .filter((row) => row[0] || row[4])
    .map((row) => ({
      id: row[0] || `lib-${Math.random().toString(36).slice(2, 8)}`,
      grade: row[1] || '6°',
      subject: row[2] || 'Informática',
      period: row[3] || undefined,
      topic: row[4] || 'Contenido académico',
      academicYear: Number(row[5]) || config.academicYear,
      competency: row[6] || '',
      topics: row[7] || '',
      activities: row[8] || '',
      evaluationCriteria: row[9] || '',
      bibliography: row[10] || '',
      createdAt: row[11] || new Date().toISOString(),
      updatedAt: row[12] || new Date().toISOString(),
    }));

  const rosters: StudentRosterEntry[] = (rostersRange?.values || [])
    .slice(1)
    .filter((row) => row[0] || row[2])
    .map((row) => ({
      id: row[0] || `st-${Math.random().toString(36).slice(2, 8)}`,
      code: row[1] || '',
      name: row[2] || '',
      grade: row[3] || '',
      course: row[4] || '',
      subject: row[5] || '',
      period: row[6] || '',
      academicYear: Number(row[7]) || config.academicYear,
      periodScore: row[8] !== undefined && row[8] !== '' ? Number(row[8]) : null,
      finalScore: row[9] !== undefined && row[9] !== '' ? Number(row[9]) : null,
      performanceLevel: row[10] || '',
      needsSupport: row[11] === 'SI' || row[11] === 'true',
    }));

  const isSheetEmpty =
    configMap.size === 0 &&
    plans.length === 0 &&
    library.length === 0 &&
    rosters.length === 0;

  return {
    db: isSheetEmpty ? INITIAL_DATABASE : { config, plans, library, rosters },
    title: structure.title,
    driveFolderId: configMap.get('driveFolderId') || undefined,
    driveFolderName: configMap.get('driveFolderName') || undefined,
  };
}

export async function createCasdDriveFolder(
  accessToken: string,
  folderName = 'Planes de Apoyo CASD - Archivos'
): Promise<{ id: string; name: string; webViewLink?: string }> {
  return googleApiFetch<{ id: string; name: string; webViewLink?: string }>(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );
}

export async function listFolderFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFileEntry[]> {
  const q = `'${folderId}' in parents and trashed = false`;
  const data = await googleApiFetch<{ files?: DriveFileEntry[] }>(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&orderBy=createdTime%20desc&pageSize=100&fields=files(id,name,mimeType,size,createdTime,webViewLink)`,
    accessToken
  );
  return data.files || [];
}

export async function discoverAppResources(accessToken: string): Promise<{
  spreadsheets: DriveFileEntry[];
  folders: DriveFileEntry[];
}> {
  const q =
    "(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.google-apps.folder') and trashed = false";
  const data = await googleApiFetch<{ files?: DriveFileEntry[] }>(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&orderBy=modifiedTime%20desc&pageSize=50&fields=files(id,name,mimeType,size,createdTime,webViewLink)`,
    accessToken
  );
  const files = data.files || [];
  return {
    spreadsheets: files.filter(
      (f) => f.mimeType === 'application/vnd.google-apps.spreadsheet'
    ),
    folders: files.filter(
      (f) => f.mimeType === 'application/vnd.google-apps.folder'
    ),
  };
}

export async function uploadBlobToDriveFolder(
  accessToken: string,
  folderId: string,
  fileName: string,
  blob: Blob,
  mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
): Promise<DriveFileEntry> {
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const boundary = `casd_drive_boundary_${Date.now()}`;
  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}\r\n`;
  const fileHeaderPart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const closingPart = `\r\n--${boundary}--`;

  const bodyBlob = new Blob([metadataPart, fileHeaderPart, blob, closingPart], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
    }
  );

  if (!res.ok) {
    let message = `Error al subir archivo a Drive (${res.status})`;
    try {
      const errData = (await res.json()) as { error?: { message?: string } };
      if (errData?.error?.message) message = errData.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as DriveFileEntry;
}

export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await googleApiFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    accessToken,
    { method: 'DELETE' }
  );
}
