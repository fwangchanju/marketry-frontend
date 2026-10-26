import DocumentPageLayout from '@/components/DocumentPageLayout'
import { INFO_LIST, InfoPageHeading, InfoSection } from '@/components/InfoDocument'

const DATA_SOURCES: { source: string; category: string; items: string[] }[] = [
  { source: '키움증권', category: '시장·종목 데이터', items: ['시세·등락률·시가총액', '코스피·코스닥 지수·거래대금', '종목명·업종명', '신규 상장 종목', 'NXT 거래 가능 종목'] },
  { source: '토스증권', category: '거래 일정·상태', items: ['날짜·시간·거래 세션·휴장일', '거래정지·상장폐지 종목'] },
  { source: 'NEXTRADE', category: 'NXT 거래 정보', items: ['NXT 거래 가능 종목 (키움증권 데이터가 없을 때만)'] },
  { source: 'MARKETRY', category: '서비스 분류', items: ['종목·업종 분류'] },
  { source: '내 기준', category: '이용자 설정', items: ['이용자가 직접 만든 분류'] },
]

const PROCESSING_RULES: { title: string; description: string }[] = [
  {
    title: '시각·거래 세션',
    description: '시계는 화면 데이터의 기준 시각이며 모든 시간은 한국 시간(UTC+9)입니다. 거래일 시간표를 우선 적용하고, 없을 때는 프리 08:00~09:00 · 메인 09:00~15:40 · 애프터 15:40~20:00 · 그 외 마켓 종료로 표시합니다.',
  },
  {
    title: '지도 박스 크기',
    description: '종목·업종 박스 면적은 시가총액^(비율÷100)으로 계산합니다. 0%는 같은 크기, 50%는 시가총액의 제곱근 비율, 100%는 시가총액 비례입니다.',
  },
  {
    title: '등락률·업종',
    description: '등락률은 선택한 기준(종가·누적·시간외 별도)의 기준 가격과 현재 가격으로 계산합니다. 업종 시가총액은 포함 종목을 합산하며 MARKETRY 분류 또는 이용자의 내 기준을 사용합니다.',
  },
]

export default function SourcePage() {
  return (
    <DocumentPageLayout
      title="SOURCE"
      panelDescription="시장 데이터의 출처와 기준입니다."
      heading={(
        <InfoPageHeading
          flushBottom
          title="데이터"
          summary="MARKETRY는 아래 출처의 정보를 가공해 시장 지도를 보여 줍니다. 데이터는 오류가 있거나 늦게 반영될 수 있으며 투자 참고용으로만 제공합니다."
        />
      )}
    >
      <article className="mx-auto max-w-4xl space-y-5">
        <InfoSection number="1" title="데이터 출처">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {DATA_SOURCES.map(({ source, category, items }) => (
              <section key={source} className="border border-ui-border bg-ui-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-base font-bold text-ui-white">
                    <span aria-hidden="true" className="h-4 w-1 rounded-sm bg-brand" />
                    {source}
                  </h3>
                  <span className="border border-ui-border px-2 py-1 text-xs text-ui-muted">{category}</span>
                </div>
                <ul className={`${INFO_LIST} mt-3`}>
                  {items.map(item => <li key={item}>{item}</li>)}
                </ul>
              </section>
            ))}
          </div>
        </InfoSection>

        <InfoSection number="2" title="표시·가공 기준">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {PROCESSING_RULES.map(({ title, description }, index) => (
              <section key={title} className="border border-ui-border bg-ui-panel p-4">
                <p className="text-xs font-bold text-brand">기준 {index + 1}</p>
                <h3 className="mt-2 text-base font-bold text-ui-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ui-text">{description}</p>
              </section>
            ))}
          </div>
        </InfoSection>
      </article>
    </DocumentPageLayout>
  )
}
