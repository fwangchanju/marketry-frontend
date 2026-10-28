import { Link } from 'react-router-dom'

// 면책조항 — 지도·그룹 페이지 왼쪽 아래 첫 줄에, 정보 링크는 둘째 줄에 각각 10px로 보여준다.
// 한 줄이 칸보다 길면 줄임표로 자른다(마우스를 올려도 전체 문구를 띄우지 않는다).
// 둘째 줄은 저작권·약관·개인정보처리방침·데이터·가이드·문의 순서로 보여 준다.
const DISCLAIMER = '본 웹사이트의 정보는 외부 시세·종목 데이터를 바탕으로 가공된 것으로, 투자 참고사항이며 오류가 발생하거나 지연될 수 있습니다. 제공된 정보에 의한 투자결과에 대해 법적인 책임을 지지 않습니다.'

export default function DisclaimerNotice() {
  return (
    // 두 줄을 20px로 맞추고 아래 4px를 띄워 등락률 범례와 위·아래 위치를 맞춘다.
    <p className="normal-nums m-0 min-w-0 pb-[4px] text-left text-[9px] font-bold leading-[10px] text-ui-white/70">
      <span className="min-w-0 leading-[10px]">
        <span className="block h-[10px] truncate">{DISCLAIMER}</span>
        <span className="block h-[10px] truncate">
          <span>© 2026 MARKETRY</span>
          <span aria-hidden="true" className="px-1 text-ui-white/35">·</span>
          <Link to="/info/terms" className="hover:text-ui-white focus-visible:text-ui-white focus-visible:outline focus-visible:outline-1">이용약관</Link>
          <span aria-hidden="true" className="px-1 text-ui-white/35">·</span>
          <Link to="/info/privacy" className="hover:text-ui-white focus-visible:text-ui-white focus-visible:outline focus-visible:outline-1">개인정보처리방침</Link>
          <span aria-hidden="true" className="px-1 text-ui-white/35">·</span>
          <Link to="/info/source" className="hover:text-ui-white focus-visible:text-ui-white focus-visible:outline focus-visible:outline-1">데이터</Link>
          <span aria-hidden="true" className="px-1 text-ui-white/35">·</span>
          <Link to="/info/guide" className="hover:text-ui-white focus-visible:text-ui-white focus-visible:outline focus-visible:outline-1">가이드</Link>
          <span aria-hidden="true" className="px-1 text-ui-white/35">·</span>
          <Link to="/info/contact" className="hover:text-ui-white focus-visible:text-ui-white focus-visible:outline focus-visible:outline-1">문의</Link>
        </span>
      </span>
    </p>
  )
}
