import { Link } from 'react-router-dom'
import DocumentPageLayout from '@/components/DocumentPageLayout'
import { InfoPageHeading, InfoSection } from '@/components/InfoDocument'

const destinations = [
  { label: '국내증시 히트맵', to: '/map/korea' },
  { label: '코스피 히트맵', to: '/map/kospi' },
  { label: '코스닥 히트맵', to: '/map/kosdaq' },
  { label: '국내증시 등락률 그래프', to: '/graph/korea' },
  { label: '코스피 등락률 그래프', to: '/graph/kospi' },
  { label: '코스닥 등락률 그래프', to: '/graph/kosdaq' },
]

export default function StockHeatmapGuidePage() {
  return (
    <DocumentPageLayout
      title="GUIDE"
      panelDescription="히트맵과 등락률 그래프를 내 기준으로 보는 방법입니다."
      heading={(
        <InfoPageHeading
          flushBottom
          title="증시 히트맵을 내 기준으로 보는 법"
          summary="업종 분류와 종목 크기를 조절해 익숙한 기준만으로는 놓치기 쉬운 시장 흐름을 살펴보세요."
        />
      )}
    >
      <article className="mx-auto w-full max-w-4xl space-y-5">
        <InfoSection title="업종을 원하는 기준으로 묶기">
          <p>“왜 이 종목이 이 업종에 있지?” 싶다면 업종 그룹을 직접 분류해 함께 움직이는 종목을 한곳에서 볼 수 있습니다.</p>
          <p>분류 단계를 조절하거나 원치 않는 업종을 제외해 지도를 내 관점에 맞게 구성해 보세요.</p>
        </InfoSection>

        <InfoSection title="대형주에 가려진 흐름 보기">
          <p>종목 박스 크기에 반영되는 시가총액 비율을 낮추면 대형주 면적을 줄여 다른 종목의 등락도 비교하기 쉬워집니다.</p>
        </InfoSection>

        <InfoSection title="히트맵과 등락률 그래프">
          <p>히트맵은 종목별 움직임과 업종 구성을 함께 보여주고, 그래프는 직접 분류한 업종 그룹의 등락률을 비교합니다.</p>
          <nav aria-label="시장 지도와 그래프" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {destinations.map(({ label, to }) => (
              <Link key={to} to={to} className="flex min-h-11 items-center border border-ui-border bg-ui-panel px-3 text-sm font-bold text-ui-white hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                {label}<span aria-hidden="true" className="ml-auto text-ui-muted">↗</span>
              </Link>
            ))}
          </nav>
        </InfoSection>
      </article>
    </DocumentPageLayout>
  )
}
