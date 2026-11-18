import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/summarize-json', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error:
          'GEMINI_API_KEY가 설정되어 있지 않습니다. Settings > Secrets에서 API 키를 설정하거나, AI 요약 OFF 모드로 무손실 변환을 이용해 주세요.',
      });
      return;
    }

    const body = req.body as { jsonPayload?: Record<string, unknown> };
    if (!body || !body.jsonPayload || typeof body.jsonPayload !== 'object') {
      res.status(400).json({ error: '변환할 JSON 데이터가 올바르지 않습니다.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const originalPayload = body.jsonPayload;
      const lockedSystemRules = originalPayload['#시스템 기본 규칙'];
      const lockedCharactersBlock = originalPayload['#주요 등장인물'] as
        | Record<string, unknown>
        | undefined;
      const lockedCharRules = lockedCharactersBlock?.['등장인물_규칙'];
      const lockedStyleBlock = originalPayload['#문체 설정'] as
        | Record<string, unknown>
        | undefined;
      const lockedFewShot = lockedStyleBlock?.['few_shot_examples'] as
        | Record<string, unknown>
        | undefined;
      const lockedFewShotRule = lockedFewShot?.['기본_규칙'];

      const prompt = [
        '당신은 AI 캐릭터봇 시스템 프롬프트의 토큰을 절약하면서도 핵심 설정과 뉘앙스를 잃지 않게 다듬는 전문 편집자입니다.',
        '아래 JSON 객체의 키 구조(한글/영문 키 이름)는 절대 변경하지 말고 그대로 유지하세요.',
        '각 장황한 서술형 문장만 군더더기 없이 간결하게 압축하되, 인물의 핵심 성격, 말투, 호불호, 예시 문장의 문체는 훼손하지 마세요.',
        '"#시스템 기본 규칙", "등장인물_규칙", "few_shot_examples.기본_규칙"은 절대 수정하거나 축약하지 말고 원문 그대로 유지하세요.',
        '반드시 유효한 순수 JSON 객체만 반환하세요 (마크다운 코드 블록 없이).',
        '',
        JSON.stringify(originalPayload, null, 2),
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.' });
        return;
      }

      const summarized = JSON.parse(rawText) as Record<string, unknown>;

      // Enforce immutable fixed rules strictly even after AI summarization
      if (lockedSystemRules !== undefined) {
        summarized['#시스템 기본 규칙'] = lockedSystemRules;
      }
      if (
        lockedCharRules !== undefined &&
        summarized['#주요 등장인물'] &&
        typeof summarized['#주요 등장인물'] === 'object'
      ) {
        (summarized['#주요 등장인물'] as Record<string, unknown>)['등장인물_규칙'] =
          lockedCharRules;
      }
      if (
        lockedFewShotRule !== undefined &&
        summarized['#문체 설정'] &&
        typeof summarized['#문체 설정'] === 'object'
      ) {
        const styleObj = summarized['#문체 설정'] as Record<string, unknown>;
        if (styleObj['few_shot_examples'] && typeof styleObj['few_shot_examples'] === 'object') {
          (styleObj['few_shot_examples'] as Record<string, unknown>)['기본_규칙'] =
            lockedFewShotRule;
        }
      }

      res.json({ summarized });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI 요약 처리 중 알 수 없는 오류가 발생했습니다.';
      res.status(500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*all', (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
