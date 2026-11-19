import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CloudUpload,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  FolderPlus,
  Globe,
  LogOut,
  RefreshCw,
  Search,
  Sheet,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AppDatabase, DriveFileEntry, WorkspaceLinks } from '../types.ts';
import { ConfirmModal } from './ConfirmModal.tsx';
import { GoogleSignInButton } from './GoogleSignInButton.tsx';
import {
  createCasdDriveFolder,
  createCasdSpreadsheet,
  deleteDriveFile,
  discoverAppResources,
  ensureCasdSpreadsheetStructure,
  extractDriveFolderId,
  extractSpreadsheetId,
  listFolderFiles,
  readDatabaseFromSheets,
  uploadBlobToDriveFolder,
  writeDatabaseToSheets,
} from '../utils/googleWorkspaceBackend.ts';

interface CloudWorkspacePanelProps {
  db: AppDatabase;
  user: User | null;
  accessToken: string | null;
  isLoggingIn: boolean;
  links: WorkspaceLinks;
  hasPendingSheetSync: boolean;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
  onUpdateLinks: (next: WorkspaceLinks) => void;
  onReplaceDatabaseFromSheets: (nextDb: AppDatabase) => Promise<void>;
  onMarkSynced: () => void;
}

type PendingMutation =
  | { kind: 'push_sheets' }
  | { kind: 'pull_sheets' }
  | { kind: 'upload_file'; file: File }
  | { kind: 'delete_drive_file'; file: DriveFileEntry };

export const CloudWorkspacePanel: React.FC<CloudWorkspacePanelProps> = ({
  db,
  user,
  accessToken,
  isLoggingIn,
  links,
  hasPendingSheetSync,
  onLogin,
  onLogout,
  onUpdateLinks,
  onReplaceDatabaseFromSheets,
  onMarkSynced,
}) => {
  const [sheetInput, setSheetInput] = useState(links.spreadsheetId || '');
  const [folderInput, setFolderInput] = useState(links.driveFolderId || '');
  const [newSheetTitle, setNewSheetTitle] = useState(
    `CASD - Base de Datos Planes de Apoyo ${db.config.academicYear}`
  );
  const [newFolderName, setNewFolderName] = useState(
    'Planes de Apoyo CASD - Archivos'
  );

  const [driveFiles, setDriveFiles] = useState<DriveFileEntry[]>([]);
  const [discovered, setDiscovered] = useState<{
    spreadsheets: DriveFileEntry[];
    folders: DriveFileEntry[];
  } | null>(null);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] =
    useState<PendingMutation | null>(null);

  useEffect(() => {
    setSheetInput(links.spreadsheetId || '');
    setFolderInput(links.driveFolderId || '');
  }, [links.spreadsheetId, links.driveFolderId]);

  const refreshFolderFiles = async (folderId = links.driveFolderId) => {
    if (!accessToken || !folderId) return;
    setBusyAction('list_files');
    setErrorMsg(null);
    try {
      const files = await listFolderFiles(accessToken, folderId);
      setDriveFiles(files);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudieron listar los archivos.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    if (accessToken && links.driveFolderId) {
      void refreshFolderFiles(links.driveFolderId);
    } else {
      setDriveFiles([]);
    }
  }, [accessToken, links.driveFolderId]);

  const handleDiscover = async () => {
    if (!accessToken) return;
    setBusyAction('discover');
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await discoverAppResources(accessToken);
      setDiscovered(res);
      if (res.spreadsheets.length === 0 && res.folders.length === 0) {
        setStatusMsg(
          'No se encontraron hojas ni carpetas creadas previamente desde esta app. Puedes crearlas ahora en un clic.'
        );
      } else {
        setStatusMsg(
          `Se detectaron ${res.spreadsheets.length} hoja(s) de cálculo y ${res.folders.length} carpeta(s) disponibles.`
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error al buscar recursos en Google Drive.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateSpreadsheet = async () => {
    if (!accessToken) return;
    setBusyAction('create_sheet');
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const created = await createCasdSpreadsheet(
        accessToken,
        newSheetTitle.trim() || 'CASD - Base de Datos Planes de Apoyo'
      );
      const nextLinks: WorkspaceLinks = {
        ...links,
        spreadsheetId: created.spreadsheetId,
        spreadsheetTitle: created.title,
      };
      onUpdateLinks(nextLinks);
      setSheetInput(created.spreadsheetId);
      setStatusMsg(
        `Hoja de cálculo "${created.title}" creada con las pestañas Configuracion, Planes, Biblioteca y Estudiantes. Ahora puedes subir los datos iniciales.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo crear la hoja de cálculo.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleConnectExistingSpreadsheet = async () => {
    if (!accessToken) return;
    const id = extractSpreadsheetId(sheetInput);
    if (!id) {
      setErrorMsg('Pega el enlace o ID válido de la hoja de cálculo.');
      return;
    }
    setBusyAction('connect_sheet');
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const info = await ensureCasdSpreadsheetStructure(accessToken, id);
      onUpdateLinks({
        ...links,
        spreadsheetId: id,
        spreadsheetTitle: info.title,
      });
      setStatusMsg(
        `Hoja "${info.title}" conectada y verificada correctamente.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo conectar la hoja de cálculo.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!accessToken) return;
    setBusyAction('create_folder');
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const folder = await createCasdDriveFolder(
        accessToken,
        newFolderName.trim() || 'Planes de Apoyo CASD - Archivos'
      );
      onUpdateLinks({
        ...links,
        driveFolderId: folder.id,
        driveFolderName: folder.name,
      });
      setFolderInput(folder.id);
      setStatusMsg(
        `Carpeta "${folder.name}" creada en tu Google Drive y conectada para subir archivos.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo crear la carpeta en Google Drive.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleConnectExistingFolder = async () => {
    if (!accessToken) return;
    const id = extractDriveFolderId(folderInput);
    if (!id) {
      setErrorMsg('Ingresa un ID o enlace válido de carpeta de Google Drive.');
      return;
    }
    onUpdateLinks({
      ...links,
      driveFolderId: id,
      driveFolderName: links.driveFolderName || 'Carpeta conectada',
    });
    await refreshFolderFiles(id);
    setStatusMsg('Carpeta de Google Drive vinculada.');
  };

  const executePendingMutation = async () => {
    if (!pendingMutation || !accessToken) return;
    const action = pendingMutation;
    setPendingMutation(null);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      if (action.kind === 'push_sheets') {
        setBusyAction('push_sheets');
        const res = await writeDatabaseToSheets(
          accessToken,
          links.spreadsheetId,
          db,
          links
        );
        onUpdateLinks({
          ...links,
          spreadsheetTitle: res.title,
          lastSyncedAt: res.syncedAt,
        });
        onMarkSynced();
        setStatusMsg(
          `Datos actualizados en la hoja "${res.title}" (${db.plans.length} planes, ${db.library.length} contenidos, ${db.rosters.length} estudiantes).`
        );
      } else if (action.kind === 'pull_sheets') {
        setBusyAction('pull_sheets');
        const res = await readDatabaseFromSheets(
          accessToken,
          links.spreadsheetId
        );
        await onReplaceDatabaseFromSheets(res.db);
        onUpdateLinks({
          ...links,
          spreadsheetTitle: res.title,
          driveFolderId: res.driveFolderId || links.driveFolderId,
          driveFolderName: res.driveFolderName || links.driveFolderName,
          lastSyncedAt: new Date().toISOString(),
        });
        onMarkSynced();
        setStatusMsg(
          `Datos cargados desde "${res.title}" (${res.db.plans.length} planes, ${res.db.library.length} contenidos).`
        );
      } else if (action.kind === 'upload_file') {
        setBusyAction('upload_file');
        const uploaded = await uploadBlobToDriveFolder(
          accessToken,
          links.driveFolderId,
          action.file.name,
          action.file,
          action.file.type || 'application/octet-stream'
        );
        setStatusMsg(
          `Archivo "${uploaded.name}" subido correctamente a Google Drive.`
        );
        await refreshFolderFiles(links.driveFolderId);
      } else if (action.kind === 'delete_drive_file') {
        setBusyAction('delete_file');
        await deleteDriveFile(accessToken, action.file.id);
        setStatusMsg(`Archivo "${action.file.name}" eliminado de Google Drive.`);
        await refreshFolderFiles(links.driveFolderId);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error al ejecutar la operación en Google Workspace.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const getConfirmDetails = () => {
    if (!pendingMutation) {
      return { title: '', description: '', confirmLabel: '', variant: 'primary' as const };
    }
    switch (pendingMutation.kind) {
      case 'push_sheets':
        return {
          title: 'Actualizar hoja de cálculo en Google Sheets',
          description: `Se actualizarán las pestañas Configuracion, Planes (${db.plans.length}), Biblioteca (${db.library.length}) y Estudiantes (${db.rosters.length}) en la hoja "${links.spreadsheetTitle || links.spreadsheetId}". ¿Deseas continuar?`,
          confirmLabel: 'Sí, actualizar hoja',
          variant: 'primary' as const,
        };
      case 'pull_sheets':
        return {
          title: 'Cargar base de datos desde Google Sheets',
          description: `Se reemplazarán los datos locales actuales con la información almacenada en la hoja "${links.spreadsheetTitle || links.spreadsheetId}". ¿Deseas continuar?`,
          confirmLabel: 'Sí, cargar datos',
          variant: 'primary' as const,
        };
      case 'upload_file':
        return {
          title: 'Subir archivo a carpeta de Google Drive',
          description: `Se subirá el archivo "${pendingMutation.file.name}" a la carpeta "${links.driveFolderName || links.driveFolderId}" en tu Google Drive.`,
          confirmLabel: 'Sí, subir archivo',
          variant: 'primary' as const,
        };
      case 'delete_drive_file':
        return {
          title: 'Eliminar archivo de Google Drive',
          description: `¿Deseas eliminar permanentemente el archivo "${pendingMutation.file.name}" de tu carpeta de Google Drive? Esta acción no se puede deshacer.`,
          confirmLabel: 'Sí, eliminar archivo',
          variant: 'danger' as const,
        };
    }
  };

  const confirmDetails = getConfirmDetails();
  const isConnected = Boolean(user && accessToken);

  const formatFileSize = (bytes?: string) => {
    const n = Number(bytes);
    if (!n || Number.isNaN(n)) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Google Account Connection */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <Sheet className="mt-0.5 h-5 w-5 text-[#0D7136] shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Backend en Google Sheets y Carpeta de Archivos en Google Drive
              </h3>
              <p className="text-xs text-slate-500">
                Conecta tu cuenta de Google para guardar planes, biblioteca y planillas en una hoja de cálculo y subir los documentos Word (.docx) a una carpeta de Drive.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isConnected ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-right text-xs">
                  <p className="font-semibold text-slate-900">
                    {user?.displayName || 'Cuenta Google conectada'}
                  </p>
                  <p className="text-slate-500">{user?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Desconectar
                </button>
              </div>
            ) : (
              <GoogleSignInButton
                onClick={onLogin}
                loading={isLoggingIn}
                label="Sign in with Google"
              />
            )}
          </div>
        </div>

        {statusMsg && (
          <div
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900"
            role="status"
          >
            {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-900"
            role="alert"
          >
            {errorMsg}
          </div>
        )}

        {!isConnected ? (
          <div className="rounded-lg border border-slate-200 bg-[#FAF6D8]/45 p-4 text-xs text-slate-700 space-y-2">
            <p className="font-semibold text-[#095528]">
              Conecta tu cuenta Google para activar el almacenamiento en la nube
            </p>
            <p>
              Mientras no inicies sesión con Google, la aplicación guarda tus planes automáticamente en este navegador. Al conectar Google podrás crear o vincular tu Hoja de Cálculo y tu Carpeta de Drive en un clic.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Auto-discovery helper */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-600">
                ¿Ya creaste tu hoja o carpeta anteriormente desde esta app en otro equipo?
              </p>
              <button
                type="button"
                onClick={handleDiscover}
                disabled={busyAction === 'discover'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Search className="h-3.5 w-3.5 text-[#0D7136]" />
                {busyAction === 'discover'
                  ? 'Buscando...'
                  : 'Detectar hoja y carpeta existentes'}
              </button>
            </div>

            {discovered &&
              (discovered.spreadsheets.length > 0 ||
                discovered.folders.length > 0) && (
                <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-800">
                      Hojas de cálculo detectadas ({discovered.spreadsheets.length})
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {discovered.spreadsheets.map((sp) => (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => {
                            setSheetInput(sp.id);
                            onUpdateLinks({
                              ...links,
                              spreadsheetId: sp.id,
                              spreadsheetTitle: sp.name,
                            });
                            setStatusMsg(`Hoja "${sp.name}" seleccionada.`);
                          }}
                          className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1.5 text-left text-xs hover:border-[#0D7136]"
                        >
                          <span className="truncate font-medium text-slate-900">
                            {sp.name}
                          </span>
                          <span className="ml-2 text-[11px] font-semibold text-[#0D7136] shrink-0">
                            Usar
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-800">
                      Carpetas Drive detectadas ({discovered.folders.length})
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {discovered.folders.map((fld) => (
                        <button
                          key={fld.id}
                          type="button"
                          onClick={() => {
                            setFolderInput(fld.id);
                            onUpdateLinks({
                              ...links,
                              driveFolderId: fld.id,
                              driveFolderName: fld.name,
                            });
                            setStatusMsg(`Carpeta "${fld.name}" seleccionada.`);
                          }}
                          className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1.5 text-left text-xs hover:border-[#0D7136]"
                        >
                          <span className="truncate font-medium text-slate-900">
                            {fld.name}
                          </span>
                          <span className="ml-2 text-[11px] font-semibold text-[#0D7136] shrink-0">
                            Usar
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            {/* Google Sheets Backend Card */}
            <div className="rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="h-5 w-5 text-[#0D7136]" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      1. Base de datos en Hoja de Cálculo (Google Sheets)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Almacena 4 pestañas automáticas: Configuracion, Planes, Biblioteca y Estudiantes.
                    </p>
                  </div>
                </div>

                {links.spreadsheetId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(
                      links.spreadsheetId
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-[#0D7136] hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    Abrir hoja en Google Sheets
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Opción A: Crear hoja de cálculo nueva automáticamente
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={newSheetTitle}
                      onChange={(e) => setNewSheetTitle(e.target.value)}
                      className="flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateSpreadsheet}
                      disabled={busyAction === 'create_sheet'}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D7136] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#095528] disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      {busyAction === 'create_sheet'
                        ? 'Creando...'
                        : 'Crear hoja nueva'}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Opción B: Conectar hoja existente (pega URL o ID)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={sheetInput}
                      onChange={(e) => setSheetInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleConnectExistingSpreadsheet}
                      disabled={busyAction === 'connect_sheet'}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      {busyAction === 'connect_sheet'
                        ? 'Verificando...'
                        : 'Conectar hoja'}
                    </button>
                  </div>
                </div>
              </div>

              {links.spreadsheetId && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">
                      Hoja activa:{' '}
                    </span>
                    {links.spreadsheetTitle || links.spreadsheetId}
                    {links.lastSyncedAt && (
                      <span className="ml-2 text-slate-500 tabular-nums">
                        · Última sincronización:{' '}
                        {new Date(links.lastSyncedAt).toLocaleString('es-CO')}
                      </span>
                    )}
                    {hasPendingSheetSync && (
                      <span className="ml-2 font-semibold text-amber-700">
                        · Cambios locales pendientes por subir
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPendingMutation({ kind: 'pull_sheets' })}
                      disabled={Boolean(busyAction)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {busyAction === 'pull_sheets'
                        ? 'Cargando...'
                        : 'Cargar desde Google Sheets'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingMutation({ kind: 'push_sheets' })}
                      disabled={Boolean(busyAction)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D7136] px-4 py-2 text-xs font-semibold text-white hover:bg-[#095528] disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <CloudUpload className="h-3.5 w-3.5" />
                      {busyAction === 'push_sheets'
                        ? 'Sincronizando...'
                        : 'Guardar / Actualizar en Google Sheets'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Google Drive Folder Card */}
            <div className="rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FolderOpen className="h-5 w-5 text-[#0D7136]" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      2. Carpeta de Google Drive para subir archivos (.docx, .zip, guías)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Todos los planes Word (.docx) o paquetes ZIP que envíes a la nube se guardarán dentro de esta carpeta.
                    </p>
                  </div>
                </div>

                {links.driveFolderId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${encodeURIComponent(
                      links.driveFolderId
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-[#0D7136] hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    Abrir carpeta en Drive
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Crear carpeta dedicada en Google Drive
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0D7136] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateFolder}
                      disabled={busyAction === 'create_folder'}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D7136] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#095528] disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      {busyAction === 'create_folder'
                        ? 'Creando...'
                        : 'Crear carpeta'}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Vincular carpeta existente autorizada (URL o ID)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={folderInput}
                      onChange={(e) => setFolderInput(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      className="flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#0D7136] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleConnectExistingFolder}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
                    >
                      Vincular carpeta
                    </button>
                  </div>
                </div>
              </div>

              {links.driveFolderId && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-700">
                      Carpeta conectada:{' '}
                      <span className="font-semibold text-slate-900">
                        {links.driveFolderName || links.driveFolderId}
                      </span>{' '}
                      ({driveFiles.length} archivo(s))
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => refreshFolderFiles(links.driveFolderId)}
                        disabled={busyAction === 'list_files'}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Actualizar lista
                      </button>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0">
                        <Upload className="h-3.5 w-3.5" />
                        Subir archivo a la carpeta
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setPendingMutation({ kind: 'upload_file', file });
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Archivo</th>
                          <th className="px-3 py-2 font-semibold">Tamaño</th>
                          <th className="px-3 py-2 font-semibold">Fecha</th>
                          <th className="px-4 py-2 text-right font-semibold">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {driveFiles.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-6 text-center text-slate-500"
                            >
                              Aún no hay archivos en esta carpeta. Puedes subir planes .docx directamente al generarlos o cargar guías aquí.
                            </td>
                          </tr>
                        ) : (
                          driveFiles.map((f) => (
                            <tr key={f.id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-2 font-medium text-slate-900">
                                {f.name}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-600 tabular-nums">
                                {formatFileSize(f.size)}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-500 tabular-nums">
                                {f.createdTime
                                  ? new Date(f.createdTime).toLocaleDateString(
                                      'es-CO'
                                    )
                                  : '—'}
                              </td>
                              <td className="px-4 py-2 text-right whitespace-nowrap">
                                {f.webViewLink && (
                                  <a
                                    href={f.webViewLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mr-2 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-[#0D7136] hover:bg-slate-50"
                                  >
                                    Abrir
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPendingMutation({
                                      kind: 'delete_drive_file',
                                      file: f,
                                    })
                                  }
                                  className="inline-flex items-center rounded-md p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                                  title="Eliminar archivo de Google Drive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 2. GitHub Pages Deployment Checklist */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="flex items-start gap-3">
          <Globe className="mt-0.5 h-5 w-5 text-[#0D7136] shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Guía de publicación en GitHub Pages
            </h3>
            <p className="text-xs text-slate-500">
              El repositorio ya incluye rutas relativas en Vite y el flujo automático de despliegue en{' '}
              <span className="font-mono">.github/workflows/deploy-gh-pages.yml</span>.
            </p>
          </div>
        </div>

        <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-700">
          <li>
            Sube el proyecto a tu repositorio de GitHub en la rama <span className="font-mono font-semibold">main</span>.
          </li>
          <li>
            En GitHub ve a <span className="font-semibold">Settings → Pages → Build and deployment</span> y selecciona <span className="font-semibold">Source: GitHub Actions</span>.
          </li>
          <li>
            En <span className="font-semibold">Firebase Console → Authentication → Settings → Authorized domains</span>, agrega tu dominio de GitHub Pages (por ejemplo, <span className="font-mono">tu-usuario.github.io</span>) para habilitar el inicio de sesión con Google en la web publicada.
          </li>
          <li>
            Abre la URL publicada de GitHub Pages, inicia sesión con Google arriba y crea o conecta tu Hoja de Cálculo y Carpeta de Drive.
          </li>
        </ol>
      </section>

      <ConfirmModal
        open={Boolean(pendingMutation)}
        title={confirmDetails.title}
        description={confirmDetails.description}
        confirmLabel={confirmDetails.confirmLabel}
        variant={confirmDetails.variant}
        onConfirm={executePendingMutation}
        onCancel={() => setPendingMutation(null)}
      />
    </div>
  );
};
