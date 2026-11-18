export type BotStatus = 'in_progress' | 'completed' | 'published';

export interface BotLinkEntry {
  id: string;
  label: string;
  url: string;
}

export type StandardSectionKey =
  | 'session_goal'
  | 'basic_settings'
  | 'places'
  | 'characters'
  | 'writing_style'
  | 'output_rules';

export interface CustomField {
  id: string;
  key: string;
  value: string;
}

export interface PlaceEntry {
  id: string;
  name: string;
  description: string;
}

export interface CharacterEntry {
  id: string;
  name: string;
  age: string;
  traits: string;
  appearance: string;
  personality: string;
  speechStyle: string;
  likesDislikes: string;
  customFields: CustomField[];
}

export interface WritingStyleConfig {
  narration_rules: {
    style: string;
    focus: string;
    tone: string;
    formatting: string;
  };
  dialogue_rules: {
    style: string;
    format: {
      strict_restrictions: string;
      extra_format: string;
    };
  };
  few_shot_examples: {
    negative_example: string;
    positive_style_name: string;
    positive_example: string;
  };
}

export interface CustomSection {
  id: string;
  title: string;
  mode: 'text' | 'fields';
  textContent: string;
  fields: CustomField[];
  enabled: boolean;
}

export interface BotTemplate {
  /** Always fixed at top; core substitution rule is immutable */
  systemExtraRules: string[];
  enabledSections: Record<StandardSectionKey, boolean>;
  sectionOrder: string[]; // StandardSectionKey or `custom:${id}`
  sessionGoal: string;
  basicSettings: {
    genre: string;
    era: string;
    background: string;
    customFields: CustomField[];
  };
  places: PlaceEntry[];
  characters: CharacterEntry[];
  characterExtraRules: string[];
  writingStyle: WritingStyleConfig;
  outputRules: string[];
  customSections: CustomSection[];
}

export interface BotProject {
  id: string;
  title: string;
  subtitle: string;
  status: BotStatus;
  updatedAt: string; // YYYY-MM-DD
  notes: string;
  coverImage?: string;
  externalLinks?: BotLinkEntry[];
  publishedLinks?: BotLinkEntry[];
  template: BotTemplate;
}

export interface SystemPromptPreset {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  systemExtraRules: string[];
  characterExtraRules: string[];
  writingStyle: WritingStyleConfig;
  outputRules: string[];
}

export interface GoalItem {
  id: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  category: string;
  completed: boolean;
}

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  botTitle?: string;
  completed: boolean;
}

export interface StarterTemplate {
  id: string;
  name: string;
  genreLabel: string;
  description: string;
  template: BotTemplate;
}
