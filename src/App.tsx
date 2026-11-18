import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  CalendarDays,
  FileCode2,
  FileText,
  Lock,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from 'lucide-react';
import { AuthGateView } from './components/AuthGateView';
import { BotBuilderView } from './components/BotBuilderView';
import { JsonConverterView } from './components/JsonConverterView';
import { LoadTemplateModal } from './components/LoadTemplateModal';
import { PlannerView } from './components/PlannerView';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { DEFAULT_DAILY_PLEDGE, INITIAL_PRESETS, STARTER_TEMPLATES } from './data/seedData';
import { auth } from './firebase';
import {
  deleteBotDoc,
  deleteCalendarEventDoc,
  deleteGoalDoc,
  deletePresetDoc,
  ensureUserWorkspaceInitialized,
  saveWorkspaceSettingsDoc,
  subscribeUserWorkspace,
  upsertBotDoc,
  upsertCalendarEventDoc,
  upsertGoalDoc,
  upsertPresetDoc,
} from './services/workspaceFirestore';
import type {
  BotProject,
  BotStatus,
  BotTemplate,
  CalendarEvent,
  GoalItem,
  StarterTemplate,
  SystemPromptPreset,
} from './types/bot';
import {
  applySystemPreset,
  cloneTemplate,
  createEmptyTemplate,
  createId,
} from './utils/promptBuilder';
import { loadFromStorage, saveToStorage } from './utils/storage';

type WorkspaceTab = 'planner' | 'builder' | 'json';

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<Error | null>(null);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('planner');
  const [bots, setBots] = useState<BotProject[]>([]);
  const [activeBotId, setActiveBotId] = useState<string>('');
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [presets, setPresets] = useState<SystemPromptPreset[]>(INITIAL_PRESETS);
  const [dailyPledge, setDailyPledge] = useState<string>(DEFAULT_DAILY_PLEDGE);

  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() =>
    loadFromStorage<boolean>('sidebarOpen', true),
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  if (workspaceError) {
    throw workspaceError;
  }

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAuthUser(null);
        setAuthReady(true);
        setWorkspaceReady(false);
        setBots([]);
        setActiveBotId('');
        setGoals([]);
        setCalendarEvents([]);
        setPresets([]);
        setDailyPledge('');
        setIsLoadModalOpen(false);
        setIsMobileSidebarOpen(false);
        return;
      }
      setAuthUser(user);
      setAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    let unsubscribeWorkspace: (() => void) | undefined;

    setWorkspaceReady(false);
    setWorkspaceError(null);

    ensureUserWorkspaceInitialized(authUser)
      .then(() => {
        if (cancelled) return;
        let botsLoaded = false;
        let settingsLoaded = false;

        const checkReady = () => {
          if (botsLoaded && settingsLoaded) {
            setWorkspaceReady(true);
          }
        };

        unsubscribeWorkspace = subscribeUserWorkspace(authUser.uid, {
          onBots: (nextBots) => {
            setBots(nextBots);
            botsLoaded = true;
            checkReady();
          },
          onGoals: (nextGoals) => setGoals(nextGoals),
          onCalendarEvents: (nextEvents) => setCalendarEvents(nextEvents),
          onPresets: (nextPresets) => setPresets(nextPresets),
          onSettings: (settings) => {
            setDailyPledge(settings.dailyPledge);
            if (settings.activeBotId) {
              setActiveBotId(settings.activeBotId);
            }
            settingsLoaded = true;
            checkReady();
          },
          onError: (err) => setWorkspaceError(err),
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setWorkspaceError(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return () => {
      cancelled = true;
      if (unsubscribeWorkspace) {
        unsubscribeWorkspace();
      }
    };
  }, [authUser]);

  useEffect(() => {
    saveToStorage('sidebarOpen', isSidebarOpen);
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSidebarOpen]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#f3f7f2] text-[#1b2b21] flex items-center justify-center px-4">
        <div className="rounded-xl border border-[#d1dfd0] bg-white px-6 py-5 text-center space-y-2">
          <Lock className="mx-auto h-5 w-5 text-[#3b6e4c]" />
          <p className="text-xs font-medium text-[#496051]">작업실 보안 세션을 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthGateView />;
  }

  if (!workspaceReady) {
    return (
      <div className="min-h-screen bg-[#f3f7f2] text-[#1b2b21] flex items-center justify-center px-4">
        <div className="rounded-xl border border-[#d1dfd0] bg-white px-6 py-5 text-center space-y-2">
          <Lock className="mx-auto h-5 w-5 text-[#3b6e4c]" />
          <p className="text-xs font-medium text-[#496051]">
            개인 작업실 데이터를 안전하게 불러오는 중입니다...
          </p>
        </div>
      </div>
    );
  }

  const uid = authUser.uid;
  const activeBot = bots.find((b) => b.id === activeBotId) ?? bots[0];
  const userLabel =
    authUser.displayName ||
    authUser.email?.replace('@pineapple-studio.app', '') ||
    '내 작업실';

  const runSync = (promise: Promise<void>) => {
    promise.catch((err) => {
      setWorkspaceError(err instanceof Error ? err : new Error(String(err)));
    });
  };

  const showNotice = (msg: string) => {
    setBannerNotice(msg);
    window.setTimeout(() => setBannerNotice(null), 2600);
  };

  const selectBot = (botId: string) => {
    setActiveBotId(botId);
    runSync(saveWorkspaceSettingsDoc(uid, { dailyPledge, activeBotId: botId }));
  };

  // Bot CRUD handlers
  const handleCreateNewBot = () => {
    const today = new Date().toISOString().slice(0, 10);
    const newBot: BotProject = {
      id: createId('bot'),
      title: `새 캐릭터봇 ${bots.length + 1}`,
      subtitle: '장르 미입력',
      status: 'in_progress',
      updatedAt: today,
      notes: '',
      template: createEmptyTemplate(),
    };
    setBots((prev) => [newBot, ...prev]);
    setActiveBotId(newBot.id);
    setActiveTab('builder');
    runSync(upsertBotDoc(uid, newBot));
    runSync(saveWorkspaceSettingsDoc(uid, { dailyPledge, activeBotId: newBot.id }));
    showNotice('새 캐릭터봇 제작 틀을 열었습니다.');
  };

  const handleUpdateBot = (updated: BotProject) => {
    setBots((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    runSync(upsertBotDoc(uid, updated));
  };

  const handleDuplicateBot = (botId: string) => {
    const source = bots.find((b) => b.id === botId);
    if (!source) return;
    const today = new Date().toISOString().slice(0, 10);
    const copy: BotProject = {
      ...source,
      id: createId('bot'),
      title: `${source.title} (사본)`,
      status: 'in_progress',
      updatedAt: today,
      template: cloneTemplate(source.template),
    };
    setBots((prev) => [copy, ...prev]);
    setActiveBotId(copy.id);
    runSync(upsertBotDoc(uid, copy));
    runSync(saveWorkspaceSettingsDoc(uid, { dailyPledge, activeBotId: copy.id }));
    showNotice(`'${source.title}'을(를) 복제했습니다.`);
  };

  const handleSaveAsNewBot = (source: BotProject) => {
    const today = new Date().toISOString().slice(0, 10);
    const copy: BotProject = {
      ...source,
      id: createId('bot'),
      title: `${source.title} (사본)`,
      updatedAt: today,
      template: cloneTemplate(source.template),
    };
    setBots((prev) => [copy, ...prev]);
    setActiveBotId(copy.id);
    runSync(upsertBotDoc(uid, copy));
    runSync(saveWorkspaceSettingsDoc(uid, { dailyPledge, activeBotId: copy.id }));
    showNotice('새 캐릭터봇으로 복제 저장되었습니다.');
  };

  const handleDeleteBot = (botId: string) => {
    if (bots.length <= 1) return;
    const nextList = bots.filter((b) => b.id !== botId);
    setBots(nextList);
    const nextActiveId =
      activeBotId === botId && nextList.length > 0 ? nextList[0].id : activeBotId;
    if (nextActiveId !== activeBotId) {
      setActiveBotId(nextActiveId);
      runSync(saveWorkspaceSettingsDoc(uid, { dailyPledge, activeBotId: nextActiveId }));
    }
    runSync(deleteBotDoc(uid, botId));
    showNotice('캐릭터봇을 목록에서 삭제했습니다.');
  };

  const handleChangeBotStatus = (botId: string, nextStatus: BotStatus) => {
    const today = new Date().toISOString().slice(0, 10);
    const target = bots.find((b) => b.id === botId);
    if (!target) return;
    const updated: BotProject = {
      ...target,
      status: nextStatus,
      updatedAt: today,
    };
    setBots((prev) => prev.map((b) => (b.id === botId ? updated : b)));
    runSync(upsertBotDoc(uid, updated));
  };

  // Load / Import handlers
  const handleLoadBotProjectStructure = (sourceBot: BotProject) => {
    if (!activeBot) return;
    const updated: BotProject = {
      ...activeBot,
      updatedAt: new Date().toISOString().slice(0, 10),
      template: cloneTemplate(sourceBot.template),
    };
    handleUpdateBot(updated);
    showNotice(`'${sourceBot.title}'의 구조를 불러왔습니다.`);
  };

  const handleLoadStarterTemplate = (starter: StarterTemplate) => {
    if (!activeBot) return;
    const updated: BotProject = {
      ...activeBot,
      updatedAt: new Date().toISOString().slice(0, 10),
      template: cloneTemplate(starter.template),
    };
    handleUpdateBot(updated);
    showNotice(`'${starter.name}' 템플릿을 불러왔습니다.`);
  };

  const handleApplyPreset = (preset: SystemPromptPreset) => {
    if (!activeBot) return;
    const updated: BotProject = {
      ...activeBot,
      updatedAt: new Date().toISOString().slice(0, 10),
      template: applySystemPreset(activeBot.template, preset),
    };
    handleUpdateBot(updated);
    showNotice(`'${preset.name}' 프리셋을 현재 봇에 적용했습니다.`);
  };

  const handleImportTemplateJson = (template: BotTemplate) => {
    if (!activeBot) return;
    const updated: BotProject = {
      ...activeBot,
      updatedAt: new Date().toISOString().slice(0, 10),
      template,
    };
    handleUpdateBot(updated);
    showNotice('JSON 데이터를 제작 틀로 불러왔습니다.');
  };

  // Pledge handler
  const handleUpdatePledge = (nextPledge: string) => {
    setDailyPledge(nextPledge);
    runSync(
      saveWorkspaceSettingsDoc(uid, {
        dailyPledge: nextPledge,
        activeBotId: activeBot?.id ?? activeBotId,
      }),
    );
  };

  // Goals & Calendar handlers
  const handleAddGoal = (goal: Omit<GoalItem, 'id'>) => {
    const created: GoalItem = { ...goal, id: createId('goal') };
    setGoals((prev) => [created, ...prev]);
    runSync(upsertGoalDoc(uid, created));
  };

  const handleToggleGoal = (id: string) => {
    const target = goals.find((g) => g.id === id);
    if (!target) return;
    const updated: GoalItem = { ...target, completed: !target.completed };
    setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
    runSync(upsertGoalDoc(uid, updated));
  };

  const handleDeleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    runSync(deleteGoalDoc(uid, id));
  };

  const handleAddCalendarEvent = (event: Omit<CalendarEvent, 'id'>) => {
    const created: CalendarEvent = { ...event, id: createId('cal') };
    setCalendarEvents((prev) => [...prev, created]);
    runSync(upsertCalendarEventDoc(uid, created));
  };

  const handleToggleCalendarEvent = (id: string) => {
    const target = calendarEvents.find((ev) => ev.id === id);
    if (!target) return;
    const updated: CalendarEvent = { ...target, completed: !target.completed };
    setCalendarEvents((prev) => prev.map((ev) => (ev.id === id ? updated : ev)));
    runSync(upsertCalendarEventDoc(uid, updated));
  };

  const handleDeleteCalendarEvent = (id: string) => {
    setCalendarEvents((prev) => prev.filter((ev) => ev.id !== id));
    runSync(deleteCalendarEventDoc(uid, id));
  };

  // Presets handlers
  const handleSavePreset = (preset: SystemPromptPreset) => {
    setPresets((prev) => [preset, ...prev]);
    runSync(upsertPresetDoc(uid, preset));
  };

  const handleDeletePreset = (presetId: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
    runSync(deletePresetDoc(uid, presetId));
  };

  const handleSignOut = () => {
    setActiveTab('planner');
    void signOut(auth);
  };

  return (
    <div className="min-h-screen bg-[#f3f7f2] text-[#1b2b21] flex flex-col">
      {/* Top Bar Contract: Zone 1 Brand Wordmark — Zone 2 Concise Nav Links — Zone 3 Primary CTA */}
      <header className="border-b border-[#d1dfd0] bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 sm:gap-8 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-expanded={isSidebarOpen}
              aria-controls="workspace-sidebar"
              aria-label={isSidebarOpen ? '좌측 메뉴 닫기' : '좌측 메뉴 열기'}
              title={isSidebarOpen ? '좌측 메뉴 닫기' : '좌측 메뉴 열기'}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-2.5 py-1.5 text-xs font-medium text-[#496051] hover:bg-[#e8f0e6] hover:text-[#1b2b21] transition-colors shrink-0"
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
              <span>{isSidebarOpen ? '좌측 메뉴 닫기' : '좌측 메뉴 열기'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
              aria-expanded={isMobileSidebarOpen}
              aria-controls="mobile-workspace-sidebar"
              aria-label={isMobileSidebarOpen ? '좌측 메뉴 닫기' : '좌측 메뉴 열기'}
              title={isMobileSidebarOpen ? '좌측 메뉴 닫기' : '좌측 메뉴 열기'}
              className="inline-flex lg:hidden items-center gap-1.5 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-2.5 py-1.5 text-xs font-medium text-[#496051] hover:bg-[#e8f0e6] hover:text-[#1b2b21] transition-colors shrink-0"
            >
              {isMobileSidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">좌측 메뉴</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('planner')}
              className="text-lg font-bold tracking-tight text-[#1b2b21] whitespace-nowrap shrink-0 hover:text-[#3b6e4c] transition-colors"
            >
              파인애플작업실
            </button>
          </div>

          <nav aria-label="주 메뉴" className="hidden md:flex items-center gap-6">
            {(
              [
                ['planner', '목표 · 캘린더'],
                ['builder', '캐릭터봇 제작 틀'],
                ['json', 'JSON 변환 · 프리셋'],
              ] as const
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={`border-b-2 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tabKey
                    ? 'border-[#3b6e4c] text-[#1b2b21] font-semibold'
                    : 'border-transparent text-[#496051] hover:text-[#1b2b21]'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden xl:inline-block max-w-[140px] truncate text-xs font-medium text-[#496051]">
              {userLabel}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="작업실 잠금 및 로그아웃"
              title="작업실 잠금 및 로그아웃"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-xs font-medium text-[#496051] hover:bg-[#e8f0e6] hover:text-[#1b2b21] transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
            <button
              type="button"
              onClick={handleCreateNewBot}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b6e4c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              새 캐릭터봇
            </button>
          </div>
        </div>

        {/* Mobile Navigation Strip (visible only below md) */}
        <nav
          aria-label="모바일 메뉴"
          className="flex md:hidden border-t border-[#ebf1ea] bg-[#f8fbf8] px-4"
        >
          {(
            [
              ['planner', '목표 · 캘린더', CalendarDays],
              ['builder', '제작 틀', FileText],
              ['json', 'JSON 변환', FileCode2],
            ] as const
          ).map(([tabKey, label, Icon]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs whitespace-nowrap ${
                activeTab === tabKey
                  ? 'border-[#3b6e4c] bg-white text-[#1b2b21] font-semibold'
                  : 'border-transparent text-[#496051] font-medium'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Workspace Container */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 gap-6 px-4 py-6 sm:px-6">
        {/* Desktop Sidebar: Quick Bot Switcher & Active Context */}
        {isSidebarOpen && (
          <aside
            id="workspace-sidebar"
            aria-label="좌측 빠른 작업 메뉴"
            className="hidden lg:flex w-64 shrink-0 flex-col"
          >
            <WorkspaceSidebar
              bots={bots}
              activeBotId={activeBot?.id}
              activeBotTitle={activeBot?.title}
              onSelectBot={(botId) => {
                selectBot(botId);
                if (activeTab === 'planner') {
                  setActiveTab('builder');
                }
              }}
              onOpenBuilder={() => setActiveTab('builder')}
              onOpenJson={() => setActiveTab('json')}
            />
          </aside>
        )}

        {/* Mobile / Tablet Slide-over Sidebar Drawer */}
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <button
              type="button"
              aria-label="좌측 메뉴 배경 닫기"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-[#1b2b21]/30 backdrop-blur-[1px]"
            />
            <aside
              id="mobile-workspace-sidebar"
              aria-label="좌측 빠른 작업 메뉴"
              className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto border-r border-[#d1dfd0] bg-[#f3f7f2] p-4 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-[#d1dfd0] pb-3">
                <span className="text-sm font-semibold text-[#1b2b21]">좌측 작업 메뉴</span>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  aria-label="좌측 메뉴 닫기"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#d1dfd0] bg-white px-2.5 py-1 text-xs font-medium text-[#496051] hover:text-[#1b2b21]"
                >
                  <X className="h-3.5 w-3.5" />
                  닫기
                </button>
              </div>
              <WorkspaceSidebar
                bots={bots}
                activeBotId={activeBot?.id}
                activeBotTitle={activeBot?.title}
                onSelectBot={(botId) => {
                  selectBot(botId);
                  if (activeTab === 'planner') {
                    setActiveTab('builder');
                  }
                  setIsMobileSidebarOpen(false);
                }}
                onOpenBuilder={() => {
                  setActiveTab('builder');
                  setIsMobileSidebarOpen(false);
                }}
                onOpenJson={() => {
                  setActiveTab('json');
                  setIsMobileSidebarOpen(false);
                }}
              />
            </aside>
          </div>
        )}

        {/* Main Viewport */}
        <main className="min-w-0 flex-1">
          {bannerNotice && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-[#b6cab4] bg-[#e2efe4] px-4 py-2.5 text-xs font-medium text-[#1b2b21]"
            >
              {bannerNotice}
            </div>
          )}

          {activeTab === 'planner' && activeBot && (
            <PlannerView
              bots={bots}
              activeBotId={activeBot.id}
              goals={goals}
              calendarEvents={calendarEvents}
              dailyPledge={dailyPledge}
              onUpdatePledge={handleUpdatePledge}
              onAddGoal={handleAddGoal}
              onToggleGoal={handleToggleGoal}
              onDeleteGoal={handleDeleteGoal}
              onAddCalendarEvent={handleAddCalendarEvent}
              onToggleCalendarEvent={handleToggleCalendarEvent}
              onDeleteCalendarEvent={handleDeleteCalendarEvent}
              onLoadBotToBuilder={(botId) => {
                selectBot(botId);
                setActiveTab('builder');
              }}
              onOpenBotJson={(botId) => {
                selectBot(botId);
                setActiveTab('json');
              }}
              onChangeBotStatus={handleChangeBotStatus}
              onUpdateBot={handleUpdateBot}
              onDuplicateBot={handleDuplicateBot}
              onDeleteBot={handleDeleteBot}
              onCreateNewBot={handleCreateNewBot}
            />
          )}

          {activeTab === 'builder' && activeBot && (
            <BotBuilderView
              bot={activeBot}
              onUpdateBot={handleUpdateBot}
              onSaveAsNewBot={handleSaveAsNewBot}
              onOpenLoadModal={() => setIsLoadModalOpen(true)}
              onGoToJsonConverter={() => setActiveTab('json')}
            />
          )}

          {activeTab === 'json' && activeBot && (
            <JsonConverterView
              bot={activeBot}
              presets={presets}
              onSavePreset={handleSavePreset}
              onApplyPreset={handleApplyPreset}
              onDeletePreset={handleDeletePreset}
              onBackToBuilder={() => setActiveTab('builder')}
            />
          )}
        </main>
      </div>

      <LoadTemplateModal
        isOpen={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        bots={bots}
        starterTemplates={STARTER_TEMPLATES}
        presets={presets}
        onLoadBotProject={handleLoadBotProjectStructure}
        onLoadStarterTemplate={handleLoadStarterTemplate}
        onApplyPreset={handleApplyPreset}
        onImportTemplateJson={handleImportTemplateJson}
      />
    </div>
  );
}
