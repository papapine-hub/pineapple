import React, { useState } from 'react';
import { FileUp, FolderOpen, Layers, Sparkles, X } from 'lucide-react';
import type { BotProject, BotTemplate, StarterTemplate, SystemPromptPreset } from '../types/bot';
import { BOT_STATUS_LABELS } from '../utils/botRoster';
import { parseImportedJsonToTemplate } from '../utils/promptBuilder';

interface LoadTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  bots: BotProject[];
  starterTemplates: StarterTemplate[];
  presets: SystemPromptPreset[];
  onLoadBotProject: (bot: BotProject) => void;
  onLoadStarterTemplate: (starter: StarterTemplate) => void;
  onApplyPreset: (preset: SystemPromptPreset) => void;
  onImportTemplateJson: (template: BotTemplate) => void;
}

type ModalTab = 'bots' | 'starters' | 'presets' | 'json';

export const LoadTemplateModal: React.FC<LoadTemplateModalProps> = ({
  isOpen,
  onClose,
  bots,
  starterTemplates,
  presets,
  onLoadBotProject,
  onLoadStarterTemplate,
  onApplyPreset,
  onImportTemplateJson,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('bots');
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleJsonImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    try {
      const parsedTemplate = parseImportedJsonToTemplate(rawJsonInput);
      onImportTemplateJson(parsedTemplate);
      setRawJsonInput('');
      onClose();
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'JSON 형식을 해석할 수 없습니다. 구문을 확인해 주세요.',
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setRawJsonInput(text);
      setImportError(null);
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b2b21]/35 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="load-template-modal-title"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-[#c3d5c2] bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-[#e5ede4] px-6 py-4">
          <div>
            <h2 id="load-template-modal-title" className="text-base font-semibold text-[#1b2b21]">
              제작 틀 · 캐릭터봇 불러오기
            </h2>
            <p className="text-xs text-[#687e6f] mt-0.5">
              기존 캐릭터봇이나 템플릿, 저장한 프리셋을 불러와 제작 시간을 단축하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="불러오기 창 닫기"
            className="rounded-lg p-1.5 text-[#496051] hover:bg-[#f3f7f2] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-1 border-b border-[#e5ede4] bg-[#f8fbf8] px-6 py-2 overflow-x-auto">
          {(
            [
              ['bots', '저장된 캐릭터봇'],
              ['starters', '표준 템플릿'],
              ['presets', '시스템 프리셋 적용'],
              ['json', 'JSON 가져오기'],
            ] as const
          ).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tabKey
                  ? 'bg-[#3b6e4c] text-white'
                  : 'text-[#496051] hover:bg-[#e8f0e6] hover:text-[#1b2b21]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'bots' && (
            <div className="space-y-3">
              {bots.map((bot) => (
                <div
                  key={bot.id}
                  className="flex flex-col gap-3 rounded-lg border border-[#d1dfd0] bg-[#fcfefc] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#1b2b21]">{bot.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#687e6f]">
                      <span>{BOT_STATUS_LABELS[bot.status]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{bot.subtitle || '일반'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{bot.updatedAt}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadBotProject(bot);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b6e4c] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap shrink-0"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    구조 복제 불러오기
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'starters' && (
            <div className="space-y-3">
              {starterTemplates.map((starter) => (
                <div
                  key={starter.id}
                  className="flex flex-col gap-3 rounded-lg border border-[#d1dfd0] bg-[#fcfefc] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-[#3b6e4c] shrink-0" />
                      <span className="text-sm font-semibold text-[#1b2b21]">{starter.name}</span>
                      <span className="text-xs text-[#687e6f]">· {starter.genreLabel}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#496051]">{starter.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadStarterTemplate(starter);
                      onClose();
                    }}
                    className="rounded-lg bg-[#3b6e4c] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap shrink-0"
                  >
                    이 틀로 채우기
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="space-y-3">
              <p className="text-xs text-[#496051] mb-3">
                프리셋을 적용하면 현재 작성 중인 <strong className="font-semibold">등장인물·장소·세션 목표</strong>는 그대로 유지한 채,{' '}
                <strong className="font-semibold">#시스템 기본 규칙 보조·#문체 설정·#출력 추가 규칙</strong>만 덮어씁니다.
              </p>
              {presets.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#687e6f]">
                  저장된 시스템 프롬프트 프리셋이 아직 없습니다. JSON 변환 탭에서 자주 쓰는 프리셋을 저장해 보세요.
                </p>
              ) : (
                presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex flex-col gap-3 rounded-lg border border-[#d1dfd0] bg-[#fcfefc] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#3b6e4c] shrink-0" />
                        <span className="text-sm font-semibold text-[#1b2b21]">{preset.name}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#496051]">
                        {preset.description || '문체 및 출력 규칙 프리셋'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onApplyPreset(preset);
                        onClose();
                      }}
                      className="rounded-lg bg-[#3b6e4c] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap shrink-0"
                    >
                      문체·규칙 적용
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'json' && (
            <form onSubmit={handleJsonImportSubmit} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[#496051]">
                  기존에 변환해 둔 캐릭터봇 JSON 텍스트를 붙여넣거나 파일을 선택하세요.
                </span>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-1.5 text-xs font-medium text-[#1b2b21] hover:bg-[#e8f0e6] transition-colors">
                  <FileUp className="h-3.5 w-3.5 text-[#3b6e4c]" />
                  .json 파일 선택
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              <label htmlFor="import-json-textarea" className="sr-only">
                JSON 텍스트 입력
              </label>
              <textarea
                id="import-json-textarea"
                rows={9}
                value={rawJsonInput}
                onChange={(e) => setRawJsonInput(e.target.value)}
                placeholder={'{\n  "#시스템 기본 규칙": [...],\n  "#세션 목표": "..."\n}'}
                className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] p-3 font-mono text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
              />

              {importError && (
                <p className="rounded-lg border border-[#e6baba] bg-[#fbebeb] px-3 py-2 text-xs text-[#b43c3c]">
                  {importError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-[#d1dfd0] px-4 py-2 text-xs font-medium text-[#496051] hover:bg-[#f3f7f2] transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#3b6e4c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors"
                >
                  제작 틀로 변환 불러오기
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
