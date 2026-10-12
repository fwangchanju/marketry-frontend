const DEPTH_LABELS = ['대분류', '중분류', '소분류']

// 홈 그룹 등락률 박스 위 한 줄 — 지금 그래프가 보여 주는 업종 분류의 단계(대분류·중분류·소분류)만 알려 주는 배지다. 눌러서 바꾸지 않는다
// (단계는 설정창의 "업종 분류 단계"에서 고른다). 그룹 페이지 제목 옆의 단계 배지와 같은 짙은 청록 배지만 가운데에 두고, 코스피·코스닥 지수 배지 줄과 같은 높이(24px)를 지켜 두 틀의 아래 그래프가 어긋나지 않게 한다.
export default function DepthBadge({ depth }: { depth: number }) {
  return (
    <div className="mb-1 flex h-6 shrink-0 items-center justify-center whitespace-nowrap text-[13px] leading-none">
      <span className="rounded bg-cyan-700 px-2 py-[3px] font-semibold text-white">{DEPTH_LABELS[depth - 1] ?? DEPTH_LABELS[0]}</span>
    </div>
  )
}
