import { useState } from 'react'
import { useSession } from './useSession'

// 사진이 없을 때의 기본 이미지 — 어두운 틀(1px 테두리)에 청록 둥근 사람 선 아이콘을 둔다(38px 칸에 26px 아이콘).
// 비로그인 로그인 버튼(회색 틀 + 연한 회색 사람 선)과 틀·아이콘 색이 달라서 로그인한 상태라는 것이 한눈에 구분된다.
const DEFAULT_AVATAR_SRC = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 38"><rect x=".5" y=".5" width="37" height="37" rx="4.5" fill="#27272a" stroke="#3f3f46"/>'
    + '<g transform="translate(6 6) scale(1.0833)" fill="none" stroke="#4dd0e1" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">'
    + '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></g></svg>',
)}`

// 사용자 사진 주소(없거나 비로그인이면 기본 이미지). 사진은 <img>로 불러서 axios의 401 갱신을 못 타므로,
// 로딩이 실패하면 그 사진 버전은 기본 이미지로 바꾼다.
export function useProfileImageSrc() {
  const { data: session } = useSession()
  const version = session?.authenticated ? (session.profileImageVersion ?? null) : null
  const [failedVersion, setFailedVersion] = useState<number | null>(null)
  const src = version !== null && failedVersion !== version ? `/api/profile/image?v=${version}` : DEFAULT_AVATAR_SRC
  return { src, onError: () => setFailedVersion(version) }
}
