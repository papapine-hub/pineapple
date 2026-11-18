import type {
  BotTemplate,
  CharacterEntry,
  CustomSection,
  PlaceEntry,
  StandardSectionKey,
  SystemPromptPreset,
} from '../types/bot';

export const FIXED_SUBSTITUTION_RULE = '치환 공식: 사용자 = {user} = ⓤ, 등장인물 = {char} = ⓒ';

export const FIXED_CHARACTER_RULE =
  "모든 ⓒ의 말투: 현대에 맞는 어투 사용, 'ㅋㅋ'같은 초성체 및 심한 비속어 사용 금지, 모든 ⓒ은 범성애 지향";

export const FIXED_FEW_SHOT_INSTRUCTION =
  "AI는 텍스트를 생성할 때 반드시 아래의 'positive_example' 문체를 모방해야 하며, 'negative_example'처럼 평면적으로 서술해서는 안 된다.";

export const STANDARD_SECTION_LABELS: Record<StandardSectionKey, string> = {
  session_goal: '#세션 목표',
  basic_settings: '#기본설정',
  places: '#장소',
  characters: '#주요 등장인물',
  writing_style: '#문체 설정',
  output_rules: '#출력 추가 규칙',
};

export const DEFAULT_SECTION_ORDER: StandardSectionKey[] = [
  'session_goal',
  'basic_settings',
  'places',
  'characters',
  'writing_style',
  'output_rules',
];

export function createId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyCharacter(partial?: Partial<CharacterEntry>): CharacterEntry {
  return {
    id: partial?.id ?? createId('char'),
    name: partial?.name ?? '',
    age: partial?.age ?? '',
    traits: partial?.traits ?? '',
    appearance: partial?.appearance ?? '',
    personality: partial?.personality ?? '',
    speechStyle: partial?.speechStyle ?? '',
    likesDislikes: partial?.likesDislikes ?? '',
    customFields: partial?.customFields ?? [],
  };
}

export function createEmptyPlace(partial?: Partial<PlaceEntry>): PlaceEntry {
  return {
    id: partial?.id ?? createId('place'),
    name: partial?.name ?? '',
    description: partial?.description ?? '',
  };
}

export function createEmptyTemplate(): BotTemplate {
  return {
    systemExtraRules: [],
    enabledSections: {
      session_goal: true,
      basic_settings: true,
      places: true,
      characters: true,
      writing_style: true,
      output_rules: true,
    },
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    sessionGoal: '',
    basicSettings: {
      genre: '',
      era: '',
      background: '',
      customFields: [],
    },
    places: [createEmptyPlace()],
    characters: [createEmptyCharacter()],
    characterExtraRules: [],
    writingStyle: {
      narration_rules: {
        style: '',
        focus: '',
        tone: '',
        formatting: '',
      },
      dialogue_rules: {
        style: '',
        format: {
          strict_restrictions: '',
          extra_format: '',
        },
      },
      few_shot_examples: {
        negative_example: '',
        positive_style_name: '감각적_서사체',
        positive_example: '',
      },
    },
    outputRules: ['한 턴에 3~4문단 내외로 호흡을 조절하며 ⓤ의 행동이나 대사를 대신 서술하지 않는다.'],
    customSections: [],
  };
}

export function cloneTemplate(template: BotTemplate): BotTemplate {
  return JSON.parse(JSON.stringify(template)) as BotTemplate;
}

/**
 * Converts a structured BotTemplate into a deterministic, lossless JSON object.
 * `#시스템 기본 규칙` is always placed first and always contains the fixed substitution formula.
 */
export function templateToJsonObject(
  template: BotTemplate,
  includedSections?: Record<string, boolean>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // 1. Always lock `#시스템 기본 규칙` at the very top
  const systemRules: string[] = [
    FIXED_SUBSTITUTION_RULE,
    ...template.systemExtraRules.map((rule) => rule.trim()).filter(Boolean),
  ];
  result['#시스템 기본 규칙'] = systemRules;

  const isSectionIncluded = (key: string): boolean => {
    if (includedSections && key in includedSections) {
      return includedSections[key];
    }
    if (key.startsWith('custom:')) {
      const customId = key.slice('custom:'.length);
      const found = template.customSections.find((s) => s.id === customId);
      return Boolean(found?.enabled);
    }
    return template.enabledSections[key as StandardSectionKey] ?? false;
  };

  for (const key of template.sectionOrder) {
    if (!isSectionIncluded(key)) continue;

    if (key === 'session_goal') {
      result['#세션 목표'] = template.sessionGoal;
      continue;
    }

    if (key === 'basic_settings') {
      const basicObj: Record<string, string> = {
        장르: template.basicSettings.genre,
        시대: template.basicSettings.era,
        배경: template.basicSettings.background,
      };
      for (const cf of template.basicSettings.customFields) {
        if (cf.key.trim()) {
          basicObj[cf.key.trim()] = cf.value;
        }
      }
      result['#기본설정'] = basicObj;
      continue;
    }

    if (key === 'places') {
      result['#장소'] = template.places.map((p) => ({
        장소명: p.name,
        설명: p.description,
      }));
      continue;
    }

    if (key === 'characters') {
      const charRules = [
        FIXED_CHARACTER_RULE,
        ...template.characterExtraRules.map((r) => r.trim()).filter(Boolean),
      ];
      result['#주요 등장인물'] = {
        등장인물_규칙: charRules,
        등장인물_목록: template.characters.map((c) => {
          const entry: Record<string, string> = {
            이름: c.name,
            나이: c.age,
            특징: c.traits,
            외관: c.appearance,
            성격: c.personality,
            말투: c.speechStyle,
            호불호: c.likesDislikes,
          };
          for (const cf of c.customFields) {
            if (cf.key.trim()) {
              entry[cf.key.trim()] = cf.value;
            }
          }
          return entry;
        }),
      };
      continue;
    }

    if (key === 'writing_style') {
      const styleName = template.writingStyle.few_shot_examples.positive_style_name.trim() || '설정_문체';
      const dialogueFormat: Record<string, string> = {
        strict_restrictions: template.writingStyle.dialogue_rules.format.strict_restrictions,
      };
      if (template.writingStyle.dialogue_rules.format.extra_format.trim()) {
        dialogueFormat.extra_format = template.writingStyle.dialogue_rules.format.extra_format;
      }

      result['#문체 설정'] = {
        narration_rules: {
          style: template.writingStyle.narration_rules.style,
          focus: template.writingStyle.narration_rules.focus,
          tone: template.writingStyle.narration_rules.tone,
          formatting: template.writingStyle.narration_rules.formatting,
        },
        dialogue_rules: {
          style: template.writingStyle.dialogue_rules.style,
          format: dialogueFormat,
        },
        few_shot_examples: {
          기본_규칙: {
            instruction: FIXED_FEW_SHOT_INSTRUCTION,
          },
          negative_example: template.writingStyle.few_shot_examples.negative_example,
          positive_example: {
            [styleName]: template.writingStyle.few_shot_examples.positive_example,
          },
        },
      };
      continue;
    }

    if (key === 'output_rules') {
      result['#출력 추가 규칙'] = template.outputRules.map((r) => r.trim()).filter(Boolean);
      continue;
    }

    if (key.startsWith('custom:')) {
      const customId = key.slice('custom:'.length);
      const custom = template.customSections.find((s) => s.id === customId);
      if (custom) {
        const heading = custom.title.trim().startsWith('#') ? custom.title.trim() : `#${custom.title.trim() || '추가 항목'}`;
        if (custom.mode === 'text') {
          result[heading] = custom.textContent;
        } else {
          const obj: Record<string, string> = {};
          for (const cf of custom.fields) {
            if (cf.key.trim()) {
              obj[cf.key.trim()] = cf.value;
            }
          }
          result[heading] = obj;
        }
      }
    }
  }

  return result;
}

export function serializeBotJson(jsonObj: Record<string, unknown>, singleLine: boolean): string {
  return singleLine ? JSON.stringify(jsonObj) : JSON.stringify(jsonObj, null, 2);
}

/**
 * Estimates LLM token usage for mixed Korean + English + JSON syntax.
 * Korean syllables typically map to ~1.3-1.8 tokens while ASCII punctuation/JSON keys map to ~0.35 tokens per char.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let tokens = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7af) {
      tokens += 1.45;
    } else if (code === 32 || code === 10 || code === 9) {
      tokens += 0.25;
    } else if (code < 128) {
      tokens += 0.35;
    } else {
      tokens += 1.2;
    }
  }
  return Math.max(1, Math.round(tokens));
}

export function extractSystemPreset(
  template: BotTemplate,
  name: string,
  description: string,
): SystemPromptPreset {
  return {
    id: createId('preset'),
    name: name.trim() || '새 시스템 프리셋',
    description: description.trim(),
    createdAt: new Date().toISOString().slice(0, 10),
    systemExtraRules: [...template.systemExtraRules],
    characterExtraRules: [...template.characterExtraRules],
    writingStyle: JSON.parse(JSON.stringify(template.writingStyle)),
    outputRules: [...template.outputRules],
  };
}

export function applySystemPreset(template: BotTemplate, preset: SystemPromptPreset): BotTemplate {
  const next = cloneTemplate(template);
  next.systemExtraRules = [...preset.systemExtraRules];
  next.characterExtraRules = [...preset.characterExtraRules];
  next.writingStyle = JSON.parse(JSON.stringify(preset.writingStyle));
  next.outputRules = [...preset.outputRules];
  next.enabledSections.writing_style = true;
  next.enabledSections.output_rules = true;
  return next;
}

/**
 * Parses an exported JSON string back into a BotTemplate for the "불러오기" workflow.
 */
export function parseImportedJsonToTemplate(rawJson: string): BotTemplate {
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('올바른 JSON 객체 형식이 아닙니다.');
  }

  const tpl = createEmptyTemplate();
  const order: string[] = [];

  // Disable standard sections initially and enable what exists in JSON
  tpl.enabledSections = {
    session_goal: false,
    basic_settings: false,
    places: false,
    characters: false,
    writing_style: false,
    output_rules: false,
  };

  // System rules
  const sysRules = parsed['#시스템 기본 규칙'];
  if (Array.isArray(sysRules)) {
    tpl.systemExtraRules = sysRules
      .map((item) => String(item))
      .filter((item) => item.trim() !== '' && !item.includes('사용자 = {user} = ⓤ'));
  }

  const knownKeys = new Set([
    '#시스템 기본 규칙',
    '#세션 목표',
    '#기본설정',
    '#장소',
    '#주요 등장인물',
    '#문체 설정',
    '#출력 추가 규칙',
  ]);

  for (const [key, value] of Object.entries(parsed)) {
    if (key === '#시스템 기본 규칙') continue;

    if (key === '#세션 목표') {
      tpl.enabledSections.session_goal = true;
      tpl.sessionGoal = typeof value === 'string' ? value : JSON.stringify(value);
      order.push('session_goal');
      continue;
    }

    if (key === '#기본설정' && value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      tpl.enabledSections.basic_settings = true;
      tpl.basicSettings.genre = String(obj['장르'] ?? '');
      tpl.basicSettings.era = String(obj['시대'] ?? '');
      tpl.basicSettings.background = String(obj['배경'] ?? '');
      tpl.basicSettings.customFields = Object.entries(obj)
        .filter(([k]) => !['장르', '시대', '배경'].includes(k))
        .map(([k, v]) => ({ id: createId('bf'), key: k, value: String(v ?? '') }));
      order.push('basic_settings');
      continue;
    }

    if (key === '#장소' && Array.isArray(value)) {
      tpl.enabledSections.places = true;
      tpl.places = value.map((item) => {
        if (item && typeof item === 'object') {
          const p = item as Record<string, unknown>;
          return createEmptyPlace({
            name: String(p['장소명'] ?? p['name'] ?? ''),
            description: String(p['설명'] ?? p['description'] ?? ''),
          });
        }
        return createEmptyPlace({ name: String(item ?? ''), description: '' });
      });
      if (tpl.places.length === 0) tpl.places = [createEmptyPlace()];
      order.push('places');
      continue;
    }

    if (key === '#주요 등장인물' && value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      tpl.enabledSections.characters = true;
      const rules = obj['등장인물_규칙'] ?? obj['등장인물 규칙'];
      if (Array.isArray(rules)) {
        tpl.characterExtraRules = rules
          .map((r) => String(r))
          .filter((r) => r.trim() !== '' && !r.includes('범성애 지향'));
      }
      const list = obj['등장인물_목록'] ?? obj['등장인물 목록'];
      if (Array.isArray(list)) {
        const stdFields = new Set(['이름', '나이', '특징', '외관', '성격', '말투', '호불호']);
        tpl.characters = list.map((rawChar) => {
          const c = (rawChar && typeof rawChar === 'object' ? rawChar : {}) as Record<string, unknown>;
          return createEmptyCharacter({
            name: String(c['이름'] ?? ''),
            age: String(c['나이'] ?? ''),
            traits: String(c['특징'] ?? ''),
            appearance: String(c['외관'] ?? ''),
            personality: String(c['성격'] ?? ''),
            speechStyle: String(c['말투'] ?? ''),
            likesDislikes: String(c['호불호'] ?? ''),
            customFields: Object.entries(c)
              .filter(([ck]) => !stdFields.has(ck))
              .map(([ck, cv]) => ({ id: createId('cf'), key: ck, value: String(cv ?? '') })),
          });
        });
      }
      if (tpl.characters.length === 0) tpl.characters = [createEmptyCharacter()];
      order.push('characters');
      continue;
    }

    if (key === '#문체 설정' && value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      tpl.enabledSections.writing_style = true;
      const nar = (obj['narration_rules'] ?? {}) as Record<string, unknown>;
      const dia = (obj['dialogue_rules'] ?? {}) as Record<string, unknown>;
      const diaFormat = (dia['format'] ?? {}) as Record<string, unknown>;
      const few = (obj['few_shot_examples'] ?? {}) as Record<string, unknown>;
      const posObj = few['positive_example'];

      let posStyleName = '감각적_서사체';
      let posExample = '';
      if (posObj && typeof posObj === 'object' && !Array.isArray(posObj)) {
        const entries = Object.entries(posObj as Record<string, unknown>);
        if (entries.length > 0) {
          posStyleName = entries[0][0];
          posExample = String(entries[0][1] ?? '');
        }
      } else if (typeof posObj === 'string') {
        posExample = posObj;
      }

      tpl.writingStyle = {
        narration_rules: {
          style: String(nar['style'] ?? ''),
          focus: String(nar['focus'] ?? ''),
          tone: String(nar['tone'] ?? ''),
          formatting: String(nar['formatting'] ?? ''),
        },
        dialogue_rules: {
          style: String(dia['style'] ?? ''),
          format: {
            strict_restrictions: String(diaFormat['strict_restrictions'] ?? ''),
            extra_format: String(diaFormat['extra_format'] ?? ''),
          },
        },
        few_shot_examples: {
          negative_example: String(few['negative_example'] ?? ''),
          positive_style_name: posStyleName,
          positive_example: posExample,
        },
      };
      order.push('writing_style');
      continue;
    }

    if (key === '#출력 추가 규칙') {
      tpl.enabledSections.output_rules = true;
      if (Array.isArray(value)) {
        tpl.outputRules = value.map((v) => String(v));
      } else if (typeof value === 'string') {
        tpl.outputRules = [value];
      }
      order.push('output_rules');
      continue;
    }

    if (!knownKeys.has(key)) {
      const customId = createId('sec');
      let custom: CustomSection;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        custom = {
          id: customId,
          title: key.replace(/^#/, ''),
          mode: 'fields',
          textContent: '',
          fields: Object.entries(value as Record<string, unknown>).map(([fk, fv]) => ({
            id: createId('sf'),
            key: fk,
            value: String(fv ?? ''),
          })),
          enabled: true,
        };
      } else {
        custom = {
          id: customId,
          title: key.replace(/^#/, ''),
          mode: 'text',
          textContent: typeof value === 'string' ? value : JSON.stringify(value),
          fields: [],
          enabled: true,
        };
      }
      tpl.customSections.push(custom);
      order.push(`custom:${customId}`);
    }
  }

  // Ensure standard keys missing from JSON stay in sectionOrder (disabled) so user can re-enable them
  for (const stdKey of DEFAULT_SECTION_ORDER) {
    if (!order.includes(stdKey)) {
      order.push(stdKey);
    }
  }
  tpl.sectionOrder = order;
  return tpl;
}
