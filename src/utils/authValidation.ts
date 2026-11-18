const SYNTHETIC_ID_DOMAIN = 'pineapple-studio.app';

export interface NormalizedLoginIdResult {
  ok: boolean;
  email: string;
  displayId: string;
  error?: string;
}

export interface AuthValidationResult {
  ok: boolean;
  email: string;
  displayId: string;
  displayName: string;
  error?: string;
}

export interface AuthErrorInfo {
  message: string;
  needsEmailProviderSetup: boolean;
}

export function normalizeLoginIdToEmail(rawLoginId: string): NormalizedLoginIdResult {
  const trimmed = rawLoginId.trim();
  if (!trimmed) {
    return {
      ok: false,
      email: '',
      displayId: '',
      error: '아이디 또는 이메일을 입력해 주세요.',
    };
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes('@')) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(lower) || lower.length > 160) {
      return {
        ok: false,
        email: '',
        displayId: '',
        error: '올바른 이메일 주소를 입력해 주세요.',
      };
    }
    return {
      ok: true,
      email: lower,
      displayId: lower,
    };
  }

  const idPattern = /^[a-zA-Z0-9._-]{3,32}$/;
  if (!idPattern.test(trimmed)) {
    return {
      ok: false,
      email: '',
      displayId: '',
      error: '아이디는 영문, 숫자, 마침표(.), 밑줄(_), 하이픈(-) 조합 3~32자로 입력해 주세요.',
    };
  }

  return {
    ok: true,
    email: `${lower}@${SYNTHETIC_ID_DOMAIN}`,
    displayId: lower,
  };
}

export function validateSignInForm(input: {
  loginId: string;
  password: string;
}): AuthValidationResult {
  const normalized = normalizeLoginIdToEmail(input.loginId);
  if (!normalized.ok) {
    return {
      ok: false,
      email: '',
      displayId: '',
      displayName: '',
      error: normalized.error,
    };
  }

  if (!input.password) {
    return {
      ok: false,
      email: '',
      displayId: '',
      displayName: '',
      error: '비밀번호를 입력해 주세요.',
    };
  }

  return {
    ok: true,
    email: normalized.email,
    displayId: normalized.displayId,
    displayName: normalized.displayId.split('@')[0],
  };
}

export function validateSignUpForm(input: {
  loginId: string;
  displayName?: string;
  password: string;
  confirmPassword: string;
}): AuthValidationResult {
  const normalized = normalizeLoginIdToEmail(input.loginId);
  if (!normalized.ok) {
    return {
      ok: false,
      email: '',
      displayId: '',
      displayName: '',
      error: normalized.error,
    };
  }

  if (input.password.length < 6) {
    return {
      ok: false,
      email: '',
      displayId: '',
      displayName: '',
      error: '비밀번호는 보안을 위해 6자 이상 입력해 주세요.',
    };
  }

  if (input.password.length > 128) {
    return {
      ok: false,
      email: '',
      displayId: '',
      displayName: '',
      error: '비밀번호는 128자 이하로 입력해 주세요.',
    };
  }

  if (input.password !== input.confirmPassword) {
    return {
      ok: false,
      email: '',
      displayId: '',
      displayName: '',
      error: '비밀번호와 비밀번호 확인이 일치하지 않습니다.',
    };
  }

  const trimmedName = (input.displayName ?? '').trim();
  const fallbackName = normalized.displayId.split('@')[0];
  const resolvedDisplayName = (trimmedName || fallbackName).slice(0, 60);

  return {
    ok: true,
    email: normalized.email,
    displayId: normalized.displayId,
    displayName: resolvedDisplayName,
  };
}

export function mapFirebaseAuthError(error: unknown): AuthErrorInfo {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return {
        message:
          'Firebase 콘솔에서 이메일/비밀번호 로그인 제공업체가 아직 활성화되지 않았습니다. 아래 안내에 따라 활성화하거나 Google 계정 로그인을 이용해 주세요.',
        needsEmailProviderSetup: true,
      };
    case 'auth/email-already-in-use':
      return {
        message: '이미 등록된 아이디 또는 이메일입니다. 로그인 탭에서 접속해 주세요.',
        needsEmailProviderSetup: false,
      };
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        message: '아이디(이메일) 또는 비밀번호가 올바르지 않습니다.',
        needsEmailProviderSetup: false,
      };
    case 'auth/weak-password':
      return {
        message: '비밀번호는 6자 이상으로 더 안전하게 설정해 주세요.',
        needsEmailProviderSetup: false,
      };
    case 'auth/too-many-requests':
      return {
        message: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        needsEmailProviderSetup: false,
      };
    case 'auth/popup-closed-by-user':
      return {
        message: 'Google 로그인 창이 닫혔습니다. 다시 시도해 주세요.',
        needsEmailProviderSetup: false,
      };
    case 'auth/popup-blocked':
      return {
        message: '브라우저 팝업이 차단되었습니다. 팝업 차단을 해제한 뒤 다시 시도해 주세요.',
        needsEmailProviderSetup: false,
      };
    case 'auth/network-request-failed':
      return {
        message: '네트워크 연결이 원활하지 않습니다. 연결 상태를 확인해 주세요.',
        needsEmailProviderSetup: false,
      };
    default:
      return {
        message:
          error instanceof Error && error.message
            ? `인증 처리 중 오류가 발생했습니다. (${code || error.message})`
            : '인증 처리 중 오류가 발생했습니다.',
        needsEmailProviderSetup: false,
      };
  }
}

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}
