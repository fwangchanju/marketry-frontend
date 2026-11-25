import { getProtectedSectorHint } from '@/utils/protectedSector'
import SectorTable from '@/components/SectorTable'
import type { SectorItem } from '@/types/api'
import type { SectorStats } from '@/utils/sectorOrder'
import { useMemo, type ReactNode } from 'react'
import { SortIcon } from '@/components/icons/AppIcons'
import { SEARCH_MAX_LENGTH } from '@/utils/sectorSearch'
import type { HeatmapResponse } from '@/types/api'

// 이 시트 전용 색 — MARKETRY 표(커스텀 종목 표)의 강조색·노란 화살표를 가져다 쓰지 않는다. MARKETRY 색을 바꿔도
// 이 시트가 따라 바뀌지 않도록 색은 전부 여기 모아 두었다. 시트 색을 바꿀 때도 여기만 고치면 된다.
// Tailwind는 완성된 클래스 이름만 인식하므로, 클래스를 문자열로 조립하지 말고 아래처럼 통째로 적는다.
const COLOR = {
  headerBg: 'bg-[var(--ui-panel)]',
  headerText: 'text-ui-white',
  rowDivider: 'border-ui-border',
  sortActive: 'text-[var(--brand)]',
  sortInactive: 'text-ui-muted',
  sortHover: 'hover:text-ui-text',
} as const

export type SortDirection = 'asc' | 'desc'

// 글자 옆에 ⇅ 정렬 아이콘이 붙는 머리글 글자 — 업종 표(내 기준·MARKETRY·거래소)의 한 줄 머리글이 같이 쓴다.
export function SortLabel({ label, active, direction, onClick }: { label: string; active: boolean; direction: SortDirection; onClick: () => void }) {
  return (
    <button type="button" className="group/sort inline-flex cursor-pointer select-none items-center border-0 bg-transparent p-0 align-middle text-inherit hover:text-[var(--brand)]" onClick={onClick}>
      {label}
      <span className={`ml-1 inline-flex align-middle group-hover/sort:text-[var(--brand)] ${active ? COLOR.sortActive : COLOR.sortInactive}`}>
        <SortIcon active={active} direction={direction} className="h-3.5 w-3.5" />
      </span>
    </button>
  )
}

interface SectorRow {
  sectorName: string
  sectorPath?: string[]
  stocks: HeatmapResponse['items'][number]['items']
}

// 종목 표는 대·중·소분류에 직접 배정된 종목을 모두 읽되, 각 종목의 배정 업종명을 유지한다.
function collectSectorRows(nodes: HeatmapResponse['items'], parentPath: string[] = []): SectorRow[] {
  return nodes.flatMap(node => {
    const sectorPath = [...parentPath, node.sectorName]
    return [
      { sectorName: node.sectorName, sectorPath, stocks: node.items },
      ...collectSectorRows(node.children, sectorPath),
    ]
  })
}

// KRX/NXT·MARKETRY 시트 — 업종 분류를 읽기만 하는 화면이다. 편집 기능(추가·이동·배정)은 없고, 지도의 해당 분류이 보여주는
// 분류(/map?source=...)를 그대로 표로 보여준다. 시세가 있는 종목만 내려오므로 거래정지 종목 등은 빠질 수 있다.
export default function ReadOnlyTaxonomySheet({ data, source, toolbarContainer }: { data: HeatmapResponse | undefined; source: 'KRX' | 'MARKETRY'; toolbarContainer: HTMLElement | null }) {
  const sectors = useMemo<SectorRow[]>(() => (data ? collectSectorRows(data.items) : []), [data])
  return <CategoryTable sectors={sectors} source={source} toolbarContainer={toolbarContainer} />
}

// 검색어 최대 글자 수 — 분류 이름(대·중·소분류)·약칭 최대 길이(12자)와 같다.
// 표 위의 검색창과 개수 — 카테고리·종목 화면이 같은 틀(위치·크기)을 쓰도록 한 곳에 둔다. 커스텀 종목 표도 이걸 쓴다.
export function SearchBar({ query, onChange, placeholder, ariaLabel, countLabel, extra, settingsLayout = false, inline = false, inlineWidthClassName = 'w-[250px]', afterInput, maxLength = SEARCH_MAX_LENGTH }: {
  query: string
  onChange: (query: string) => void
  placeholder: string
  ariaLabel: string
  countLabel?: string
  settingsLayout?: boolean
  // 윗줄(드롭다운 오른쪽)에 한 줄로 얹을 때 — 표 위 줄 전용 여백(아래 간격·오른쪽 여백)을 없앤다.
  inline?: boolean
  // 페이지별 표에 맞춰 inline 검색창 너비를 조정한다.
  inlineWidthClassName?: string
  // 개수 오른쪽 끝에 붙는 추가 조작(예: "NXT만 보기" 체크박스).
  extra?: ReactNode
  // 검색창 바로 오른쪽에 붙는 조작(예: 관리자 버튼, 필터 요약).
  afterInput?: ReactNode
  // 입력 길이 한도. 기본은 업종 검색 한도이고, 종목 검색은 쉼표로 여러 개를 이어 쓰도록 더 길게 준다.
  maxLength?: number
}) {
  return (
    <div className={settingsLayout ? 'mb-6 flex min-w-0 flex-col gap-2' : inline ? 'flex shrink-0 items-center' : 'flex shrink-0 items-center pr-[18px] pb-2'}>
      <input
        type="text"
        value={query}
        maxLength={maxLength}
        // 한글처럼 글자를 조합하며 치는 입력은 maxLength를 넘는 한 글자가 조합 중에 잠깐 들어온다 — 넘는 순간 바로 잘라 낸다.
        onChange={event => onChange(event.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`nes-input is-dark text-sm font-normal focus:placeholder:text-transparent ${
          // 윗줄 검색창은 표 안의 약칭 입력창과 같은 색(모서리는 직사각형으로 툴바 칩과 같다)이고, 높이는 왼쪽 제목 박스(24px)와 같다.
          inline
            ? `toolbar-badge h-6 ${inlineWidthClassName} !rounded-none !border-0 !bg-[var(--ui-panel)] text-ui-white outline-none placeholder:text-ui-muted focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]`
            : `focus:outline-1 focus:outline-offset-0 focus:outline-ui-white ${settingsLayout ? 'h-8 w-full' : 'h-7 w-[15.5rem]'}`
        }`}
        // 안내 문구와 입력 글자가 위 드롭박스의 글자와 같은 선에서 시작하게 한다: 드롭박스 안쪽 여백(0.5rem)에서
        // 이 입력창의 테두리(1px)만큼 뺀다. 유틸리티 클래스는 nes.css보다 약해서 인라인으로 준다.
        style={{ paddingLeft: 'calc(0.5rem - 1px)' }}
      />
      {afterInput && <div className="ml-2 flex shrink-0 items-center gap-3">{afterInput}</div>}
      {/* 개수는 위 헤더의 "읽기 전용"과 같은 위치에서 시작한다: 드롭박스 둘(15.5rem) + 간격(0.5rem) + "읽기 전용"의 왼쪽 여백(0.75rem)
          = 16.75rem이고, 검색창이 15.5rem이므로 사이에 1.25rem을 둔다. */}
      {countLabel && <span className={settingsLayout ? 'text-xs text-ui-muted' : 'ml-5 text-sm text-ui-muted'}>{countLabel}</span>}
      {extra && <div className="ml-auto flex items-center">{extra}</div>}
    </div>
  )
}

// 업종 트리(대·중·소분류)를 내 기준 칸(`SectorTable`)이 받는 형식으로 바꾼다. 번호는 경로 순서로 매기고,
// 업종마다 하위 업종까지 포함한 시가총액 합·종목 수를 센다(MARKETRY·거래소 업종 표와 같은 계산).
function buildReadOnlySectorTree(sectors: SectorRow[]): { items: SectorItem[]; stats: SectorStats } {
  const idByPath = new Map<string, number>()
  const items: SectorItem[] = []
  const stats = new Map<number, { marketValue: number; stockCount: number }>()
  for (const sector of sectors) {
    const path = sector.sectorPath && sector.sectorPath.length > 0 ? sector.sectorPath : [sector.sectorName]
    let parentId: number | null = null
    for (let depth = 0; depth < path.length; depth++) {
      const key = path.slice(0, depth + 1).join('>')
      let id = idByPath.get(key)
      if (id === undefined) {
        id = idByPath.size + 1
        idByPath.set(key, id)
        items.push({ id, name: path[depth], parentId, depth })
      }
      parentId = id
    }
  }
  // 자기 종목과 하위 업종 종목을 모두 각 상위 업종에 더한다.
  for (const sector of sectors) {
    const path = sector.sectorPath && sector.sectorPath.length > 0 ? sector.sectorPath : [sector.sectorName]
    const marketValue = sector.stocks.reduce((sum, stock) => sum + stock.totalMarketValue, 0)
    for (let depth = 0; depth < path.length; depth++) {
      const id = idByPath.get(path.slice(0, depth + 1).join('>'))
      if (id === undefined) continue
      const current = stats.get(id) ?? { marketValue: 0, stockCount: 0 }
      stats.set(id, { marketValue: current.marketValue + marketValue, stockCount: current.stockCount + sector.stocks.length })
    }
  }
  return { items, stats }
}

// 대·중·소분류 업종 표는 내 기준 칸을 그대로 쓰고, 읽기 전용으로 켠다(끌기·추가·이름 변경·삭제 없음).
function CategoryTable({ sectors, source, toolbarContainer }: { sectors: SectorRow[]; source: 'KRX' | 'MARKETRY'; toolbarContainer: HTMLElement | null }) {
  const tree = useMemo(() => buildReadOnlySectorTree(sectors), [sectors])
  // 거래소 모드는 번호 배지를 거래소 색으로 맞춘다(index.css의 data-sector-profile).
  return (
    <div data-sector-profile={source === 'KRX' ? 'exchange' : undefined} className="flex min-h-0 flex-1 flex-col">
      <SectorTable sectors={tree.items} sectorStats={tree.stats} actions={null} currency="원" maxDepth={3} protectedHint={getProtectedSectorHint} toolbarContainer={toolbarContainer} />
    </div>
  )
}

