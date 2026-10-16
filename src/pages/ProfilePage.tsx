import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import { GoogleLogoIcon } from '@/components/icons/AppIcons'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import Spinner from '@/components/Spinner'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useLeaveToEntryPage } from '@/hooks/useLeaveToEntryPage'
import { useLoginGate } from '@/hooks/useLoginGate'
import { useCheckNickname, useDeleteProfileImage, useUpdateNickname, useUploadProfileImage } from '@/hooks/useProfile'
import { useLogout, useSession } from '@/hooks/useSession'
import { appConfirm } from '@/utils/appDialogBus'
import { checkProfileImageFile, resizeProfileImage, PROFILE_IMAGE_MAX_UPLOAD_BYTES } from '@/utils/resizeProfileImage'

// 이메일·닉네임·프로필 사진 항목은 모두 같은 높이(가장 큰 프로필 사진 항목: 위아래 여백 12px씩 + 제목 20px + 간격 8px + 사진 64px + 간격 8px + 안내 16px = 140px, 위 구분선 1px)이고, 내용은 세로 가운데에 둔다.
const ITEM_CLASS = 'flex min-h-[141px] flex-col justify-center border-t border-gray-700 py-3'
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
  const updateNickname = useUpdateNickname()
  const checkNickname = useCheckNickname()
  const uploadImage = useUploadProfileImage()
  const deleteImage = useDeleteProfileImage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nicknameInput, setNicknameInput] = useState('')
  const [nicknameMessage, setNicknameMessage] = useState<{ kind: 'error' | 'done'; text: string } | null>(null)
  const [imageMessage, setImageMessage] = useState<{ kind: 'error' | 'done'; text: string } | null>(null)
  const [isImageBusy, setIsImageBusy] = useState(false)
  const [nicknameFocused, setNicknameFocused] = useState(false)

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

  // 로그인하지 않은 상태(세션 확인 중 포함)에서는 로고 말고 아무것도 보이지 않게 한다 — 로그인 팝업만 뜬다.
  if (!session?.authenticated && !isError) {
    return (
      <div className="min-h-screen text-white">
        <NavBar hideAccount />
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white">
      <NavBar />
      <NavSubBar />
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <section className="rounded-lg border border-gray-700 bg-zinc-800 p-6">
          {isError ? (
            // 다른 화면의 불러오기 실패와 같은 오류 원(문구와 "다시 시도")으로 보여 준다.
            <div className="flex justify-center py-4">
              <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => void refetch()} />
            </div>
          ) : session?.authenticated ? (
            <>
              {/* 캡처 창·설정창 제목처럼 제목 앞에 청록 막대를 둔다. */}
              <h2 className="font-roboto-latin mb-4 flex h-7 items-center text-lg font-bold leading-none">
                <span aria-hidden="true" className="mr-[6px] inline-block h-5 w-1 shrink-0 rounded-sm bg-[var(--brand)]" />
                Account
              </h2>
              <div className={ITEM_CLASS}>
                <p className="text-sm text-gray-300">이메일</p>
                {/* 구글 로고는 색을 바꾸지 않고 흰 칸 위에 그대로 둔다(로그인 창과 같은 모양). 로그인이 구글 계정이라 이메일이 구글 주소임을 알려 준다. */}
                <p className="mt-2 flex items-center gap-2 text-base">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded bg-white">
                    <GoogleLogoIcon className="size-3.5" />
                  </span>
                  <span className="break-all">{session.email || '등록된 이메일 없음'}</span>
                </p>
              </div>
              <div className={ITEM_CLASS}>
                <form onSubmit={handleSaveNickname}>
                  <label htmlFor="profile-nickname" className="text-sm text-gray-300">
                    닉네임
                  </label>
                  <div className="mt-2 flex gap-2">
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
                      className="w-[11.5rem] h-7 rounded border border-gray-600 bg-zinc-900 px-3 text-[13px] text-white outline-none focus:border-gray-400 focus:placeholder:text-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={checkNickname.isPending || updateNickname.isPending || isNicknameLocked}
                      className="h-7 rounded-[5px] border-0 bg-cyan-700 px-4 text-[13px] font-medium text-white transition-colors hover:bg-cyan-600 disabled:cursor-wait disabled:opacity-50"
                    >
                      {checkNickname.isPending ? '확인 중...' : updateNickname.isPending ? '등록 중...' : '확인'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-medium text-gray-300">먼저, 닉네임이 등록 가능한지 확인합니다.</p>
                  {/* 결과·제한 사유 문구가 뜰 자리를 늘 비워 둔다 — 문구가 나타나도 입력칸이 움직이지 않게 한다. */}
                  <div className="mt-2 h-5">
                    {nicknameLiveText ? (
                      <p role="alert" className="text-sm text-red-300">{nicknameLiveText}</p>
                    ) : nicknameMessage ? (
                      <p role={nicknameMessage.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${nicknameMessage.kind === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                        {nicknameMessage.text}
                      </p>
                    ) : isNicknameLocked && nicknameChangeableAt !== null ? (
                      <p role="status" className="text-sm text-red-300">
                        7일에 한 번만 바꿀 수 있습니다. ({formatChangeableAt(nicknameChangeableAt)}부터)
                      </p>
                    ) : null}
                  </div>
                </form>
              </div>
              <div className={ITEM_CLASS}>
                <p className="text-sm text-gray-300">프로필 사진</p>
                <div className="mt-2 flex items-center gap-5">
                  <ProfileAvatar className="size-16 shrink-0 object-cover" />
                  {/* 두 버튼을 세로로 쌓고(너비는 글자에 맞추며 두 버튼이 같은 너비가 된다) 프로필 사진 높이를 두 버튼 높이의 합인 64px(28 + 간격 8 + 28)에 맞춘다. 삭제 버튼이 없을 때는 등록 버튼이 사진 높이의 세로 가운데에 온다. */}
                  <div className="flex h-16 flex-col justify-center gap-2">
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
                      className="h-7 rounded-[5px] border-0 bg-cyan-700 px-4 text-[13px] font-medium text-white transition-colors hover:bg-cyan-600 disabled:cursor-wait disabled:opacity-50"
                    >
                      {isImageBusy ? '처리 중...' : '사진 등록'}
                    </button>
                    {session.profileImageVersion != null && (
                      <button
                        type="button"
                        onClick={handleDeleteImage}
                        disabled={isImageBusy}
                        className="h-7 rounded-[5px] border-0 bg-zinc-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-zinc-500 disabled:cursor-wait disabled:opacity-50"
                      >
                        사진 삭제
                      </button>
                    )}
                  </div>
                </div>
                {/* 안내 줄 자리에서 결과 문구로 바뀌어서(줄 수 그대로) 문구가 떠도 항목 높이가 변하지 않는다. */}
                {imageMessage ? (
                  <p role={imageMessage.kind === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs font-medium ${imageMessage.kind === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                    {imageMessage.text}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-medium text-gray-300">JPG, PNG · 10MB 이하 · 가운데 정사각형으로 잘라 저장합니다.</p>
                )}
              </div>
              <div className="border-t border-gray-700 pt-4">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logout.isPending}
                  className="h-7 rounded-[5px] border-0 bg-zinc-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-zinc-500 disabled:cursor-wait disabled:opacity-50"
                >
                  {logout.isPending ? '로그아웃 중...' : '로그아웃'}
                </button>
                {logout.isError && <p role="alert" className="mt-3 text-sm text-red-300">로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  )
}
