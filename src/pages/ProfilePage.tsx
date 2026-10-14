import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import Spinner from '@/components/Spinner'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useLeaveToEntryPage } from '@/hooks/useLeaveToEntryPage'
import { useLoginGate } from '@/hooks/useLoginGate'
import { useDeleteProfileImage, useUpdateNickname, useUploadProfileImage } from '@/hooks/useProfile'
import { useLogout, useSession } from '@/hooks/useSession'
import { checkProfileImageFile, resizeProfileImage, PROFILE_IMAGE_MAX_UPLOAD_BYTES } from '@/utils/resizeProfileImage'

const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9]{2,12}$/
const NICKNAME_RULE_MESSAGE = '닉네임은 2~12자의 한글, 영문, 숫자만 사용할 수 있습니다.'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { data: session, isLoading, isError, refetch } = useSession()
  const { requireLogin } = useLoginGate()
  const leaveToEntryPage = useLeaveToEntryPage()
  const logout = useLogout()
  const updateNickname = useUpdateNickname()
  const uploadImage = useUploadProfileImage()
  const deleteImage = useDeleteProfileImage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nicknameInput, setNicknameInput] = useState('')
  const [nicknameMessage, setNicknameMessage] = useState<{ kind: 'error' | 'done'; text: string } | null>(null)
  const [imageMessage, setImageMessage] = useState<{ kind: 'error' | 'done'; text: string } | null>(null)
  const [isImageBusy, setIsImageBusy] = useState(false)

  // 세션에서 닉네임을 받아오면(또는 저장 후 바뀌면) 입력칸을 그 값으로 맞춘다.
  const savedNickname = session?.authenticated ? (session.nickname ?? '') : ''
  useEffect(() => {
    setNicknameInput(savedNickname)
  }, [savedNickname])

  const handleSaveNickname = async (event: FormEvent) => {
    event.preventDefault()
    const nickname = nicknameInput.normalize('NFC').trim()
    if (!NICKNAME_PATTERN.test(nickname)) {
      setNicknameMessage({ kind: 'error', text: NICKNAME_RULE_MESSAGE })
      return
    }
    try {
      await updateNickname.mutateAsync(nickname)
      setNicknameMessage({ kind: 'done', text: '닉네임을 저장했습니다.' })
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined
      if (status === 409) setNicknameMessage({ kind: 'error', text: '이미 사용 중인 닉네임입니다.' })
      else if (status === 400) setNicknameMessage({ kind: 'error', text: NICKNAME_RULE_MESSAGE })
      else setNicknameMessage({ kind: 'error', text: '닉네임을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
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
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold">프로필</h1>
        <section className="mt-6 rounded-lg border border-gray-700 bg-zinc-800 p-6">
          {isError ? (
            // 다른 화면의 불러오기 실패와 같은 오류 원(문구와 "다시 시도")으로 보여 준다.
            <div className="flex justify-center py-4">
              <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => void refetch()} />
            </div>
          ) : session?.authenticated ? (
            <>
              <h2 className="text-lg font-semibold">계정 정보</h2>
              <div className="mt-6 border-t border-gray-700 pt-5">
                <p className="text-sm text-gray-300">이메일</p>
                <p className="mt-2 break-all text-base">{session.email || '등록된 이메일 없음'}</p>
              </div>
              <div className="mt-8 border-t border-gray-700 pt-6">
                <h2 className="text-lg font-semibold">프로필</h2>
                <div className="mt-5 flex items-center gap-5">
                  <ProfileAvatar className="size-[84px] shrink-0 object-cover" />
                  {/* 두 버튼을 세로로 쌓아 프로필 사진(84px)과 높이를 맞춘다 — 버튼 38px(닉네임 입력·저장 버튼과 같은 높이) + 간격 8px + 버튼 38px. 삭제 버튼이 없을 때는 선택 버튼이 세로 가운데에 온다. */}
                  <div className="flex h-[84px] flex-col justify-center gap-2">
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
                      className="h-[38px] w-32 rounded-lg border-0 bg-cyan-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-cyan-600 disabled:cursor-wait disabled:opacity-50"
                    >
                      {isImageBusy ? '처리 중...' : '사진 선택'}
                    </button>
                    {session.profileImageVersion != null && (
                      <button
                        type="button"
                        onClick={handleDeleteImage}
                        disabled={isImageBusy}
                        className="h-[38px] w-32 rounded-lg border-0 bg-zinc-600 px-4 text-sm text-white transition-colors hover:bg-zinc-500 disabled:cursor-wait disabled:opacity-50"
                      >
                        사진 삭제
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs font-medium text-gray-300">JPG, PNG · 10MB 이하 · 가운데 정사각형으로 잘라 저장합니다.</p>
                {imageMessage && (
                  <p role={imageMessage.kind === 'error' ? 'alert' : 'status'} className={`mt-2 text-sm ${imageMessage.kind === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                    {imageMessage.text}
                  </p>
                )}
                <form onSubmit={handleSaveNickname} className="mt-6">
                  <label htmlFor="profile-nickname" className="text-sm text-gray-300">
                    닉네임
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id="profile-nickname"
                      value={nicknameInput}
                      onChange={event => {
                        setNicknameInput(event.target.value)
                        setNicknameMessage(null)
                      }}
                      maxLength={12}
                      autoComplete="off"
                      placeholder="2~12자"
                      className="w-56 rounded border border-gray-600 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-400 focus:placeholder:text-transparent"
                    />
                    <button
                      type="submit"
                      disabled={updateNickname.isPending}
                      className="rounded-lg border-0 bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-600 disabled:cursor-wait disabled:opacity-50"
                    >
                      {updateNickname.isPending ? '저장 중...' : '저장'}
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-medium text-gray-300">한글, 영문, 숫자만 쓸 수 있고 다른 사용자와 겹칠 수 없습니다.</p>
                  {nicknameMessage && (
                    <p role={nicknameMessage.kind === 'error' ? 'alert' : 'status'} className={`mt-2 text-sm ${nicknameMessage.kind === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                      {nicknameMessage.text}
                    </p>
                  )}
                </form>
              </div>
              <div className="mt-8 border-t border-gray-700 pt-6">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logout.isPending}
                  className="h-[38px] rounded-lg border-0 bg-zinc-600 px-4 text-sm text-white transition-colors hover:bg-zinc-500 disabled:cursor-wait disabled:opacity-50"
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
