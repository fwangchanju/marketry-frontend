import { useContext } from 'react'
import { createPortal } from 'react-dom'
import { EmptyMessageAreaContext } from '@/utils/emptyMessageArea'

// 표에 보여줄 줄이 없을 때의 안내 — 한가운데에 크게 보여준다. 부모는 relative여야 한다.
// 거래소·MARKETRY·내 분류 표와 그룹·지도 페이지가 모두 같은 모양과 같은 문구를 쓴다.
export const EMPTY_DATA_MESSAGE = '표시할 데이터가 없습니다.'
export const EMPTY_SEARCH_MESSAGE = '검색 결과가 없습니다.'

const MESSAGE_CLASS = 'pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center whitespace-pre-line px-6 text-center text-xl text-ui-text'

export default function EmptyMessage({ message, topClass = 'top-8' }: { message: string; topClass?: string }) {
  const area = useContext(EmptyMessageAreaContext)
  if (area) {
    return createPortal(<div className={`${MESSAGE_CLASS} top-1.5`}>{message}</div>, area)
  }
  return <div className={`${MESSAGE_CLASS} ${topClass}`}>{message}</div>
}
