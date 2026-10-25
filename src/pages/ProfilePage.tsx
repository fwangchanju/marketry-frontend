import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import AuthProviderIcon from '@/components/AuthProviderIcon'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import PageInfoPanel from '@/components/PageInfoPanel'
import PageMainFrame from '@/components/PageMainFrame'
import ScreenshotModal from '@/components/ScreenshotModal'
import Spinner from '@/components/Spinner'
import ProfileAvatar from '@/components/ProfileAvatar'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import { InfoPageHeading } from '@/components/InfoDocument'
import { useLeaveToEntryPage } from '@/hooks/useLeaveToEntryPage'
import { useLoginGate } from '@/hooks/useLoginGate'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useCheckNickname, useDeleteProfileImage, useUpdateNickname, useUploadProfileImage } from '@/hooks/useProfile'
import { useLogout, useSession, useWithdrawAccount } from '@/hooks/useSession'
import { appConfirm } from '@/utils/appDialogBus'
import { displayEmail } from '@/utils/displayEmail'
import { checkProfileImageFile, resizeProfileImage, PROFILE_IMAGE_MAX_UPLOAD_BYTES } from '@/utils/resizeProfileImage'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'

const NICKNAME_MAX_LENGTH = 12
const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9]{2,12}$/
// 입력하는 동안 바로 알려 주는 제한 사유(빨간 글자) — 문제가 없으면 null.
function nicknameProblem(value: string): string | null {
  const nickname = value.normalize('NFC').trim()
  if (!nickname) return null
  if (/[^가-힣A-Za-z0-9]/.test(nickname)) return '한글, 영문, 숫자만 사용할 수 있습니다.'
  if (nickname.length < 2) return '2자 이상 입력해 주세요.'
  return null
}
const NICKNAME_CHANGE_LIMITED_CODE = 'PROFILE_NICKNAME_CHANGE_LIMITED'
const NICKNAME_RESERVED_CODE = 'PROFILE_NICKNAME_RESERVED'
// 닉네임을 다시 바꿀 수 있게 되는 시각을 "10월 23일 오후 2시"처럼 한국 시간으로 적는다.
function formatChangeableAt(epochMillis: number): string {
  return new Date(epochMillis).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', timeZone: 'Asia/Seoul' })
}
const NICKNAME_RULE_MESSAGE = '닉네임은 2~12자의 한글, 영문, 숫자만 사용할 수 있습니다.'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { data: session, isLoading, isError, refetch } = useSession()
  const { requireLogin } = useLoginGate()
  const leaveToEntryPage = useLeaveToEntryPage()
  const logout = useLogout()
  const withdraw = useWithdrawAccount()
  const updateNickname = useUpdateNickname()
  const checkNickname = useCheckNickname()
  const uploadImage = useUploadProfileImage()
  const deleteImage = useDeleteProfileImage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const screenshotRef = useRef<HTMLElement>(null)
  const [nicknameInput, setNicknameInput] = useState('')
  const [nicknameMessage, setNicknameMessage] = useState<{ kind: 'error' | 'done'; text: string } | null>(null)
  const [imageMessage, setImageMessage] = useState<{ kind: 'error' | 'done'; text: string } | null>(null)
  const [isImageBusy, setIsImageBusy] = useState(false)
  const [nicknameFocused, setNicknameFocused] = useState(false)
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')

  const handleCopy = async (previewSrc: string | null) => {
    if (!previewSrc && !screenshotRef.current) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (screenshotRef.current) await screenshotElementToClipboard(screenshotRef.current)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }
  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'

  // 세션에서 닉네임을 받아오면(또는 등록 후 바뀌면) 입력칸을 그 값으로 맞춘다.
  const savedNickname = session?.authenticated ? (session.nickname ?? '') : ''
  useEffect(() => {
    setNicknameInput(savedNickname)
  }, [savedNickname])

  // 최근에 바꿨으면 정해진 시각까지 닉네임을 바꿀 수 없다(서버 규칙: 한 번 바꾸면 7일 뒤에 다시).
  const nicknameChangeableAt = session?.authenticated ? (session.nicknameChangeableAt ?? null) : null
  const isNicknameLocked = nicknameChangeableAt !== null && nicknameChangeableAt > Date.now()
  // 등록된 닉네임에서 바꿔 쓰는 중일 때만 제한 사유를 보여 준다.
  const liveNicknameProblem = nicknameInput !== savedNickname ? nicknameProblem(nicknameInput) : null
  // 글자 수 상한에 닿으면(칸을 누르고 있는 동안) 그 이유를 알려 준다 — 상한을 넘는 글자는 입력되지 않고 잘리기 때문이다(커스텀 페이지 이름 입력칸과 같다).
  const nicknameAtLimit = nicknameFocused && nicknameInput.length >= NICKNAME_MAX_LENGTH
  const nicknameLiveText = liveNicknameProblem ?? (nicknameAtLimit ? `최대 ${NICKNAME_MAX_LENGTH}자까지 입력할 수 있습니다.` : null)

  // 확인 → (서버가 이미 쓰는 닉네임인지 확인) → 쓸 수 있으면 "등록하시겠습니까?" 창 → 등록.
  const handleSaveNickname = async (event: FormEvent) => {
    event.preventDefault()
    const nickname = nicknameInput.normalize('NFC').trim()
    if (!NICKNAME_PATTERN.test(nickname)) {
      setNicknameMessage({ kind: 'error', text: NICKNAME_RULE_MESSAGE })
      return
    }
    if (nickname === savedNickname) {
      setNicknameMessage({ kind: 'error', text: '지금 쓰고 있는 닉네임입니다.' })
      return
    }
    setNicknameMessage(null)
    try {
      const { available } = await checkNickname.mutateAsync(nickname)
      if (!available) {
        setNicknameMessage({ kind: 'error', text: '이미 사용 중인 닉네임입니다.' })
        return
      }
      // 닉네임이 있는 계정이 바꾸면 그때부터 7일 동안 다시 바꿀 수 없다(서버 규칙) — 등록하기 전에 알려 준다.
      const warning = savedNickname ? '\n등록하면 7일 동안은 다시 바꿀 수 없습니다.' : ''
      const confirmed = await appConfirm(`'${nickname}' 닉네임으로 등록하시겠습니까?${warning}`, { title: '닉네임 등록' })
      if (!confirmed) return
      await updateNickname.mutateAsync(nickname)
      setNicknameMessage({ kind: 'done', text: '닉네임을 등록했습니다.' })
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined
      const errorCode = isAxiosError(error) ? (error.response?.data as { errorCode?: string } | undefined)?.errorCode : undefined
      if (status === 409 && errorCode === NICKNAME_CHANGE_LIMITED_CODE) {
        setNicknameMessage({ kind: 'error', text: '닉네임은 7일에 한 번만 바꿀 수 있습니다.' })
        void refetch()
      } else if (status === 409) setNicknameMessage({ kind: 'error', text: '이미 사용 중인 닉네임입니다.' })
      else if (status === 400 && errorCode === NICKNAME_RESERVED_CODE) setNicknameMessage({ kind: 'error', text: '사용할 수 없는 닉네임입니다.' })
      else if (status === 400) setNicknameMessage({ kind: 'error', text: NICKNAME_RULE_MESSAGE })
      else setNicknameMessage({ kind: 'error', text: '닉네임을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    }
  }

  const handlePickImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // 같은 파일을 다시 고를 수 있게 선택 직후 비운다.
    event.target.value = ''
    if (!file) return
    const problem = checkProfileImageFile(file)
    if (problem === 'type') {
      setImageMessage({ kind: 'error', text: 'JPG 또는 PNG 사진만 올릴 수 있습니다.' })
      return
    }
    if (problem === 'size') {
      setImageMessage({ kind: 'error', text: '사진은 10MB 이하만 올릴 수 있습니다.' })
      return
    }
    setIsImageBusy(true)
    setImageMessage(null)
    try {
      const resized = await resizeProfileImage(file).catch(() => null)
      if (resized === null) {
        setImageMessage({ kind: 'error', text: '사진을 읽지 못했습니다. 다른 사진을 골라 주세요.' })
        return
      }
      if (resized.size > PROFILE_IMAGE_MAX_UPLOAD_BYTES) {
        setImageMessage({ kind: 'error', text: '사진 용량이 너무 큽니다. 다른 사진을 골라 주세요.' })
        return
      }
      await uploadImage.mutateAsync(resized)
      setImageMessage({ kind: 'done', text: '프로필 사진을 저장했습니다.' })
    } catch {
      setImageMessage({ kind: 'error', text: '사진을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setIsImageBusy(false)
    }
  }

  const handleDeleteImage = async () => {
    setIsImageBusy(true)
    setImageMessage(null)
    try {
      await deleteImage.mutateAsync()
      setImageMessage({ kind: 'done', text: '프로필 사진을 삭제했습니다.' })
    } catch {
      setImageMessage({ kind: 'error', text: '사진을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setIsImageBusy(false)
    }
  }

  // 비로그인이 이 페이지에 들어오면 바로 로그인 팝업을 띄운다. 로그인 없이 팝업을 닫으면 들어온 곳으로 돌려보낸다.
  const needsLogin = !isLoading && !isError && session?.authenticated === false
  useEffect(() => {
    if (!needsLogin) return
    void requireLogin('/profile').then(dismissed => { if (dismissed) leaveToEntryPage() })
  }, [needsLogin, requireLogin, leaveToEntryPage])

  const handleLogout = async () => {
    try {
      await logout.mutateAsync()
      navigate('/home', { replace: true })
    } catch {
      // 요청 실패는 아래 계정 카드에서 안내한다.
    }
  }

  // 회원 탈퇴 — 확인을 한 번 더 받고, 서버가 데이터를 지우면 홈으로 보낸다. 관리자는 버튼 자체를 보이지 않는다.
  const handleWithdraw = async () => {
    const confirmed = await appConfirm('탈퇴하면 이메일, 닉네임, 프로필 사진, 내 기준과 설정이 모두 즉시 지워지며 복구할 수 없습니다.\n정말 탈퇴하시겠습니까?', { title: '회원 탈퇴' })
    if (!confirmed) return
    try {
      await withdraw.mutateAsync()
      navigate('/home', { replace: true })
    } catch {
      // 요청 실패는 아래 계정 카드에서 안내한다.
    }
  }

  // 로그인하지 않은 상태(세션 확인 중 포함)에서는 로고 말고 아무것도 보이지 않게 한다 — 로그인 팝업만 뜬다.
  if (!session?.authenticated && !isError) {
    return (
      <div className="min-h-screen text-ui-white">
        <NavBar hideAccount />
      </div>
    )
  }

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background text-ui-white">
      <NavBar />
      <NavSubBar
        actions={
          <NavBarPageActions
            onRefresh={() => undefined}
            isRefreshing={false}
            showRefresh={false}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            onToggleSettings={() => setIsSettingsOpen(open => !open)}
            isSettingsOpen={isSettingsOpen}
            onOpenShare={() => setIsShareOpen(true)}
            isScreenshotOpen={isShareOpen}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        <div ref={rowRef} className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 gap-[4px] overflow-hidden bg-ui-background">
        <main ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
          <Toolbar>
            <ToolbarModeText page="ACCOUNT" label="PROFILE" />
          </Toolbar>
          <PageMainFrame className="p-6">
            <section className="mx-auto w-full max-w-4xl">
          {isError ? (
            // 다른 화면의 불러오기 실패와 같은 오류 원(문구와 "다시 시도")으로 보여 준다.
            <div className="flex justify-center py-4">
              <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => void refetch()} />
            </div>
          ) : session?.authenticated ? (
            <>
              <InfoPageHeading title="내 프로필" summary="로그인 계정과 프로필 정보를 확인하고 관리합니다." />

              <section aria-labelledby="profile-account-heading" className="-mt-3 overflow-hidden border border-ui-border bg-ui-panel">
                <header className="border-b border-ui-border px-4 py-3">
                  <h2 id="profile-account-heading" className="m-0 text-base font-bold text-ui-white">계정 정보</h2>
                  <p className="m-0 mt-1 text-xs text-ui-muted">로그인에 사용한 계정입니다.</p>
                </header>
                <div className="flex min-w-0 items-center gap-4 px-4 py-4">
                  <div className="min-w-0">
                    <p className="m-0 text-xs font-medium text-ui-muted">이메일</p>
                    <p className="m-0 mt-1 flex min-w-0 items-center gap-2 text-base text-ui-white">
                      <AuthProviderIcon issuer={session.issuer} />
                      <span className="break-all">{displayEmail(session.email) || '등록된 이메일 없음'}</span>
                    </p>
                  </div>
                </div>
              </section>

              <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
              <section aria-labelledby="profile-nickname-heading" className="min-w-0 border border-ui-border bg-ui-panel p-4">
                <header className="mb-4">
                  <h2 id="profile-nickname-heading" className="m-0 text-base font-bold text-ui-white">닉네임</h2>
                  <p className="m-0 mt-1 text-xs leading-relaxed text-ui-muted">다른 회원에게 표시되는 이름입니다.</p>
                </header>
                <form onSubmit={handleSaveNickname}>
                  <label htmlFor="profile-nickname" className="sr-only">닉네임</label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      id="profile-nickname"
                      value={nicknameInput}
                      maxLength={NICKNAME_MAX_LENGTH}
                      onFocus={() => setNicknameFocused(true)}
                      onBlur={() => setNicknameFocused(false)}
                      // 한글처럼 글자를 조합하며 치는 입력은 maxLength를 넘는 한 글자가 조합 중에 잠깐 보인다 — 넘는 순간 바로 잘라 낸다.
                      onChange={event => {
                        setNicknameInput(event.target.value.slice(0, NICKNAME_MAX_LENGTH))
                        setNicknameMessage(null)
                      }}
                      disabled={isNicknameLocked}
                      autoComplete="off"
                      placeholder="2~12자"
                      // 12자 너비 — 가장 넓은 영문 대문자 12자(약 154px, 글자 13px)도 들어가는 184px(좌우 안쪽 여백 12px·테두리 1px 포함).
                      className="h-7 w-[11.5rem] max-w-full rounded border border-ui-border bg-ui-surface px-3 text-[13px] text-ui-white outline-none focus:border-ui-border focus:placeholder:text-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={checkNickname.isPending || updateNickname.isPending || isNicknameLocked}
                      className="h-7 rounded-[5px] border-0 bg-[var(--brand-surface)] px-4 text-[13px] font-medium text-ui-white transition-colors hover:bg-[var(--brand-surface-hover)] disabled:cursor-wait disabled:opacity-50"
                    >
                      {checkNickname.isPending ? '확인 중...' : updateNickname.isPending ? '등록 중...' : '확인'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ui-muted">확인을 누르면 사용 가능 여부를 확인한 뒤 등록합니다.</p>
                  {/* 결과·제한 사유 문구가 뜰 자리를 늘 비워 둔다 — 문구가 나타나도 입력칸이 움직이지 않게 한다. */}
                  <div className="mt-2 min-h-6">
                    {nicknameLiveText ? (
                      <p role="alert" className="text-sm text-status-error-text">{nicknameLiveText}</p>
                    ) : nicknameMessage ? (
                      <p role={nicknameMessage.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${nicknameMessage.kind === 'error' ? 'text-status-error-text' : 'text-status-success'}`}>
                        {nicknameMessage.text}
                      </p>
                    ) : isNicknameLocked && nicknameChangeableAt !== null ? (
                      <p role="status" className="text-sm text-status-error-text">
                        7일에 한 번만 바꿀 수 있습니다. ({formatChangeableAt(nicknameChangeableAt)}부터)
                      </p>
                    ) : null}
                  </div>
                </form>
              </section>

              <section aria-labelledby="profile-photo-heading" className="min-w-0 border border-ui-border bg-ui-panel p-4">
                <header className="mb-4">
                  <h2 id="profile-photo-heading" className="m-0 text-base font-bold text-ui-white">프로필 사진</h2>
                  <p className="m-0 mt-1 text-xs leading-relaxed text-ui-muted">계정 메뉴와 서비스 화면에 표시됩니다.</p>
                </header>
                <div className="flex min-w-0 items-center gap-4">
                  <ProfileAvatar className="size-16 shrink-0 object-cover" />
                  <div className="flex min-w-0 flex-col items-start gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handlePickImage}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImageBusy}
                      className="h-7 rounded-[5px] border-0 bg-[var(--brand-surface)] px-4 text-[13px] font-medium text-ui-white transition-colors hover:bg-[var(--brand-surface-hover)] disabled:cursor-wait disabled:opacity-50"
                    >
                      {isImageBusy ? '처리 중...' : '사진 등록'}
                    </button>
                    {session.profileImageVersion != null && (
                      <button
                        type="button"
                        onClick={handleDeleteImage}
                        disabled={isImageBusy}
                        className="h-7 rounded-[5px] border-0 bg-ui-control px-4 text-[13px] font-medium text-ui-white transition-colors hover:bg-ui-control-hover disabled:cursor-wait disabled:opacity-50"
                      >
                        사진 삭제
                      </button>
                    )}
                  </div>
                </div>
                {/* 상태 문구가 바뀌어도 카드가 갑자기 크게 움직이지 않도록 최소 높이를 유지한다. */}
                {imageMessage ? (
                  <p role={imageMessage.kind === 'error' ? 'alert' : 'status'} className={`m-0 mt-4 min-h-5 text-sm font-medium ${imageMessage.kind === 'error' ? 'text-status-error-text' : 'text-status-success'}`}>
                    {imageMessage.text}
                  </p>
                ) : (
                  <p className="m-0 mt-4 min-h-5 text-xs leading-relaxed text-ui-muted">JPG, PNG · 10MB 이하 · 가운데 정사각형으로 잘라 저장합니다.</p>
                )}
              </section>
              </div>

              <section aria-labelledby="profile-account-actions-heading" className="mt-4 border border-ui-border bg-ui-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 id="profile-account-actions-heading" className="m-0 text-base font-bold text-ui-white">계정 관리</h2>
                    <p className="m-0 mt-1 text-xs text-ui-muted">로그아웃하거나 서비스 이용을 종료할 수 있습니다.</p>
                  </div>
                  <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={logout.isPending}
                    className="h-7 rounded-[5px] border-0 bg-ui-control px-4 text-[13px] font-medium text-ui-white transition-colors hover:bg-ui-control-hover disabled:cursor-wait disabled:opacity-50"
                  >
                    {logout.isPending ? '로그아웃 중...' : '로그아웃'}
                  </button>
                  {session.role !== 'ADMIN' && (
                    <button
                      type="button"
                      onClick={handleWithdraw}
                      disabled={withdraw.isPending}
                      className="h-7 rounded-[5px] border border-ui-border bg-transparent px-4 text-[13px] font-medium text-status-error-text transition-colors hover:bg-ui-control disabled:cursor-wait disabled:opacity-50"
                    >
                      {withdraw.isPending ? '탈퇴 처리 중...' : '회원 탈퇴'}
                    </button>
                  )}
                  </div>
                </div>
                {logout.isError && <p role="alert" className="m-0 mt-3 text-sm text-status-error-text">로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
                {withdraw.isError && <p role="alert" className="m-0 mt-3 text-sm text-status-error-text">탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
              </section>
            </>
          ) : null}
            </section>
          </PageMainFrame>
          <DisclaimerFooter />
        </main>
        {isSettingsOpen && <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
          <PageInfoPanel title="Account" tabLabel="PROFILE" icon="member" isOnLeft={isOnLeft} onToggleSide={toggleSide}>
            <p>로그인 계정의 이메일과 프로필 정보를 관리합니다.</p>
            <p className="mt-4 border-l-2 border-brand bg-ui-background px-3 py-2">등록한 닉네임은 7일에 한 번만 바꿀 수 있습니다.</p>
          </PageInfoPanel>
        </div>}
        </div>
      </div>
      {isShareOpen && (
        <ScreenshotModal
          onClose={() => setIsShareOpen(false)}
          onCopy={handleCopy}
          copyLabel={copyLabel}
          isCopying={copyStatus === 'copying'}
          screenshotTarget={screenshotRef.current}
        />
      )}
    </div>
  )
}
