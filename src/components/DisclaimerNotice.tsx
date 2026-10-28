import { Link } from 'react-router-dom'

// 면책조항 — 지도·그룹 페이지 왼쪽 아래 첫 줄에, 정보 링크는 둘째 줄에 각각 10px로 보여준다.
// 한 줄이 칸보다 길면 줄임표로 자른다(마우스를 올려도 전체 문구를 띄우지 않는다).
// 둘째 줄은 저작권·약관·개인정보처리방침·데이터·가이드·문의 순서로 보여 준다.
const DISCLAIMER = '본 웹사이트의 정보는 외부 시세·종목 데이터를 바탕으로 가공된 것으로, 투자 참고사항이며 오류가 발생하거나 지연될 수 있습니다. 제공된 정보에 의한 투자결과에 대해 법적인 책임을 지지 않습니다.'

const INFO_LINKS = [
  { to: '/info/terms', label: '이용약관' },
  { to: '/info/privacy', label: '개인정보처리방침' },
  { to: '/info/source', label: '데이터' },
  { to: '/info/guide', label: '가이드' },
  { to: '/info/contact', label: '문의' },
]

// wrap: 좁은 화면(모바일 글 페이지)에서는 한 줄 줄임표 대신 전체 문구를 줄바꿈해서 보여 준다.
export default function DisclaimerNotice({ wrap = false }: { wrap?: boolean }) {
  const lineClass = wrap ? 'block' : 'block h-[10px] truncate'
  return (
    // 두 줄을 20px로 맞추고 아래 4px를 띄워 등락률 범례와 위·아래 위치를 맞춘다.
    <p className={`normal-nums m-0 min-w-0 text-left font-bold text-ui-white/70 ${wrap ? 'pb-1 text-[11px] leading-[16px]' : 'pb-[4px] text-[9px] leading-[10px]'}`}>
      <span className={`min-w-0 ${wrap ? 'leading-[16px]' : 'leading-[10px]'}`}>
        <span className={wrap ? `${lineClass} mb-1` : lineClass}>{DISCLAIMER}</span>
        <span className={wrap ? 'flex flex-wrap items-center justify-center' : lineClass}>
          <span className={wrap ? "order-last w-full whitespace-nowrap text-center" : "whitespace-nowrap"}>© 2026 MARKETRY</span>
          {INFO_LINKS.map((link, index) => (
            // 구분점과 링크를 한 덩어리로 묶어, 좁은 화면에서 줄이 바뀌어도 링크 글자가 중간에서 끊기지 않게 한다.
            <span key={link.to} className="whitespace-nowrap">
              {(!wrap || index > 0) && <span aria-hidden="true" className="px-1 text-ui-white/35">·</span>}
              <Link to={link.to} className="hover:text-ui-white focus-visible:text-ui-white focus-visible:outline focus-visible:outline-1">{link.label}</Link>
            </span>
          ))}
        </span>
      </span>
    </p>
  )
}
