import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  DEFAULT_DAILY_PLEDGE,
  INITIAL_BOT_PROJECTS,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_GOALS,
  INITIAL_PRESETS,
} from '../data/seedData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  BotProject,
  CalendarEvent,
  GoalItem,
  SystemPromptPreset,
} from '../types/bot';
import { stripUndefinedDeep } from '../utils/authValidation';

function clampString(value: string | undefined, maxLength: number): string {
  return (value ?? '').slice(0, maxLength);
}

function serializeBotPayload(uid: string, bot: BotProject) {
  const base: Record<string, unknown> = {
    ownerId: uid,
    id: bot.id,
    title: clampString(bot.title || '이름 없는 캐릭터봇', 120),
    subtitle: clampString(bot.subtitle, 160),
    status: bot.status,
    updatedAt: clampString(bot.updatedAt, 20),
    notes: clampString(bot.notes, 2000),
    template: stripUndefinedDeep(bot.template),
    syncedAt: serverTimestamp(),
  };

  if (bot.coverImage) {
    base.coverImage = clampString(bot.coverImage, 400000);
  }
  if (bot.externalLinks) {
    base.externalLinks = stripUndefinedDeep(bot.externalLinks.slice(0, 30));
  }
  if (bot.publishedLinks) {
    base.publishedLinks = stripUndefinedDeep(bot.publishedLinks.slice(0, 30));
  }
  return base;
}

function serializeGoalPayload(uid: string, goal: GoalItem) {
  return {
    ownerId: uid,
    id: goal.id,
    title: clampString(goal.title || '새 목표', 200),
    category: clampString(goal.category, 60),
    targetDate: clampString(goal.targetDate, 20),
    completed: Boolean(goal.completed),
    syncedAt: serverTimestamp(),
  };
}

function serializeCalendarEventPayload(uid: string, event: CalendarEvent) {
  const payload: Record<string, unknown> = {
    ownerId: uid,
    id: event.id,
    date: clampString(event.date, 20),
    title: clampString(event.title || '새 일정', 200),
    completed: Boolean(event.completed),
    syncedAt: serverTimestamp(),
  };
  if (event.botTitle) {
    payload.botTitle = clampString(event.botTitle, 128);
  }
  return payload;
}

function serializePresetPayload(uid: string, preset: SystemPromptPreset) {
  return {
    ownerId: uid,
    id: preset.id,
    name: clampString(preset.name || '새 프리셋', 120),
    description: clampString(preset.description, 400),
    createdAt: clampString(preset.createdAt, 20),
    systemExtraRules: preset.systemExtraRules.slice(0, 30),
    characterExtraRules: preset.characterExtraRules.slice(0, 30),
    writingStyle: stripUndefinedDeep(preset.writingStyle),
    outputRules: preset.outputRules.slice(0, 30),
    syncedAt: serverTimestamp(),
  };
}

export async function ensureUserWorkspaceInitialized(
  user: User,
  loginIdOverride?: string,
  displayNameOverride?: string,
): Promise<void> {
  const uid = user.uid;
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let userExists = false;
  try {
    const snap = await getDoc(userRef);
    userExists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!userExists) {
    const rawLogin =
      loginIdOverride ??
      user.email ??
      user.displayName ??
      uid;
    const rawName =
      displayNameOverride ??
      user.displayName ??
      rawLogin.split('@')[0] ??
      '작가';

    try {
      await setDoc(userRef, {
        uid,
        loginId: clampString(rawLogin, 160),
        displayName: clampString(rawName || '작가', 60),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
  }

  const settingsPath = `users/${uid}/settings/workspace`;
  const settingsRef = doc(db, 'users', uid, 'settings', 'workspace');
  let settingsExists = false;
  try {
    const settingsSnap = await getDoc(settingsRef);
    settingsExists = settingsSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, settingsPath);
  }

  if (!settingsExists) {
    try {
      const batch = writeBatch(db);
      batch.set(settingsRef, {
        ownerId: uid,
        dailyPledge: DEFAULT_DAILY_PLEDGE,
        activeBotId: INITIAL_BOT_PROJECTS[0].id,
        syncedAt: serverTimestamp(),
      });

      for (const bot of INITIAL_BOT_PROJECTS) {
        batch.set(doc(db, 'users', uid, 'bots', bot.id), serializeBotPayload(uid, bot));
      }
      for (const goal of INITIAL_GOALS) {
        batch.set(doc(db, 'users', uid, 'goals', goal.id), serializeGoalPayload(uid, goal));
      }
      for (const ev of INITIAL_CALENDAR_EVENTS) {
        batch.set(
          doc(db, 'users', uid, 'calendarEvents', ev.id),
          serializeCalendarEventPayload(uid, ev),
        );
      }
      for (const preset of INITIAL_PRESETS) {
        batch.set(
          doc(db, 'users', uid, 'presets', preset.id),
          serializePresetPayload(uid, preset),
        );
      }

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, settingsPath);
    }
  }
}

export interface WorkspaceSnapshotHandlers {
  onBots: (bots: BotProject[]) => void;
  onGoals: (goals: GoalItem[]) => void;
  onCalendarEvents: (events: CalendarEvent[]) => void;
  onPresets: (presets: SystemPromptPreset[]) => void;
  onSettings: (settings: { dailyPledge: string; activeBotId: string }) => void;
  onError: (err: Error) => void;
}

export function subscribeUserWorkspace(
  uid: string,
  handlers: WorkspaceSnapshotHandlers,
): Unsubscribe {
  const safeError = (error: unknown, op: OperationType, path: string) => {
    try {
      handleFirestoreError(error, op, path);
    } catch (wrapped) {
      handlers.onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  };

  const settingsPath = `users/${uid}/settings/workspace`;
  const unsubSettings = onSnapshot(
    doc(db, 'users', uid, 'settings', 'workspace'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        handlers.onSettings({
          dailyPledge:
            typeof data.dailyPledge === 'string' ? data.dailyPledge : DEFAULT_DAILY_PLEDGE,
          activeBotId: typeof data.activeBotId === 'string' ? data.activeBotId : '',
        });
      }
    },
    (error) => safeError(error, OperationType.GET, settingsPath),
  );

  const botsPath = `users/${uid}/bots`;
  const unsubBots = onSnapshot(
    query(collection(db, 'users', uid, 'bots'), where('ownerId', '==', uid)),
    (snap) => {
      const items = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: String(raw.id ?? d.id),
          title: String(raw.title ?? ''),
          subtitle: String(raw.subtitle ?? ''),
          status: raw.status,
          updatedAt: String(raw.updatedAt ?? ''),
          notes: String(raw.notes ?? ''),
          coverImage: typeof raw.coverImage === 'string' ? raw.coverImage : undefined,
          externalLinks: Array.isArray(raw.externalLinks) ? raw.externalLinks : undefined,
          publishedLinks: Array.isArray(raw.publishedLinks) ? raw.publishedLinks : undefined,
          template: raw.template,
        } as BotProject;
      });
      items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      handlers.onBots(items);
    },
    (error) => safeError(error, OperationType.LIST, botsPath),
  );

  const goalsPath = `users/${uid}/goals`;
  const unsubGoals = onSnapshot(
    query(collection(db, 'users', uid, 'goals'), where('ownerId', '==', uid)),
    (snap) => {
      const items = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: String(raw.id ?? d.id),
          title: String(raw.title ?? ''),
          category: String(raw.category ?? ''),
          targetDate: String(raw.targetDate ?? ''),
          completed: Boolean(raw.completed),
        } as GoalItem;
      });
      handlers.onGoals(items);
    },
    (error) => safeError(error, OperationType.LIST, goalsPath),
  );

  const eventsPath = `users/${uid}/calendarEvents`;
  const unsubEvents = onSnapshot(
    query(collection(db, 'users', uid, 'calendarEvents'), where('ownerId', '==', uid)),
    (snap) => {
      const items = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: String(raw.id ?? d.id),
          date: String(raw.date ?? ''),
          title: String(raw.title ?? ''),
          botTitle: typeof raw.botTitle === 'string' ? raw.botTitle : undefined,
          completed: Boolean(raw.completed),
        } as CalendarEvent;
      });
      handlers.onCalendarEvents(items);
    },
    (error) => safeError(error, OperationType.LIST, eventsPath),
  );

  const presetsPath = `users/${uid}/presets`;
  const unsubPresets = onSnapshot(
    query(collection(db, 'users', uid, 'presets'), where('ownerId', '==', uid)),
    (snap) => {
      const items = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: String(raw.id ?? d.id),
          name: String(raw.name ?? ''),
          description: String(raw.description ?? ''),
          createdAt: String(raw.createdAt ?? ''),
          systemExtraRules: Array.isArray(raw.systemExtraRules) ? raw.systemExtraRules : [],
          characterExtraRules: Array.isArray(raw.characterExtraRules)
            ? raw.characterExtraRules
            : [],
          writingStyle: raw.writingStyle,
          outputRules: Array.isArray(raw.outputRules) ? raw.outputRules : [],
        } as SystemPromptPreset;
      });
      handlers.onPresets(items);
    },
    (error) => safeError(error, OperationType.LIST, presetsPath),
  );

  return () => {
    unsubSettings();
    unsubBots();
    unsubGoals();
    unsubEvents();
    unsubPresets();
  };
}

export async function saveWorkspaceSettingsDoc(
  uid: string,
  settings: { dailyPledge: string; activeBotId: string },
): Promise<void> {
  const path = `users/${uid}/settings/workspace`;
  try {
    await setDoc(doc(db, 'users', uid, 'settings', 'workspace'), {
      ownerId: uid,
      dailyPledge: clampString(settings.dailyPledge, 500),
      activeBotId: clampString(settings.activeBotId, 128),
      syncedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertBotDoc(uid: string, bot: BotProject): Promise<void> {
  const path = `users/${uid}/bots/${bot.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'bots', bot.id), serializeBotPayload(uid, bot));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBotDoc(uid: string, botId: string): Promise<void> {
  const path = `users/${uid}/bots/${botId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'bots', botId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertGoalDoc(uid: string, goal: GoalItem): Promise<void> {
  const path = `users/${uid}/goals/${goal.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'goals', goal.id), serializeGoalPayload(uid, goal));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteGoalDoc(uid: string, goalId: string): Promise<void> {
  const path = `users/${uid}/goals/${goalId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'goals', goalId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertCalendarEventDoc(uid: string, event: CalendarEvent): Promise<void> {
  const path = `users/${uid}/calendarEvents/${event.id}`;
  try {
    await setDoc(
      doc(db, 'users', uid, 'calendarEvents', event.id),
      serializeCalendarEventPayload(uid, event),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCalendarEventDoc(uid: string, eventId: string): Promise<void> {
  const path = `users/${uid}/calendarEvents/${eventId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'calendarEvents', eventId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertPresetDoc(uid: string, preset: SystemPromptPreset): Promise<void> {
  const path = `users/${uid}/presets/${preset.id}`;
  try {
    await setDoc(
      doc(db, 'users', uid, 'presets', preset.id),
      serializePresetPayload(uid, preset),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePresetDoc(uid: string, presetId: string): Promise<void> {
  const path = `users/${uid}/presets/${presetId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'presets', presetId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
