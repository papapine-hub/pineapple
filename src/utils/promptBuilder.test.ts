import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIXED_CHARACTER_RULE,
  FIXED_FEW_SHOT_INSTRUCTION,
  FIXED_SUBSTITUTION_RULE,
  applySystemPreset,
  createEmptyCharacter,
  createEmptyTemplate,
  estimateTokens,
  extractSystemPreset,
  parseImportedJsonToTemplate,
  serializeBotJson,
  templateToJsonObject,
} from './promptBuilder';

test('templateToJsonObject always locks #시스템 기본 규칙 as the first key with substitution rule', () => {
  const tpl = createEmptyTemplate();
  tpl.systemExtraRules = ['메타 발화 금지'];
  tpl.sessionGoal = '두 인물이 카페에서 우연히 재회한다.';

  const obj = templateToJsonObject(tpl);
  const keys = Object.keys(obj);
  assert.equal(keys[0], '#시스템 기본 규칙');

  const sysRules = obj['#시스템 기본 규칙'] as string[];
  assert.equal(sysRules[0], FIXED_SUBSTITUTION_RULE);
  assert.ok(sysRules.includes('메타 발화 금지'));
});

test('templateToJsonObject preserves fixed character rule and positive_example dynamic style key losslessly', () => {
  const tpl = createEmptyTemplate();
  tpl.characters = [
    createEmptyCharacter({
      name: '서이안',
      age: '27',
      traits: '은테 안경, 차가운 손끝',
      appearance: '검은 코트에 짙은 남색 니트',
      personality: '과묵하지만 섬세함',
      speechStyle: '낮고 단정한 존댓말',
      likesDislikes: '호: 홍차 / 불호: 소음',
    }),
  ];
  tpl.writingStyle.few_shot_examples.positive_style_name = '비오는_수채화체';
  tpl.writingStyle.few_shot_examples.positive_example = '빗물이 유리창을 타고 천천히 번져 내렸다.';
  tpl.writingStyle.few_shot_examples.negative_example = '비가 왔다. 그는 슬퍼 보였다.';

  const obj = templateToJsonObject(tpl);
  const charsSection = obj['#주요 등장인물'] as {
    등장인물_규칙: string[];
    등장인물_목록: Array<Record<string, string>>;
  };

  assert.equal(charsSection['등장인물_규칙'][0], FIXED_CHARACTER_RULE);
  assert.equal(charsSection['등장인물_목록'][0]['이름'], '서이안');

  const styleSection = obj['#문체 설정'] as {
    few_shot_examples: {
      기본_규칙: { instruction: string };
      negative_example: string;
      positive_example: Record<string, string>;
    };
  };

  assert.equal(styleSection.few_shot_examples.기본_규칙.instruction, FIXED_FEW_SHOT_INSTRUCTION);
  assert.equal(
    styleSection.few_shot_examples.positive_example['비오는_수채화체'],
    '빗물이 유리창을 타고 천천히 번져 내렸다.',
  );
});

test('single-line serialization removes whitespace newlines and reduces character/token count', () => {
  const tpl = createEmptyTemplate();
  tpl.sessionGoal = '오래된 식물원에서 비밀 노트를 함께 해독한다.';
  const obj = templateToJsonObject(tpl);

  const pretty = serializeBotJson(obj, false);
  const compact = serializeBotJson(obj, true);

  assert.ok(pretty.includes('\n'));
  assert.equal(compact.includes('\n'), false);
  assert.ok(compact.length < pretty.length);
  assert.ok(estimateTokens(compact) <= estimateTokens(pretty));
});

test('removing optional sections omits them from JSON while keeping system rules intact', () => {
  const tpl = createEmptyTemplate();
  tpl.enabledSections.places = false;
  tpl.enabledSections.output_rules = false;

  const obj = templateToJsonObject(tpl);
  assert.ok('#시스템 기본 규칙' in obj);
  assert.equal('#장소' in obj, false);
  assert.equal('#출력 추가 규칙' in obj, false);
});

test('parseImportedJsonToTemplate roundtrips exported JSON faithfully', () => {
  const tpl = createEmptyTemplate();
  tpl.sessionGoal = '겨울 기차역에서 마지막 열차를 기다리는 대화';
  tpl.basicSettings.genre = '현대 감성 드라마';
  tpl.basicSettings.era = '2026년 겨울';
  tpl.basicSettings.background = '눈 내리는 간이역 대합실';
  tpl.writingStyle.few_shot_examples.positive_style_name = '담백한_대화체';
  tpl.writingStyle.few_shot_examples.positive_example = '숨결이 하얗게 흩어졌다.';

  const jsonText = serializeBotJson(templateToJsonObject(tpl), true);
  const imported = parseImportedJsonToTemplate(jsonText);

  assert.equal(imported.sessionGoal, tpl.sessionGoal);
  assert.equal(imported.basicSettings.genre, '현대 감성 드라마');
  assert.equal(imported.writingStyle.few_shot_examples.positive_style_name, '담백한_대화체');
  assert.equal(imported.writingStyle.few_shot_examples.positive_example, '숨결이 하얗게 흩어졌다.');
});

test('system prompt preset extraction and application preserves character data', () => {
  const source = createEmptyTemplate();
  source.systemExtraRules = ['과도한 반복 표현 금지'];
  source.writingStyle.narration_rules.tone = '차분하고 서정적인 톤';
  source.outputRules = ['문단 사이 여백을 유지한다.'];

  const preset = extractSystemPreset(source, '차분한 서사 프리셋', '기본 문체 세트');

  const target = createEmptyTemplate();
  target.characters = [createEmptyCharacter({ name: '한여울', age: '24' })];
  const updated = applySystemPreset(target, preset);

  assert.equal(updated.characters[0].name, '한여울');
  assert.equal(updated.writingStyle.narration_rules.tone, '차분하고 서정적인 톤');
  assert.deepEqual(updated.systemExtraRules, ['과도한 반복 표현 금지']);
});
