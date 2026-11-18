import type { BotProject } from '../types/bot';
import { BOT_STATUS_LABELS } from '../utils/botRoster';

interface WorkspaceSidebarProps {
  bots: BotProject[];
  activeBotId?: string;
  activeBotTitle?: string;
  onSelectBot: (botId: string) => void;
  onOpenBuilder: () => void;
  onOpenJson: () => void;
}

export function WorkspaceSidebar({
  bots,
  activeBotId,
  activeBotTitle,
  onSelectBot,
  onOpenBuilder,
  onOpenJson,
}: WorkspaceSidebarProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-[#d1dfd0] bg-white p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#e5ede4] pb-2.5">
          <h2 className="text-xs font-semibold text-[#496051]">작업 중인 캐릭터봇</h2>
          <span className="text-xs text-[#687e6f] tabular-nums">{bots.length}개</span>
        </div>

        <ul className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {bots.map((bot) => {
            const isSelected = bot.id === activeBotId;
            return (
              <li key={bot.id}>
                <button
                  type="button"
                  onClick={() => onSelectBot(bot.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-[#e2efe4] text-[#1b2b21]'
                      : 'text-[#496051] hover:bg-[#f3f7f2] hover:text-[#1b2b21]'
                  }`}
                >
                  <div className="truncate text-xs font-semibold">{bot.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#687e6f]">
                    <span>{BOT_STATUS_LABELS[bot.status]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{bot.updatedAt}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-[#d1dfd0] bg-[#e8f0e6] p-4 space-y-2">
        <div className="text-xs font-semibold text-[#2d573b]">빠른 작업 이동</div>
        <p className="text-xs leading-relaxed text-[#496051]">
          현재 선택: <span className="font-semibold text-[#1b2b21]">{activeBotTitle}</span>
        </p>
        <div className="flex flex-col gap-1.5 pt-1">
          <button
            type="button"
            onClick={onOpenBuilder}
            className="w-full rounded-lg border border-[#b6cab4] bg-white px-3 py-2 text-left text-xs font-medium text-[#1b2b21] hover:bg-[#f3f7f2] transition-colors"
          >
            제작 틀 열기
          </button>
          <button
            type="button"
            onClick={onOpenJson}
            className="w-full rounded-lg border border-[#b6cab4] bg-white px-3 py-2 text-left text-xs font-medium text-[#1b2b21] hover:bg-[#f3f7f2] transition-colors"
          >
            JSON 변환 및 프리셋
          </button>
        </div>
      </div>
    </div>
  );
}
