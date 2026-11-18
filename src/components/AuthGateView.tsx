import { type FormEvent, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Lock,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { auth, FIREBASE_PROJECT_ID, googleProvider } from '../firebase';
import { ensureUserWorkspaceInitialized } from '../services/workspaceFirestore';
import {
  mapFirebaseAuthError,
  validateSignInForm,
  validateSignUpForm,
} from '../utils/authValidation';

type AuthMode = 'login' | 'signup';

export function AuthGateView() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginId, setLoginId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsEmailSetup, setNeedsEmailSetup] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMsg(null);
    setNeedsEmailSetup(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNeedsEmailSetup(false);

    if (mode === 'login') {
      const check = validateSignInForm({ loginId, password });
      if (!check.ok) {
        setErrorMsg(check.error ?? '입력 값을 확인해 주세요.');
        return;
      }

      setIsSubmitting(true);
      try {
        const credential = await signInWithEmailAndPassword(auth, check.email, password);
        await ensureUserWorkspaceInitialized(credential.user, check.displayId);
      } catch (err) {
        const mapped = mapFirebaseAuthError(err);
        setErrorMsg(mapped.message);
        setNeedsEmailSetup(mapped.needsEmailProviderSetup);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const check = validateSignUpForm({
      loginId,
      displayName,
      password,
      confirmPassword,
    });
    if (!check.ok) {
      setErrorMsg(check.error ?? '입력 값을 확인해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, check.email, password);
      if (check.displayName) {
        await updateProfile(credential.user, { displayName: check.displayName });
      }
      await ensureUserWorkspaceInitialized(credential.user, check.displayId, check.displayName);
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      setErrorMsg(mapped.message);
      setNeedsEmailSetup(mapped.needsEmailProviderSetup);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setNeedsEmailSetup(false);
    setIsSubmitting(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await ensureUserWorkspaceInitialized(credential.user);
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      setErrorMsg(mapped.message);
      setNeedsEmailSetup(mapped.needsEmailProviderSetup);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f7f2] text-[#1b2b21] flex flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        {/* Header / Brand Lock Notice */}
        <div className="text-center space-y-2.5">
          <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#c3d8c1] bg-[#e8f0e6] text-[#2d573b]">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#1b2b21]">파인애플작업실</h1>
          <p className="text-xs leading-relaxed text-[#496051]">
            개인 AI 캐릭터봇 설정과 프롬프트 정보 유출을 방지하기 위해
            <br />
            로그인 또는 회원가입 후 메인 작업실에 입장할 수 있습니다.
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl border border-[#d1dfd0] bg-white p-6 space-y-5">
          {/* Login / Signup Tabs */}
          <div
            role="tablist"
            aria-label="계정 인증 탭"
            className="grid grid-cols-2 rounded-xl border border-[#d1dfd0] bg-[#f8fbf8] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-[#3b6e4c] text-white'
                  : 'text-[#496051] hover:text-[#1b2b21]'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              로그인
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => switchMode('signup')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
                mode === 'signup'
                  ? 'bg-[#3b6e4c] text-white'
                  : 'text-[#496051] hover:text-[#1b2b21]'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              회원가입
            </button>
          </div>

          {/* Inline Error Alert */}
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-[#d9a6a6] bg-[#fdf5f5] p-3 text-xs leading-relaxed text-[#7c2d2d] space-y-2"
            >
              <p>{errorMsg}</p>
              {needsEmailSetup && (
                <a
                  href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#2d573b] underline underline-offset-2 hover:text-[#1b2b21]"
                >
                  Firebase 콘솔에서 이메일/비밀번호 제공업체 열기
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* ID & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <div>
              <label
                htmlFor="auth-login-id"
                className="mb-1.5 block text-xs font-semibold text-[#2d573b]"
              >
                아이디 또는 이메일
              </label>
              <input
                id="auth-login-id"
                type="text"
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="예: pineapple_01 또는 name@example.com"
                className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] placeholder:text-[#7c9383] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
              />
              {mode === 'signup' && (
                <p className="mt-1 text-[11px] text-[#687e6f]">
                  아이디만 입력할 경우 영문, 숫자, 마침표(.), 밑줄(_), 하이픈(-) 3~32자를 사용할 수 있습니다.
                </p>
              )}
            </div>

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="mb-1.5 block text-xs font-semibold text-[#2d573b]"
                >
                  작업실 표시 이름 (선택)
                </label>
                <input
                  id="auth-display-name"
                  type="text"
                  autoComplete="nickname"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="비워 두면 아이디가 표시됩니다"
                  className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] placeholder:text-[#7c9383] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-password"
                className="mb-1.5 block text-xs font-semibold text-[#2d573b]"
              >
                비밀번호
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? '6자 이상의 비밀번호' : '비밀번호 입력'}
                  className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] py-2 pl-3 pr-10 text-sm text-[#1b2b21] placeholder:text-[#7c9383] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#687e6f] hover:text-[#1b2b21]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="mb-1.5 block text-xs font-semibold text-[#2d573b]"
                >
                  비밀번호 확인
                </label>
                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호를 한 번 더 입력"
                  className="w-full rounded-lg border border-[#d1dfd0] bg-[#f8fbf8] px-3 py-2 text-sm text-[#1b2b21] placeholder:text-[#7c9383] focus:border-[#3b6e4c] focus:bg-white focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#3b6e4c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2d573b] disabled:opacity-60 transition-colors"
            >
              {isSubmitting
                ? '인증 확인 중...'
                : mode === 'login'
                  ? '아이디로 로그인'
                  : '회원가입 후 작업실 입장'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center py-0.5">
            <div className="flex-grow border-t border-[#e5ede4]" />
            <span className="mx-3 shrink-0 text-[11px] font-medium text-[#687e6f]">또는</span>
            <div className="flex-grow border-t border-[#e5ede4]" />
          </div>

          {/* Google Sign-in Option */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleGoogleSignIn}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#b6cab4] bg-[#f8fbf8] px-4 py-2.5 text-xs font-semibold text-[#1b2b21] hover:bg-[#e8f0e6] disabled:opacity-60 transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-[#3b6e4c]" />
            Google 계정으로 계속하기
          </button>
        </div>

        <p className="text-center text-[11px] leading-relaxed text-[#687e6f]">
          로그인된 계정의 데이터만 본인 전용 공간에 암호화되어 저장되며,
          <br />
          로그아웃 시 브라우저 화면의 작업 내역은 즉시 잠깁니다.
        </p>
      </div>
    </div>
  );
}
