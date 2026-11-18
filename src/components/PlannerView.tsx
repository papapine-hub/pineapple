import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  ImagePlus,
  Link2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { BotProject, BotStatus, CalendarEvent, GoalItem } from '../types/bot';
import {
  createBotLinkEntry,
  filterBotsByStatusAndQuery,
  normalizeCoverImageUrl,
} from '../utils/botRoster';

interface PlannerViewProps {
  bots: BotProject[];
  activeBotId: string;
  goals: GoalItem[];
  calendarEvents: CalendarEvent[];
  dailyPledge: string;
  onUpdatePledge: (pledge: string) => void;
  onAddGoal: (goal: Omit<GoalItem, 'id'>) => void;
  onToggleGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onAddCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onToggleCalendarEvent: (id: string) => void;
  onDeleteCalendarEvent: (id: string) => void;
  onLoadBotToBuilder: (botId: string) => void;
  onOpenBotJson: (botId: string) => void;
  onChangeBotStatus: (botId: string, nextStatus: BotStatus) => void;
  onUpdateBot: (updated: BotProject) => void;
  onDuplicateBot: (botId: string) => void;
  onDeleteBot: (botId: string) => void;
  onCreateNewBot: () => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const PLATFORM_PRESETS = ['크랙 (Crack)', '캐릭터.ai', '뤼튼 (Wrtn)', '바베큐', '포스타입', '직접 입력'];

function formatDateKey(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('올바른 이미지 형식이 아닙니다.'));
      img.onload = () => {
        const maxSide = 480;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result ?? ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = String(reader.result ?? '');
    };
    reader.readAsDataURL(file);
  });
}

type RosterAttachmentTab = 'cover' | 'external' | 'published';

export const PlannerView: React.FC<PlannerViewProps> = ({
  bots,
  activeBotId,
  goals,
  calendarEvents,
  dailyPledge,
  onUpdatePledge,
  onAddGoal,
  onToggleGoal,
  onDeleteGoal,
  onAddCalendarEvent,
  onToggleCalendarEvent,
  onDeleteCalendarEvent,
  onLoadBotToBuilder,
  onOpenBotJson,
  onChangeBotStatus,
  onUpdateBot,
  onDuplicateBot,
  onDeleteBot,
  onCreateNewBot,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const initialDate = useMemo(() => new Date(todayStr + 'T00:00:00'), [todayStr]);

  const [calYear, setCalYear] = useState(initialDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Pledge editing
  const [isEditingPledge, setIsEditingPledge] = useState(false);
  const [pledgeDraft, setPledgeDraft] = useState(dailyPledge);

  // New calendar event form
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventBot, setNewEventBot] = useState('');

  // Goal form & filter
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDate, setGoalDate] = useState(todayStr);
  const [goalCategory, setGoalCategory] = useState('월간 목표');
  const [goalFilter, setGoalFilter] = useState<'all' | 'active' | 'done'>('all');

  // Bot roster filter & search
  const [botFilter, setBotFilter] = useState<'all' | BotStatus>('all');
  const [botSearch, setBotSearch] = useState('');

  // Inline attachment panel state per bot row
  const [activeAttachment, setActiveAttachment] = useState<{
    botId: string;
    tab: RosterAttachmentTab;
  } | null>(null);
  const [coverUrlDraft, setCoverUrlDraft] = useState('');
  const [coverError, setCoverError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [extLabelDraft, setExtLabelDraft] = useState('');
  const [extUrlDraft, setExtUrlDraft] = useState('');
  const [extError, setExtError] = useState<string | null>(null);
  const [pubPlatformSelect, setPubPlatformSelect] = useState(PLATFORM_PRESETS[0]);
  const [pubCustomLabelDraft, setPubCustomLabelDraft] = useState('');
  const [pubUrlDraft, setPubUrlDraft] = useState('');
  const [pubError, setPubError] = useState<string | null>(null);

  const inProgressCount = bots.filter((b) => b.status === 'in_progress').length;
  const completedBotsCount = bots.filter((b) => b.status === 'completed').length;
  const publishedBotsCount = bots.filter((b) => b.status === 'published').length;
  const completedGoalsCount = goals.filter((g) => g.completed).length;

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateStr: string | null }> = [];
    for (let i = 0; i < firstDayOfWeek; i += 1) {
      cells.push({ day: null, dateStr: null });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push({ day: d, dateStr: formatDateKey(calYear, calMonth, d) });
    }
    return cells;
  }, [calYear, calMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of calendarEvents) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [calendarEvents]);

  const selectedDateEvents = eventsByDate.get(selectedDate) ?? [];

  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      if (goalFilter === 'active') return !g.completed;
      if (goalFilter === 'done') return g.completed;
      return true;
    });
  }, [goals, goalFilter]);

  const filteredBots = useMemo(
    () => filterBotsByStatusAndQuery(bots, botFilter, botSearch),
    [bots, botFilter, botSearch],
  );

  const toggleAttachmentTab = (botId: string, tab: RosterAttachmentTab) => {
    setCoverError(null);
    setExtError(null);
    setPubError(null);
    setActiveAttachment((prev) => {
      if (prev && prev.botId === botId && prev.tab === tab) {
        return null;
      }
      return { botId, tab };
    });
  };

  const handleCoverFileChange = async (
    bot: BotProject,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setFailedImages((prev) => ({ ...prev, [bot.id]: false }));
      onUpdateBot({
        ...bot,
        coverImage: dataUrl,
        updatedAt: todayStr,
      });
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveCoverUrl = (bot: BotProject, e: React.FormEvent) => {
    e.preventDefault();
    setCoverError(null);
    const safeUrl = normalizeCoverImageUrl(coverUrlDraft);
    if (!safeUrl) {
      setCoverError('올바른 이미지 URL(https://...)을 입력해 주세요.');
      return;
    }
    setFailedImages((prev) => ({ ...prev, [bot.id]: false }));
    onUpdateBot({
      ...bot,
      coverImage: safeUrl,
      updatedAt: todayStr,
    });
    setCoverUrlDraft('');
  };

  const handleRemoveCover = (bot: BotProject) => {
    onUpdateBot({
      ...bot,
      coverImage: undefined,
      updatedAt: todayStr,
    });
  };

  const handleAddExternalLink = (bot: BotProject, e: React.FormEvent) => {
    e.preventDefault();
    setExtError(null);
    const entry = createBotLinkEntry(extLabelDraft, extUrlDraft);
    if (!entry) {
      setExtError('올바른 외부 사이트 주소(예: https://...)를 입력해 주세요.');
      return;
    }
    onUpdateBot({
      ...bot,
      externalLinks: [...(bot.externalLinks ?? []), entry],
      updatedAt: todayStr,
    });
    setExtLabelDraft('');
    setExtUrlDraft('');
  };

  const handleRemoveExternalLink = (bot: BotProject, linkId: string) => {
    onUpdateBot({
      ...bot,
      externalLinks: (bot.externalLinks ?? []).filter((l) => l.id !== linkId),
      updatedAt: todayStr,
    });
  };

  const handleAddPublishedLink = (bot: BotProject, e: React.FormEvent) => {
    e.preventDefault();
    setPubError(null);
    const chosenLabel =
      pubPlatformSelect === '직접 입력' ? pubCustomLabelDraft : pubPlatformSelect;
    const entry = createBotLinkEntry(chosenLabel, pubUrlDraft);
    if (!entry) {
      setPubError('올바른 게시 플랫폼 주소(예: https://...)를 입력해 주세요.');
      return;
    }
    onUpdateBot({
      ...bot,
      publishedLinks: [...(bot.publishedLinks ?? []), entry],
      updatedAt: todayStr,
    });
    setPubCustomLabelDraft('');
    setPubUrlDraft('');
  };

  const handleRemovePublishedLink = (bot: BotProject, linkId: string) => {
    onUpdateBot({
      ...bot,
      publishedLinks: (bot.publishedLinks ?? []).filter((l) => l.id !== linkId),
      updatedAt: todayStr,
    });
  };

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    setCalYear(initialDate.getFullYear());
    setCalMonth(initialDate.getMonth());
    setSelectedDate(todayStr);
  };

  const handleSavePledge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pledgeDraft.trim()) return;
    onUpdatePledge(pledgeDraft.trim());
    setIsEditingPledge(false);
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    onAddGoal({
      title: goalTitle.trim(),
      targetDate: goalDate || todayStr,
      category: goalCategory.trim() || '일반 목표',
      completed: false,
    });
    setGoalTitle('');
  };

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    onAddCalendarEvent({
      date: selectedDate,
      title: newEventTitle.trim(),
      botTitle: newEventBot || undefined,
      completed: false,
    });
    setNewEventTitle('');
    setNewEventBot('');
  };

  return (
    <div className="space-y-8">
      {/* Top Creative Pledge & Quiet Overview Strip */}
      <section className="rounded-xl border border-[#d1dfd0] bg-[#e8f0e6] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-[#1b2b21] text-balance">
                오늘의 제작 다짐
              </h1>
              {!isEditingPledge && (
                <button
                  type="button"
                  onClick={() => {
                    setPledgeDraft(dailyPledge);
                    setIsEditingPledge(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-[#3b6e4c] hover:bg-[#dce8d9] transition-colors whitespace-nowrap shrink-0"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  다짐 수정
                </button>
              )}
            </div>

            {isEditingPledge ? (
              <form onSubmit={handleSavePledge} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label htmlFor="daily-pledge-input" className="sr-only">
                  오늘의 제작 다짐 입력
                </label>
                <input
                  id="daily-pledge-input"
                  type="text"
                  value={pledgeDraft}
                  onChange={(e) => setPledgeDraft(e.target.value)}
                  className="w-full rounded-lg border border-[#b6cab4] bg-white px-3.5 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:outline-none"
                  placeholder="나만의 캐릭터봇 제작 다짐을 적어보세요"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="submit"
                    className="rounded-lg bg-[#3b6e4c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingPledge(false)}
                    className="rounded-lg border border-[#b6cab4] bg-white px-3 py-2 text-xs font-medium text-[#496051] hover:bg-[#f3f7f2] transition-colors whitespace-nowrap"
                  >
                    취소
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm leading-relaxed text-[#354c3d] max-w-3xl">{dailyPledge}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5 border-t border-[#d1dfd0] pt-4 sm:grid-cols-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 shrink-0">
            <div>
              <div className="text-xs font-medium text-[#496051]">제작중</div>
              <div className="mt-1 text-2xl font-bold text-[#1b2b21] tabular-nums">
                {inProgressCount}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-[#496051]">제작완료</div>
              <div className="mt-1 text-2xl font-bold text-[#2e6f40] tabular-nums">
                {completedBotsCount}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-[#496051]">게시완료</div>
              <div className="mt-1 text-2xl font-bold text-[#3b6e4c] tabular-nums">
                {publishedBotsCount}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-[#496051]">목표 달성</div>
              <div className="mt-1 text-2xl font-bold text-[#1b2b21] tabular-nums">
                {completedGoalsCount} / {goals.length}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calendar + Goals Split Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Monthly Calendar & Selected Date Log */}
        <section className="xl:col-span-5 rounded-xl border border-[#d1dfd0] bg-white p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#e5ede4]">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarIcon className="h-4 w-4 text-[#3b6e4c] shrink-0" />
                <h2 className="text-sm sm:text-base font-semibold text-[#1b2b21] tabular-nums whitespace-nowrap">
                  {calYear}년 {calMonth + 1}월 제작 캘린더
                </h2>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="이전 달"
                  className="rounded-md p-1.5 text-[#496051] hover:bg-[#e8f0e6] transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleJumpToday}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-[#3b6e4c] hover:bg-[#e8f0e6] transition-colors whitespace-nowrap"
                >
                  오늘
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="다음 달"
                  className="rounded-md p-1.5 text-[#496051] hover:bg-[#e8f0e6] transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Weekday Header */}
            <div className="mt-4 grid grid-cols-7 text-center text-xs font-medium text-[#687e6f]">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="py-1.5">
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-1 mt-1">
              {calendarDays.map((cell, idx) => {
                if (!cell.day || !cell.dateStr) {
                  return <div key={`empty_${idx}`} className="h-10" />;
                }
                const dayEvents = eventsByDate.get(cell.dateStr) ?? [];
                const isSelected = cell.dateStr === selectedDate;
                const isToday = cell.dateStr === todayStr;
                const hasPending = dayEvents.some((ev) => !ev.completed);
                const allDone = dayEvents.length > 0 && !hasPending;

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateStr!)}
                    aria-label={`${cell.dateStr} 일정 ${dayEvents.length}건`}
                    className={`relative flex h-10 flex-col items-center justify-center rounded-lg text-sm tabular-nums transition-colors ${
                      isSelected
                        ? 'bg-[#3b6e4c] font-semibold text-white'
                        : isToday
                          ? 'bg-[#e2efe4] font-semibold text-[#1b2b21]'
                          : 'text-[#1b2b21] hover:bg-[#f3f7f2]'
                    }`}
                  >
                    <span>{cell.day}</span>
                    {dayEvents.length > 0 && (
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 h-1 w-4 rounded-sm ${
                          isSelected
                            ? 'bg-white/80'
                            : allDone
                              ? 'bg-[#6fa47e]'
                              : 'bg-[#3b6e4c]'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Schedule */}
          <div className="mt-6 border-t border-[#e5ede4] pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1b2b21] tabular-nums">
                {selectedDate} 작업 일정
              </h3>
              <span className="text-xs text-[#687e6f] tabular-nums">
                {selectedDateEvents.length}건
              </span>
            </div>

            {selectedDateEvents.length === 0 ? (
              <p className="py-3 text-xs text-[#687e6f]">
                선택한 날짜에 등록된 제작 일정이 없습니다. 아래에서 일정을 추가해 보세요.
              </p>
            ) : (
              <ul className="space-y-2 mb-4 max-h-44 overflow-y-auto pr-1">
                {selectedDateEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-start justify-between gap-2 rounded-lg bg-[#f3f7f2] px-3 py-2 text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleCalendarEvent(ev.id)}
                      className="flex items-start gap-2.5 text-left min-w-0 flex-1"
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          ev.completed
                            ? 'border-[#3b6e4c] bg-[#3b6e4c] text-white'
                            : 'border-[#9fb59e] bg-white'
                        }`}
                      >
                        {ev.completed && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-xs font-medium ${
                            ev.completed ? 'line-through text-[#687e6f]' : 'text-[#1b2b21]'
                          }`}
                        >
                          {ev.title}
                        </span>
                        {ev.botTitle && (
                          <span className="block text-[11px] text-[#496051] mt-0.5">
                            연결 봇 · {ev.botTitle}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCalendarEvent(ev.id)}
                      aria-label={`일정 '${ev.title}' 삭제`}
                      className="rounded p-1 text-[#687e6f] hover:text-[#b43c3c] transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleEventSubmit} className="space-y-2 mt-3">
              <div className="flex gap-2">
                <label htmlFor="calendar-event-title" className="sr-only">
                  새 일정 제목
                </label>
                <input
                  id="calendar-event-title"
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="예: 캐릭터 말투 예시 3개 작성"
                  className="min-w-0 flex-1 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#3b6e4c] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  일정 추가
                </button>
              </div>
              <label htmlFor="calendar-event-bot" className="sr-only">
                연결할 캐릭터봇 선택
              </label>
              <select
                id="calendar-event-bot"
                value={newEventBot}
                onChange={(e) => setNewEventBot(e.target.value)}
                className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-1.5 text-xs text-[#496051] focus:border-[#3b6e4c] focus:outline-none"
              >
                <option value="">연결할 캐릭터봇 선택 (선택사항)</option>
                {bots.map((b) => (
                  <option key={b.id} value={b.title}>
                    {b.title}
                  </option>
                ))}
              </select>
            </form>
          </div>
        </section>

        {/* Right: Goal Tracker */}
        <section className="xl:col-span-7 rounded-xl border border-[#d1dfd0] bg-white p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#e5ede4]">
              <div>
                <h2 className="text-base font-semibold text-[#1b2b21]">제작 목표 리스트</h2>
                <p className="text-xs text-[#687e6f] mt-0.5">
                  완료하고 싶은 캐릭터봇과 문체 다듬기 목표를 차분히 관리하세요.
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-[#f3f7f2] p-1 self-start sm:self-auto">
                {(
                  [
                    ['all', '전체'],
                    ['active', '진행중'],
                    ['done', '완료'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setGoalFilter(key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      goalFilter === key
                        ? 'bg-white text-[#1b2b21] shadow-xs'
                        : 'text-[#496051] hover:text-[#1b2b21]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredGoals.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[#496051]">표시할 제작 목표가 없습니다.</p>
                <p className="mt-1 text-xs text-[#687e6f]">
                  아래 입력란에서 새로운 캐릭터봇 제작 목표를 추가해 보세요.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#ebf1ea] mt-2">
                {filteredGoals.map((goal) => (
                  <li key={goal.id} className="flex items-center justify-between gap-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => onToggleGoal(goal.id)}
                      className="flex items-start gap-3 text-left min-w-0 flex-1 group"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          goal.completed
                            ? 'border-[#3b6e4c] bg-[#3b6e4c] text-white'
                            : 'border-[#9fb59e] bg-white group-hover:border-[#3b6e4c]'
                        }`}
                      >
                        {goal.completed && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm font-medium ${
                            goal.completed ? 'line-through text-[#687e6f]' : 'text-[#1b2b21]'
                          }`}
                        >
                          {goal.title}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-xs text-[#687e6f]">
                          <span>{goal.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">목표일 {goal.targetDate}</span>
                          <span aria-hidden="true">·</span>
                          <span>{goal.completed ? '달성 완료' : '진행중'}</span>
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteGoal(goal.id)}
                      aria-label={`목표 '${goal.title}' 삭제`}
                      className="rounded-md p-1.5 text-[#687e6f] hover:bg-[#fbebeb] hover:text-[#b43c3c] transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add Goal Form */}
          <form onSubmit={handleGoalSubmit} className="mt-6 border-t border-[#e5ede4] pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <label htmlFor="new-goal-title" className="sr-only">
                  새 목표 내용
                </label>
                <input
                  id="new-goal-title"
                  type="text"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="새로운 제작 목표 입력 (예: 호불호 항목 보완)"
                  className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-xs sm:text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="sm:w-28 shrink-0">
                <label htmlFor="new-goal-category" className="sr-only">
                  목표 분류
                </label>
                <input
                  id="new-goal-category"
                  type="text"
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value)}
                  placeholder="분류"
                  className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-2.5 py-2 text-xs sm:text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="sm:w-36 shrink-0">
                <label htmlFor="new-goal-date" className="sr-only">
                  목표 날짜
                </label>
                <input
                  id="new-goal-date"
                  type="date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-2.5 py-2 text-xs sm:text-sm text-[#1b2b21] tabular-nums focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#3b6e4c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                목표 추가하기
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Character Bot Roster: In Progress, Completed & Published */}
      <section className="rounded-xl border border-[#d1dfd0] bg-white p-6">
        <div className="flex flex-col gap-4 border-b border-[#e5ede4] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1b2b21]">
              제작중 / 제작완료 / 게시완료 캐릭터봇 목록
            </h2>
            <p className="text-xs text-[#687e6f] mt-0.5">
              표지 사진 첨부, 제작완료 외부 사이트 링크 및 게시완료 플랫폼 링크를 캐릭터봇별로 관리하세요.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#687e6f]" />
              <label htmlFor="bot-roster-search" className="sr-only">
                캐릭터봇 검색
              </label>
              <input
                id="bot-roster-search"
                type="text"
                value={botSearch}
                onChange={(e) => setBotSearch(e.target.value)}
                placeholder="봇 이름, 장르 검색"
                className="w-44 sm:w-48 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] py-1.5 pl-8 pr-3 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
              />
            </div>

            <div
              role="tablist"
              aria-label="캐릭터봇 제작 상태 필터"
              className="flex flex-wrap items-center gap-1 rounded-lg bg-[#f3f7f2] p-1"
            >
              {(
                [
                  ['all', `전체 (${bots.length})`],
                  ['in_progress', `제작중 (${inProgressCount})`],
                  ['completed', `제작완료 (${completedBotsCount})`],
                  ['published', `게시완료 (${publishedBotsCount})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={botFilter === key}
                  onClick={() => setBotFilter(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium tabular-nums transition-colors whitespace-nowrap ${
                    botFilter === key
                      ? 'bg-white text-[#1b2b21] shadow-xs'
                      : 'text-[#496051] hover:text-[#1b2b21]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredBots.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-[#496051]">조건에 맞는 캐릭터봇이 없습니다.</p>
            <button
              type="button"
              onClick={onCreateNewBot}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b6e4c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              새 캐릭터봇 만들기
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#ebf1ea]">
            {filteredBots.map((bot) => {
              const isActive = bot.id === activeBotId;
              const externalLinks = bot.externalLinks ?? [];
              const publishedLinks = bot.publishedLinks ?? [];
              const isAttachmentOpen = activeAttachment?.botId === bot.id;
              const currentAttachmentTab = activeAttachment?.tab;
              const hasValidCover = Boolean(bot.coverImage) && !failedImages[bot.id];

              return (
                <div
                  key={bot.id}
                  className={`py-4 ${isActive ? 'bg-[#f6faf5] -mx-3 px-3 rounded-lg' : ''}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Left: Cover Thumbnail + Title + Cover Tab + Metadata + Links */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      {/* Cover Photo Thumbnail */}
                      <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-[#d1dfd0] bg-[#f3f7f2] flex items-center justify-center">
                        {hasValidCover ? (
                          <img
                            src={bot.coverImage}
                            alt={`${bot.title} 표지 사진`}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedImages((prev) => ({ ...prev, [bot.id]: true }))
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-[#8ba18e]" aria-hidden="true" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-[#1b2b21]">{bot.title}</h3>
                          <button
                            type="button"
                            onClick={() => toggleAttachmentTab(bot.id, 'cover')}
                            aria-expanded={isAttachmentOpen && currentAttachmentTab === 'cover'}
                            aria-label={`'${bot.title}' 표지 사진 첨부`}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                              isAttachmentOpen && currentAttachmentTab === 'cover'
                                ? 'border-[#3b6e4c] bg-[#e2efe4] text-[#1b2b21]'
                                : 'border-[#d1dfd0] bg-white text-[#496051] hover:bg-[#f3f7f2]'
                            }`}
                          >
                            <ImagePlus className="h-3 w-3 text-[#3b6e4c]" />
                            {bot.coverImage ? '표지 변경' : '표지 첨부'}
                          </button>

                          {bot.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => toggleAttachmentTab(bot.id, 'external')}
                              aria-expanded={
                                isAttachmentOpen && currentAttachmentTab === 'external'
                              }
                              aria-label={`'${bot.title}' 외부 사이트 링크 첨부`}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                                isAttachmentOpen && currentAttachmentTab === 'external'
                                  ? 'border-[#3b6e4c] bg-[#e2efe4] text-[#1b2b21]'
                                  : 'border-[#d1dfd0] bg-white text-[#496051] hover:bg-[#f3f7f2]'
                              }`}
                            >
                              <Link2 className="h-3 w-3 text-[#3b6e4c]" />
                              외부 링크 ({externalLinks.length})
                            </button>
                          )}

                          {bot.status === 'published' && (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleAttachmentTab(bot.id, 'published')}
                                aria-expanded={
                                  isAttachmentOpen && currentAttachmentTab === 'published'
                                }
                                aria-label={`'${bot.title}' 게시 플랫폼 링크 첨부`}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                                  isAttachmentOpen && currentAttachmentTab === 'published'
                                    ? 'border-[#3b6e4c] bg-[#e2efe4] text-[#1b2b21]'
                                    : 'border-[#d1dfd0] bg-white text-[#496051] hover:bg-[#f3f7f2]'
                                }`}
                              >
                                <Globe className="h-3 w-3 text-[#3b6e4c]" />
                                플랫폼 링크 ({publishedLinks.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleAttachmentTab(bot.id, 'external')}
                                aria-expanded={
                                  isAttachmentOpen && currentAttachmentTab === 'external'
                                }
                                aria-label={`'${bot.title}' 외부 사이트 링크 첨부`}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                                  isAttachmentOpen && currentAttachmentTab === 'external'
                                    ? 'border-[#3b6e4c] bg-[#e2efe4] text-[#1b2b21]'
                                    : 'border-[#d1dfd0] bg-white text-[#496051] hover:bg-[#f3f7f2]'
                                }`}
                              >
                                <Link2 className="h-3 w-3 text-[#3b6e4c]" />
                                외부 링크 ({externalLinks.length})
                              </button>
                            </>
                          )}

                          {isActive && (
                            <span className="text-xs font-medium text-[#3b6e4c]">· 현재 작업중</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#687e6f]">
                          <span>{bot.subtitle || '장르 미입력'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">최근 수정 {bot.updatedAt}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            등장인물 {bot.template.characters.length}명
                          </span>
                        </div>

                        {bot.notes && (
                          <p className="text-xs text-[#496051] line-clamp-1">{bot.notes}</p>
                        )}

                        {/* Visible External & Published Links Summary */}
                        {(externalLinks.length > 0 || publishedLinks.length > 0) && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs">
                            {publishedLinks.map((link) => (
                              <a
                                key={link.id}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-[#2d573b] underline decoration-[#b6cab4] underline-offset-2 hover:text-[#1b2b21]"
                              >
                                <Globe className="h-3 w-3 shrink-0" />
                                <span>게시: {link.label}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                              </a>
                            ))}
                            {externalLinks.map((link) => (
                              <a
                                key={link.id}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#496051] underline decoration-[#d1dfd0] underline-offset-2 hover:text-[#1b2b21]"
                              >
                                <Link2 className="h-3 w-3 shrink-0" />
                                <span>외부: {link.label}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Status Select + Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <label htmlFor={`bot-status-${bot.id}`} className="sr-only">
                        {bot.title} 제작 상태
                      </label>
                      <select
                        id={`bot-status-${bot.id}`}
                        value={bot.status}
                        onChange={(e) => onChangeBotStatus(bot.id, e.target.value as BotStatus)}
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none ${
                          bot.status === 'published'
                            ? 'border-[#9ec4a7] bg-[#d8ecd9] text-[#1f5132]'
                            : bot.status === 'completed'
                              ? 'border-[#b9d6be] bg-[#e3f1e6] text-[#2e6f40]'
                              : 'border-[#e6d5b2] bg-[#fbf3e2] text-[#8a611c]'
                        }`}
                      >
                        <option value="in_progress">제작중</option>
                        <option value="completed">제작완료</option>
                        <option value="published">게시완료</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => onLoadBotToBuilder(bot.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b6e4c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        불러오기
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenBotJson(bot.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1dfd0] bg-white px-3 py-1.5 text-xs font-medium text-[#1b2b21] hover:bg-[#f3f7f2] transition-colors whitespace-nowrap"
                      >
                        <FileCode2 className="h-3.5 w-3.5 text-[#3b6e4c]" />
                        JSON 변환
                      </button>

                      <button
                        type="button"
                        onClick={() => onDuplicateBot(bot.id)}
                        aria-label={`'${bot.title}' 복제`}
                        className="rounded-lg border border-[#d1dfd0] bg-white p-1.5 text-[#496051] hover:bg-[#f3f7f2] transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteBot(bot.id)}
                        aria-label={`'${bot.title}' 삭제`}
                        disabled={bots.length <= 1}
                        className="rounded-lg border border-[#d1dfd0] bg-white p-1.5 text-[#687e6f] hover:border-[#e6baba] hover:bg-[#fbebeb] hover:text-[#b43c3c] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Attachment Panel (Cover Photo / External Links / Published Platform Links) */}
                  {isAttachmentOpen && currentAttachmentTab && (
                    <div className="mt-3 border-t border-[#e5ede4] pt-3 pl-0 sm:pl-15 space-y-3">
                      {/* Sub-tabs inside panel */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setActiveAttachment({ botId: bot.id, tab: 'cover' })}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                              currentAttachmentTab === 'cover'
                                ? 'bg-[#3b6e4c] text-white'
                                : 'bg-[#f3f7f2] text-[#496051] hover:text-[#1b2b21]'
                            }`}
                          >
                            표지 사진
                          </button>
                          {(bot.status === 'completed' || bot.status === 'published') && (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveAttachment({ botId: bot.id, tab: 'external' })
                              }
                              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                currentAttachmentTab === 'external'
                                  ? 'bg-[#3b6e4c] text-white'
                                  : 'bg-[#f3f7f2] text-[#496051] hover:text-[#1b2b21]'
                              }`}
                            >
                              외부 사이트 링크
                            </button>
                          )}
                          {bot.status === 'published' && (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveAttachment({ botId: bot.id, tab: 'published' })
                              }
                              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                currentAttachmentTab === 'published'
                                  ? 'bg-[#3b6e4c] text-white'
                                  : 'bg-[#f3f7f2] text-[#496051] hover:text-[#1b2b21]'
                              }`}
                            >
                              게시 플랫폼 링크
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveAttachment(null)}
                          aria-label="첨부 패널 닫기"
                          className="rounded p-1 text-[#687e6f] hover:text-[#1b2b21]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Cover Photo Panel */}
                      {currentAttachmentTab === 'cover' && (
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#b6cab4] bg-[#f3f7f2] px-3 py-1.5 text-xs font-medium text-[#1b2b21] hover:bg-[#e2efe4] transition-colors">
                              <Upload className="h-3.5 w-3.5 text-[#3b6e4c]" />
                              표지 이미지 파일 업로드
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleCoverFileChange(bot, e)}
                                className="sr-only"
                              />
                            </label>
                            {bot.coverImage && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCover(bot)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#e6baba] bg-[#fbebeb] px-3 py-1.5 text-xs font-medium text-[#b43c3c] hover:bg-[#f7dada] transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                표지 삭제
                              </button>
                            )}
                          </div>

                          <form
                            onSubmit={(e) => handleSaveCoverUrl(bot, e)}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center"
                          >
                            <label htmlFor={`cover-url-${bot.id}`} className="sr-only">
                              표지 이미지 URL
                            </label>
                            <input
                              id={`cover-url-${bot.id}`}
                              type="text"
                              value={coverUrlDraft}
                              onChange={(e) => setCoverUrlDraft(e.target.value)}
                              placeholder="또는 표지 이미지 URL 붙여넣기 (https://...)"
                              className="min-w-0 flex-1 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-1.5 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-[#3b6e4c] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap shrink-0"
                            >
                              URL 적용
                            </button>
                          </form>
                          {coverError && <p className="text-xs text-[#b43c3c]">{coverError}</p>}
                        </div>
                      )}

                      {/* External Site Links Panel (제작완료 / 게시완료) */}
                      {currentAttachmentTab === 'external' && (
                        <div className="space-y-2.5">
                          {externalLinks.length > 0 && (
                            <ul className="space-y-1.5">
                              {externalLinks.map((link) => (
                                <li
                                  key={link.id}
                                  className="flex items-center justify-between gap-2 rounded-lg bg-[#f8fbf8] px-3 py-1.5 text-xs"
                                >
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 font-medium text-[#2d573b] hover:underline truncate"
                                  >
                                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{link.label}</span>
                                    <span className="text-[#687e6f] truncate">({link.url})</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExternalLink(bot, link.id)}
                                    aria-label={`외부 링크 '${link.label}' 삭제`}
                                    className="rounded p-1 text-[#687e6f] hover:text-[#b43c3c] shrink-0"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}

                          <form
                            onSubmit={(e) => handleAddExternalLink(bot, e)}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center"
                          >
                            <label htmlFor={`ext-label-${bot.id}`} className="sr-only">
                              외부 사이트 이름
                            </label>
                            <input
                              id={`ext-label-${bot.id}`}
                              type="text"
                              value={extLabelDraft}
                              onChange={(e) => setExtLabelDraft(e.target.value)}
                              placeholder="사이트 설명 (예: 설정 백업 노트)"
                              className="sm:w-48 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-1.5 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                            />
                            <label htmlFor={`ext-url-${bot.id}`} className="sr-only">
                              외부 사이트 URL
                            </label>
                            <input
                              id={`ext-url-${bot.id}`}
                              type="text"
                              value={extUrlDraft}
                              onChange={(e) => setExtUrlDraft(e.target.value)}
                              placeholder="외부 사이트 URL (https://...)"
                              className="min-w-0 flex-1 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-1.5 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#3b6e4c] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap shrink-0"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              외부 링크 추가
                            </button>
                          </form>
                          {extError && <p className="text-xs text-[#b43c3c]">{extError}</p>}
                        </div>
                      )}

                      {/* Published Platform Links Panel (게시완료) */}
                      {currentAttachmentTab === 'published' && (
                        <div className="space-y-2.5">
                          {publishedLinks.length > 0 && (
                            <ul className="space-y-1.5">
                              {publishedLinks.map((link) => (
                                <li
                                  key={link.id}
                                  className="flex items-center justify-between gap-2 rounded-lg bg-[#f3f7f2] px-3 py-1.5 text-xs"
                                >
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 font-medium text-[#1f5132] hover:underline truncate"
                                  >
                                    <Globe className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{link.label}</span>
                                    <span className="text-[#496051] truncate">({link.url})</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePublishedLink(bot, link.id)}
                                    aria-label={`게시 플랫폼 링크 '${link.label}' 삭제`}
                                    className="rounded p-1 text-[#687e6f] hover:text-[#b43c3c] shrink-0"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}

                          <form
                            onSubmit={(e) => handleAddPublishedLink(bot, e)}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center"
                          >
                            <label htmlFor={`pub-platform-${bot.id}`} className="sr-only">
                              게시 플랫폼 선택
                            </label>
                            <select
                              id={`pub-platform-${bot.id}`}
                              value={pubPlatformSelect}
                              onChange={(e) => setPubPlatformSelect(e.target.value)}
                              className="sm:w-36 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-2.5 py-1.5 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                            >
                              {PLATFORM_PRESETS.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                            {pubPlatformSelect === '직접 입력' && (
                              <>
                                <label htmlFor={`pub-custom-label-${bot.id}`} className="sr-only">
                                  직접 입력 플랫폼명
                                </label>
                                <input
                                  id={`pub-custom-label-${bot.id}`}
                                  type="text"
                                  value={pubCustomLabelDraft}
                                  onChange={(e) => setPubCustomLabelDraft(e.target.value)}
                                  placeholder="플랫폼명 입력"
                                  className="sm:w-32 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-1.5 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                                />
                              </>
                            )}
                            <label htmlFor={`pub-url-${bot.id}`} className="sr-only">
                              게시된 플랫폼 URL
                            </label>
                            <input
                              id={`pub-url-${bot.id}`}
                              type="text"
                              value={pubUrlDraft}
                              onChange={(e) => setPubUrlDraft(e.target.value)}
                              placeholder="게시된 캐릭터봇 페이지 URL (https://...)"
                              className="min-w-0 flex-1 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-1.5 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#3b6e4c] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap shrink-0"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              플랫폼 링크 추가
                            </button>
                          </form>
                          {pubError && <p className="text-xs text-[#b43c3c]">{pubError}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
