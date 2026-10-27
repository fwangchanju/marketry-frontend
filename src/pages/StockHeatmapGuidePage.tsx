import { Link } from 'react-router-dom'
import MarketryLogo from '@/components/MarketryLogo'
import { InfoCallout, InfoSection } from '@/components/InfoDocument'

const MAP_LINKS = [
  { to: '/map/allstock', label: '코스피·코스닥 전체 지도' },
  { to: '/map/kospi', label: '코스피 지도' },
  { to: '/map/kosdaq', label: '코스닥 지도' },
]

function GuideLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="font-semibold text-brand underline decoration-brand/70 underline-offset-4 hover:text-ui-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
      {children}
    </Link>
  )
}

export default function StockHeatmapGuidePage() {
  return (
    <div className="min-h-screen bg-ui-background text-ui-white">
      <header className="border-b border-ui-border bg-ui-surface">
        <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/home" aria-label="MARKETRY 홈으로 이동" className="shrink-0">
            <MarketryLogo layout="horizontalClean" className="h-auto w-[min(13rem,55vw)]" />
          </Link>
          <Link to="/home" className="text-sm text-ui-text underline underline-offset-4 hover:text-ui-white">홈으로</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
        <article>
          <header className="border-b border-ui-border pb-6">
            <p className="text-sm font-bold tracking-wide text-brand">MARKETRY 사용법</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-ui-white sm:text-4xl">주식 히트맵 보는 법</h1>
            <p className="mt-4 text-base leading-relaxed text-ui-text sm:text-lg">
              코스피와 코스닥의 종목별 등락률을 색으로, 상대적인 규모를 사각형 면적으로 살펴보는 방법을 안내합니다.
            </p>
          </header>

          <div className="mt-7 space-y-8 text-[15px] leading-7 text-ui-text sm:text-base">
            <InfoSection number="1" title="사각형과 업종을 읽기">
              <p>지도는 종목을 사각형으로 나누어 보여 줍니다. 큰 사각형일수록 지도에서 차지하는 비중이 큽니다. 크기는 시가총액 반영 설정에 따라 달라지며, 설정을 0으로 두면 같은 크기로 볼 수 있습니다.</p>
              <p>종목들은 선택한 분류 기준에 따라 업종 안에 모입니다. 업종 사각형을 선택하면 그 안의 종목 지도로 들어가고, 화면의 경로를 이용해 상위 업종으로 돌아올 수 있습니다.</p>
            </InfoSection>

            <InfoSection number="2" title="색으로 등락률 비교하기">
              <p>기본 색상에서는 빨강 계열이 상승, 파랑 계열이 하락을 나타냅니다. 색이 진할수록 선택한 색상 구간에서 등락 폭이 큰 편입니다. 0% 부근은 회색으로 보일 수 있습니다.</p>
              <p>색상 구간과 등락률 기준은 설정에 따라 바꿀 수 있으므로, 지도 아래 범례와 화면의 등락률 기준을 함께 확인하세요.</p>
            </InfoSection>

            <InfoSection number="3" title="종목 정보 확인하기">
              <p>종목 이름과 등락률은 사각형 크기와 표시 설정에 따라 보이지 않을 수 있습니다. 종목에 마우스를 올리거나 우클릭하면 종목명, 등락률, 현재가, 기준 가격, 시가총액을 확인할 수 있습니다. 팝업을 띄우는 동작은 설정에 따라 다릅니다.</p>
              <p>지도에 표시되는 종목과 글자 크기는 시가총액 범위, 제외 업종, 박스 안 표기 설정의 영향을 받습니다.</p>
            </InfoSection>

            <InfoSection number="4" title="코스피·코스닥 지도와 그래프 보기">
              <p>아래에서 시장을 골라 지도를 열 수 있습니다. 업종별 움직임을 막대 그래프로 비교하려면 <GuideLink to="/graph/allstock">국내 주식 업종 그래프</GuideLink>를 확인하세요.</p>
              <nav aria-label="시장별 주식 지도" className="grid gap-3 pt-1 sm:grid-cols-3">
                {MAP_LINKS.map(({ to, label }) => (
                  <Link key={to} to={to} className="flex min-h-12 items-center justify-center border border-ui-border bg-ui-panel px-3 py-3 text-center font-semibold text-ui-white transition-colors hover:bg-ui-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                    {label}
                  </Link>
                ))}
              </nav>
              <InfoCallout title="화면 안내">
                MARKETRY 지도와 그래프는 PC 화면에 최적화되어 있습니다. 모바일에서는 이 사용법을 읽을 수 있으며, 지도 조작은 PC에서 이용해 주세요.
              </InfoCallout>
            </InfoSection>
          </div>

          <footer className="mt-8 border-t border-ui-border pt-5 text-sm leading-relaxed text-ui-muted">
            시장 데이터는 외부 출처를 바탕으로 가공되며 오류가 있거나 늦게 반영될 수 있습니다. 투자 판단을 위한 참고 정보로 이용해 주세요. 자세한 내용은 <GuideLink to="/info/source">데이터 출처와 기준</GuideLink>에서 확인할 수 있습니다.
          </footer>
        </article>
      </main>
    </div>
  )
}
