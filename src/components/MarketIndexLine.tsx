import { toPctSigned } from '@/utils/format'

interface IndexChange {
  label: string
  // 지수 값(예: 7,003.74)과 등락률(%) — 아직 못 받았으면 null
  indexValue: number | null
  changeRate: number | null
  // 이름 배지의 배경 클래스 — 기본은 청록(cyan-700). 두 지수를 색으로 나누려고 코스닥은 더 짙은 청록(cyan-900)을 넘긴다.
  badgeClass?: string
}

// 오르면 빨강·내리면 파랑(지도와 같은 방향) — 변화가 없거나 값이 없으면 회색.
function rateColorClass(changeRate: number | null): string {
  if (changeRate === null || changeRate === 0) return 'text-gray-300'
  return changeRate > 0 ? 'text-red-400' : 'text-blue-400'
}

const toIndexValue = (value: number): string => value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 홈 시장 요약 지도 위 한 줄 — 코스피·코스닥의 지수 값과 등락률을 어두운 배지로 보여 준다("코스피 7,003.74 +0.46%").
// 코스피·코스닥 이름 부분만 그룹 분류 단계와 같은 짙은 청록 배지로 표시한다.
// 등락이 작은 날에도 오르내림이 한눈에 보이도록 배경은 고정 색으로 두고 등락률 글자만 색을 입힌다.
// 지수명 배지는 수치 배경 밖에 두고, 지수 값과 등락률만 어두운 배경으로 묶는다.
// 값을 아직 못 받았으면 "-" 대신 비워 두고 라벨만 보인다.
// 위젯 폭(342px) 안에 들어가도록 글자는 13px다(14px는 11px 넘친다). 높이 24px 안에 들어가도록 줄 간격을 붙인다.
// 지수가 만 단위·1,000 이상이 되거나 등락이 두 자리가 되어 폭이 모자라면, 배지 안 글자 사이 간격(최소 2px)이 먼저 줄어든다.
export default function MarketIndexLine({ indexes }: { indexes: IndexChange[] }) {
  return (
    <div className="mb-1 flex h-6 shrink-0 items-center gap-2 whitespace-nowrap text-[13px] font-medium leading-none tabular-nums">
      {indexes.map(({ label, indexValue, changeRate, badgeClass = 'bg-cyan-700' }) => (
        <span key={label} className="flex h-[22px] min-w-0 flex-1 items-center gap-1">
          <span className={`shrink-0 rounded-sm px-1 py-[3px] text-white ${badgeClass}`}>{label}</span>
          <span className="flex h-[22px] min-w-0 flex-1 items-center justify-between gap-0.5 rounded-sm bg-zinc-800 px-1">
            <span className="text-gray-300">{indexValue === null ? '' : toIndexValue(indexValue)}</span>
            <span className={rateColorClass(changeRate)}>{changeRate === null ? '' : toPctSigned(changeRate)}</span>
          </span>
        </span>
      ))}
    </div>
  )
}
