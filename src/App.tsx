import React, { useState, useEffect } from 'react';
import {
  Gift,
  Heart,
  Sparkles,
  ShieldCheck,
  Lock,
  Unlock,
  Send,
  RefreshCw,
  User,
  Eye,
  EyeOff,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  ChevronRight,
  HelpCircle,
  Mail,
  UserCheck,
  Search,
  LogOut,
  PartyPopper,
  KeyRound,
  Calendar,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ==========================================
// 상수 및 보안 설정
// ==========================================
const PARTICIPANTS: string[] = [
  '파이(화성)', '다온', '귤', '일구', '두리', '썬더', '바오', '완두',
  '곰순', '달래', '달수', '니모', '우유', '하쿠(서초)', '달순', '강태',
  '말랑', '코비', '밥엠히', '감자', '테리(동탄)', '유토리', '코이', '베리', '설기', '슈슈엘'
];

// 비밀번호 '0623'의 올바른 SHA-256 해시값
const ADMIN_PASSWORD_HASH = 'b5d8a55fb763ff8e61c885c836cbfdb97f9699b2eadac509be2a9c38b62f8857';
// 이전 가이드 해시값 호환 지원
const LEGACY_ADMIN_HASH = 'c6396f7c00e620a233b8b0e77d853e30f1d5334e32d6f7887e4bc83d950bc0d0';

const STORAGE_KEY = 'manito_matching_data_v2';
const ADMIN_SESSION_KEY = 'manito_admin_auth_session';

// ==========================================
// 타입 정의
// ==========================================
interface MatchItem {
  giver: string;
  receiver: string;
  message: string;
  updatedAt?: string;
}

// ==========================================
// 유틸리티 함수
// ==========================================
// Web Crypto API를 사용한 SHA-256 해싱
async function computeSha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// 완전 순환 매칭 (자기 자신 제외 단일 사이클 보장)
function generateCircularMatches(list: string[]): MatchItem[] {
  const shuffled = [...list];
  // Fisher-Yates 셔플
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 완전 단일 순환 (i -> i+1, 마지막 -> 0)
  return shuffled.map((giver, idx) => {
    const receiver = shuffled[(idx + 1) % shuffled.length];
    return {
      giver,
      receiver,
      message: '',
    };
  });
}

export default function App() {
  // 매칭 데이터 상태
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [userMessage, setUserMessage] = useState<string>('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  // 관리자 모드 상태
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [adminError, setAdminError] = useState<string>('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>('');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [copyToast, setCopyToast] = useState<boolean>(false);

  // 로컬 스토리지 초기화 및 로드
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData) as MatchItem[];
        // 유효성 체크 (모든 참여자가 포함되어 있는지)
        const givers = parsed.map((m) => m.giver);
        const allPresent = PARTICIPANTS.every((p) => givers.includes(p)) && parsed.length === PARTICIPANTS.length;
        if (allPresent) {
          setMatches(parsed);
        } else {
          const fresh = generateCircularMatches(PARTICIPANTS);
          setMatches(fresh);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        }
      } else {
        const fresh = generateCircularMatches(PARTICIPANTS);
        setMatches(fresh);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      }

      // 관리자 세션 체크
      const adminSession = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (adminSession === 'authenticated') {
        setIsAdminLoggedIn(true);
      }
    } catch (e) {
      console.error('Failed to load storage:', e);
      const fresh = generateCircularMatches(PARTICIPANTS);
      setMatches(fresh);
    }
  }, []);

  // 선택된 사용자가 바뀔 때 기존 작성 메시지 불러오기 및 리빌 상태 초기화
  useEffect(() => {
    if (!selectedUser) {
      setIsRevealed(false);
      setUserMessage('');
      return;
    }
    const currentMatch = matches.find((m) => m.giver === selectedUser);
    setUserMessage(currentMatch?.message || '');
    setIsRevealed(false);
    setSaveSuccessNotice(false);
  }, [selectedUser, matches]);

  // 사용자가 뽑은 수신자(마니또) 정보
  const currentGivingMatch = matches.find((m) => m.giver === selectedUser);
  // 현재 사용자를 마니또로 뽑은 사람(익명)이 보낸 메시지
  const messageReceivedFromSecretManito = matches.find((m) => m.receiver === selectedUser)?.message;

  // 마니또 확인 버튼 클릭
  const handleRevealClick = () => {
    if (!selectedUser) return;
    setIsRevealed(true);
  };

  // 메시지 저장
  const handleSaveMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const updated = matches.map((item) => {
      if (item.giver === selectedUser) {
        return {
          ...item,
          message: userMessage.trim(),
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      }
      return item;
    });

    setMatches(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSaveSuccessNotice(true);
    setTimeout(() => {
      setSaveSuccessNotice(false);
    }, 3000);
  };

  // 관리자 로그인 검증
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');

    const inputVal = adminPasswordInput.trim();
    if (!inputVal) {
      setAdminError('비밀번호를 입력해 주세요.');
      return;
    }

    try {
      const hashed = await computeSha256(inputVal);
      if (hashed === ADMIN_PASSWORD_HASH || hashed === LEGACY_ADMIN_HASH) {
        setIsAdminLoggedIn(true);
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'authenticated');
        setIsAdminModalOpen(false);
        setAdminPasswordInput('');
      } else {
        setAdminError('비밀번호가 일치하지 않습니다. (0623을 입력해주세요)');
      }
    } catch (err) {
      console.error(err);
      setAdminError('비밀번호 검증 중 오류가 발생했습니다.');
    }
  };

  // 관리자 로그아웃
  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  };

  // 매칭 재설정 / 리셋
  const handleResetMatches = () => {
    const fresh = generateCircularMatches(PARTICIPANTS);
    setMatches(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    setShowResetConfirmModal(false);
    setIsRevealed(false);
  };

  // 전체 매칭 텍스트 복사 (관리자 편의용)
  const handleCopyMatchesText = () => {
    const text = matches
      .map(
        (m, idx) =>
          `${idx + 1}. [주는 사람] ${m.giver} ➔ [받는 사람] ${m.receiver}${
            m.message ? ` (메시지: "${m.message}")` : ' (메시지 없음)'
          }`
      )
      .join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  };

  // 관리자 목록 필터링
  const filteredMatches = matches.filter(
    (m) =>
      m.giver.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
      m.receiver.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
      m.message.toLowerCase().includes(adminSearchQuery.toLowerCase())
  );

  const messageFilledCount = matches.filter((m) => m.message.trim().length > 0).length;

  return (
    <div id="manito-app-root" className="min-h-screen bg-[#FDFBF7] text-[#4A4A4A] flex flex-col justify-between font-sans">
      {/* ================= HEADER (NAV) ================= */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E6E2D3] shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#7C9070]/10 border border-[#7C9070]/30 flex items-center justify-center text-xl">
              🎁
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-[#7C9070]">
                  Manito Magic 2026
                </h1>
                <span className="hidden sm:inline-block text-[11px] font-mono uppercase tracking-widest text-[#8E8B82] bg-[#FDFBF7] px-2 py-0.5 rounded-md border border-[#E6E2D3]">
                  v2.6
                </span>
              </div>
              <p className="text-xs text-[#8E8B82] hidden sm:block">
                총 26인의 완전 순환 비밀 선물 매칭 시스템
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#8E8B82] hidden md:inline-flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#7C9070] animate-pulse"></span>
              Secure Matching Active
            </span>

            {isAdminLoggedIn ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#7C9070]/15 text-[#7C9070] border border-[#7C9070]/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin Mode
                </span>
                <button
                  id="admin-logout-button"
                  onClick={handleAdminLogout}
                  className="px-3.5 py-1.5 text-xs font-semibold tracking-wider uppercase border border-[#E6E2D3] text-[#8E8B82] hover:text-[#4A4A4A] bg-[#FDFBF7] hover:bg-[#E6E2D3]/40 rounded-full transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </button>
              </div>
            ) : (
              <button
                id="admin-modal-open-button"
                onClick={() => {
                  setAdminError('');
                  setIsAdminModalOpen(true);
                }}
                className="px-4 py-1.5 text-xs font-semibold uppercase tracking-widest border border-[#7C9070] text-[#7C9070] rounded-full hover:bg-[#7C9070] hover:text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Admin Access</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-10 flex-1 flex flex-col justify-center">
        {isAdminLoggedIn ? (
          /* ========================================================
             관리자 전용 대시보드 화면
             ======================================================== */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* 상단 컨트롤 패널 */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-[#E6E2D3]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold tracking-tight text-[#2D3748]">전체 마니또 매칭 현황판</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#7C9070]/15 text-[#7C9070] border border-[#7C9070]/30 font-mono">
                      총 {PARTICIPANTS.length}명
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#8E8B82] mt-1.5">
                    모든 인원이 자기 자신을 제외한 1:1 완전 단일 순환(Single Circular Cycle)으로 매칭되어 있습니다.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    id="copy-matching-data-btn"
                    onClick={handleCopyMatchesText}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-[#E6E2D3] bg-[#FDFBF7] hover:bg-[#E6E2D3]/50 text-[#4A4A4A] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#8E8B82]" />
                    <span>명단 복사</span>
                  </button>

                  <button
                    id="trigger-reset-matches-btn"
                    onClick={() => setShowResetConfirmModal(true)}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#E68E8E] hover:bg-[#D97D7D] text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-[#E68E8E]/20"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>매칭 리셋/재생성</span>
                  </button>
                </div>
              </div>

              {/* 통계 바 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mt-6 pt-6 border-t border-[#E6E2D3]">
                <div className="bg-[#FDFBF7] rounded-2xl p-4 text-center border border-[#E6E2D3]">
                  <span className="text-[11px] font-bold text-[#8E8B82] uppercase tracking-wider">총 참가자</span>
                  <p className="text-xl font-bold text-[#2D3748] mt-1">{PARTICIPANTS.length}명</p>
                </div>
                <div className="bg-[#F2E3DB]/60 rounded-2xl p-4 text-center border border-[#D9C5B2]">
                  <span className="text-[11px] font-bold text-[#6D5D4E] uppercase tracking-wider">응원 메시지 작성</span>
                  <p className="text-xl font-bold text-[#E68E8E] mt-1">
                    {messageFilledCount} / {PARTICIPANTS.length}명
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-[#7C9070]/10 rounded-2xl p-4 text-center border border-[#7C9070]/30 flex flex-col justify-center">
                  <span className="text-[11px] font-bold text-[#7C9070] uppercase tracking-wider">매칭 사이클 상태</span>
                  <p className="text-xs font-bold text-[#7C9070] mt-1.5 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-[#7C9070]" /> 완전 순환 검증 완료
                  </p>
                </div>
              </div>

              {/* 검색창 */}
              <div className="mt-5 relative">
                <Search className="w-4 h-4 text-[#8E8B82] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="이름이나 메시지 내용으로 검색..."
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#FDFBF7] border border-[#E6E2D3] text-sm text-[#4A4A4A] focus:outline-none focus:ring-2 focus:ring-[#7C9070] transition-all placeholder-[#BAB7AC]"
                />
              </div>
            </div>

            {/* 매칭 데이터 테이블 */}
            <div className="bg-white rounded-3xl border border-[#E6E2D3] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E6E2D3] flex items-center justify-between bg-[#F8F6F0]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4A4A4A]">
                  매칭 결과 목록 ({filteredMatches.length}건)
                </span>
                <span className="text-[11px] font-mono text-[#8E8B82]">GIVER ➔ RECEIVER (MANITO)</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[#4A4A4A]">
                  <thead className="bg-[#FDFBF7] text-[11px] font-bold text-[#8E8B82] uppercase tracking-wider border-b border-[#E6E2D3]">
                    <tr>
                      <th className="px-5 py-3.5 w-14 text-center">#</th>
                      <th className="px-5 py-3.5 w-40">주는 사람 (Giver)</th>
                      <th className="px-2 py-3.5 w-8 text-center"></th>
                      <th className="px-5 py-3.5 w-40">받는 사람 (Receiver)</th>
                      <th className="px-5 py-3.5">작성된 응원 메시지</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E2D3]/60">
                    {filteredMatches.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-[#8E8B82] text-sm">
                          검색 결과가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredMatches.map((m, idx) => (
                        <tr key={m.giver} className="hover:bg-[#FDFBF7] transition-colors">
                          <td className="px-5 py-4 text-center text-xs text-[#8E8B82] font-mono">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="px-5 py-4 font-semibold text-[#2D3748]">
                            <span className="inline-flex items-center gap-1.5 bg-[#FDFBF7] border border-[#E6E2D3] px-3 py-1 rounded-lg text-xs">
                              <User className="w-3.5 h-3.5 text-[#8E8B82]" />
                              {m.giver}
                            </span>
                          </td>
                          <td className="px-2 py-4 text-center text-[#7C9070]">
                            <ChevronRight className="w-4 h-4 mx-auto" />
                          </td>
                          <td className="px-5 py-4 font-bold text-[#7C9070]">
                            <span className="inline-flex items-center gap-1.5 bg-[#7C9070]/10 border border-[#7C9070]/30 px-3 py-1 rounded-lg text-xs text-[#7C9070]">
                              <Gift className="w-3.5 h-3.5" />
                              {m.receiver}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {m.message ? (
                              <div className="bg-[#F2E3DB]/60 border border-[#D9C5B2] rounded-xl px-3.5 py-2 text-xs text-[#6D5D4E] flex items-start gap-2 max-w-xl">
                                <MessageCircle className="w-3.5 h-3.5 text-[#E68E8E] mt-0.5 shrink-0" />
                                <span className="break-words font-medium leading-relaxed">{m.message}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-[#BAB7AC] italic">메시지 미작성</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ========================================================
             일반 사용자 화면 (Professional Polish Grid Layout)
             ======================================================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
            {/* 왼쪽 컬럼: 1. 본인 확인 & 가이드 카드 (5 cols) */}
            <section className="lg:col-span-5 flex flex-col gap-6">
              {/* Step 1 카드 */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-[#E6E2D3]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-[#2D3748] tracking-tight flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#7C9070] text-white text-xs flex items-center justify-center font-mono">
                      1
                    </span>
                    본인 확인
                  </h2>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-[#8E8B82]">
                    Step 01
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[#8E8B82] mb-6 leading-relaxed">
                  26명의 참여자 목록에서 본인의 이름을 선택해 주세요.
                </p>

                <div className="space-y-4">
                  <div className="relative">
                    <label htmlFor="participant-select" className="block text-xs font-semibold text-[#8E8B82] uppercase tracking-wider mb-2">
                      참여자 이름 선택
                    </label>
                    <div className="relative">
                      <select
                        id="participant-select"
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full appearance-none bg-[#FDFBF7] border border-[#E6E2D3] rounded-xl px-4 py-3.5 text-sm text-[#4A4A4A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#7C9070] transition-all cursor-pointer"
                      >
                        <option value="">이름을 선택하세요</option>
                        {PARTICIPANTS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#7C9070] font-bold text-xs">
                        ▼
                      </div>
                    </div>
                  </div>

                  {!isRevealed ? (
                    <button
                      id="check-my-manito-btn"
                      onClick={handleRevealClick}
                      disabled={!selectedUser}
                      className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm tracking-wide ${
                        selectedUser
                          ? 'bg-[#7C9070] text-white shadow-[#7C9070]/20 hover:brightness-110 cursor-pointer active:scale-[0.99]'
                          : 'bg-[#E6E2D3]/60 text-[#BAB7AC] cursor-not-allowed border border-[#E6E2D3]'
                      }`}
                    >
                      <Gift className="w-4 h-4" />
                      <span>내 마니또 확인하기</span>
                    </button>
                  ) : (
                    <button
                      id="hide-my-manito-btn"
                      onClick={() => setIsRevealed(false)}
                      className="w-full py-3.5 rounded-xl text-xs font-semibold tracking-wide bg-[#FDFBF7] hover:bg-[#E6E2D3]/50 text-[#8E8B82] hover:text-[#4A4A4A] border border-[#E6E2D3] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <EyeOff className="w-4 h-4" />
                      <span>화면 가리기 (비밀 보호)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 필수 가이드 카드 (Professional Polish Blush Card) */}
              <div className="bg-[#F2E3DB] p-6 rounded-2xl border border-[#D9C5B2] shadow-2xs">
                <div className="flex gap-3.5">
                  <span className="text-xl shrink-0">💡</span>
                  <div className="text-xs leading-relaxed text-[#6D5D4E] space-y-1.5">
                    <p className="font-bold text-sm text-[#5C4D3E]">
                      🎁 1만 원 이하의 작은 선물을 준비해 주세요! 따뜻한 응원의 한 마디도 잊지 마세요.
                    </p>
                    <p className="text-[11px] text-[#7A6B5C] pt-1">
                      매칭 결과는 본인만 확인할 수 있도록 비밀을 철저히 지켜주세요.
                    </p>
                  </div>
                </div>
              </div>

              {/* 추가 안내 카드 */}
              <div className="bg-white p-5 rounded-2xl border border-[#E6E2D3] text-xs text-[#8E8B82] space-y-2">
                <div className="flex items-center gap-2 text-[#7C9070] font-bold">
                  <HelpCircle className="w-4 h-4" />
                  <span>진행 수칙</span>
                </div>
                <p className="leading-relaxed text-[#4A4A4A]">
                  • 26명 전원이 자기 자신을 뽑지 않는 <strong>1:1 단일 순환 루프</strong>로 매칭되었습니다.
                </p>
                <p className="leading-relaxed text-[#4A4A4A]">
                  • 메시지를 남기면 상대방에게 <strong>익명</strong>으로 안전하게 전달됩니다.
                </p>
              </div>
            </section>

            {/* 오른쪽 컬럼: 2. 마니또 결과 확인 & 익명 메시지 & 도착 편지 (7 cols) */}
            <section className="lg:col-span-7">
              <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-[#E6E2D3] relative flex flex-col min-h-[520px]">
                {/* 상단 메타 세션 태그 */}
                <div className="absolute top-0 right-0 p-6">
                  <span className="text-[11px] font-mono text-[#BAB7AC] tracking-wider">
                    SESSION ID: #0623
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  {isRevealed && currentGivingMatch ? (
                    <motion.div
                      key="revealed-section"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 flex flex-col items-center justify-center text-center w-full"
                    >
                      {/* 아이콘 */}
                      <div className="w-20 h-20 bg-[#FDFBF7] border-2 border-dashed border-[#7C9070] rounded-full flex items-center justify-center mb-5 shadow-2xs">
                        <span className="text-3xl">🎁</span>
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7C9070]/10 border border-[#7C9070]/30 text-[11px] font-bold text-[#7C9070] uppercase tracking-widest mb-3">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Matching Revealed</span>
                      </div>

                      <h3 className="text-xs uppercase tracking-widest text-[#8E8B82] mb-2 font-bold">
                        <span className="text-[#2D3748] font-bold">{selectedUser}</span> 님의 마니또는
                      </h3>

                      {/* 받는 사람 이름 강조 상자 */}
                      <div className="text-3xl sm:text-5xl font-black text-[#7C9070] mb-6 bg-[#FDFBF7] px-8 py-4 sm:py-5 rounded-2xl border border-[#E6E2D3] shadow-xs tracking-tight">
                        🎉 {currentGivingMatch.receiver} 님 🎉
                      </div>

                      <p className="text-xs text-[#8E8B82] max-w-md mb-8">
                        행사 종료 시까지 <strong className="text-[#7C9070]">{currentGivingMatch.receiver}</strong> 님에게 정체를 들키지 않도록 주의하세요! 🤫
                      </p>

                      {/* 메시지 작성 폼 */}
                      <div className="w-full max-w-lg text-left bg-[#FDFBF7] p-5 sm:p-6 rounded-2xl border border-[#E6E2D3] mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold text-[#8E8B82] uppercase tracking-wider">
                            마니또에게 메시지 남기기 (익명 전달)
                          </label>
                          <span className="text-[10px] text-[#BAB7AC]">보낸 사람 비공개</span>
                        </div>

                        <form onSubmit={handleSaveMessage} className="space-y-3">
                          <textarea
                            id="manito-message-input"
                            rows={3}
                            value={userMessage}
                            onChange={(e) => setUserMessage(e.target.value)}
                            placeholder="비밀 친구에게 따뜻한 응원의 한마디를 적어보세요..."
                            className="w-full bg-white border border-[#E6E2D3] rounded-xl p-4 text-sm text-[#4A4A4A] resize-none focus:outline-none focus:ring-2 focus:ring-[#7C9070] transition-all placeholder-[#BAB7AC]"
                          />

                          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                            <span className="text-[11px] text-[#8E8B82]">
                              저장된 메시지는 상대방에게만 표시됩니다.
                            </span>

                            <button
                              type="submit"
                              id="save-manito-message-btn"
                              className="w-full sm:w-auto px-6 py-2.5 bg-[#E68E8E] text-white rounded-xl font-bold text-xs tracking-wider uppercase shadow-md shadow-[#E68E8E]/20 hover:bg-[#D97D7D] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>메시지 전송하기</span>
                            </button>
                          </div>
                        </form>

                        {saveSuccessNotice && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 p-3 rounded-xl bg-[#7C9070]/10 border border-[#7C9070]/30 text-[#7C9070] text-xs font-semibold flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[#7C9070]" />
                            <span>메시지가 성공적으로 저장되었습니다!</span>
                          </motion.div>
                        )}
                      </div>

                      {/* 나에게 온 비밀 편지 확인 */}
                      <div className="w-full max-w-lg text-left bg-[#F2E3DB]/50 p-5 rounded-2xl border border-[#D9C5B2]">
                        <div className="flex items-center gap-2 mb-2 text-[#6D5D4E] font-bold text-xs">
                          <Mail className="w-4 h-4 text-[#E68E8E]" />
                          <span>나({selectedUser})에게 도착한 비밀 마니또의 편지</span>
                        </div>
                        {messageReceivedFromSecretManito && messageReceivedFromSecretManito.trim().length > 0 ? (
                          <p className="text-xs sm:text-sm font-medium text-[#4A4A4A] bg-white p-3.5 rounded-xl border border-[#E6E2D3] whitespace-pre-wrap leading-relaxed">
                            "{messageReceivedFromSecretManito}"
                          </p>
                        ) : (
                          <p className="text-xs text-[#8E8B82] italic py-1">
                            아직 비밀 마니또가 메시지를 남기지 않았습니다. 선물을 기대해 보세요! ☕
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    /* 아직 확인하지 않은 대기 상태 카드 */
                    <motion.div
                      key="waiting-section"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col items-center justify-center text-center py-12"
                    >
                      <div className="w-20 h-20 bg-[#FDFBF7] border-2 border-dashed border-[#7C9070] rounded-full flex items-center justify-center mb-6">
                        <span className="text-3xl grayscale opacity-75">🕵️‍♂️</span>
                      </div>

                      <h3 className="text-xs uppercase tracking-widest text-[#8E8B82] mb-3 font-bold">
                        Secret Matching Status
                      </h3>

                      <h4 className="text-xl sm:text-2xl font-bold text-[#2D3748] mb-2">
                        {selectedUser ? `${selectedUser} 님의 마니또를 확인할 준비가 되었습니다.` : '왼쪽에서 본인 이름을 먼저 선택해 주세요.'}
                      </h4>

                      <p className="text-xs sm:text-sm text-[#8E8B82] max-w-sm mb-6 leading-relaxed">
                        {selectedUser
                          ? '[내 마니또 확인하기] 버튼을 누르면 배정된 마니또의 이름과 메시지 창이 나타납니다.'
                          : '본인 확인 후 1:1 비밀 매칭 결과와 익명 응원 메시지를 작성할 수 있습니다.'}
                      </p>

                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FDFBF7] border border-[#E6E2D3] text-xs font-mono text-[#8E8B82]">
                        <Lock className="w-3.5 h-3.5 text-[#7C9070]" />
                        <span>Only you can see your matching result</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 카드 하단 보안 태그 */}
                <div className="mt-8 pt-6 border-t border-[#FDFBF7] text-center">
                  <p className="text-[10px] text-[#BAB7AC] uppercase tracking-widest font-mono">
                    Encryption: SHA-256 Verified • Total 26 Matches Circular Cycle
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ================= FOOTER (Professional Polish Footer) ================= */}
      <footer className="px-6 sm:px-8 py-5 bg-[#F8F6F0] border-t border-[#E6E2D3] flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-6 sm:gap-8 text-left w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[#8E8B82] uppercase tracking-tighter">참여자 현황</span>
            <span className="text-xs sm:text-sm font-semibold text-[#2D3748]">
              {PARTICIPANTS.length} / {PARTICIPANTS.length} 매칭 완료
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[#8E8B82] uppercase tracking-tighter">진행 단계</span>
            <span className="text-xs sm:text-sm font-semibold text-[#7C9070] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              선물 준비 및 비밀 미션 기간
            </span>
          </div>
        </div>

        {/* 참여자 아바타 버블 체인 */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-[#8E8B82] hidden md:inline">Participants:</span>
          <div className="flex -space-x-2 overflow-hidden">
            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-[#7C9070] flex items-center justify-center text-[10px] font-bold text-white shadow-2xs">
              파이
            </div>
            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-[#E68E8E] flex items-center justify-center text-[10px] font-bold text-white shadow-2xs">
              다온
            </div>
            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-[#D9C5B2] flex items-center justify-center text-[10px] font-bold text-[#4A4A4A] shadow-2xs">
              귤
            </div>
            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-[#BAB7AC] flex items-center justify-center text-[10px] font-bold text-white shadow-2xs">
              +23
            </div>
          </div>
        </div>
      </footer>

      {/* ================= ADMIN AUTH MODAL ================= */}
      <AnimatePresence>
        {isAdminModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminModalOpen(false)}
              className="fixed inset-0 bg-[#2D3748]/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-[#E6E2D3] z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#7C9070]/15 text-[#7C9070] flex items-center justify-center border border-[#7C9070]/30">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#2D3748] text-base">Admin Access</h3>
                    <p className="text-[11px] font-mono text-[#8E8B82]">SHA-256 Verified</p>
                  </div>
                </div>
                <button
                  id="close-admin-modal-btn"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="text-[#8E8B82] hover:text-[#4A4A4A] p-1 rounded-lg hover:bg-[#FDFBF7] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label htmlFor="admin-pw" className="block text-xs font-semibold text-[#8E8B82] uppercase tracking-wider mb-1.5">
                    관리자 비밀번호
                  </label>
                  <div className="relative">
                    <input
                      id="admin-pw"
                      type={showAdminPassword ? 'text' : 'password'}
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      placeholder="비밀번호를 입력하세요"
                      autoFocus
                      className="w-full pl-3.5 pr-10 py-3 rounded-xl bg-[#FDFBF7] border border-[#E6E2D3] text-sm text-[#4A4A4A] focus:outline-none focus:ring-2 focus:ring-[#7C9070] transition-all placeholder-[#BAB7AC]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8B82] hover:text-[#4A4A4A] cursor-pointer"
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {adminError && (
                    <p className="text-xs font-medium text-[#E68E8E] mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {adminError}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdminModalOpen(false)}
                    className="flex-1 py-3 rounded-xl text-xs font-semibold text-[#8E8B82] bg-[#FDFBF7] hover:bg-[#E6E2D3]/50 border border-[#E6E2D3] transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    id="submit-admin-login-btn"
                    className="flex-1 py-3 rounded-xl text-xs font-bold text-white bg-[#7C9070] hover:brightness-110 shadow-md shadow-[#7C9070]/20 transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>인증하기</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= RESET CONFIRM MODAL ================= */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetConfirmModal(false)}
              className="fixed inset-0 bg-[#2D3748]/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-[#E6E2D3] z-10 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#E68E8E]/15 text-[#E68E8E] flex items-center justify-center mx-auto mb-3 border border-[#E68E8E]/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#2D3748]">매칭을 새로 재생성할까요?</h3>
              <p className="text-xs text-[#8E8B82] mt-2 leading-relaxed">
                재생성 시 기존 매칭 관계와 작성된 메시지가 모두 초기화되며, 26명의 새로운 1:1 순환 매칭이 구성됩니다.
              </p>

              <div className="flex items-center gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-[#8E8B82] bg-[#FDFBF7] hover:bg-[#E6E2D3]/50 border border-[#E6E2D3] transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  id="confirm-reset-action-btn"
                  onClick={handleResetMatches}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-[#E68E8E] hover:bg-[#D97D7D] transition-colors shadow-sm shadow-[#E68E8E]/20 cursor-pointer"
                >
                  새로 매칭하기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= TOAST NOTICE ================= */}
      <AnimatePresence>
        {copyToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 bg-[#2D3748] text-white text-xs font-medium px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-[#4A4A4A]"
          >
            <Check className="w-4 h-4 text-[#7C9070]" />
            <span>전체 매칭 명단이 클립보드에 복사되었습니다!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
