import { Link } from 'react-router-dom'
import MarketryLogo from '@/components/MarketryLogo'
import { InfoCallout, InfoSection } from '@/components/InfoDocument'

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
          <Link to="/home" className="text-sm text-ui-text underline underline-offset-4 hover:text-ui-white">시장 지도</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
        <article>
          <header className="border-b border-ui-border pb-6">
            <p className="text-sm font-bold tracking-wide text-brand">DESIGN YOUR MARKET</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-ui-white sm:text-4xl">같이 움직이는 종목을,<br className="sm:hidden" /> 내 기준으로</h1>
            <p className="mt-4 text-base leading-relaxed text-ui-text sm:text-lg">
              기존 업종표가 보여 주는 분류와 내가 보고 싶은 시장은 다를 수 있습니다. 종목을 직접 묶고 대형주 쏠림을 조절해, 시장을 내 관점으로 다시 살펴보세요.
            </p>
          </header>

          <div className="mt-7 space-y-7 text-[15px] leading-7 text-ui-text sm:text-base">
            <InfoSection number="1" title="“왜 이 업종이지?”에서 시작">
              <p>거래소 업종만으로 설명하기 어려운 종목이 있습니다. 설정에서 MARKETRY 분류, 거래소 분류, 내 기준을 골라 같은 시장을 다른 관점으로 볼 수 있습니다. 더 세밀하게 바꾸고 싶을 때는 <GuideLink to="/custom/sector">내 업종을 만들고</GuideLink> 종목을 직접 배치하세요.</p>
            </InfoSection>

            <InfoSection number="2" title="대형주에 가려진 흐름 보기">
              <p>지도 설정에서 박스 크기에 반영되는 시가총액 비율을 낮추면 대형주가 차지하는 면적이 줄어듭니다. 0%는 모든 종목을 같은 크기로, 100%는 시가총액에 비례해 보여 줍니다.</p>
            </InfoSection>

            <InfoSection number="3" title="설정이 바꾸는 시장 지도">
              <p>분류 기준과 박스 크기를 바꾸면 지도의 묶음과 면적이 달라집니다. 지도에서 종목별 등락을 살펴보고, <GuideLink to="/graph/allstock">업종 그래프</GuideLink>에서 같은 기준의 흐름을 비교하세요.</p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link to="/custom/sector" className="flex min-h-12 items-center justify-center border border-brand bg-brand-surface px-4 py-3 text-center font-semibold text-ui-white hover:bg-brand-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">내 업종 만들기</Link>
                <Link to="/home" className="flex min-h-12 items-center justify-center border border-ui-border bg-ui-panel px-4 py-3 text-center font-semibold text-ui-white hover:bg-ui-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">시장 지도 보기</Link>
              </div>
              <InfoCallout title="휴대폰에서도">
                요약 지도에서 대분류와 중분류를 차례로 살펴보고, 원하는 종목 목록을 열 수 있습니다.
              </InfoCallout>
            </InfoSection>
          </div>

          <footer className="mt-8 border-t border-ui-border pt-5 text-sm leading-relaxed text-ui-muted">
            데이터는 투자 참고용이며, 종목 분류나 등락률은 실제 시장의 움직임을 완벽하게 설명하지 않습니다. <GuideLink to="/info/source">데이터 출처와 기준</GuideLink>
          </footer>
        </article>
      </main>
    </div>
  )
}
