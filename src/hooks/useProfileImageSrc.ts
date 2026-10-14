import { useState } from 'react'
import { useSession } from './useSession'

// 사진이 없을 때의 기본 이미지 — 청록 틀(38px 칸)에 이메일 첫 글자를 흰색으로 쓴다. 로그인한 상태라는 것이 비로그인 로그인 버튼(회색 틀 + 사람 선)과 구분된다.
// 첫 글자가 영문·숫자가 아니면(기호 등) 같은 청록 틀에 사람 선 아이콘을 쓴다. 영문은 대문자로 쓴다.
const AVATAR_BACKGROUND = '#0e7490'

function defaultAvatarSrc(email: string | null | undefined): string {
  const first = email?.trim().charAt(0).toUpperCase() ?? ''
  const mark = /^[A-Z0-9]$/.test(first)
    ? `<text x="19" y="19" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,'Segoe UI',Roboto,sans-serif" font-size="21" font-weight="700" fill="#fff">${first}</text>`
    : '<g transform="translate(6 6) scale(1.0833)" fill="none" stroke="#fff" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></g>'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 38"><rect width="38" height="38" fill="${AVATAR_BACKGROUND}"/>${mark}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// 사용자 사진 주소(없거나 비로그인이면 기본 이미지). 사진은 <img>로 불러서 axios의 401 갱신을 못 타므로,
// 로딩이 실패하면 그 사진 버전은 기본 이미지로 바꾼다.
export function useProfileImageSrc() {
  const { data: session } = useSession()
  const version = session?.authenticated ? (session.profileImageVersion ?? null) : null
  const [failedVersion, setFailedVersion] = useState<number | null>(null)
  const src = version !== null && failedVersion !== version ? `/api/profile/image?v=${version}` : defaultAvatarSrc(session?.email)
  return { src, onError: () => setFailedVersion(version) }
}
