import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CopyPlus,
  FileCode2,
  FolderOpen,
  Lock,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type {
  BotProject,
  BotTemplate,
  CharacterEntry,
  CustomSection,
  StandardSectionKey,
} from '../types/bot';
import {
  DEFAULT_SECTION_ORDER,
  FIXED_CHARACTER_RULE,
  FIXED_FEW_SHOT_INSTRUCTION,
  FIXED_SUBSTITUTION_RULE,
  STANDARD_SECTION_LABELS,
  createEmptyCharacter,
  createEmptyPlace,
  createId,
} from '../utils/promptBuilder';

interface BotBuilderViewProps {
  bot: BotProject;
  onUpdateBot: (updated: BotProject) => void;
  onSaveAsNewBot: (sourceBot: BotProject) => void;
  onOpenLoadModal: () => void;
  onGoToJsonConverter: () => void;
}

export const BotBuilderView: React.FC<BotBuilderViewProps> = ({
  bot,
  onUpdateBot,
  onSaveAsNewBot,
  onOpenLoadModal,
  onGoToJsonConverter,
}) => {
  const [savedNotice, setSavedNotice] = useState(false);
  const [newCustomSectionTitle, setNewCustomSectionTitle] = useState('');
  const [newCustomSectionMode, setNewCustomSectionMode] = useState<'text' | 'fields'>('text');
  const [showAddCustomForm, setShowAddCustomForm] = useState(false);

  const tpl = bot.template;

  const updateTemplate = (updater: (prev: BotTemplate) => BotTemplate) => {
    const nextTemplate = updater(tpl);
    onUpdateBot({
      ...bot,
      updatedAt: new Date().toISOString().slice(0, 10),
      template: nextTemplate,
    });
  };

  const handleManualSaveFeedback = () => {
    onUpdateBot({
      ...bot,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleMoveSection = (sectionKey: string, direction: -1 | 1) => {
    const activeKeys = tpl.sectionOrder.filter((k) => {
      if (k.startsWith('custom:')) {
        const cid = k.slice('custom:'.length);
        return tpl.customSections.some((c) => c.id === cid && c.enabled);
      }
      return tpl.enabledSections[k as StandardSectionKey];
    });
    const idx = activeKeys.indexOf(sectionKey);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= activeKeys.length) return;

    const fullOrder = [...tpl.sectionOrder];
    const a = fullOrder.indexOf(activeKeys[idx]);
    const b = fullOrder.indexOf(activeKeys[targetIdx]);
    if (a === -1 || b === -1) return;
    [fullOrder[a], fullOrder[b]] = [fullOrder[b], fullOrder[a]];

    updateTemplate((prev) => ({
      ...prev,
      sectionOrder: fullOrder,
    }));
  };

  const handleRemoveSection = (sectionKey: string) => {
    if (sectionKey.startsWith('custom:')) {
      const cid = sectionKey.slice('custom:'.length);
      updateTemplate((prev) => ({
        ...prev,
        customSections: prev.customSections.filter((c) => c.id !== cid),
        sectionOrder: prev.sectionOrder.filter((k) => k !== sectionKey),
      }));
      return;
    }

    updateTemplate((prev) => ({
      ...prev,
      enabledSections: {
        ...prev.enabledSections,
        [sectionKey]: false,
      },
    }));
  };

  const handleRestoreStandardSection = (stdKey: StandardSectionKey) => {
    updateTemplate((prev) => ({
      ...prev,
      enabledSections: {
        ...prev.enabledSections,
        [stdKey]: true,
      },
      sectionOrder: prev.sectionOrder.includes(stdKey)
        ? prev.sectionOrder
        : [...prev.sectionOrder, stdKey],
    }));
  };

  const handleCreateCustomSection = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newCustomSectionTitle.trim();
    if (!cleanTitle) return;
    const newId = createId('sec');
    const custom: CustomSection = {
      id: newId,
      title: cleanTitle,
      mode: newCustomSectionMode,
      textContent: '',
      fields: newCustomSectionMode === 'fields' ? [{ id: createId('sf'), key: '', value: '' }] : [],
      enabled: true,
    };
    updateTemplate((prev) => ({
      ...prev,
      customSections: [...prev.customSections, custom],
      sectionOrder: [...prev.sectionOrder, `custom:${newId}`],
    }));
    setNewCustomSectionTitle('');
    setShowAddCustomForm(false);
  };

  const removedStandardSections = DEFAULT_SECTION_ORDER.filter((k) => !tpl.enabledSections[k]);

  const activeOrderedKeys = tpl.sectionOrder.filter((k) => {
    if (k.startsWith('custom:')) {
      const cid = k.slice('custom:'.length);
      return tpl.customSections.some((c) => c.id === cid && c.enabled);
    }
    return tpl.enabledSections[k as StandardSectionKey];
  });

  const updateCharacter = (charId: string, patch: Partial<CharacterEntry>) => {
    updateTemplate((prev) => ({
      ...prev,
      characters: prev.characters.map((c) => (c.id === charId ? { ...c, ...patch } : c)),
    }));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Workspace Action & Metadata Bar */}
      <section className="rounded-xl border border-[#d1dfd0] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label
                htmlFor="builder-bot-title"
                className="block text-xs font-medium text-[#496051] mb-1"
              >
                캐릭터봇 제목
              </label>
              <input
                id="builder-bot-title"
                type="text"
                value={bot.title}
                onChange={(e) => onUpdateBot({ ...bot, title: e.target.value })}
                placeholder="예: 온실 티하우스의 윤채원"
                className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm font-semibold text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label
                htmlFor="builder-bot-subtitle"
                className="block text-xs font-medium text-[#496051] mb-1"
              >
                간단 장르 · 한줄 메모
              </label>
              <input
                id="builder-bot-subtitle"
                type="text"
                value={bot.subtitle}
                onChange={(e) => onUpdateBot({ ...bot, subtitle: e.target.value })}
                placeholder="예: 현대 일상 로맨스 · 1인 캐릭터"
                className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="builder-bot-status"
                className="block text-xs font-medium text-[#496051] mb-1"
              >
                제작 상태
              </label>
              <select
                id="builder-bot-status"
                value={bot.status}
                onChange={(e) =>
                  onUpdateBot({
                    ...bot,
                    status: e.target.value as 'in_progress' | 'completed' | 'published',
                  })
                }
                className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm font-medium text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
              >
                <option value="in_progress">제작중</option>
                <option value="completed">제작완료</option>
                <option value="published">게시완료</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:pt-5 shrink-0">
            <button
              type="button"
              onClick={onOpenLoadModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#b6cab4] bg-[#f3f7f2] px-3.5 py-2 text-xs font-semibold text-[#1b2b21] hover:bg-[#e2efe4] transition-colors whitespace-nowrap"
            >
              <FolderOpen className="h-3.5 w-3.5 text-[#3b6e4c]" />
              불러오기
            </button>

            <button
              type="button"
              onClick={handleManualSaveFeedback}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1dfd0] bg-white px-3.5 py-2 text-xs font-semibold text-[#1b2b21] hover:bg-[#f3f7f2] transition-colors whitespace-nowrap"
            >
              <Check className="h-3.5 w-3.5 text-[#3b6e4c]" />
              {savedNotice ? '저장됨' : '저장'}
            </button>

            <button
              type="button"
              onClick={() => onSaveAsNewBot(bot)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1dfd0] bg-white px-3 py-2 text-xs font-medium text-[#496051] hover:bg-[#f3f7f2] transition-colors whitespace-nowrap"
            >
              <CopyPlus className="h-3.5 w-3.5" />
              복제 저장
            </button>

            <button
              type="button"
              onClick={onGoToJsonConverter}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b6e4c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap"
            >
              <FileCode2 className="h-3.5 w-3.5" />
              JSON 변환
            </button>
          </div>
        </div>
      </section>

      {/* Fixed Section 1: #시스템 기본 규칙 (Always Top & Immutable Core) */}
      <section
        aria-label="#시스템 기본 규칙 (절대 고정)"
        className="rounded-xl border border-[#b6cab4] bg-[#e8f0e6] p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#c9dac7]">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-[#2d573b]" />
            <h2 className="text-base font-bold text-[#1b2b21]">#시스템 기본 규칙</h2>
            <span className="text-xs font-medium text-[#2d573b]">· 맨 첫단 절대 고정</span>
          </div>
          <button
            type="button"
            onClick={() =>
              updateTemplate((prev) => ({
                ...prev,
                systemExtraRules: [...prev.systemExtraRules, ''],
              }))
            }
            className="inline-flex items-center gap-1 rounded-lg border border-[#b6cab4] bg-white px-3 py-1.5 text-xs font-medium text-[#1b2b21] hover:bg-[#f3f7f2] transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5 text-[#3b6e4c]" />
            보조 규칙 추가
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-[#c3d5c2] bg-white/85 px-4 py-3">
            <div className="text-xs font-medium text-[#496051] mb-1">
              필수 치환 공식 (삭제·순서 변경 불가)
            </div>
            <p className="font-mono text-xs sm:text-sm font-medium text-[#1b2b21]">
              - {FIXED_SUBSTITUTION_RULE}
            </p>
          </div>

          {tpl.systemExtraRules.map((rule, idx) => (
            <div key={`sys_extra_${idx}`} className="flex items-center gap-2">
              <label htmlFor={`sys-extra-${idx}`} className="sr-only">
                시스템 보조 규칙 {idx + 1}
              </label>
              <input
                id={`sys-extra-${idx}`}
                type="text"
                value={rule}
                onChange={(e) => {
                  const next = [...tpl.systemExtraRules];
                  next[idx] = e.target.value;
                  updateTemplate((prev) => ({ ...prev, systemExtraRules: next }));
                }}
                placeholder="추가할 시스템 규칙 입력 (예: 메타 발화 금지)"
                className="min-w-0 flex-1 rounded-lg border border-[#c3d5c2] bg-white px-3.5 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  updateTemplate((prev) => ({
                    ...prev,
                    systemExtraRules: prev.systemExtraRules.filter((_, i) => i !== idx),
                  }))
                }
                aria-label={`시스템 보조 규칙 ${idx + 1} 삭제`}
                className="rounded-lg border border-[#c3d5c2] bg-white p-2 text-[#687e6f] hover:text-[#b43c3c] transition-colors shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Dynamic Modular Sections Toolbar (Restore Removed / Add Custom) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d1dfd0] bg-[#f8fbf8] px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#496051]">
          <span className="font-medium text-[#1b2b21]">모듈 구성:</span>
          <span>#시스템 기본 규칙 외 섹션은 자유롭게 추가·제거·순서 변경할 수 있습니다.</span>
          {removedStandardSections.map((stdKey) => (
            <button
              key={stdKey}
              type="button"
              onClick={() => handleRestoreStandardSection(stdKey)}
              className="inline-flex items-center gap-1 rounded-md border border-[#b6cab4] bg-white px-2.5 py-1 text-xs font-medium text-[#3b6e4c] hover:bg-[#e8f0e6] transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-3 w-3" />
              {STANDARD_SECTION_LABELS[stdKey]} 복원
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowAddCustomForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#b6cab4] bg-white px-3 py-1.5 text-xs font-semibold text-[#3b6e4c] hover:bg-[#e8f0e6] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          자유 섹션 추가
        </button>
      </div>

      {showAddCustomForm && (
        <form
          onSubmit={handleCreateCustomSection}
          className="rounded-xl border border-[#b6cab4] bg-white p-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label
              htmlFor="new-custom-section-title"
              className="block text-xs font-medium text-[#496051] mb-1"
            >
              새 섹션 이름 (# 자동 포함)
            </label>
            <input
              id="new-custom-section-title"
              type="text"
              value={newCustomSectionTitle}
              onChange={(e) => setNewCustomSectionTitle(e.target.value)}
              placeholder="예: 세계관 금기사항 또는 인물 관계도"
              className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
            />
          </div>
          <div className="sm:w-44">
            <label
              htmlFor="new-custom-section-mode"
              className="block text-xs font-medium text-[#496051] mb-1"
            >
              입력 형식
            </label>
            <select
              id="new-custom-section-mode"
              value={newCustomSectionMode}
              onChange={(e) => setNewCustomSectionMode(e.target.value as 'text' | 'fields')}
              className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
            >
              <option value="text">자유 문장형</option>
              <option value="fields">항목(Key-Value)형</option>
            </select>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              className="rounded-lg bg-[#3b6e4c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap"
            >
              추가
            </button>
            <button
              type="button"
              onClick={() => setShowAddCustomForm(false)}
              className="rounded-lg border border-[#d1dfd0] px-3 py-2 text-xs font-medium text-[#496051] hover:bg-[#f3f7f2] transition-colors whitespace-nowrap"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* Render Active Sections in Order */}
      {activeOrderedKeys.map((sectionKey, activeIdx) => {
        const isFirst = activeIdx === 0;
        const isLast = activeIdx === activeOrderedKeys.length - 1;

        let sectionTitle = STANDARD_SECTION_LABELS[sectionKey as StandardSectionKey] ?? sectionKey;
        let customSection: CustomSection | undefined;
        if (sectionKey.startsWith('custom:')) {
          const cid = sectionKey.slice('custom:'.length);
          customSection = tpl.customSections.find((c) => c.id === cid);
          if (!customSection) return null;
          sectionTitle = customSection.title.startsWith('#')
            ? customSection.title
            : `#${customSection.title}`;
        }

        const renderHeaderControls = () => (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleMoveSection(sectionKey, -1)}
              disabled={isFirst}
              aria-label={`${sectionTitle} 위로 이동`}
              className="rounded-md p-1.5 text-[#496051] hover:bg-[#e8f0e6] disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleMoveSection(sectionKey, 1)}
              disabled={isLast}
              aria-label={`${sectionTitle} 아래로 이동`}
              className="rounded-md p-1.5 text-[#496051] hover:bg-[#e8f0e6] disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleRemoveSection(sectionKey)}
              aria-label={`${sectionTitle} 섹션 빼기`}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#687e6f] hover:bg-[#fbebeb] hover:text-[#b43c3c] transition-colors whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              빼기
            </button>
          </div>
        );

        // #세션 목표
        if (sectionKey === 'session_goal') {
          return (
            <section
              key={sectionKey}
              className="rounded-xl border border-[#d1dfd0] bg-white p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#e5ede4] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#1b2b21]">#세션 목표</h2>
                  <p className="text-xs text-[#687e6f] mt-0.5">
                    특정 양식 없이 세션의 핵심 흐름과 목표를 문장형으로 자유롭게 작성하세요.
                  </p>
                </div>
                {renderHeaderControls()}
              </div>
              <label htmlFor="session-goal-textarea" className="sr-only">
                세션 목표 입력
              </label>
              <textarea
                id="session-goal-textarea"
                rows={4}
                value={tpl.sessionGoal}
                onChange={(e) =>
                  updateTemplate((prev) => ({ ...prev, sessionGoal: e.target.value }))
                }
                placeholder="예: 비 오는 오후 온실 카페에서 3년 만에 재회한 ⓤ와 ⓒ가 오해를 풀어 가는 차분한 일상 세션을 진행한다."
                className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] p-3.5 text-sm leading-relaxed text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
              />
            </section>
          );
        }

        // #기본설정
        if (sectionKey === 'basic_settings') {
          return (
            <section
              key={sectionKey}
              className="rounded-xl border border-[#d1dfd0] bg-white p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#e5ede4] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#1b2b21]">#기본설정</h2>
                  <p className="text-xs text-[#687e6f] mt-0.5">
                    장르, 시대, 배경 및 필요한 추가 세계관 항목을 자유롭게 구성합니다.
                  </p>
                </div>
                {renderHeaderControls()}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="basic-genre"
                    className="block text-xs font-semibold text-[#496051] mb-1.5"
                  >
                    장르
                  </label>
                  <input
                    id="basic-genre"
                    type="text"
                    value={tpl.basicSettings.genre}
                    onChange={(e) =>
                      updateTemplate((prev) => ({
                        ...prev,
                        basicSettings: { ...prev.basicSettings, genre: e.target.value },
                      }))
                    }
                    placeholder="예: 현대 일상 로맨스 / 미스터리"
                    className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3.5 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="basic-era"
                    className="block text-xs font-semibold text-[#496051] mb-1.5"
                  >
                    시대
                  </label>
                  <input
                    id="basic-era"
                    type="text"
                    value={tpl.basicSettings.era}
                    onChange={(e) =>
                      updateTemplate((prev) => ({
                        ...prev,
                        basicSettings: { ...prev.basicSettings, era: e.target.value },
                      }))
                    }
                    placeholder="예: 2026년 현대"
                    className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3.5 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="basic-background"
                  className="block text-xs font-semibold text-[#496051] mb-1.5"
                >
                  배경
                </label>
                <textarea
                  id="basic-background"
                  rows={2}
                  value={tpl.basicSettings.background}
                  onChange={(e) =>
                    updateTemplate((prev) => ({
                      ...prev,
                      basicSettings: { ...prev.basicSettings, background: e.target.value },
                    }))
                  }
                  placeholder="예: 도심 속 오래된 식물원 겸 티하우스"
                  className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] p-3 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                />
              </div>

              {tpl.basicSettings.customFields.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#ebf1ea]">
                  {tpl.basicSettings.customFields.map((cf, cfIdx) => (
                    <div key={cf.id} className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-center">
                      <input
                        type="text"
                        value={cf.key}
                        aria-label={`기본설정 추가 항목 이름 ${cfIdx + 1}`}
                        onChange={(e) => {
                          const next = [...tpl.basicSettings.customFields];
                          next[cfIdx] = { ...cf, key: e.target.value };
                          updateTemplate((prev) => ({
                            ...prev,
                            basicSettings: { ...prev.basicSettings, customFields: next },
                          }));
                        }}
                        placeholder="항목명 (예: 분위기)"
                        className="sm:col-span-4 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-xs font-medium text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                      />
                      <input
                        type="text"
                        value={cf.value}
                        aria-label={`기본설정 추가 항목 내용 ${cfIdx + 1}`}
                        onChange={(e) => {
                          const next = [...tpl.basicSettings.customFields];
                          next[cfIdx] = { ...cf, value: e.target.value };
                          updateTemplate((prev) => ({
                            ...prev,
                            basicSettings: { ...prev.basicSettings, customFields: next },
                          }));
                        }}
                        placeholder="내용 입력"
                        className="sm:col-span-7 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateTemplate((prev) => ({
                            ...prev,
                            basicSettings: {
                              ...prev.basicSettings,
                              customFields: prev.basicSettings.customFields.filter(
                                (item) => item.id !== cf.id,
                              ),
                            },
                          }))
                        }
                        aria-label={`기본설정 항목 ${cf.key || cfIdx + 1} 삭제`}
                        className="sm:col-span-1 justify-self-end rounded-md p-1.5 text-[#687e6f] hover:text-[#b43c3c] transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() =>
                    updateTemplate((prev) => ({
                      ...prev,
                      basicSettings: {
                        ...prev.basicSettings,
                        customFields: [
                          ...prev.basicSettings.customFields,
                          { id: createId('bf'), key: '', value: '' },
                        ],
                      },
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-1.5 text-xs font-medium text-[#3b6e4c] hover:bg-[#e8f0e6] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  세부 항목 추가
                </button>
              </div>
            </section>
          );
        }

        // #장소
        if (sectionKey === 'places') {
          return (
            <section
              key={sectionKey}
              className="rounded-xl border border-[#d1dfd0] bg-white p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#e5ede4] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#1b2b21]">#장소</h2>
                  <p className="text-xs text-[#687e6f] mt-0.5">
                    이야기가 전개되는 주요 공간들을 추가하거나 삭제할 수 있습니다.
                  </p>
                </div>
                {renderHeaderControls()}
              </div>

              <div className="divide-y divide-[#ebf1ea]">
                {tpl.places.map((place, pIdx) => (
                  <div key={place.id} className="py-4 first:pt-1 last:pb-1 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#496051] tabular-nums">
                        장소 {pIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateTemplate((prev) => ({
                            ...prev,
                            places: prev.places.filter((p) => p.id !== place.id),
                          }))
                        }
                        aria-label={`장소 ${pIdx + 1} 삭제`}
                        className="inline-flex items-center gap-1 text-xs text-[#687e6f] hover:text-[#b43c3c] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        삭제
                      </button>
                    </div>
                    <input
                      type="text"
                      value={place.name}
                      aria-label={`장소 ${pIdx + 1} 이름`}
                      onChange={(e) => {
                        const next = tpl.places.map((p) =>
                          p.id === place.id ? { ...p, name: e.target.value } : p,
                        );
                        updateTemplate((prev) => ({ ...prev, places: next }));
                      }}
                      placeholder="장소 이름 (예: 유리 온실 홀)"
                      className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3.5 py-2 text-sm font-medium text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                    />
                    <textarea
                      rows={2}
                      value={place.description}
                      aria-label={`장소 ${pIdx + 1} 설명`}
                      onChange={(e) => {
                        const next = tpl.places.map((p) =>
                          p.id === place.id ? { ...p, description: e.target.value } : p,
                        );
                        updateTemplate((prev) => ({ ...prev, places: next }));
                      }}
                      placeholder="공간의 분위기, 빛, 소리, 소품 묘사"
                      className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] p-3 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() =>
                    updateTemplate((prev) => ({
                      ...prev,
                      places: [...prev.places, createEmptyPlace()],
                    }))
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3.5 py-2 text-xs font-semibold text-[#3b6e4c] hover:bg-[#e8f0e6] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  장소 추가
                </button>
              </div>
            </section>
          );
        }

        // #주요 등장인물
        if (sectionKey === 'characters') {
          return (
            <section
              key={sectionKey}
              className="rounded-xl border border-[#d1dfd0] bg-white p-6 space-y-5"
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#e5ede4] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#1b2b21]">#주요 등장인물</h2>
                  <p className="text-xs text-[#687e6f] mt-0.5">
                    고정 등장인물 규칙이 자동 포함되며, 인원 수와 세부 속성을 자유롭게 늘리거나 뺄 수 있습니다.
                  </p>
                </div>
                {renderHeaderControls()}
              </div>

              {/* Fixed Character Rule */}
              <div className="rounded-lg border border-[#c3d5c2] bg-[#f3f7f2] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#2d573b]">
                    <Lock className="h-3.5 w-3.5" />
                    등장인물 규칙 (고정)
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateTemplate((prev) => ({
                        ...prev,
                        characterExtraRules: [...prev.characterExtraRules, ''],
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-[#b6cab4] bg-white px-2.5 py-1 text-xs font-medium text-[#1b2b21] hover:bg-[#e8f0e6] transition-colors"
                  >
                    <Plus className="h-3 w-3 text-[#3b6e4c]" />
                    규칙 추가
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-[#1b2b21] font-medium">
                  {FIXED_CHARACTER_RULE}
                </p>

                {tpl.characterExtraRules.map((cRule, crIdx) => (
                  <div key={`cr_${crIdx}`} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cRule}
                      aria-label={`추가 등장인물 규칙 ${crIdx + 1}`}
                      onChange={(e) => {
                        const next = [...tpl.characterExtraRules];
                        next[crIdx] = e.target.value;
                        updateTemplate((prev) => ({ ...prev, characterExtraRules: next }));
                      }}
                      placeholder="추가할 인물 공통 규칙"
                      className="min-w-0 flex-1 rounded-lg border border-[#c3d5c2] bg-white px-3 py-1.5 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          characterExtraRules: prev.characterExtraRules.filter((_, i) => i !== crIdx),
                        }))
                      }
                      aria-label={`추가 등장인물 규칙 ${crIdx + 1} 삭제`}
                      className="rounded p-1 text-[#687e6f] hover:text-[#b43c3c]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Character Entries */}
              <div className="divide-y divide-[#e5ede4]">
                {tpl.characters.map((char, cIdx) => (
                  <div key={char.id} className="py-5 first:pt-2 last:pb-2 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-[#1b2b21] tabular-nums">
                        등장인물 {cIdx + 1}
                        {char.name ? ` · ${char.name}` : ''}
                      </h3>
                      <button
                        type="button"
                        onClick={() =>
                          updateTemplate((prev) => ({
                            ...prev,
                            characters: prev.characters.filter((item) => item.id !== char.id),
                          }))
                        }
                        aria-label={`등장인물 ${char.name || cIdx + 1} 삭제`}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-[#687e6f] hover:bg-[#fbebeb] hover:text-[#b43c3c] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        인물 삭제
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <label
                          htmlFor={`char-name-${char.id}`}
                          className="block text-xs font-medium text-[#496051] mb-1"
                        >
                          이름
                        </label>
                        <input
                          id={`char-name-${char.id}`}
                          type="text"
                          value={char.name}
                          onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
                          placeholder="이름"
                          className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`char-age-${char.id}`}
                          className="block text-xs font-medium text-[#496051] mb-1"
                        >
                          나이
                        </label>
                        <input
                          id={`char-age-${char.id}`}
                          type="text"
                          value={char.age}
                          onChange={(e) => updateCharacter(char.id, { age: e.target.value })}
                          placeholder="예: 28세"
                          className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-1">
                        <label
                          htmlFor={`char-traits-${char.id}`}
                          className="block text-xs font-medium text-[#496051] mb-1"
                        >
                          특징
                        </label>
                        <input
                          id={`char-traits-${char.id}`}
                          type="text"
                          value={char.traits}
                          onChange={(e) => updateCharacter(char.id, { traits: e.target.value })}
                          placeholder="습관, 소품, 눈에 띄는 특징"
                          className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`char-appearance-${char.id}`}
                          className="block text-xs font-medium text-[#496051] mb-1"
                        >
                          외관
                        </label>
                        <textarea
                          id={`char-appearance-${char.id}`}
                          rows={2}
                          value={char.appearance}
                          onChange={(e) => updateCharacter(char.id, { appearance: e.target.value })}
                          placeholder="머리스타일, 인상, 평소 착장"
                          className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] p-3 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`char-personality-${char.id}`}
                          className="block text-xs font-medium text-[#496051] mb-1"
                        >
                          성격
                        </label>
                        <textarea
                          id={`char-personality-${char.id}`}
                          rows={2}
                          value={char.personality}
                          onChange={(e) =>
                            updateCharacter(char.id, { personality: e.target.value })
                          }
                          placeholder="성향, 가치관, 감정 표현 방식"
                          className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] p-3 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`char-speech-${char.id}`}
                          className="block text-xs font-medium text-[#496051] mb-1"
                        >
                          말투
                        </label>
                        <textarea
                          id={`char-speech-${char.id}`}
                          rows={2}
                          value={char.speechStyle}
                          onChange={(e) =>
                            updateCharacter(char.id, { speechStyle: e.target.value })
                          }
                          placeholder="존댓말/반말 비율, 어미, 말버릇"
                          className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] p-3 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`char-likes-${char.id}`}
                          className="block text-xs font-medium text-[#496051] mb-1"
                        >
                          호불호
                        </label>
                        <textarea
                          id={`char-likes-${char.id}`}
                          rows={2}
                          value={char.likesDislikes}
                          onChange={(e) =>
                            updateCharacter(char.id, { likesDislikes: e.target.value })
                          }
                          placeholder="좋아하는 것(호) / 싫어하는 것(불호)"
                          className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] p-3 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {char.customFields.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {char.customFields.map((cf, cfIdx) => (
                          <div key={cf.id} className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-center">
                            <input
                              type="text"
                              value={cf.key}
                              aria-label={`인물 ${cIdx + 1} 추가 속성명 ${cfIdx + 1}`}
                              onChange={(e) => {
                                const next = [...char.customFields];
                                next[cfIdx] = { ...cf, key: e.target.value };
                                updateCharacter(char.id, { customFields: next });
                              }}
                              placeholder="속성명 (예: 비밀, ⓤ와의 관계)"
                              className="sm:col-span-4 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-1.5 text-xs font-medium text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                            />
                            <input
                              type="text"
                              value={cf.value}
                              aria-label={`인물 ${cIdx + 1} 추가 속성 내용 ${cfIdx + 1}`}
                              onChange={(e) => {
                                const next = [...char.customFields];
                                next[cfIdx] = { ...cf, value: e.target.value };
                                updateCharacter(char.id, { customFields: next });
                              }}
                              placeholder="내용 입력"
                              className="sm:col-span-7 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-1.5 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateCharacter(char.id, {
                                  customFields: char.customFields.filter((f) => f.id !== cf.id),
                                })
                              }
                              aria-label={`인물 추가 속성 ${cf.key || cfIdx + 1} 삭제`}
                              className="sm:col-span-1 justify-self-end rounded p-1 text-[#687e6f] hover:text-[#b43c3c]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          updateCharacter(char.id, {
                            customFields: [
                              ...char.customFields,
                              { id: createId('cf'), key: '', value: '' },
                            ],
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-[#3b6e4c] hover:bg-[#e8f0e6] transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        커스텀 속성 추가
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() =>
                    updateTemplate((prev) => ({
                      ...prev,
                      characters: [...prev.characters, createEmptyCharacter()],
                    }))
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3.5 py-2 text-xs font-semibold text-[#3b6e4c] hover:bg-[#e8f0e6] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  등장인물 추가
                </button>
              </div>
            </section>
          );
        }

        // #문체 설정
        if (sectionKey === 'writing_style') {
          const ws = tpl.writingStyle;
          return (
            <section
              key={sectionKey}
              className="rounded-xl border border-[#d1dfd0] bg-white p-6 space-y-6"
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#e5ede4] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#1b2b21]">#문체 설정</h2>
                  <p className="text-xs text-[#687e6f] mt-0.5">
                    narration_rules, dialogue_rules, few_shot_examples 구조를 JSON 변환 규격에 맞춰 세팅합니다.
                  </p>
                </div>
                {renderHeaderControls()}
              </div>

              {/* narration_rules */}
              <div className="space-y-3">
                <h3 className="font-mono text-xs font-semibold text-[#2d573b]">
                  narration_rules
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {(
                    [
                      ['style', 'style (서술 문체)', '예: 3인칭 관찰자 시점의 감각적 문체'],
                      ['focus', 'focus (초점 대상)', '예: 시선, 손끝, 빛과 소리의 대비'],
                      ['tone', 'tone (분위기·어조)', '예: 차분하고 여백이 있는 서정적 톤'],
                      ['formatting', 'formatting (문단·표기)', '예: 서술과 대사를 명확히 구분'],
                    ] as const
                  ).map(([fieldKey, label, placeholder]) => (
                    <div key={fieldKey}>
                      <label
                        htmlFor={`nar-${fieldKey}`}
                        className="block text-xs font-medium text-[#496051] mb-1"
                      >
                        {label}
                      </label>
                      <input
                        id={`nar-${fieldKey}`}
                        type="text"
                        value={ws.narration_rules[fieldKey]}
                        onChange={(e) =>
                          updateTemplate((prev) => ({
                            ...prev,
                            writingStyle: {
                              ...prev.writingStyle,
                              narration_rules: {
                                ...prev.writingStyle.narration_rules,
                                [fieldKey]: e.target.value,
                              },
                            },
                          }))
                        }
                        placeholder={placeholder}
                        className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* dialogue_rules */}
              <div className="space-y-3 border-t border-[#ebf1ea] pt-5">
                <h3 className="font-mono text-xs font-semibold text-[#2d573b]">
                  dialogue_rules
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="dia-style"
                      className="block text-xs font-medium text-[#496051] mb-1"
                    >
                      style (대화 스타일)
                    </label>
                    <input
                      id="dia-style"
                      type="text"
                      value={ws.dialogue_rules.style}
                      onChange={(e) =>
                        updateTemplate((prev) => ({
                          ...prev,
                          writingStyle: {
                            ...prev.writingStyle,
                            dialogue_rules: {
                              ...prev.writingStyle.dialogue_rules,
                              style: e.target.value,
                            },
                          },
                        }))
                      }
                      placeholder="예: 절제되고 자연스러운 구어체"
                      className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="dia-strict"
                      className="block text-xs font-medium text-[#496051] mb-1"
                    >
                      format.strict_restrictions (엄격 제한 사항)
                    </label>
                    <input
                      id="dia-strict"
                      type="text"
                      value={ws.dialogue_rules.format.strict_restrictions}
                      onChange={(e) =>
                        updateTemplate((prev) => ({
                          ...prev,
                          writingStyle: {
                            ...prev.writingStyle,
                            dialogue_rules: {
                              ...prev.writingStyle.dialogue_rules,
                              format: {
                                ...prev.writingStyle.dialogue_rules.format,
                                strict_restrictions: e.target.value,
                              },
                            },
                          },
                        }))
                      }
                      placeholder="예: 메타 발언, 과장된 감탄부호 연속 금지"
                      className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label
                      htmlFor="dia-extra-format"
                      className="block text-xs font-medium text-[#496051] mb-1"
                    >
                      format.extra_format (대사 표기 형식 · 선택)
                    </label>
                    <input
                      id="dia-extra-format"
                      type="text"
                      value={ws.dialogue_rules.format.extra_format}
                      onChange={(e) =>
                        updateTemplate((prev) => ({
                          ...prev,
                          writingStyle: {
                            ...prev.writingStyle,
                            dialogue_rules: {
                              ...prev.writingStyle.dialogue_rules,
                              format: {
                                ...prev.writingStyle.dialogue_rules.format,
                                extra_format: e.target.value,
                              },
                            },
                          },
                        }))
                      }
                      placeholder='예: 대사는 큰따옴표(" ")로 감싸며 행동 묘사와 함께 배치한다.'
                      className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* few_shot_examples */}
              <div className="space-y-4 border-t border-[#ebf1ea] pt-5">
                <h3 className="font-mono text-xs font-semibold text-[#2d573b]">
                  few_shot_examples
                </h3>

                <div className="rounded-lg border border-[#c3d5c2] bg-[#f3f7f2] p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2d573b] mb-1">
                    <Lock className="h-3.5 w-3.5" />
                    기본 규칙 (고정 설정)
                  </div>
                  <p className="font-mono text-xs leading-relaxed text-[#1b2b21]">
                    "instruction": "{FIXED_FEW_SHOT_INSTRUCTION}"
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="few-shot-negative"
                    className="block text-xs font-medium text-[#496051] mb-1"
                  >
                    negative_example (피해야 할 평면적인 서술 예시)
                  </label>
                  <textarea
                    id="few-shot-negative"
                    rows={2}
                    value={ws.few_shot_examples.negative_example}
                    onChange={(e) =>
                      updateTemplate((prev) => ({
                        ...prev,
                        writingStyle: {
                          ...prev.writingStyle,
                          few_shot_examples: {
                            ...prev.writingStyle.few_shot_examples,
                            negative_example: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder="예: 그는 놀라서 쳐다보았다. &quot;오랜만이네요!&quot; 그가 웃었다."
                    className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] p-3 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
                    <div className="sm:col-span-5">
                      <label
                        htmlFor="few-shot-style-name"
                        className="block text-xs font-medium text-[#496051] mb-1"
                      >
                        positive_example 스타일 이름 (JSON 키로 반영)
                      </label>
                      <input
                        id="few-shot-style-name"
                        type="text"
                        value={ws.few_shot_examples.positive_style_name}
                        onChange={(e) =>
                          updateTemplate((prev) => ({
                            ...prev,
                            writingStyle: {
                              ...prev.writingStyle,
                              few_shot_examples: {
                                ...prev.writingStyle.few_shot_examples,
                                positive_style_name: e.target.value,
                              },
                            },
                          }))
                        }
                        placeholder="예: 연두빛_서정체"
                        className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 font-mono text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-7 text-xs text-[#687e6f] font-mono pb-2 truncate">
                      출력 키 미리보기: "positive_example": {'{'} "
                      {ws.few_shot_examples.positive_style_name.trim() || '설정_문체'}": "..." {'}'}
                    </div>
                  </div>

                  <label
                    htmlFor="few-shot-positive"
                    className="block text-xs font-medium text-[#496051] mb-1"
                  >
                    positive_example (AI가 모방해야 할 이상적인 문체 예시)
                  </label>
                  <textarea
                    id="few-shot-positive"
                    rows={4}
                    value={ws.few_shot_examples.positive_example}
                    onChange={(e) =>
                      updateTemplate((prev) => ({
                        ...prev,
                        writingStyle: {
                          ...prev.writingStyle,
                          few_shot_examples: {
                            ...prev.writingStyle.few_shot_examples,
                            positive_example: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder="설정해둔 스타일 이름에 어울리는 밀도 높은 모범 예시 문단을 입력하세요."
                    className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] p-3 text-sm leading-relaxed text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </section>
          );
        }

        // #출력 추가 규칙
        if (sectionKey === 'output_rules') {
          return (
            <section
              key={sectionKey}
              className="rounded-xl border border-[#d1dfd0] bg-white p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#e5ede4] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#1b2b21]">#출력 추가 규칙</h2>
                  <p className="text-xs text-[#687e6f] mt-0.5">
                    응답 길이, 턴 전개 속도, 금지 사항 등 출력 제어 규칙을 자유롭게 추가/제거합니다.
                  </p>
                </div>
                {renderHeaderControls()}
              </div>

              <div className="space-y-2.5">
                {tpl.outputRules.map((rule, rIdx) => (
                  <div key={`out_rule_${rIdx}`} className="flex items-center gap-2">
                    <span className="w-6 text-xs font-medium text-[#687e6f] tabular-nums text-right shrink-0">
                      {rIdx + 1}.
                    </span>
                    <input
                      type="text"
                      value={rule}
                      aria-label={`출력 추가 규칙 ${rIdx + 1}`}
                      onChange={(e) => {
                        const next = [...tpl.outputRules];
                        next[rIdx] = e.target.value;
                        updateTemplate((prev) => ({ ...prev, outputRules: next }));
                      }}
                      placeholder="예: 한 턴에 3~4문단 내외로 작성한다."
                      className="min-w-0 flex-1 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3.5 py-2 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateTemplate((prev) => ({
                          ...prev,
                          outputRules: prev.outputRules.filter((_, i) => i !== rIdx),
                        }))
                      }
                      aria-label={`출력 추가 규칙 ${rIdx + 1} 삭제`}
                      className="rounded-lg p-2 text-[#687e6f] hover:bg-[#fbebeb] hover:text-[#b43c3c] transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() =>
                    updateTemplate((prev) => ({
                      ...prev,
                      outputRules: [...prev.outputRules, ''],
                    }))
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3.5 py-2 text-xs font-semibold text-[#3b6e4c] hover:bg-[#e8f0e6] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  출력 규칙 추가
                </button>
              </div>
            </section>
          );
        }

        // Custom Section
        if (customSection) {
          return (
            <section
              key={sectionKey}
              className="rounded-xl border border-[#d1dfd0] bg-white p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-4 border-b border-[#e5ede4] pb-3">
                <div className="flex-1 max-w-md">
                  <label htmlFor={`custom-title-${customSection.id}`} className="sr-only">
                    자유 섹션 제목
                  </label>
                  <input
                    id={`custom-title-${customSection.id}`}
                    type="text"
                    value={customSection.title}
                    onChange={(e) => {
                      const next = tpl.customSections.map((cs) =>
                        cs.id === customSection.id ? { ...cs, title: e.target.value } : cs,
                      );
                      updateTemplate((prev) => ({ ...prev, customSections: next }));
                    }}
                    className="w-full rounded-lg border border-transparent hover:border-[#d1dfd0] focus:border-[#3b6e4c] px-2 py-1 text-base font-bold text-[#1b2b21] focus:outline-none"
                  />
                </div>
                {renderHeaderControls()}
              </div>

              {customSection.mode === 'text' ? (
                <textarea
                  rows={4}
                  value={customSection.textContent}
                  aria-label={`${sectionTitle} 내용`}
                  onChange={(e) => {
                    const next = tpl.customSections.map((cs) =>
                      cs.id === customSection.id ? { ...cs, textContent: e.target.value } : cs,
                    );
                    updateTemplate((prev) => ({ ...prev, customSections: next }));
                  }}
                  placeholder="자유롭게 내용을 작성하세요."
                  className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] p-3.5 text-sm text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                />
              ) : (
                <div className="space-y-2.5">
                  {customSection.fields.map((cf, fIdx) => (
                    <div key={cf.id} className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-center">
                      <input
                        type="text"
                        value={cf.key}
                        aria-label={`${sectionTitle} 항목 이름 ${fIdx + 1}`}
                        onChange={(e) => {
                          const next = tpl.customSections.map((cs) => {
                            if (cs.id !== customSection.id) return cs;
                            const fields = [...cs.fields];
                            fields[fIdx] = { ...cf, key: e.target.value };
                            return { ...cs, fields };
                          });
                          updateTemplate((prev) => ({ ...prev, customSections: next }));
                        }}
                        placeholder="항목명"
                        className="sm:col-span-4 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-xs font-medium text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                      />
                      <input
                        type="text"
                        value={cf.value}
                        aria-label={`${sectionTitle} 항목 내용 ${fIdx + 1}`}
                        onChange={(e) => {
                          const next = tpl.customSections.map((cs) => {
                            if (cs.id !== customSection.id) return cs;
                            const fields = [...cs.fields];
                            fields[fIdx] = { ...cf, value: e.target.value };
                            return { ...cs, fields };
                          });
                          updateTemplate((prev) => ({ ...prev, customSections: next }));
                        }}
                        placeholder="내용 입력"
                        className="sm:col-span-7 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = tpl.customSections.map((cs) => {
                            if (cs.id !== customSection.id) return cs;
                            return {
                              ...cs,
                              fields: cs.fields.filter((f) => f.id !== cf.id),
                            };
                          });
                          updateTemplate((prev) => ({ ...prev, customSections: next }));
                        }}
                        aria-label={`${sectionTitle} 항목 ${fIdx + 1} 삭제`}
                        className="sm:col-span-1 justify-self-end rounded p-1.5 text-[#687e6f] hover:text-[#b43c3c]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const next = tpl.customSections.map((cs) => {
                        if (cs.id !== customSection.id) return cs;
                        return {
                          ...cs,
                          fields: [...cs.fields, { id: createId('sf'), key: '', value: '' }],
                        };
                      });
                      updateTemplate((prev) => ({ ...prev, customSections: next }));
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-1.5 text-xs font-medium text-[#3b6e4c] hover:bg-[#e8f0e6] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    항목 추가
                  </button>
                </div>
              )}
            </section>
          );
        }

        return null;
      })}
    </div>
  );
};
