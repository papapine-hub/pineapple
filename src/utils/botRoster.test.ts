import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT_STATUS_LABELS,
  createBotLinkEntry,
  filterBotsByStatusAndQuery,
  normalizeCoverImageUrl,
  normalizeExternalUrl,
} from './botRoster';
import { createEmptyTemplate } from './promptBuilder';
import type { BotProject } from '../types/bot';

test('BOT_STATUS_LABELS maps all three statuses correctly', () => {
  assert.equal(BOT_STATUS_LABELS.in_progress, '제작중');
  assert.equal(BOT_STATUS_LABELS.completed, '제작완료');
  assert.equal(BOT_STATUS_LABELS.published, '게시완료');
});

test('normalizeExternalUrl prepends https and rejects unsafe schemes', () => {
  assert.equal(normalizeExternalUrl('example.com/bot/1'), 'https://example.com/bot/1');
  assert.equal(normalizeExternalUrl('http://localhost:3000/test'), 'http://localhost:3000/test');
  assert.equal(normalizeExternalUrl('javascript:alert(1)'), null);
  assert.equal(normalizeExternalUrl('data:text/html,<script>'), null);
  assert.equal(normalizeExternalUrl('   '), null);
});

test('normalizeCoverImageUrl accepts data:image and https URLs', () => {
  assert.equal(
    normalizeCoverImageUrl('data:image/png;base64,iVBORw0KGgo='),
    'data:image/png;base64,iVBORw0KGgo=',
  );
  assert.equal(normalizeCoverImageUrl('cdn.example.com/cover.jpg'), 'https://cdn.example.com/cover.jpg');
  assert.equal(normalizeCoverImageUrl('javascript:void(0)'), null);
});

test('createBotLinkEntry builds labeled link and falls back to hostname when label is blank', () => {
  const labeled = createBotLinkEntry('캐릭터 시트', 'https://notion.so/my-bot');
  assert.ok(labeled);
  assert.equal(labeled.label, '캐릭터 시트');
  assert.equal(labeled.url, 'https://notion.so/my-bot');

  const unlabeled = createBotLinkEntry('', 'www.postype.com/post/123');
  assert.ok(unlabeled);
  assert.equal(unlabeled.label, 'postype.com');
  assert.equal(unlabeled.url, 'https://www.postype.com/post/123');
});

test('filterBotsByStatusAndQuery filters across in_progress, completed, and published bots', () => {
  const tpl = createEmptyTemplate();
  const sampleBots: BotProject[] = [
    {
      id: '1',
      title: '윤채원',
      subtitle: '로맨스',
      status: 'published',
      updatedAt: '2026-11-17',
      notes: '게시 완료',
      template: tpl,
    },
    {
      id: '2',
      title: '강도현',
      subtitle: '미스터리',
      status: 'completed',
      updatedAt: '2026-11-17',
      notes: '검수 끝',
      template: tpl,
    },
    {
      id: '3',
      title: '이서진',
      subtitle: '판타지',
      status: 'in_progress',
      updatedAt: '2026-11-17',
      notes: '초안',
      template: tpl,
    },
  ];

  assert.equal(filterBotsByStatusAndQuery(sampleBots, 'published', '').length, 1);
  assert.equal(filterBotsByStatusAndQuery(sampleBots, 'completed', '').length, 1);
  assert.equal(filterBotsByStatusAndQuery(sampleBots, 'in_progress', '').length, 1);
  assert.equal(filterBotsByStatusAndQuery(sampleBots, 'all', '윤채원')[0].id, '1');
});
