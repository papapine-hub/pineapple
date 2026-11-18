import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  Check,
  Copy,
  Download,
  Lock,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { BotProject, StandardSectionKey, SystemPromptPreset } from '../types/bot';
import {
  STANDARD_SECTION_LABELS,
  estimateTokens,
  extractSystemPreset,
  serializeBotJson,
  templateToJsonObject,
} from '../utils/promptBuilder';

interface JsonConverterViewProps {
  bot: BotProject;
  presets: SystemPromptPreset[];
  onSavePreset: (preset: SystemPromptPreset) => void;
  onApplyPreset: (preset: SystemPromptPreset) => void;
  onDeletePreset: (presetId: string) => void;
  onBackToBuilder: () => void;
}

export const JsonConverterView: React.FC<JsonConverterViewProps> = ({
  bot,
  presets,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onBackToBuilder,
}) => {
  const [singleLine, setSingleLine] = useState(false);
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSummarizedObject, setAiSummarizedObject] = useState<Record<string, unknown> | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  // Section inclusion toggles for conversion
  const [includedSections, setIncludedSections] = useState<Record<string, boolean>>({});

  // Preset creation form
  const [presetName, setPresetName] = useState('');
  const [presetDesc, setPresetDesc] = useState('');
  const [presetSavedNotice, setPresetSavedNotice] = useState<string | null>(null);

  // Reset AI summary cache when bot changes
  useEffect(() => {
    setAiSummarizedObject(null);
    setAiError(null);
  }, [bot.id, bot.updatedAt]);

  // Reset includedSections map when bot switches
  useEffect(() => {
    const nextMap: Record<string, boolean> = {};
    for (const key of bot.template.sectionOrder) {
      if (key.startsWith('custom:')) {
        const cid = key.slice('custom:'.length);
        const found = bot.template.customSections.find((c) => c.id === cid);
        nextMap[key] = Boolean(found?.enabled);
      } else {
        nextMap[key] = bot.template.enabledSections[key as StandardSectionKey] ?? false;
      }
    }
    setIncludedSections(nextMap);
  }, [bot.id, bot.template]);

  const rawJsonObject = useMemo(
    () => templateToJsonObject(bot.template, includedSections),
    [bot.template, includedSections],
  );

  const activeJsonObject =
    aiSummaryEnabled && aiSummarizedObject ? aiSummarizedObject : rawJsonObject;

  const prettyRawText = useMemo(() => serializeBotJson(rawJsonObject, false), [rawJsonObject]);
  const outputJsonText = useMemo(
    () => serializeBotJson(activeJsonObject, singleLine),
    [activeJsonObject, singleLine],
  );

  const baselineTokens = useMemo(() => estimateTokens(prettyRawText), [prettyRawText]);
  const currentTokens = useMemo(() => estimateTokens(outputJsonText), [outputJsonText]);
  const savedChars = Math.max(0, prettyRawText.length - outputJsonText.length);
  const savedTokens = Math.max(0, baselineTokens - currentTokens);

  const handleToggleAiSummary = () => {
    const next = !aiSummaryEnabled;
    setAiSummaryEnabled(next);
    setAiError(null);
    if (!next) {
      // Turning OFF immediately restores exact lossless raw JSON
      setAiSummarizedObject(null);
    }
  };

  const handleRunAiSummarize = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch('/api/summarize-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonPayload: rawJsonObject }),
      });
      const data = (await response.json()) as {
        summarized?: Record<string, unknown>;
        error?: string;
      };
      if (!response.ok || !data.summarized) {
        throw new Error(data.error || 'AI 요약 변환에 실패했습니다.');
      }
      setAiSummarizedObject(data.summarized);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'AI 요약 요청 중 오류가 발생했습니다.',
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(outputJsonText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback
      const el = document.createElement('textarea');
      el.value = outputJsonText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([outputJsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (bot.title.trim() || 'character_bot').replace(/[\\/:*?"<>|]/g, '_');
    a.href = url;
    a.download = `${safeName}${singleLine ? '_compact' : ''}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSavePresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;
    const preset = extractSystemPreset(bot.template, presetName, presetDesc);
    onSavePreset(preset);
    setPresetName('');
    setPresetDesc('');
    setPresetSavedNotice(`'${preset.name}' 프리셋이 저장되었습니다.`);
    window.setTimeout(() => setPresetSavedNotice(null), 2200);
  };

  const availableSections = bot.template.sectionOrder.filter((key) => {
    if (key.startsWith('custom:')) {
      const cid = key.slice('custom:'.length);
      return bot.template.customSections.some((c) => c.id === cid && c.enabled);
    }
    return bot.template.enabledSections[key as StandardSectionKey];
  });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 pb-12">
      {/* Left Column: Conversion Options & System Prompt Presets */}
      <div className="xl:col-span-5 space-y-6">
        {/* Conversion Options */}
        <section className="rounded-xl border border-[#d1dfd0] bg-white p-6 space-y-5">
          <div className="border-b border-[#e5ede4] pb-3">
            <h1 className="text-base font-bold text-[#1b2b21]">JSON 변환 옵션</h1>
            <p className="text-xs text-[#687e6f] mt-0.5">
              대상 봇: <span className="font-semibold text-[#1b2b21]">{bot.title}</span>
            </p>
          </div>

          {/* Option 1: Single-line Minify Toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[#1b2b21]">
                한 줄로 변환 (토큰 절약)
              </div>
              <p className="text-xs text-[#496051] leading-relaxed">
                들여쓰기와 줄바꿈 공백을 제거해 한 줄 JSON으로 압축하여 프롬프트 토큰을 절감합니다.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={singleLine}
              aria-label="한 줄로 변환 토글"
              onClick={() => setSingleLine((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                singleLine ? 'bg-[#3b6e4c]' : 'bg-[#c5d4c4]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  singleLine ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Option 2: AI Summary ON/OFF (Default OFF) */}
          <div className="border-t border-[#ebf1ea] pt-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#1b2b21]">AI 요약 모드</span>
                  <span className="text-xs font-medium text-[#3b6e4c]">
                    {aiSummaryEnabled ? 'ON' : 'OFF (원본 유지)'}
                  </span>
                </div>
                <p className="text-xs text-[#496051] leading-relaxed">
                  {aiSummaryEnabled
                    ? 'AI가 장황한 문장을 압축 요약합니다. 단, 고정 규칙(#시스템 기본 규칙, 등장인물 규칙, few_shot 기본 규칙)은 원문 그대로 보존됩니다.'
                    : '기본 OFF 상태에서는 AI가 내용을 임의로 줄이거나 바꾸지 않고 입력한 모든 설정을 100% 무손실 JSON으로 변환합니다.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiSummaryEnabled}
                aria-label="AI 요약 ON/OFF 토글"
                onClick={handleToggleAiSummary}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  aiSummaryEnabled ? 'bg-[#3b6e4c]' : 'bg-[#c5d4c4]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    aiSummaryEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {aiSummaryEnabled && (
              <div className="rounded-lg border border-[#c3d5c2] bg-[#f3f7f2] p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunAiSummarize}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b6e4c] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] disabled:opacity-60 transition-colors"
                  >
                    {aiLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {aiLoading ? 'AI 요약 변환 중...' : 'AI 요약 변환 실행'}
                  </button>

                  {aiSummarizedObject && (
                    <button
                      type="button"
                      onClick={() => setAiSummarizedObject(null)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#b6cab4] bg-white px-3 py-2 text-xs font-medium text-[#496051] hover:bg-[#e8f0e6] transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      원본으로 복원
                    </button>
                  )}
                </div>

                {aiError && (
                  <div className="flex items-start gap-2 rounded-md border border-[#e6baba] bg-[#fbebeb] p-2.5 text-xs text-[#b43c3c]">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{aiError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section Inclusion Checkboxes */}
          <div className="border-t border-[#ebf1ea] pt-4 space-y-2.5">
            <div className="text-xs font-semibold text-[#496051]">변환에 포함할 섹션</div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between rounded-md bg-[#f3f7f2] px-3 py-1.5 text-xs text-[#1b2b21]">
                <span className="flex items-center gap-2 font-medium">
                  <Lock className="h-3.5 w-3.5 text-[#3b6e4c]" />
                  #시스템 기본 규칙
                </span>
                <span className="text-[11px] text-[#496051]">항상 포함</span>
              </div>

              {availableSections.map((key) => {
                let label = STANDARD_SECTION_LABELS[key as StandardSectionKey] ?? key;
                if (key.startsWith('custom:')) {
                  const cs = bot.template.customSections.find(
                    (c) => c.id === key.slice('custom:'.length),
                  );
                  if (cs) {
                    label = cs.title.startsWith('#') ? cs.title : `#${cs.title}`;
                  }
                }
                const checked = includedSections[key] ?? true;
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-xs text-[#1b2b21] hover:bg-[#f8fbf8]"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setIncludedSections((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                          }));
                          setAiSummarizedObject(null);
                        }}
                        className="h-3.5 w-3.5 accent-[#3b6e4c]"
                      />
                      <span>{label}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        {/* System Prompt Presets Manager */}
        <section className="rounded-xl border border-[#d1dfd0] bg-white p-6 space-y-4">
          <div className="border-b border-[#e5ede4] pb-3">
            <h2 className="text-base font-bold text-[#1b2b21]">시스템 프롬프트 프리셋</h2>
            <p className="text-xs text-[#687e6f] mt-0.5">
              자주 쓰는 #시스템 기본 규칙 보조, #문체 설정, #출력 추가 규칙 세트를 저장해 재사용하세요.
            </p>
          </div>

          <form onSubmit={handleSavePresetSubmit} className="space-y-2.5">
            <div>
              <label htmlFor="preset-name-input" className="sr-only">
                프리셋 이름
              </label>
              <input
                id="preset-name-input"
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="저장할 프리셋 이름 (예: 차분한 일상 서정체)"
                className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <label htmlFor="preset-desc-input" className="sr-only">
                프리셋 설명
              </label>
              <input
                id="preset-desc-input"
                type="text"
                value={presetDesc}
                onChange={(e) => setPresetDesc(e.target.value)}
                placeholder="간단 설명 (선택)"
                className="min-w-0 flex-1 rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-xs text-[#1b2b21] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b6e4c] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap shrink-0"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                프리셋 저장
              </button>
            </div>
            {presetSavedNotice && (
              <p className="text-xs font-medium text-[#2e6f40]">{presetSavedNotice}</p>
            )}
          </form>

          <div className="divide-y divide-[#ebf1ea] pt-1">
            {presets.length === 0 ? (
              <p className="py-4 text-center text-xs text-[#687e6f]">
                저장된 프리셋이 없습니다.
              </p>
            ) : (
              presets.map((preset) => (
                <div key={preset.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#1b2b21]">{preset.name}</div>
                    <div className="text-[11px] text-[#687e6f] mt-0.5">
                      {preset.description || '문체 및 시스템 출력 규칙 세트'} ·{' '}
                      <span className="tabular-nums">{preset.createdAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onApplyPreset(preset)}
                      className="rounded-md border border-[#b6cab4] bg-[#f3f7f2] px-2.5 py-1 text-xs font-medium text-[#2d573b] hover:bg-[#e2efe4] transition-colors whitespace-nowrap"
                    >
                      현재 봇에 적용
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePreset(preset.id)}
                      aria-label={`프리셋 '${preset.name}' 삭제`}
                      className="rounded-md p-1 text-[#687e6f] hover:text-[#b43c3c] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Right Column: Live JSON Output & Token Metrics */}
      <div className="xl:col-span-7 flex flex-col">
        <section className="flex-1 rounded-xl border border-[#d1dfd0] bg-white p-6 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5ede4] pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-[#1b2b21]">변환된 JSON 결과</h2>
                <span className="text-xs font-medium text-[#496051]">
                  · {aiSummaryEnabled && aiSummarizedObject ? 'AI 요약 적용됨' : '원본 무손실'} ·{' '}
                  {singleLine ? '한 줄 압축' : '표준 정렬'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#496051] tabular-nums">
                <span>글자 수: {outputJsonText.length.toLocaleString()}자</span>
                <span aria-hidden="true">·</span>
                <span>예상 토큰: 약 {currentTokens.toLocaleString()} tokens</span>
                {(savedChars > 0 || savedTokens > 0) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-[#2e6f40]">
                      절감: -{savedChars.toLocaleString()}자 (약 {savedTokens.toLocaleString()} tokens)
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onBackToBuilder}
                className="rounded-lg border border-[#d1dfd0] bg-white px-3 py-2 text-xs font-medium text-[#496051] hover:bg-[#f3f7f2] transition-colors whitespace-nowrap"
              >
                제작 틀 편집
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1dfd0] bg-white px-3 py-2 text-xs font-medium text-[#1b2b21] hover:bg-[#f3f7f2] transition-colors whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-[#3b6e4c]" />
                .json 저장
              </button>
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b6e4c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2d573b] transition-colors whitespace-nowrap"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? '복사 완료' : 'JSON 복사'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex-1 overflow-hidden rounded-lg border border-[#24362b] bg-[#17231c]">
            <pre
              data-testid="json-output-preview"
              className={`h-full max-h-[680px] overflow-auto p-4 font-mono text-xs leading-relaxed text-[#e6f1e6] ${
                singleLine ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
              }`}
            >
              <code>{outputJsonText}</code>
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
};
