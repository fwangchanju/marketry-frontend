import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import Spinner from '@/components/Spinner'
import { EmptyMessageAreaContext } from '@/utils/emptyMessageArea'

// 표에 보여줄 줄이 없을 때의 안내 — 한가운데에 크게 보여준다. 부모는 relative여야 한다.
// 거래소·MARKETRY·내 분류 표와 그룹·지도 페이지가 모두 같은 모양과 같은 문구를 쓴다.
export const EMPTY_DATA_MESSAGE = '표시할 데이터가 없습니다.'
export const EMPTY_SEARCH_MESSAGE = '검색 결과가 없습니다.'
// 내 분류를 아직 만들지 않은 회원이 내 분류 지도를 열었을 때 — 내 기준으로 만들어 보라는 안내(지도에서는 아래 줄에 커스텀 배지 링크를 붙인다).
export const EMPTY_MINE_MESSAGE = '내 마음대로 시장 지도를 만들어 보세요.'

const MESSAGE_CLASS = 'pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center whitespace-pre-line px-6 text-center text-base text-ui-text'

// 원 안(로딩 숫자·"다시 시도"가 오는 자리)에 놓는 "바로 가기" 배지 링크(커스텀 페이지의 업종 화면(대·중·소분류를 먼저 만드는 곳)으로 이동) — 눌러서 커스텀 페이지로 이동한다. 크기는 로딩 화면의 "다시 시도" 버튼(Spinner, 기본 원 320px 기준)과 같다. 안내 영역은 마우스를 받지 않으므로 링크만 다시 받게 한다.
export function CustomPageBadgeLink() {
  return (
    <Link to="/custom/sector" className="pointer-events-auto inline-block whitespace-nowrap rounded border-0 bg-[var(--brand-surface)] px-[8.3px] py-[2.6px] text-[13.6px] font-bold text-ui-white no-underline transition-colors hover:brightness-125">
      바로 가기
    </Link>
  )
}

export default function EmptyMessage({ message, topClass = 'top-8', children }: { message: string; topClass?: string; children?: ReactNode }) {
  const area = useContext(EmptyMessageAreaContext)
  const body = (
    <>
      {message}
      {children && <div className="mt-2 flex justify-center">{children}</div>}
    </>
  )
  if (area) {
    return createPortal(<div className={`${MESSAGE_CLASS} top-1.5 flex-col`}>{body}</div>, area)
  }
  return <div className={`${MESSAGE_CLASS} ${topClass} flex-col`}>{body}</div>
}

// 내 분류가 비어 있을 때처럼 다음 행동을 안내하는 화면 — 로딩·오류 원과 같은 자리(위 16px·아래 19.5px 여백 안 가운데)에 같은 원·로고(움직이지 않음)를 두고,
// children(배지)은 원 안 상태 칸에, 문구는 원 아래에 매단다. 문구는 원의 가운데 정렬에 영향을 주지 않는다.
export function EmptyLogoMessage({ message, children, containerClassName = 'pt-4 pb-[19.5px]' }: { message: string; children?: ReactNode; containerClassName?: string }) {
  return (
    <div className={`flex flex-1 items-center justify-center ${containerClassName}`}>
      <div className="relative">
        <Spinner still stillContent={children} />
        <div className="absolute left-1/2 top-full mt-4 -translate-x-1/2 whitespace-nowrap text-center text-base text-ui-text">{message}</div>
      </div>
    </div>
  )
}
