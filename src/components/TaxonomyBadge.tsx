import { useSession } from '@/hooks/useSession'
import { TAXONOMY_NAMES, type TaxonomyKey } from '@/utils/taxonomyNames'

// 상단 오른쪽 분류 배지 — 지도·그룹·커스텀 페이지가 같은 모양을 쓰고, 높이는 왼쪽 제목 배지·칩(24px)과 같다. 왼쪽 밝은 칸이 지금 보는 분류, 오른쪽 짙은 칸이 "분류"다("MARKETRY 분류"처럼 읽힌다).
// 내 분류는 이름 대신 내 닉네임을 보여 준다(닉네임이 없으면 '내 분류'). "분류"를 오른쪽 끝에 고정해서, 이름이 길면 배지가 왼쪽으로 늘어나다가 이름 끝을 줄인다.
export default function TaxonomyBadge({ taxonomy }: { taxonomy: TaxonomyKey }) {
  const { data: session } = useSession()
  const title = taxonomy === 'MINE' ? session?.nickname || TAXONOMY_NAMES.MINE.title : TAXONOMY_NAMES[taxonomy].title
  return (
    <span className="flex min-w-0 items-center justify-end">
      <span className="flex h-6 min-w-0 overflow-hidden">
        <span className="flex min-w-0 items-center bg-[var(--brand)] px-1.5 font-semibold text-black">
          <span className="truncate">{title}</span>
        </span>
        <span className="flex shrink-0 items-center bg-cyan-700 px-1.5 text-[13px] font-semibold text-white">분류</span>
      </span>
    </span>
  )
}
