import DocumentPageLayout from '@/components/DocumentPageLayout'

const DATA_SOURCES: { source: string; items: string[] }[] = [
  { source: '키움증권', items: ['시세/등락률/시가총액', '코스피·코스닥 지수/거래대금', '종목명/업종명', '신규 상장 종목', 'NXT 거래 가능 종목'] },
  { source: '토스증권', items: ['날짜/시간/거래 세션/휴장일', '거래정지/상장폐지 종목'] },
  { source: 'NEXTRADE', items: ['NXT 거래 가능 종목 (키움증권 데이터 누락 시)'] },
  { source: 'MARKETRY', items: ['종목·업종 분류'] },
  { source: '내 기준', items: ['사용자 스스로 분류'] },
]

const PROCESSING_RULES: { title: string; description: string }[] = [
  {
    title: '시각·거래 세션',
    description: '시계는 화면 데이터 스냅샷의 기준 시각이며, 모든 시간은 한국 시간(UTC+9)으로 표시합니다. 거래일 시간표를 우선 적용하고, 없을 때는 프리 08:00~09:00 · 메인 09:00~15:40 · 애프터 15:40~20:00 · 그 외 마켓 종료로 표시합니다.',
  },
  {
    title: '지도 박스 크기',
    description: '종목·업종 박스의 면적은 시가총액^(비율÷100)으로 계산합니다. 0%는 같은 크기, 50%는 시가총액의 제곱근 비율, 100%는 시가총액 비례입니다.',
  },
  {
    title: '등락률과 업종',
    description: '등락률은 선택한 기준(종가·누적·시간외 별도)의 기준 가격과 현재 가격으로 계산해 색상과 수치에 표시합니다. 업종 시가총액은 포함 종목을 합산하며, MARKETRY 분류 또는 사용자의 내 기준을 사용합니다.',
  },
]

export default function SourcePage() {
  return (
    <DocumentPageLayout title="SOURCE">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ui-white">
          <span aria-hidden="true" className="h-7 w-1 shrink-0 rounded-sm bg-brand" />
          데이터
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ui-text">MARKETRY는 아래 데이터를 바탕으로 시장 정보를 가공해 보여 줍니다. 데이터는 오류 또는 지연될 수 있으며 투자 참고용으로만 제공됩니다.</p>
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 xl:grid-cols-3">
          {DATA_SOURCES.map(({ source, items }) => (
            <section key={source}>
              <h2 className="text-lg font-bold text-ui-white">{source}</h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed text-ui-text">
                {items.map(item => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ))}
        </div>
        <section className="mt-5 border-t border-ui-border pt-4">
          <h2 className="text-lg font-bold text-ui-white">표시·가공 기준</h2>
          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 xl:grid-cols-3">
            {PROCESSING_RULES.map(({ title, description }) => (
              <div key={title}>
                <h3 className="text-base font-bold text-ui-white">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ui-text">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DocumentPageLayout>
  )
}
