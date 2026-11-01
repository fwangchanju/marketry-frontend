import { buildSectorParentHints } from '@/utils/sectorFilterHints'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useReportCountLabel } from '@/hooks/useReportCountLabel'
import { useRowRangeSelection } from '@/hooks/useRowRangeSelection'
import { STOCK_HEADER_ROW_PX, stockTableMinWidthPx, type StockColumnKey } from '@/utils/stockTableColumns'
import StockTableColGroup from '@/components/StockTableColGroup'
import StockSortHeader from '@/components/StockSortHeader'
import { KRX_PROTECTED_SECTOR_NAMES, PROTECTED_SECTOR_NAMES, PROTECTED_SECTOR_TEXT_CLASS, getProtectedSectorHint, placeProtectedSectorsLast } from '@/utils/protectedSector'
import { SortIcon } from '@/components/icons/AppIcons'
import SelectionHintBubble from '@/components/SelectionHintBubble'
import ColumnFilterButton from '@/components/ColumnFilterButton'
import { SEARCH_MAX_LENGTH } from '@/utils/sectorSearch'
import { useStockColumnFilters, type StockFilterKey } from '@/hooks/useStockColumnFilters'
import { useMarketValueTiers } from '@/hooks/useMarketValueTiers'
import { useVirtualizer } from '@tanstack/react-virtual'
import Spinner from '@/components/Spinner'
import EmptyMessage, { EMPTY_DATA_MESSAGE, EMPTY_SEARCH_MESSAGE } from '@/components/EmptyMessage'
import type { Market, HeatmapResponse } from '@/types/api'
import { toCount, toJoEokDecimal } from '@/utils/format'
import { compareKoreanText } from '@/utils/koreanSort'
import { createStockMatcher } from '@/utils/stockSearch'
import { collectItems } from '@/utils/sectorAverage'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'

const MARKET_LABEL: Record<Market, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }

// 이름 정렬 기준은 모든 표가 같다(숫자 < 한글 < 영어 < 특수문자).
const compareName = compareKoreanText

// 열 가운데에 놓되 숫자는 오른쪽 정렬 — 고정 폭 상자를 가운데에 두고 그 안에서 오른쪽 정렬하므로 자릿수가 달라도 끝이 맞는다.
function CenteredRightNumber({ value }: { value: number }) {
  return <span className="mx-auto block w-[6ch] text-right tabular-nums">{toCount(value)}</span>
}

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

// 열 사이 세로 구분선 — 마지막 열 오른쪽에는 긋지 않는다. 머리글은 밝은 선, 본문은 어두운 선이다.
const TABLE_CLASS =
  'w-full border-separate border-spacing-0 [&_th:not(:last-child)]:border-r [&_th:not(:last-child)]:border-ui-white/20 [&_td:not(:last-child)]:border-r [&_td:not(:last-child)]:border-ui-border'

export type SortDirection = 'asc' | 'desc'

// 머리글을 눌러 정렬한다 — 같은 열을 계속 누르면 오름차순 → 내림차순 → 원래대로(처음 순서)로 돌고, 다른 열을 누르면 그 열의 오름차순으로
// 시작한다(커스텀 종목 표와 같은 방식).
function useSort<K extends string>(initialKey: K, initialDirection: SortDirection) {
  // null이면 처음 순서(initialKey·initialDirection)다.
  const [custom, setCustom] = useState<{ key: K; direction: SortDirection } | null>(null)
  const sortKey = custom?.key ?? initialKey
  const direction = custom?.direction ?? initialDirection
  const toggle = (key: K) => {
    if (key !== sortKey || custom === null) setCustom({ key, direction: 'asc' })
    else if (custom.direction === 'asc') setCustom({ key, direction: 'desc' })
    else setCustom(null)
  }
  return { sortKey, direction, toggle }
}

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

function SortableHeader({ label, active, direction, onClick }: { label: string; active: boolean; direction: SortDirection; onClick: () => void }) {
  return (
    <th className={HEADER_CELL}>
      <SortLabel label={label} active={active} direction={direction} onClick={onClick} />
    </th>
  )
}

// 머리글 아래 선을 셀 안쪽에 그려 첫 행과 구분한다.
const HEADER_CELL = `sticky top-0 z-10 ${COLOR.headerBg} px-3 py-1 text-center text-sm font-bold ${COLOR.headerText} shadow-[inset_0_-1px_0_var(--ui-border)]`
const BODY_CELL = `border-b ${COLOR.rowDivider} px-3 py-1 text-sm`
// 종목 표 한 행의 예상 높이(글줄 20 + 위아래 여백 8 + 아래 선 1) — 실제 높이는 렌더 뒤에 다시 잰다.
const STOCK_ROW_HEIGHT = 29
// align-middle: 머리글 글자(화살표 묶음의 가운데)가 왼쪽 체크박스와 같은 높이에 오게 한다.
const STOCK_HEADER_CELL = 'whitespace-nowrap bg-[var(--ui-panel)] text-center align-middle font-bold text-ui-white'
const STOCK_BODY_CELL = 'text-sm'
// 맨 왼쪽 체크박스 칸 — MARKETRY 종목 표(AdminStockTable)와 같은 폭(체크박스 20px + 좌우 4.5px씩)이다.
const CHECKBOX_COLUMN_WIDTH = '29px'
const CHECKBOX_CELL_STYLE = { width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH, maxWidth: CHECKBOX_COLUMN_WIDTH, paddingLeft: 0, paddingRight: 0 } as const

interface Props {
  mode: 'category' | 'stock'
  data: HeatmapResponse | undefined
  isLoading: boolean
  // 데이터를 불러오지 못했는지 — 못 불러온 것을 "표시할 데이터가 없다"로 잘못 보여주지 않는다.
  isError: boolean
  // 불러오지 못했을 때 "다시 시도"를 누르면 호출한다.
  onRetry?: () => void
  // 어떤 분류를 읽기 전용으로 보여주는지 — krx는 거래소 분류, marketry는 올린 분류다.
  source: 'KRX' | 'MARKETRY'
  // NXT 거래 가능 종목코드 — 지도 응답에는 이 정보가 없어서 커스텀 종목 목록(/custom/stock-sectors)에서 받아온다.
  nxtStockCodes: ReadonlySet<string>
  // 지도 응답에는 마켓 정보가 없어 MARKETRY 표와 같은 커스텀 종목 목록에서 가져온다.
  stockMarkets: ReadonlyMap<string, Market>
  // 거래소 분류명은 종목 메타데이터에서 읽고, MARKETRY 대·중·소분류와 별도로 표시한다.
  stockIndustries: ReadonlyMap<string, string | null>
  // nxtStockCodes를 아직 받아오는 중인지 — 받기 전에는 "종목이 없다"고 잘못 보이지 않게 스피너를 보여준다.
  isNxtLoading: boolean
  // 검색창 옆에 두던 "27/27업종" 개수를 받아 갈 곳 — 페이지가 설정창 머리글에 그려 준다.
  onCountLabelChange?: (label: string | undefined) => void
  // 검색창을 그릴 윗줄의 자리(왼쪽 제목 박스 옆) — 없으면 검색창을 그리지 않는다.
  toolbarContainer?: HTMLElement | null
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
export default function ReadOnlyTaxonomySheet({ mode, data, isLoading, isError, onRetry, source, nxtStockCodes, stockMarkets, stockIndustries, isNxtLoading, onCountLabelChange, toolbarContainer }: Props) {
  // 약칭 열은 MARKETRY 표와 관리자에게만 보인다.
  const isAdmin = isAdminSession(useSession().data)
  const sectors = useMemo<SectorRow[]>(() => {
    if (!data) return []
    // 업종 표는 최상위 업종별로 하위 종목까지 집계하고, 종목 표는 실제 배정 업종별로 펼친다.
    const rows = mode === 'stock'
      ? collectSectorRows(data.items)
      : data.items.map(node => ({ sectorName: node.sectorName, stocks: collectItems(node) }))
    return rows.filter(row => row.stocks.length > 0)
  }, [data, mode])

  // 지도·그룹 페이지처럼 불러오지 못했을 때는 큰 원 안에 안내 글을 가운데에 보여준다(원 높이는 지도·그룹 페이지와 같게 위 16px, 아래 47.5px 여백).
  if (isError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center pt-4 pb-[47.5px]">
        <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={onRetry} />
      </div>
    )
  }
  // NXT 열(종목 화면)은 NXT 종목 목록이 와야 맞게 보이므로 그동안 로딩 원을 보여준다.
  // 지도·그룹 페이지처럼 화면 한가운데에 크게 보여준다.
  if (isLoading || (mode === 'stock' && isNxtLoading)) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center pt-4 pb-[47.5px]">
        <Spinner showElapsed />
      </div>
    )
  }
  // 종목이 하나도 없어도 표 틀(검색창·머리글)은 그대로 보여준다 — 시트마다 화면 모양이 달라 보이지 않게 한다.
  const emptyMessage = EMPTY_DATA_MESSAGE
  return mode === 'stock' ? (
    <StockTable showHierarchy={source === 'MARKETRY'} showAlias={source === 'MARKETRY' || isAdmin} sectors={sectors} emptyMessage={emptyMessage} nxtStockCodes={nxtStockCodes} stockMarkets={stockMarkets} stockIndustries={stockIndustries} extra={null} onCountLabelChange={onCountLabelChange} toolbarContainer={toolbarContainer} />
  ) : (
    <CategoryTable sectors={sectors} source={source} emptyMessage={emptyMessage} extra={null} onCountLabelChange={onCountLabelChange} toolbarContainer={toolbarContainer} />
  )
}

// 검색어 최대 글자 수 — 분류 이름(대·중·소분류)·약칭 최대 길이(12자)와 같다.
// 표 위의 검색창과 개수 — 카테고리·종목 화면이 같은 틀(위치·크기)을 쓰도록 한 곳에 둔다. 커스텀 종목 표도 이걸 쓴다.
export function SearchBar({ query, onChange, placeholder, ariaLabel, countLabel, extra, settingsLayout = false, inline = false, inlineWidthClassName = 'w-[250px]', afterInput }: {
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
}) {
  return (
    <div className={settingsLayout ? 'mb-6 flex min-w-0 flex-col gap-2' : inline ? 'flex shrink-0 items-center' : 'flex shrink-0 items-center pr-[18px] pb-2'}>
      <input
        type="text"
        value={query}
        maxLength={SEARCH_MAX_LENGTH}
        // 한글처럼 글자를 조합하며 치는 입력은 maxLength를 넘는 한 글자가 조합 중에 잠깐 들어온다 — 넘는 순간 바로 잘라 낸다.
        onChange={event => onChange(event.target.value.slice(0, SEARCH_MAX_LENGTH))}
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


type CategorySortKey = 'name' | 'stockCount' | 'marketValue'

function CategoryTable({ sectors, source, emptyMessage, extra, onCountLabelChange, toolbarContainer }: { sectors: SectorRow[]; source: 'KRX' | 'MARKETRY'; emptyMessage: string; extra: ReactNode; onCountLabelChange?: (label: string | undefined) => void; toolbarContainer?: HTMLElement | null }) {
  // 노랗게 칠하고 맨 아래에 두는 업종 — MARKETRY는 보호 업종 셋, 거래소는 미분류와 거래 정지다(서버가 정지 종목을 묶어 준다).
  const protectedNames = source === 'MARKETRY' ? PROTECTED_SECTOR_NAMES : KRX_PROTECTED_SECTOR_NAMES
  const [query, setQuery] = useState('')
  // 시가총액 합이 큰 업종부터 처음 보여준다.
  const { sortKey, direction, toggle } = useSort<CategorySortKey>('marketValue', 'desc')
  const rows = useMemo(() => {
    const sign = direction === 'asc' ? 1 : -1
    const sorted = sectors
      .map(sector => ({
        name: sector.sectorName,
        stockCount: sector.stocks.length,
        marketValue: sector.stocks.reduce((sum, stock) => sum + stock.totalMarketValue, 0),
      }))
      .sort((a, b) => {
        const diff = sortKey === 'name' ? compareName(a.name, b.name) : a[sortKey] - b[sortKey]
        return diff === 0 ? compareName(a.name, b.name) : sign * diff
      })
    // MARKETRY 표에서는 보호 업종(신규 상장·거래 정지·미분류)을 정렬 방향과 상관없이 항상 맨 아래에 둔다. 거래소 표는 그대로다.
    return placeProtectedSectorsLast(sorted, row => row.name, protectedNames)
  }, [sectors, sortKey, direction, protectedNames])
  const trimmed = query.trim()
  const visibleRows = useMemo(() => (trimmed ? rows.filter(row => row.name.includes(trimmed)) : rows), [rows, trimmed])
  useReportCountLabel(`${toCount(visibleRows.length)}/${toCount(rows.length)}업종`, onCountLabelChange)
  // 업종 줄 선택 — 종목 표와 같다(줄 누르기·Shift+클릭 범위·끌어서 연속 선택). 읽기 전용 시트라 고른 업종으로 할 수 있는 작업은 아직 없고, 표시만 한다.
  const [selectedNames, setSelectedNames] = useState<ReadonlySet<string>>(new Set())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { rowProps, selectionHint } = useRowRangeSelection(
    useMemo(() => visibleRows.map(row => row.name), [visibleRows]),
    scrollContainerRef,
    selectedNames,
    setSelectedNames,
  )
  const header = (key: CategorySortKey, label: string) => (
    <SortableHeader label={label} active={sortKey === key} direction={direction} onClick={() => toggle(key)} />
  )
  return (
    <div className="relative flex min-h-0 flex-1 flex-col text-ui-white">
      {selectionHint.isOpen && <SelectionHintBubble onClose={selectionHint.close} />}
      {toolbarContainer && createPortal(
        <SearchBar
          inline
          query={query}
          onChange={setQuery}
          placeholder="업종 검색"
          ariaLabel="업종 검색"
          afterInput={extra}
        />,
        toolbarContainer,
      )}
      <div ref={scrollContainerRef} className="relative min-h-0 flex-1 overflow-y-auto border border-ui-border">
        {/* 업종·업종 시가총액·종목 수 세 칸을 같은 폭(삼등분)으로 나눈다 — MARKETRY 업종 화면의 대·중·소분류 칸과 같은 모양이다. */}
        <table className={`${TABLE_CLASS} table-fixed select-none`}>
          <thead>
            <tr style={{ height: STOCK_HEADER_ROW_PX }}>
              {header('name', '업종')}
              {header('marketValue', '시가총액 합')}
              {header('stockCount', '종목 수')}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={row.name}
                {...rowProps(index)}
                className={`cursor-pointer text-ui-muted ${selectedNames.has(row.name) ? '[&>td]:bg-[var(--brand)]/20 [&:hover>td]:bg-[var(--brand)]/35 [&>td]:border-ui-white/20!' : '[&:hover>td]:bg-[var(--brand)]/10 [&:hover>td]:border-ui-white/20!'}`}
              >
                {/* 업종명 시작 위치를 MARKETRY 업종 화면의 대분류 이름과 같게 한다 — 칸 왼쪽에서 8px(여백) + 번호 칸 32px + 10px = 50px. */}
                <td className={`${BODY_CELL} relative truncate text-left !pl-[50px] ${protectedNames.includes(row.name) ? PROTECTED_SECTOR_TEXT_CLASS : ''}`}>
                  {protectedNames.includes(row.name) ? <span data-hint={getProtectedSectorHint(row.name, source)}>{row.name}</span> : row.name}
                </td>
                {/* 종목 표와 같은 시가총액 표기('137조 2,762억' 대신 '137.3조')와 오른쪽 정렬이다. */}
                {/* 업종명 왼쪽 여백과 같은 50px를 시가총액 오른쪽에 둔다. */}
                <td className={`${BODY_CELL} text-right !pr-[50px] text-ui-muted`}>{toJoEokDecimal(row.marketValue / 100_000_000)}</td>
                <td className={BODY_CELL}>
                  <CenteredRightNumber value={row.stockCount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 && <EmptyMessage message={rows.length === 0 ? emptyMessage : EMPTY_SEARCH_MESSAGE} />}
      </div>
    </div>
  )
}

type StockSortKey = 'stockCode' | 'stockName' | 'alias' | 'sectorName' | 'industryName' | 'parentSector' | 'midSector' | 'subSector' | 'totalMarketValue' | 'sizeTier' | 'market' | 'nxt'

// 세 종목 표(MARKETRY·거래소·내 분류)가 같은 열을 보여준다. 거래소의 대/중/소분류는 아직 값이 없어 '-'이고, 월말 업종 재편 뒤에 채운다.
const STOCK_COLUMN_KEYS: readonly StockColumnKey[] = ['stockCode', 'stockName', 'alias', 'totalMarketValue', 'sizeTier', 'market', 'nxt', 'industry', 'parentSector', 'midSector', 'subSector']
const NO_EXCLUDED: ReadonlySet<string> = new Set()

function StockTable({ showHierarchy, showAlias, sectors, emptyMessage, nxtStockCodes, stockMarkets, stockIndustries, extra, onCountLabelChange, toolbarContainer }: { showHierarchy: boolean; showAlias: boolean; sectors: SectorRow[]; emptyMessage: string; nxtStockCodes: ReadonlySet<string>; stockMarkets: ReadonlyMap<string, Market>; stockIndustries: ReadonlyMap<string, string | null>; extra: ReactNode; onCountLabelChange?: (label: string | undefined) => void; toolbarContainer?: HTMLElement | null }) {
  const [query, setQuery] = useState('')
  const { sortKey, direction, toggle } = useSort<StockSortKey>('totalMarketValue', 'desc')
  const activeSortKey = !showHierarchy && (sortKey === 'parentSector' || sortKey === 'midSector' || sortKey === 'subSector' || sortKey === 'industryName') ? 'sectorName' : sortKey
  const rows = useMemo(() => {
    const sign = direction === 'asc' ? 1 : -1
    return sectors
      .flatMap(sector => sector.stocks.map(stock => ({
        ...stock,
        sectorName: sector.sectorName,
        industryName: stockIndustries.get(stock.stockCode) ?? '-',
        parentSector: sector.sectorPath?.[0] ?? '',
        midSector: sector.sectorPath?.[1] ?? '',
        subSector: sector.sectorPath?.[2] ?? '',
        market: stockMarkets.get(stock.stockCode),
        sizeTier: stock.marketValueTier,
        nxt: nxtStockCodes.has(stock.stockCode),
      })))
      .sort((a, b) => {
        const diff =
          activeSortKey === 'totalMarketValue'
            ? a.totalMarketValue - b.totalMarketValue
            // 종목 크기는 시가총액이 클수록 큰 구간이라 시가총액 순서와 같다.
            : activeSortKey === 'sizeTier'
              ? a.totalMarketValue - b.totalMarketValue
              : activeSortKey === 'nxt'
                ? Number(a.nxt) - Number(b.nxt)
                : activeSortKey === 'market'
                  ? compareKoreanText(a.market ? MARKET_LABEL[a.market] : '-', b.market ? MARKET_LABEL[b.market] : '-')
                  : compareKoreanText(a[activeSortKey] ?? '', b[activeSortKey] ?? '')
        // 같은 값끼리(예: 같은 마켓)는 방향과 상관없이 시가총액이 큰 종목이 위에 온다.
        return diff === 0 ? b.totalMarketValue - a.totalMarketValue || compareKoreanText(a.stockCode, b.stockCode) : sign * diff
      })
  }, [sectors, stockMarkets, stockIndustries, nxtStockCodes, activeSortKey, direction])
  // 읽기 전용 분류 필터도 내 기준 종목 표와 같은 순서를 쓴다. 시가총액 순은 현재 검색·필터와 무관하게 전체 종목의 합으로 계산한다.
  const [sectorFilterMode, setSectorFilterMode] = useState<'alpha' | 'cap'>(() => (localStorage.getItem('marketry:sector-filter-order') === 'cap' ? 'cap' : 'alpha'))
  const changeSectorFilterMode = useCallback((value: 'alpha' | 'cap') => {
    localStorage.setItem('marketry:sector-filter-order', value)
    setSectorFilterMode(value)
  }, [])
  const classificationFilterOrder = useMemo(() => {
    const totals = new Map<StockFilterKey, Map<string, number>>(
      (['industry', 'parentSector', 'midSector', 'subSector'] as const).map(key => [key, new Map<string, number>()]),
    )
    for (const row of rows) {
      const values: Record<'industry' | 'parentSector' | 'midSector' | 'subSector', string> = {
        industry: (showHierarchy ? row.industryName : row.sectorName) || '-',
        parentSector: (showHierarchy && row.parentSector) || '-',
        midSector: (showHierarchy && row.midSector) || '-',
        subSector: (showHierarchy && row.subSector) || '-',
      }
      for (const key of Object.keys(values) as (keyof typeof values)[]) {
        const name = values[key]
        if (name !== '-') {
          const byName = totals.get(key)!
          byName.set(name, (byName.get(name) ?? 0) + row.totalMarketValue)
        }
      }
    }
    return new Map([...totals].map(([key, byName]) => [key, [...byName]
      .sort(([nameA, valueA], [nameB, valueB]) => valueB - valueA || compareKoreanText(nameA, nameB))
      .map(([name]) => name)]))
  }, [rows, showHierarchy])
  // 위쪽 검색창은 종목명·약칭(약칭 열이 보일 때만)·코드·분류명을 대소문자·공백 무시와 초성으로 찾는다.
  const trimmed = query.trim()
  const searchedRows = useMemo(
    () => (trimmed ? rows.filter(createStockMatcher(trimmed, row => ({
      name: row.stockName,
      code: row.stockCode,
      alias: showAlias ? row.alias : null,
      labels: [row.industryName, row.parentSector, row.midSector, row.subSector, row.sectorName],
    }))) : rows),
    [rows, trimmed, showAlias],
  )
  // 머리글 필터 — 종목 크기·마켓·거래소 분류·대/중/소분류·NXT. 값이 없으면 '-'이다.
  const filterValueOf = useCallback(
    (row: (typeof rows)[number], key: StockFilterKey): string => {
      switch (key) {
        case 'sizeTier': return row.sizeTier || '-'
        case 'market': return row.market ? MARKET_LABEL[row.market] : '-'
        case 'industry': return (showHierarchy ? row.industryName : row.sectorName) || '-'
        case 'parentSector': return (showHierarchy && row.parentSector) || '-'
        case 'midSector': return (showHierarchy && row.midSector) || '-'
        case 'subSector': return (showHierarchy && row.subSector) || '-'
        case 'nxt': return row.nxt ? 'O' : '-'
      }
    },
    [showHierarchy],
  )
  const filters = useStockColumnFilters(searchedRows, filterValueOf)
  const visibleRows = filters.filteredRows
  // 종목 크기 필터의 보기 순서 — 큰 구간부터(Top 2, 대형주, ...).
  const { data: valueTiers } = useMarketValueTiers()
  const tierOrder = useMemo(() => [...(valueTiers ?? [])].sort((a, b) => b.thresholdValue - a.thresholdValue).map(tier => tier.label), [valueTiers])
  const sectorParentHints = useMemo(
    () => buildSectorParentHints(showHierarchy ? sectors.map(sector => sector.sectorPath ?? []) : []),
    [sectors, showHierarchy],
  )
  const filterButton = (filterKey: StockFilterKey, label: string, extraProps?: { optionOrder?: readonly string[]; labelOf?: (value: string) => string }) => (
    <ColumnFilterButton
      label={label}
      isProtected={showHierarchy && filterKey === 'parentSector' ? value => (PROTECTED_SECTOR_NAMES as readonly string[]).includes(value) : !showHierarchy && filterKey === 'industry' ? value => KRX_PROTECTED_SECTOR_NAMES.includes(value) : undefined}
      getOptions={() => filters.optionValues(filterKey)}
      excluded={filters.excluded[filterKey] ?? NO_EXCLUDED}
      onToggle={value => filters.toggle(filterKey, value)}
      onSelectAll={() => filters.selectAll(filterKey)}
      onSelectNone={values => filters.selectNone(filterKey, values)}
      selectOnlyOnSearch={filterKey === 'industry' || filterKey === 'parentSector' || filterKey === 'midSector' || filterKey === 'subSector'}
      hintOf={filterKey === 'midSector' || filterKey === 'subSector' ? value => sectorParentHints[filterKey].get(value) : undefined}
      orderMode={filterKey === 'industry' || filterKey === 'parentSector' || filterKey === 'midSector' || filterKey === 'subSector' ? { value: sectorFilterMode, onChange: changeSectorFilterMode } : undefined}
      optionOrder={classificationFilterOrder.get(filterKey)}
      {...extraProps}
    />
  )
  const header = (key: StockSortKey, label: string, filter?: ReactNode, colSpan?: number) => (
    <th data-column-key={key} colSpan={colSpan} className={STOCK_HEADER_CELL}>
      <StockSortHeader label={label} state={activeSortKey === key ? direction : null} filter={filter} onSort={() => toggle(key)} />
    </th>
  )
  useReportCountLabel(`${toCount(visibleRows.length)}/${toCount(rows.length)}종목`, onCountLabelChange)
  // 맨 왼쪽 체크박스 — MARKETRY 종목 표와 같은 모양이다. 읽기 전용 시트라 고른 종목으로 할 수 있는 작업은 아직 없고, 표시만 한다.
  const [selectedCodes, setSelectedCodes] = useState<ReadonlySet<string>>(new Set())
  const isAllVisibleSelected = visibleRows.length > 0 && visibleRows.every(row => selectedCodes.has(row.stockCode))
  const toggleSelectAllVisible = () =>
    setSelectedCodes(isAllVisibleSelected ? new Set() : new Set(visibleRows.map(row => row.stockCode)))
  // 종목이 수천 개라 전부 그려 두면 검색할 때마다 화면 갱신이 느리고, 공유 스크린샷도 안 보이는 행까지 전부 복제한다 —
  // 화면에 보이는 행(+위아래 여유)만 그리고, 나머지 높이는 앞뒤 스페이서 <tr>로 채운다(AdminStockTable과 같은 방식).
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  // 줄 누르기·Shift+클릭 범위·끌어서 연속 선택 — MARKETRY 종목 표와 같은 동작이다.
  const { rowProps, selectionHint } = useRowRangeSelection(
    useMemo(() => visibleRows.map(row => row.stockCode), [visibleRows]),
    scrollContainerRef,
    selectedCodes,
    setSelectedCodes,
  )
  // eslint-disable-next-line react-hooks/incompatible-library -- 가상화 라이브러리의 함수는 메모하지 못한다는 경고 — AdminStockTable과 같은 사용 방식이라 무시한다
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => STOCK_ROW_HEIGHT,
    overscan: 15,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0
  // 검색어나 정렬이 바뀌면 맨 위로 — 결과가 줄었는데 예전 스크롤 위치에 남으면 빈 화면이 보인다.
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 })
  }, [trimmed, sortKey, direction])
  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col">
      {toolbarContainer && createPortal(
        <SearchBar
          inline
          query={query}
          onChange={setQuery}
          placeholder={showAlias ? '종목코드 · 종목명 · 약칭 · 분류 검색' : '종목코드 · 종목명 · 분류 검색'}
          ariaLabel="종목 검색"
          afterInput={
            <>
              {filters.activeCount > 0 && (
                <button
                  type="button"
                  onClick={filters.clearAll}
                  className="flex h-6 items-center whitespace-nowrap rounded border border-ui-border bg-transparent px-2 text-sm font-normal text-ui-text transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  필터 초기화
                </button>
              )}
              {extra}
            </>
          }
        />,
        toolbarContainer,
      )}
      <div className="relative min-h-0 flex-1 border border-ui-border">
      {selectionHint.isOpen && <SelectionHintBubble onClose={selectionHint.close} />}
      <div ref={scrollContainerRef} className="relative h-full overflow-auto">
        {/* 내 분류와 같은 표·테두리·스크롤 규칙을 쓴다. 마지막 열은 남는 폭을 받아 KRX의 NXT가 대·중·소분류 합계 폭과 일치한다. */}
        <table className="nes-table is-dark custom-page-table w-full table-fixed select-none text-sm [border-collapse:separate] [border-spacing:0] [&_td]:border-ui-border [&_td]:py-1 [&_th]:border-ui-white/20 [&_th]:border-b-0 [&_th]:py-1" style={{ minWidth: stockTableMinWidthPx(STOCK_COLUMN_KEYS) }}>
          <StockTableColGroup keys={STOCK_COLUMN_KEYS} />
          <thead className="sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_var(--ui-border)]">
            <tr style={{ height: STOCK_HEADER_ROW_PX }}>
              <th className="cursor-pointer bg-[var(--ui-panel)] px-0 text-center font-bold text-ui-white" style={CHECKBOX_CELL_STYLE} onClick={toggleSelectAllVisible}>
                <input
                  type="checkbox"
                  aria-label="보이는 종목 전체 선택"
                  className="mx-auto my-0 block thin-check"
                  checked={isAllVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  onClick={event => event.stopPropagation()}
                />
              </th>
              {header('stockCode', '종목코드')}
              {header('stockName', '종목명', undefined, showAlias ? 1 : 2)}
              {showAlias && header('alias', '약칭')}
              {header('totalMarketValue', '시가총액')}
              {header('sizeTier', '종목 크기', filterButton('sizeTier', '종목 크기', { optionOrder: tierOrder }))}
              {header('market', '마켓', filterButton('market', '마켓', { optionOrder: ['코스피', '코스닥'] }))}
              {header('nxt', 'NXT', filterButton('nxt', 'NXT', { optionOrder: ['O', '-'], labelOf: value => (value === 'O' ? 'NXT 거래' : 'NXT 미거래') }))}
              {header(showHierarchy ? 'industryName' : 'sectorName', '거래소 분류', filterButton('industry', '거래소 분류'))}
              {header('parentSector', '대분류', filterButton('parentSector', '대분류'))}
              {header('midSector', '중분류', filterButton('midSector', '중분류'))}
              {header('subSector', '소분류', filterButton('subSector', '소분류'))}
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td colSpan={STOCK_COLUMN_KEYS.length + 1} style={{ height: paddingTop, padding: 0, border: 'none' }} />
              </tr>
            )}
            {virtualRows.map(virtualRow => {
              const row = visibleRows[virtualRow.index]
              const isKosdaq = row.market === 'KOSDAQ'
              return (
                <tr key={row.stockCode} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} {...rowProps(virtualRow.index)} className={`cursor-pointer text-ui-muted ${selectedCodes.has(row.stockCode) ? '[&>td]:bg-[var(--brand)]/20 [&:hover>td]:bg-[var(--brand)]/35 [&>td]:border-ui-white/20!' : '[&:hover>td]:bg-[var(--brand)]/10 [&:hover>td]:border-ui-white/20!'}`}>
                  <td className={`${STOCK_BODY_CELL} text-center`} style={CHECKBOX_CELL_STYLE}>
                    <input
                      type="checkbox"
                      aria-label={`${row.stockName} 선택`}
                      className="mx-auto my-0 block thin-check"
                      checked={selectedCodes.has(row.stockCode)}
                      onChange={() => {}}
                    />
                  </td>
                  <td className={`${STOCK_BODY_CELL} text-center`}>{row.stockCode}</td>
                  <td colSpan={showAlias ? 1 : 2} className={`${STOCK_BODY_CELL} truncate text-left !pl-2 ${isKosdaq ? 'text-[var(--brand)]' : ''}`}>{row.stockName}</td>
                  {showAlias && <td className={`${STOCK_BODY_CELL} truncate text-left !pl-2`}>{row.alias ?? '-'}</td>}
                  {/* MARKETRY 종목 표와 같은 표기('1,613.6조')와 오른쪽 정렬이다. */}
                  <td className={`${STOCK_BODY_CELL} text-right !pr-4 text-ui-muted`}>{toJoEokDecimal(row.totalMarketValue / 100_000_000)}</td>
                  <td className={`${STOCK_BODY_CELL} text-center`}>{row.sizeTier || '-'}</td>
                  <td className={`${STOCK_BODY_CELL} text-center ${isKosdaq ? 'text-[var(--brand)]' : ''}`}>
                    {row.market ? MARKET_LABEL[row.market] : '-'}
                  </td>
                  <td className={`${STOCK_BODY_CELL} text-center ${!row.nxt ? 'text-ui-muted' : ''}`}>{row.nxt ? 'O' : '-'}</td>
                  {/* 글자 시작 위치는 칸 왼쪽에서 8px로, 종목 표의 다른 글자 칸과 같다. */}
                  <td className={`${STOCK_BODY_CELL} truncate text-left !pl-2`}>{showHierarchy ? row.industryName : row.sectorName}</td>
                  {[row.parentSector, row.midSector, row.subSector].map((name, index) => (
                    <td key={index} className={`${STOCK_BODY_CELL} truncate text-left !pl-2`}>{(showHierarchy && name) || '-'}</td>
                  ))}
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr>
                <td colSpan={STOCK_COLUMN_KEYS.length + 1} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
              </tr>
            )}
          </tbody>
        </table>
        {visibleRows.length === 0 && <EmptyMessage message={rows.length === 0 ? emptyMessage : EMPTY_SEARCH_MESSAGE} />}
      </div>
      </div>
    </div>
  )
}
