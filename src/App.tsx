import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  FilePlus2,
  History,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react';
import type {
  AcademicContentRow,
  AppDatabase,
  AppSection,
  InstitutionalConfig,
  LibraryItem,
  PlanDraft,
  StudentRosterEntry,
  SupportPlan,
} from './types.ts';
import { INITIAL_DATABASE } from './data/seedData.ts';
import { api } from './utils/api.ts';
import { INSTITUTIONAL_LOGO_URL } from './utils/docxGenerator.ts';
import { DashboardView } from './components/DashboardView.tsx';
import { PlanEditorView, createInitialDraft } from './components/PlanEditorView.tsx';
import { createEmptyAssignedWork } from './components/AssignedWorksEditor.tsx';
import { BatchPlansView } from './components/BatchPlansView.tsx';
import { LibraryView } from './components/LibraryView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { PlanDocumentPreview } from './components/PlanDocumentPreview.tsx';

const DRAFT_STORAGE_KEY = 'casd_plan_draft_v1';

interface NavItem {
  id: AppSection;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Panel principal', icon: LayoutDashboard },
  { id: 'create', label: 'Crear nuevo plan', icon: FilePlus2 },
  { id: 'batch', label: 'Generar para varios estudiantes', icon: Users },
  { id: 'library', label: 'Biblioteca de actividades', icon: BookOpen },
  { id: 'history', label: 'Historial de planes', icon: History },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export default function App() {
  const [section, setSection] = useState<AppSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [db, setDb] = useState<AppDatabase>(INITIAL_DATABASE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState<PlanDraft>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PlanDraft;
        return {
          ...parsed,
          assignedWorks:
            Array.isArray(parsed.assignedWorks) && parsed.assignedWorks.length > 0
              ? parsed.assignedWorks
              : [createEmptyAssignedWork()],
        };
      }
    } catch {
      // ignore invalid draft JSON
    }
    return createInitialDraft(INITIAL_DATABASE.config);
  });
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);

  const [previewPlan, setPreviewPlan] = useState<SupportPlan | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const remote = await api.getState();
        if (!active) return;
        setDb(remote);
        setDraft((prev) => {
          // If draft is still pristine, sync institutional defaults from server config
          if (!prev.studentName && !prev.editingPlanId && prev.rows.length <= 1) {
            const firstRow = prev.rows[0];
            const isEmptyRow =
              !firstRow ||
              (!firstRow.competency &&
                !firstRow.topics &&
                !firstRow.activities &&
                !firstRow.evaluationCriteria);
            if (isEmptyRow) {
              return createInitialDraft(remote.config);
            }
          }
          return prev;
        });
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'No se pudo conectar con el almacenamiento del servidor.'
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Automatic draft persistence to localStorage on every edit
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        const timeStr = new Intl.DateTimeFormat('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date());
        setLastDraftSavedAt(timeStr);
      } catch {
        // ignore storage quota error
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [draft]);

  const handleNavigate = (next: AppSection) => {
    setSection(next);
    setMobileMenuOpen(false);
  };

  const handleSavePlan = async (planDraft: PlanDraft): Promise<SupportPlan> => {
    if (planDraft.editingPlanId) {
      const updated = await api.updatePlan(planDraft.editingPlanId, {
        institutionName: planDraft.institutionName,
        city: planDraft.city || db.config.city || 'Barrancabermeja',
        teacherName: planDraft.teacherName,
        teacherRole: planDraft.teacherRole,
        area: planDraft.area,
        subject: planDraft.subject,
        grade: planDraft.grade,
        course: planDraft.course,
        period: planDraft.period,
        academicYear: planDraft.academicYear,
        studentName: planDraft.studentName,
        studentCode: planDraft.studentCode,
        deliveryDate: planDraft.deliveryDate,
        supportDeadline: planDraft.supportDeadline,
        observations: planDraft.observations,
        rows: planDraft.rows,
        assignedWorks: planDraft.assignedWorks,
      });
      setDb((prev) => ({
        ...prev,
        plans: prev.plans.map((p) => (p.id === updated.id ? updated : p)),
      }));
      return updated;
    }

    const createdList = await api.createPlans([
      {
        institutionName: planDraft.institutionName,
        city: planDraft.city || db.config.city || 'Barrancabermeja',
        teacherName: planDraft.teacherName,
        teacherRole: planDraft.teacherRole,
        area: planDraft.area,
        subject: planDraft.subject,
        grade: planDraft.grade,
        course: planDraft.course,
        period: planDraft.period,
        academicYear: planDraft.academicYear,
        studentName: planDraft.studentName,
        studentCode: planDraft.studentCode,
        deliveryDate: planDraft.deliveryDate,
        supportDeadline: planDraft.supportDeadline,
        observations: planDraft.observations,
        rows: planDraft.rows,
        assignedWorks: planDraft.assignedWorks,
      },
    ]);
    const created = createdList[0];
    setDb((prev) => ({ ...prev, plans: [created, ...prev.plans] }));
    return created;
  };

  const handleCreateBatchPlans = async (
    plansPayload: Partial<SupportPlan>[]
  ): Promise<SupportPlan[]> => {
    const created = await api.createPlans(plansPayload);
    setDb((prev) => ({ ...prev, plans: [...created, ...prev.plans] }));
    return created;
  };

  const handleDeletePlan = async (id: string) => {
    await api.deletePlan(id);
    setDb((prev) => ({
      ...prev,
      plans: prev.plans.filter((p) => p.id !== id),
    }));
    showToast('Plan eliminado del historial.');
  };

  const handleEditPlan = (plan: SupportPlan) => {
    setDraft({
      editingPlanId: plan.id,
      institutionName: plan.institutionName,
      city: plan.city || db.config.city || 'Barrancabermeja',
      teacherName: plan.teacherName,
      teacherRole: plan.teacherRole,
      area: plan.area,
      subject: plan.subject,
      grade: plan.grade,
      course: plan.course,
      period: plan.period,
      academicYear: plan.academicYear,
      studentName: plan.studentName,
      studentCode: plan.studentCode || '',
      deliveryDate: plan.deliveryDate,
      supportDeadline: plan.supportDeadline || '',
      observations: plan.observations || '',
      rows: plan.rows.map((r) => ({ ...r })),
      assignedWorks:
        plan.assignedWorks && plan.assignedWorks.length > 0
          ? plan.assignedWorks.map((w) => ({ ...w }))
          : [createEmptyAssignedWork()],
    });
    setSection('create');
  };

  const handleDuplicatePlan = async (plan: SupportPlan) => {
    const createdList = await api.createPlans([
      {
        ...plan,
        id: undefined,
        code: undefined,
        studentName: plan.studentName?.trim() ? `${plan.studentName} (Copia)` : '',
      },
    ]);
    const duplicated = createdList[0];
    setDb((prev) => ({ ...prev, plans: [duplicated, ...prev.plans] }));
    showToast(`Plan duplicado (${duplicated.code}).`);
  };

  const handleResetDraft = () => {
    const fresh = createInitialDraft(db.config);
    setDraft(fresh);
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(fresh));
  };

  const handleCreateLibraryItem = async (
    item: Partial<LibraryItem>
  ): Promise<LibraryItem> => {
    const created = await api.createLibraryItem(item);
    setDb((prev) => ({ ...prev, library: [created, ...prev.library] }));
    showToast('Contenido guardado en la biblioteca.');
    return created;
  };

  const handleUpdateLibraryItem = async (
    id: string,
    item: Partial<LibraryItem>
  ): Promise<LibraryItem> => {
    const updated = await api.updateLibraryItem(id, item);
    setDb((prev) => ({
      ...prev,
      library: prev.library.map((l) => (l.id === id ? updated : l)),
    }));
    showToast('Contenido actualizado en la biblioteca.');
    return updated;
  };

  const handleDeleteLibraryItem = async (id: string) => {
    await api.deleteLibraryItem(id);
    setDb((prev) => ({
      ...prev,
      library: prev.library.filter((l) => l.id !== id),
    }));
    showToast('Contenido eliminado de la biblioteca.');
  };

  const handleSaveRowToLibrary = async (
    row: AcademicContentRow,
    topicTitle: string,
    grade: string,
    subject: string,
    year: number
  ) => {
    await handleCreateLibraryItem({
      grade,
      subject,
      topic: topicTitle,
      academicYear: year,
      competency: row.competency,
      topics: row.topics,
      activities: row.activities,
      evaluationCriteria: row.evaluationCriteria,
      bibliography: row.bibliography,
    });
  };

  const handleInsertLibraryIntoNewPlan = (item: LibraryItem) => {
    const base = createInitialDraft(db.config);
    setDraft({
      ...base,
      grade: item.grade,
      subject: item.subject,
      academicYear: db.config.academicYear,
      rows: [
        {
          id: `row-${Date.now()}`,
          competency: item.competency,
          topics: item.topics,
          activities: item.activities,
          evaluationCriteria: item.evaluationCriteria,
          bibliography: item.bibliography,
        },
      ],
    });
    setSection('create');
    showToast(`Contenido "${item.topic}" insertado en un nuevo plan.`);
  };

  const handleUpdateConfig = async (
    next: Partial<InstitutionalConfig>
  ): Promise<InstitutionalConfig> => {
    const updated = await api.updateConfig(next);
    setDb((prev) => ({ ...prev, config: updated }));
    return updated;
  };

  const handleImportRoster = async (entries: StudentRosterEntry[]) => {
    const updatedRoster = await api.importRosters(entries, true);
    setDb((prev) => ({ ...prev, rosters: updatedRoster }));
  };

  const handleRestoreBackup = async (backup: AppDatabase) => {
    const restored = await api.restoreBackup(backup);
    setDb(restored);
    showToast('Copia de seguridad restaurada.');
  };

  const currentNavLabel =
    NAV_ITEMS.find((n) => n.id === section)?.label || 'Panel principal';

  return (
    <div className="min-h-screen bg-[#F6FAF7] text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-[270px] lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-[#FAF6D8]/55 px-4 py-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white p-0.5 ring-1 ring-[#0D7136]/25">
            <img
              src={INSTITUTIONAL_LOGO_URL}
              alt="Escudo CASD"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#095528] truncate">
              Planes de Apoyo
            </p>
            <p className="text-[11px] font-medium text-slate-700 truncate">
              CASD José Prudencio Padilla
            </p>
            <p className="text-[10px] text-slate-500 truncate">
              {db.config.city || 'Barrancabermeja'}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Menú principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#0D7136] text-white'
                    : 'text-slate-700 hover:bg-[#EAF4EE] hover:text-[#095528]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-900 truncate">
            {db.config.teacherName}
          </p>
          <p className="truncate text-[11px] text-slate-600">
            {db.config.area} · Año {db.config.academicYear}
          </p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 flex w-72 max-w-[85vw] flex-col bg-white border-r border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#FAF6D8]/55 px-4 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white p-0.5 ring-1 ring-[#0D7136]/25">
                  <img
                    src={INSTITUTIONAL_LOGO_URL}
                    alt="Escudo CASD"
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="text-sm font-bold text-[#095528] truncate">
                  Planes de Apoyo CASD
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#0D7136] text-white'
                        : 'text-slate-700 hover:bg-[#EAF4EE] hover:text-[#095528]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-[270px] min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-8 border-b border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur-xs sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-500 whitespace-nowrap">
                CASD José Prudencio Padilla
              </span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <h1 className="font-semibold text-slate-900 truncate">
                {currentNavLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {section !== 'create' && (
              <button
                type="button"
                onClick={() => handleNavigate('create')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0D7136] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#095528] whitespace-nowrap shrink-0"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                Nuevo plan
              </button>
            )}
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {loadError && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              Aviso de conexión: {loadError}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
              </div>
              <div className="h-64 animate-pulse rounded-xl bg-slate-200/70" />
            </div>
          ) : (
            <>
              {section === 'dashboard' && (
                <DashboardView
                  config={db.config}
                  plans={db.plans}
                  library={db.library}
                  rosters={db.rosters}
                  onNavigate={handleNavigate}
                  onPreviewPlan={setPreviewPlan}
                  onEditPlan={handleEditPlan}
                />
              )}

              {section === 'create' && (
                <PlanEditorView
                  config={db.config}
                  draft={draft}
                  lastDraftSavedAt={lastDraftSavedAt}
                  library={db.library}
                  rosters={db.rosters}
                  onChangeDraft={setDraft}
                  onResetDraft={handleResetDraft}
                  onSavePlan={handleSavePlan}
                  onPreview={setPreviewPlan}
                  onSaveRowToLibrary={handleSaveRowToLibrary}
                />
              )}

              {section === 'batch' && (
                <BatchPlansView
                  config={db.config}
                  library={db.library}
                  rosters={db.rosters}
                  existingPlans={db.plans}
                  onCreateBatchPlans={handleCreateBatchPlans}
                  onImportRoster={handleImportRoster}
                  onPreview={setPreviewPlan}
                  onSaveRowToLibrary={handleSaveRowToLibrary}
                />
              )}

              {section === 'library' && (
                <LibraryView
                  config={db.config}
                  library={db.library}
                  onCreateItem={handleCreateLibraryItem}
                  onUpdateItem={handleUpdateLibraryItem}
                  onDeleteItem={handleDeleteLibraryItem}
                  onInsertIntoNewPlan={handleInsertLibraryIntoNewPlan}
                />
              )}

              {section === 'history' && (
                <HistoryView
                  config={db.config}
                  plans={db.plans}
                  onPreviewPlan={setPreviewPlan}
                  onEditPlan={handleEditPlan}
                  onDuplicatePlan={handleDuplicatePlan}
                  onDeletePlan={handleDeletePlan}
                />
              )}

              {section === 'settings' && (
                <SettingsView
                  config={db.config}
                  rosters={db.rosters}
                  onUpdateConfig={handleUpdateConfig}
                  onImportRoster={handleImportRoster}
                  onRestoreBackup={handleRestoreBackup}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Document Preview Modal */}
      <PlanDocumentPreview
        plan={previewPlan}
        footerNote={db.config.institutionalFooterNote}
        onClose={() => setPreviewPlan(null)}
        onEdit={handleEditPlan}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className="no-print fixed bottom-5 right-5 z-50 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
