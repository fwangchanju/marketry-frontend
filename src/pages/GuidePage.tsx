import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import DocumentPageLayout from '@/components/DocumentPageLayout'
import { navigateWithMobileSlide } from '@/utils/mobilePageTransition'
import { InfoPageHeading, InfoSection } from '@/components/InfoDocument'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import { useMobilePageSwipe } from '@/hooks/useMobilePageSwipe'
import { SECTOR_KOREA } from '@/utils/customRoutes'
import { marketRoute } from '@/utils/marketRoute'

const destinations = [
  { label: '국내증시 히트맵', to: '/map/korea' },
  { label: '코스피 히트맵', to: '/map/kospi' },
  { label: '코스닥 히트맵', to: '/map/kosdaq' },
  { label: '국내증시 등락률 그래프', to: '/graph/korea' },
  { label: '코스피 등락률 그래프', to: '/graph/kospi' },
  { label: '코스닥 등락률 그래프', to: '/graph/kosdaq' },
]

function IndustryGroupingExample() {
  return (
    <div className="space-y-3" aria-label="국내증시 거래소와 MARKETRY 분류 비교">
      <figure className="overflow-hidden border border-ui-border bg-ui-surface">
        <figcaption className="flex flex-wrap items-center gap-3 border-b border-ui-border bg-ui-control px-3 py-2 text-sm font-bold text-ui-white [&_.toolbar-badge>span]:!text-sm [&_.toolbar-badge>span]:!font-bold sm:px-4">
          <span className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-sm bg-ui-white" />국내증시 히트맵</span>
          <span className="inline-flex border border-ui-white/50"><TaxonomyBadge taxonomy="KRX" /></span>
        </figcaption>
        <img src="/images/guide/korea-exchange.png" alt="국내증시 히트맵 거래소 분류: 삼성전자와 SK하이닉스가 전기·전자 업종에, SK스퀘어·SK와 삼성생명·삼성화재가 금융·보험 업종에 나뉘어 보이는 지도" className="block h-auto w-full" loading="lazy" />
      </figure>
      <p className="text-sm text-ui-text">거래소 분류에서는 삼성 그룹과 SK 그룹 종목이 전기·전자, 금융, 보험 등 서로 다른 업종에 흩어져 있어 그룹 전체의 움직임을 한눈에 보기 어렵습니다.</p>
      <figure className="!mt-12 overflow-hidden border border-ui-border bg-ui-surface">
        <figcaption className="flex flex-wrap items-center gap-3 border-b border-ui-border bg-brand-surface px-3 py-2 text-sm font-bold text-ui-white [&_.toolbar-badge>span]:!text-sm [&_.toolbar-badge>span]:!font-bold sm:px-4">
          <span className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-sm bg-ui-white" />국내증시 히트맵</span>
          <span className="inline-flex border border-ui-white/50"><TaxonomyBadge taxonomy="MARKETRY" /></span>
        </figcaption>
        <img src="/images/guide/korea-marketry.png" alt="국내증시 히트맵 MARKETRY 분류: S7 대분류 아래 삼성 그룹과 SK 그룹으로 관련 종목을 모아 보여주는 지도" className="block h-auto w-full" loading="lazy" />
      </figure>
      <p className="text-sm text-ui-text">MARKETRY에서는 삼성 그룹과 SK 그룹을 S7 대분류 아래 각각의 중분류로 모아, 그룹별 시장 흐름을 한눈에 살펴볼 수 있습니다.</p>
    </div>
  )
}

export default function GuidePage() {
  const isNarrow = useIsNarrowScreen()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedMarket = searchParams.get('market')
  const returnMarket = requestedMarket === 'KOSPI' || requestedMarket === 'KOSDAQ' ? requestedMarket : 'ALL_STOCK'
  const returnPath = marketRoute('/map', returnMarket)
  // 모바일 페이지 순서는 종목 지도 → 업종 지도 → 그룹 등락률 → 가이드 → 종목 지도다. 슬라이드도 상단 제목 버튼과 같은 순서로 돈다.
  const swipe = useMobilePageSwipe(isNarrow, () => navigate(returnPath), () => navigate(marketRoute('/graph', returnMarket)))
  return (
    <div {...swipe.handlers} style={swipe.style} className={isNarrow ? 'bg-ui-background' : undefined}>
    <DocumentPageLayout
      title="GUIDE"
      panelDescription="나만의 분류로 시장 흐름 관찰하기"
      mobileTitleTo={isNarrow ? returnPath : undefined}
      mobileTitleLabel={isNarrow ? '종목 지도로 이동' : undefined}
      mobileTitleClick={isNarrow ? () => navigateWithMobileSlide(navigate, returnPath) : undefined}
      heading={(
        <InfoPageHeading
          flushBottom
          title="가이드"
          summary="국내증시의 클래식한 업종 분류로는 놓치기 쉬운 시장의 흐름을 나만의 새로운 분류 방법으로 관찰해 보세요."
        />
      )}
    >
      <article className="mx-auto w-full max-w-4xl space-y-12">
        <InfoSection number="1" title="업종 분류를 내 기준으로 새롭게 구성">
          <p>서로 다른 업종에 있는 종목도 내 기준으로 새롭게 묶어서 볼 수 있습니다. 원치 않는 그룹은 지도에서 숨길 수도 있습니다.</p>
          <IndustryGroupingExample />
          <div className="!mt-12 space-y-3">
            <p>또 다른 새로운 접근 방식이 있다면, 직접 그룹을 분류해 보세요.</p>
            {/* 커스텀 화면의 기존 주소 규칙(?sheet=MINE): 로그인했으면 내 기준으로 열고, 비로그인이면 로그인 안내를 띄운다. 모바일은 커스텀 화면이 없어 안내만 한다. */}
            {isNarrow ? (
              <p className="text-ui-muted">내 업종 설정은 PC 화면에서 할 수 있습니다.</p>
            ) : (
              <Link to={`${SECTOR_KOREA}?sheet=MINE`} className="inline-flex min-h-11 items-center border border-brand px-3 text-sm font-bold text-brand hover:bg-brand/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                내 업종 설정하기<span aria-hidden="true" className="ml-2">↗</span>
              </Link>
            )}
          </div>
        </InfoSection>

        <InfoSection number="2" title="초대형주에 가려진 흐름 보기">
          <p>종목박스 크기를 조절하면 상대적으로 작은 종목들의 움직임도 비교하기 쉬워집니다.</p>
          <div className="!mt-8 space-y-3" aria-label="시가총액 반영 비율에 따른 국내증시 히트맵 비교">
            <figure className="overflow-hidden border border-ui-border bg-ui-surface">
              <figcaption className="flex flex-wrap items-center gap-3 border-b border-ui-border bg-ui-control px-3 py-2 text-sm font-bold text-ui-white sm:px-4">
                <span className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-sm bg-ui-white" />국내증시 히트맵</span>
                <span className="inline-flex border border-ui-white/50"><span className="flex h-6"><span className="flex items-center bg-brand px-1.5 text-ui-background">시가총액 반영</span><span className="flex items-center bg-brand-surface px-1.5 text-ui-white">100%</span></span></span>
              </figcaption>
              <img src="/images/guide/korea-size-100.png" alt="시가총액을 100% 반영해 삼성전자와 SK하이닉스의 박스가 크게 표시된 국내증시 히트맵" className="block h-auto w-full" loading="lazy" />
            </figure>
            <p>시가총액에 비례해 종목 크기를 표시하면, 초대형주가 지도의 상당 부분을 차지해 상대적으로 작은 종목들의 흐름이 눈에 드러나지 않습니다.</p>
            <figure className="!mt-12 overflow-hidden border border-ui-border bg-ui-surface">
              <figcaption className="flex flex-wrap items-center gap-3 border-b border-ui-border bg-brand-surface px-3 py-2 text-sm font-bold text-ui-white sm:px-4">
                <span className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-sm bg-ui-white" />국내증시 히트맵</span>
                <span className="inline-flex border border-ui-white/50"><span className="flex h-6"><span className="flex items-center bg-brand px-1.5 text-ui-background">시가총액 반영</span><span className="flex items-center bg-brand-surface px-1.5 text-ui-white">45%</span></span></span>
              </figcaption>
              <img src="/images/guide/korea-size-45.png" alt="시가총액 반영을 45%로 낮춰 여러 업종과 종목이 더 넓게 표시된 국내증시 히트맵" className="block h-auto w-full" loading="lazy" />
            </figure>
            <p>시가총액 반영 비율을 낮추면 초대형주의 크기가 줄어들어, 다른 종목과 업종의 흐름도 더 잘 보입니다.</p>
          </div>
        </InfoSection>

        <InfoSection number="3" title="히트맵과 등락률 그래프">
          <p>히트맵은 종목별 움직임과 업종 구성을 한눈에 보여주고, 그래프는 직접 분류한 그룹의 등락률을 비교합니다.</p>
          <div className="!mt-8 space-y-3" aria-label="업종 분류 단계에 따른 국내증시 등락률 그래프 비교">
            <figure className="overflow-hidden border border-ui-border bg-ui-surface">
              <figcaption className="flex flex-wrap items-center gap-3 border-b border-ui-border bg-ui-control px-3 py-2 text-sm font-bold text-ui-white sm:px-4">
                <span className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-sm bg-ui-white" />국내증시 등락률 그래프</span>
                <span className="inline-flex border border-ui-white/50"><span className="flex h-6"><span className="flex items-center bg-brand px-1.5 text-ui-background">업종 분류 단계</span><span className="flex items-center bg-brand-surface px-1.5 text-ui-white">대분류</span></span></span>
              </figcaption>
              <img src="/images/guide/korea-graph-major.png" alt="MARKETRY 대분류 업종별 등락률을 비교하는 국내증시 그래프" className="block h-auto w-full" loading="lazy" />
            </figure>
            <p>S7, 반도체 소·부·장처럼 큰 그룹의 등락률을 한눈에 비교할 수 있습니다.</p>
            <figure className="!mt-12 overflow-hidden border border-ui-border bg-ui-surface">
              <figcaption className="flex flex-wrap items-center gap-3 border-b border-ui-border bg-brand-surface px-3 py-2 text-sm font-bold text-ui-white sm:px-4">
                <span className="flex items-center gap-2"><span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-sm bg-ui-white" />국내증시 등락률 그래프</span>
                <span className="inline-flex border border-ui-white/50"><span className="flex h-6"><span className="flex items-center bg-brand px-1.5 text-ui-background">업종 분류 단계</span><span className="flex items-center bg-brand-surface px-1.5 text-ui-white">중분류</span></span></span>
              </figcaption>
              <img src="/images/guide/korea-graph-middle.png" alt="MARKETRY 중분류 업종별 등락률을 비교하는 국내증시 그래프" className="block h-auto w-full" loading="lazy" />
            </figure>
            <p>삼성 그룹과 SK 그룹처럼 더 세부적인 그룹의 등락률을 비교할 수 있습니다. 직접 분류한 그룹도 같은 방식으로 확인할 수 있습니다.</p>
          </div>
          <nav aria-label="시장 지도와 그래프" className="!mt-12 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {destinations.map(({ label, to }) => (
              <Link key={to} to={to} className="flex min-h-11 items-center border border-ui-border bg-ui-panel px-3 text-sm font-bold text-ui-white hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                {label}<span aria-hidden="true" className="ml-auto text-ui-muted">↗</span>
              </Link>
            ))}
          </nav>
        </InfoSection>
      </article>
    </DocumentPageLayout>
    </div>
  )
}
