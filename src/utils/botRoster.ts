import type { BotLinkEntry, BotProject, BotStatus } from '../types/bot';
import { createId } from './promptBuilder';

export const BOT_STATUS_LABELS: Record<BotStatus, string> = {
  in_progress: '제작중',
  completed: '제작완료',
  published: '게시완료',
};

/**
 * Normalizes a user-provided URL to a safe http/https URL.
 * Returns null if the URL is empty or uses a disallowed scheme (e.g. javascript:, data:).
 */
export function normalizeExternalUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Normalizes a cover image source (supports https/http URLs and data:image/* uploads).
 */
export function normalizeCoverImageUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  return normalizeExternalUrl(trimmed);
}

export function createBotLinkEntry(label: string, rawUrl: string): BotLinkEntry | null {
  const safeUrl = normalizeExternalUrl(rawUrl);
  if (!safeUrl) return null;
  const fallbackLabel = new URL(safeUrl).hostname.replace(/^www\./, '');
  return {
    id: createId('link'),
    label: label.trim() || fallbackLabel,
    url: safeUrl,
  };
}

export function filterBotsByStatusAndQuery(
  bots: BotProject[],
  statusFilter: 'all' | BotStatus,
  searchQuery: string,
): BotProject[] {
  const query = searchQuery.trim().toLowerCase();
  return bots.filter((bot) => {
    if (statusFilter !== 'all' && bot.status !== statusFilter) return false;
    if (!query) return true;
    return (
      bot.title.toLowerCase().includes(query) ||
      bot.subtitle.toLowerCase().includes(query) ||
      bot.notes.toLowerCase().includes(query)
    );
  });
}
