import { buildSectorParentHints } from '@/utils/sectorFilterHints'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'
import { compareKoreanText } from '@/utils/koreanSort'
import { EMPTY_SECTOR_STATS, sectorNamesByDepth, sortByMarketValue, type SectorStats } from '@/utils/sectorOrder'
import { useReportCountLabel } from '@/hooks/useReportCountLabel'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useQueryClient } from '@tanstack/react-query'
import type { SectorItem, StockSectorListItem } from '@/types/api'
import { toCount, toJoEokDecimal, toSnapshotDateLabel, toSnapshotTimeOnlyLabel } from '@/utils/format'
import { appAlert, appConfirm, appWarnConfirm } from '@/utils/appDialogBus'
import { findAliasConflict } from '@/utils/aliasConflict'
import { ClassificationUploadError, buildUploadPlan, readClassificationFile } from '@/utils/classificationUpload'
import { getErrorDetail } from '@/utils/errorMessage'
import { PROTECTED_SECTOR_TEXT_CLASS, SUSPENDED_STOCK_HINT, isProtectedSectorName, isSuspendedSectorName, placeProtectedSectorsLast } from '@/utils/protectedSector'
import { exportRowsToExcel } from '@/utils/exportExcel'
import { fileTimestamp } from '@/utils/fileTimestamp'
import { invalidateCustomTaxonomy, useAssignStockSector, useBulkAssignStockSector, useResetCustomClassification, useUpdateStockAlias } from '@/hooks/useHeatmapCustom'
import { useSession } from '@/hooks/useSession'
import Spinner from './Spinner'
import { SearchBar } from './ReadOnlyTaxonomySheet'
import { SEARCH_MAX_LENGTH } from '@/utils/sectorSearch'
import { STOCK_SEARCH_MAX_LENGTH, createStockMatcher } from '@/utils/stockSearch'
import EmptyMessage, { EMPTY_DATA_MESSAGE, EMPTY_SEARCH_MESSAGE } from './EmptyMessage'
import { STOCK_CHECKBOX_COLUMN_PX, STOCK_HEADER_ROW_PX, pinnedStockColumns, stockColumnWidthsTotal, type StockColumnKey } from '@/utils/stockTableColumns'
import { useStockColumnWidths } from '@/hooks/useStockColumnWidths'
import { usePopupPosition, type PopupPosition } from '@/hooks/usePopupPosition'
import ChangeHistoryControls from '@/components/ChangeHistoryControls'
import StockTableColGroup from '@/components/StockTableColGroup'
import StockSortHeader from '@/components/StockSortHeader'
import SelectionHintBubble from '@/components/SelectionHintBubble'
import ColumnFilterButton, { FunnelIcon, SectorOrderToggle } from '@/components/ColumnFilterButton'
import { useStockColumnFilters, type StockFilterKey } from '@/hooks/useStockColumnFilters'
import { useMarketValueTiers } from '@/hooks/useMarketValueTiers'
import { customHeatmapKeys } from '@/hooks/queryKeys'
import { DownloadIcon, UploadIcon } from './icons/AppIcons'
import { isAdminSession } from '@/utils/adminAccess'
import { isAxiosError } from 'axios'
import { uploadClassification } from '@/api/custom'
import { DROPDOWN_GAP_PX } from '@/components/dropdownStyle'

interface Props {
  items: StockSectorListItem[]
  sectors: SectorItem[]
  snapshotTime: string | null
  // 종목수/실행취소·다시실행/필터/엑셀 등 툴바를 이 컨테이너로 포털링한다 — 페이지 공통 세 번째 바
  // 안에 그려야 해서, 이 컴포넌트 안에서 직접 렌더링하지 않고 부모(HeatmapAdminPage)가 그 바 안에
  // 마련해준 DOM 노드로 옮겨 그린다. 상태/핸들러는 전부 이 컴포넌트에 그대로 남아있다.
  toolbarContainer: HTMLElement | null
  // 실행취소·다시실행 아이콘을 그릴 설정창 안의 자리 — 없으면 상단 바 도구줄에 같이 그린다.
  historyContainer?: HTMLElement | null
  // 설정창의 "엑셀" 항목 자리 — 있으면 다운로드 버튼을 이 안에 그린다.
  excelContainer?: HTMLElement | null
  // 설정창의 "초기화" 항목 자리 — 업종 목록과 종목 분류를 초기화하는 버튼을 그린다.
  resetContainer?: HTMLElement | null
  // 설정창의 "일괄 변경" 항목 자리 — 대·중·소분류 일괄 변경 버튼을 이 안에 그린다.
  bulkContainer?: HTMLElement | null
  // 검색창 옆에 두던 "N/N종목" 개수를 받아 갈 곳 — 페이지가 설정창 머리글에 그려 준다.
  onCountLabelChange?: (label: string | undefined) => void
  // NXT에서도 거래되는 종목 코드 — NXT 열에 O/-로 보여준다(공개 종목 정보라 모든 사용자가 같다).
  nxtStockCodes?: ReadonlySet<string>
  // 업종 번호별 시가총액 합·종목 수 — 업종 선택 목록의 "시가총액 순" 보기에 쓴다.
  sectorStats?: SectorStats
  // 종목 목록을 처음 받는 중이거나 받지 못했을 때 표 자리에 다른 페이지와 같은 로딩·오류 원을 보여 준다.
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

// 약칭 최대 글자 수 — 분류 이름(대·중·소분류)과 같다.
const ALIAS_MAX_LENGTH = 12

const NO_NXT_CODES: ReadonlySet<string> = new Set()
const NO_EXCLUDED: ReadonlySet<string> = new Set()

// 머리글 필터가 있는 열 — 열 이름(정렬 키)에 맞는 필터 이름이다. 종목코드·종목명·약칭·시가총액에는 필터가 없다.
const FILTER_KEY_BY_COLUMN: Partial<Record<SortKey, StockFilterKey>> = {
  sizeTier: 'sizeTier',
  market: 'market',
  originCategoryName: 'industry',
  parentSectorName: 'parentSector',
  midSectorName: 'midSector',
  subSectorName: 'subSector',
  nxt: 'nxt',
}

type SortKey =
  | 'stockCode'
  | 'market'
  | 'stockName'
  | 'alias'
  | 'totalMarketValue'
  | 'sizeTier'
  | 'originCategoryName'
  | 'parentSectorName'
  | 'midSectorName'
  | 'subSectorName'
  | 'nxt'
type SortDirection = 'asc' | 'desc'

// 체크박스(20px)가 줄 높이(29px)에서 남기는 상하 여백(약 4.5px)과 비슷하게 좌우 여백도 5px씩 둔다(20 + 10 = 30px).
const CHECKBOX_COLUMN_WIDTH = `${STOCK_CHECKBOX_COLUMN_PX}px`
// nes.css의 셀 좌우 패딩(1rem)이 남지 않도록 인라인으로 0에 가깝게 고정한다.
const CHECKBOX_CELL_STYLE = { width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH, maxWidth: CHECKBOX_COLUMN_WIDTH, paddingLeft: 0, paddingRight: 0 } as const

// 정렬을 끈 상태(null)에서 쓰는 기본 순서 — 시가총액 내림차순.
const DEFAULT_SORT_KEY: SortKey = 'totalMarketValue'

// 세 종목 표(MARKETRY·거래소·내 분류)가 같은 열을 보여준다. columnKey는 열 폭(stockTableColumns)을 찾는 이름이다.
const COLUMNS: { key: SortKey; columnKey: StockColumnKey; header: string; align: 'center' | 'left' | 'right' }[] = [
  { key: 'stockCode', columnKey: 'stockCode', header: '종목코드', align: 'center' },
  { key: 'stockName', columnKey: 'stockName', header: '종목명', align: 'left' },
  { key: 'alias', columnKey: 'alias', header: '약칭', align: 'left' },
  { key: 'totalMarketValue', columnKey: 'totalMarketValue', header: '시가총액', align: 'right' },
  { key: 'sizeTier', columnKey: 'sizeTier', header: '규모', align: 'center' },
  { key: 'market', columnKey: 'market', header: '마켓', align: 'center' },
  { key: 'nxt', columnKey: 'nxt', header: 'NXT', align: 'center' },
  { key: 'originCategoryName', columnKey: 'industry', header: '거래소 분류', align: 'left' },
  { key: 'parentSectorName', columnKey: 'parentSector', header: '대분류', align: 'right' },
  { key: 'midSectorName', columnKey: 'midSector', header: '중분류', align: 'right' },
  { key: 'subSectorName', columnKey: 'subSector', header: '소분류', align: 'right' },
]

const alignClass = (align: 'center' | 'left' | 'right') =>
  align === 'right' ? 'text-right pr-2' : align === 'left' ? 'text-left pl-4' : 'text-center'

const MARKET_LABEL: Record<'KOSPI' | 'KOSDAQ', string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
const marketColorClass = (market: 'KOSPI' | 'KOSDAQ') => (market === 'KOSPI' ? 'text-ui-muted' : 'text-[var(--brand)]')

// 화면에 실제로 표시되는 값 기준으로 정렬하는 열 — 정렬 판정을 이 값으로 통일해서 화면과 어긋나지 않게 한다.
type DisplaySortKey = 'market' | 'originCategoryName' | 'parentSectorName' | 'midSectorName' | 'subSectorName'
const DISPLAY_SORT_KEYS: readonly DisplaySortKey[] = [
  'market',
  'originCategoryName',
  'parentSectorName',
  'midSectorName',
  'subSectorName',
]

function isDisplaySortKey(key: SortKey): key is DisplaySortKey {
  return (DISPLAY_SORT_KEYS as readonly string[]).includes(key)
}

function compareByKey(
  a: StockSectorListItem,
  b: StockSectorListItem,
  key: SortKey,
  displayByStockCode: Map<string, ItemDisplayValues>,
): number {
  // 규모는 시가총액이 클수록 큰 구간이라 시가총액 순서와 같다.
  if (key === 'totalMarketValue' || key === 'sizeTier') {
    return (a.totalMarketValue ?? -Infinity) - (b.totalMarketValue ?? -Infinity)
  }
  if (key === 'nxt') {
    return Number(displayByStockCode.get(a.stockCode)?.isNxt ?? false) - Number(displayByStockCode.get(b.stockCode)?.isNxt ?? false)
  }
  if (isDisplaySortKey(key)) {
    const av = displayByStockCode.get(a.stockCode)?.[key] ?? ''
    const bv = displayByStockCode.get(b.stockCode)?.[key] ?? ''
    return compareKoreanText(av, bv)
  }
  return compareKoreanText(a[key as 'stockCode' | 'stockName' | 'alias'] ?? '', b[key as 'stockCode' | 'stockName' | 'alias'] ?? '')
}

// 섹터를 부모-자식 순서로 펼쳐서 검색 옵션으로 만든다 (자식은 들여쓰기 표시).
function buildSectorOptions(sectors: SectorItem[]): SectorOption[] {
  const byParent = new Map<number | null, SectorItem[]>()
  for (const c of sectors) {
    const list = byParent.get(c.parentId)
    if (list) list.push(c)
    else byParent.set(c.parentId, [c])
  }
  for (const list of byParent.values()) list.sort((a, b) => compareKoreanText(a.name, b.name))

  const options: SectorOption[] = []
  const walk = (parentId: number | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      options.push({
        id: c.id,
        parentId: c.parentId,
        name: c.name,
        label: `${'　'.repeat(depth)}${depth > 0 ? '- ' : ''}${c.name}`,
      })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return options
}

interface SectorOption {
  id: number
  parentId: number | null
  name: string
  label: string
}

// Ctrl+Z/Y 실행취소·다시실행 대상 — 섹터 변경만 관리한다(필터 걸어놓고 섹터를 바꾸면
// 그 종목이 필터에서 바로 사라지는데, 잘못 눌렀을 때 다시 검색하지 않고 바로 되돌리기 위함).
// 메모리에만(컴포넌트 상태) 두고, 종목 탭을 벗어나면(언마운트) 자연히 사라진다.
type UndoableActionInput =
  | { type: 'sector'; stockCode: string; before: number; after: number }
  | { type: 'bulkSector'; sectorName: string; after: number; entries: { stockCode: string; before: number }[] }
// id는 실행취소/다시실행 "목록"에서 스택 순서와 무관하게 특정 항목 하나를 골라 가리키기 위한
// 프론트 전용 식별자 — 백엔드 요청엔 실리지 않는다.
type UndoableAction = UndoableActionInput & { id: string }
const UNDO_STACK_LIMIT = 9

// 실행취소/다시실행 목록에 보여줄 한 줄 설명 — "종목명" 줄과 "[이전 섹터] → [이후 섹터]" 줄 두 줄로,
// 지금 undo 목록에 있든 redo 목록에 있든(즉 아직 실행 전이든 이미 되돌린 뒤든) 항상 같은 문구를 쓴다.
function describeUndoableAction(
  action: UndoableAction,
  items: StockSectorListItem[],
  sectorOptionsById: Map<number, SectorOption>,
): string {
  const sectorLabel = (id: number) => sectorOptionsById.get(id)?.name ?? '(알 수 없음)'
  if (action.type === 'sector') {
    const stockName = items.find(item => item.stockCode === action.stockCode)?.stockName ?? action.stockCode
    return `${stockName}\n[${sectorLabel(action.before)}] → [${sectorLabel(action.after)}]`
  }
  return `${action.entries.length}개 종목\n→ [${action.sectorName}]`
}

// 종목 응답엔 sectorId(실제 배정된 섹터, 뎁스 무관)만 있어서, 대분류/중분류/소분류 3칸에 어떻게
// 나눠 보여줄지는 이미 받아온 섹터 트리를 parentId로 거슬러 올라가며 프론트에서 직접 계산한다.
// 백엔드가 뎁스별 이름 필드를 따로 내려줄 필요가 없어서, 나중에 뎁스가 더 늘어나도 여기만 고치면 된다.
interface SectorChain {
  rootId: number | null
  rootName: string
  midId: number | null
  midName: string | null
  leafId: number | null
  leafName: string | null
}

function resolveSectorChain(sectorOptionsById: Map<number, SectorOption>, sectorId: number | null): SectorChain {
  const chain: SectorOption[] = []
  let current = sectorId == null ? undefined : sectorOptionsById.get(sectorId)
  while (current) {
    chain.unshift(current)
    current = current.parentId != null ? sectorOptionsById.get(current.parentId) : undefined
  }
  return {
    rootId: chain[0]?.id ?? null,
    rootName: chain[0]?.name ?? '-',
    midId: chain[1]?.id ?? null,
    midName: chain[1]?.name ?? null,
    leafId: chain[2]?.id ?? null,
    leafName: chain[2]?.name ?? null,
  }
}

interface ItemDisplayValues {
  market: string
  originCategoryName: string
  parentSectorName: string
  midSectorName: string
  subSectorName: string
  isNxt: boolean
}

function computeDisplayValues(item: StockSectorListItem, sectorOptionsById: Map<number, SectorOption>, nxtStockCodes: ReadonlySet<string>): ItemDisplayValues {
  const chain = resolveSectorChain(sectorOptionsById, item.sectorId)
  return {
    market: MARKET_LABEL[item.market],
    originCategoryName: item.industryName ?? '-',
    parentSectorName: chain.rootName,
    midSectorName: chain.midName ?? '-',
    subSectorName: chain.leafName ?? '-',
    isNxt: nxtStockCodes.has(item.stockCode),
  }
}

// 검색어가 자기 이름이나 조상(부모/조부모...) 중 하나에라도 걸리면 매칭으로 본다.
// 예: "반"으로 검색하면 "반도체"뿐 아니라 그 하위 "메모리"/"파운드리"도 같이 남는다.
function matchesSectorSearch(option: SectorOption, trimmed: string, byId: Map<number, SectorOption>): boolean {
  let current: SectorOption | undefined = option
  while (current) {
    if (current.name.toLowerCase().includes(trimmed)) return true
    current = current.parentId != null ? byId.get(current.parentId) : undefined
  }
  return false
}

// 섹터 선택 팝업 목록 한 행의 높이(px) — 행의 min-h-7(28px)과 같다.
const FILTER_LIST_ROW_HEIGHT = 28
// 선택 팝업을 한 화면에 몇 개 행까지 보여줄지 — 이보다 적으면 목록 실제 높이만큼만 차지하고,
// 많으면 이 높이에서 스크롤(overflow-y-auto)된다. 열 머리글 필터(ColumnFilterButton)도 같은 10개다.
const FILTER_LIST_MAX_VISIBLE_ROWS = 10
const FILTER_LIST_MAX_HEIGHT = FILTER_LIST_ROW_HEIGHT * FILTER_LIST_MAX_VISIBLE_ROWS


// 섹터 검색창의 검색어/방향키 탐색 상태 — AdminStockSectorCell과 BulkAssignButton이 공유.
// isOpen이 false(팝업 닫힘)면 아무도 matches를 안 쓰므로 계산 자체를 건너뛴다 — 행이 수천 개라
// 팝업 열림 여부와 무관하게 매 렌더마다 계산하면 그 비용이 그대로 누적된다.
function useSectorSearchState(options: SectorOption[], isOpen: boolean) {
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const reset = () => {
    setQuery('')
    setHighlightedIndex(-1)
  }

  const handleQueryChange = (value: string) => {
    setQuery(value.slice(0, SEARCH_MAX_LENGTH))
    setHighlightedIndex(-1)
  }

  const trimmed = query.trim().toLowerCase()
  // 검색 전엔 전체 섹터를 그대로 보여주고(방향키로 바로 탐색 가능), 검색어가 있으면 그 안에서만 필터링한다.
  // 부모가 매칭되면 그 하위 섹터도 같이 남겨서(예: "반" -> 반도체 + 메모리/파운드리), 트리 맥락이 끊기지 않게 한다.
  const matches = useMemo(() => {
    if (!isOpen || !trimmed) return options
    const optionsById = new Map(options.map(opt => [opt.id, opt]))
    return options.filter(opt => matchesSectorSearch(opt, trimmed, optionsById))
  }, [isOpen, trimmed, options])

  const handleArrowsAndEnter = (e: React.KeyboardEvent<HTMLInputElement>, onSelect: (sectorId: number) => void) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (matches.length === 0) return
      setHighlightedIndex(i => (i < 0 ? 0 : (i + 1) % matches.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (matches.length === 0) return
      setHighlightedIndex(i => (i <= 0 ? matches.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = matches[highlightedIndex]
      if (target) onSelect(target.id)
    }
  }

  return { query, handleQueryChange, matches, highlightedIndex, setHighlightedIndex, handleArrowsAndEnter, reset }
}

// 섹터 검색 팝업(검색창 + 전체/필터링된 목록). 대분류·소분류 셀과 일괄 변경 버튼이 트리거만 다르게 해서 같이 쓴다.
function SectorSearchPopup({
  popupRef,
  inputRef,
  position,
  search,
  onSelect,
  onEscape,
  contextLabel,
  title,
  orderMode,
}: {
  popupRef: React.RefObject<HTMLDivElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  position: PopupPosition
  search: ReturnType<typeof useSectorSearchState>
  onSelect: (sectorId: number) => void
  onEscape: () => void
  // 소분류 팝업처럼 목록이 특정 대분류로 좁혀져 있을 때, 지금 어느 대분류 밑을 보고 있는지 알려주는 칩.
  contextLabel?: string
  // 일괄 변경 팝업 — 제목과 "가나다 순 / 시가총액 순" 선택(고른 순서는 호출한 쪽이 options 순서로 반영한다).
  title?: string
  orderMode?: { value: 'alpha' | 'cap'; onChange: (value: 'alpha' | 'cap') => void }
}) {
  // 방향키로 하이라이트가 화면 밖으로 나가면 스크롤이 안 따라가서 지금 뭐가 선택됐는지 안 보이는
  // 문제가 있었다 — 하이라이트된 항목의 DOM 노드를 등록해뒀다가, 바뀔 때마다 보이는 영역으로 스크롤한다.
  const optionRefs = useRef(new Map<number, HTMLButtonElement>())
  const orderToggleRef = useRef<HTMLDivElement>(null)
  const [bulkPopupWidth, setBulkPopupWidth] = useState<number>()
  useEffect(() => {
    optionRefs.current.get(search.highlightedIndex)?.scrollIntoView({ block: 'nearest' })
  }, [search.highlightedIndex])
  useLayoutEffect(() => {
    if (!orderMode || !orderToggleRef.current) return
    // 검색 입력의 안쪽 너비를 두 정렬 버튼의 실제 합산 너비에 맞춘다.
    setBulkPopupWidth(orderToggleRef.current.getBoundingClientRect().width + 2)
  }, [orderMode])

  // 목록이 한 단계(같은 부모 아래)뿐이면 들여쓰기·"- " 표시 없이 이름만 보여준다.
  const isSingleLevel = search.matches.every(opt => opt.parentId === search.matches[0]?.parentId)

  return (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        top: position.top + (position.openUpward ? -DROPDOWN_GAP_PX : DROPDOWN_GAP_PX),
        left: position.left,
        transform: `translate(${position.alignRight ? '-100%' : '0'}, ${position.openUpward ? '-100%' : '0'})`,
        ...(orderMode && bulkPopupWidth ? { width: bulkPopupWidth } : {}),
      }}
      className="z-50 w-[195px] overflow-hidden rounded-md border border-ui-border bg-[var(--ui-panel)] pt-2 text-sm font-normal text-ui-white shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      {title && (
        <div className="px-3 pb-2">
          <span className="inline-block rounded bg-[var(--brand-surface)] px-1.5 py-[3px] text-[11px] font-semibold leading-none text-ui-white">{title}</span>
        </div>
      )}
      <div className="px-3 pb-2">
        <input
          ref={inputRef}
          type="text"
          maxLength={SEARCH_MAX_LENGTH}
          autoFocus
          value={search.query}
          onChange={e => search.handleQueryChange(e.target.value)}
          onKeyDown={e => (e.key === 'Escape' ? onEscape() : search.handleArrowsAndEnter(e, onSelect))}
          placeholder="업종 검색"
          aria-label="업종 검색"
          className="h-7 w-full rounded border border-ui-border bg-ui-panel px-2 text-sm text-ui-white outline-none focus:placeholder:text-transparent focus:border-[var(--brand)]"
        />
      </div>
      {title && orderMode && <div ref={orderToggleRef} className="w-fit"><SectorOrderToggle label={title} value={orderMode.value} onChange={orderMode.onChange} /></div>}
      {contextLabel && <p className="m-0 truncate px-3 pb-2 text-xs font-medium text-ui-muted">{contextLabel}</p>}
      <div className="sector-popup-options overflow-y-auto" style={{ maxHeight: FILTER_LIST_MAX_HEIGHT }}>
        {search.matches.length === 0 ? (
          <p className="m-0 px-3 py-1 text-ui-muted">검색 결과가 없습니다.</p>
        ) : (
          search.matches.map((opt, index) => (
            <button
              key={opt.id}
              ref={el => {
                if (el) optionRefs.current.set(index, el)
                else optionRefs.current.delete(index)
              }}
              type="button"
              onClick={() => onSelect(opt.id)}
              onMouseEnter={() => search.setHighlightedIndex(index)}
              className={`flex min-h-7 w-full items-center truncate rounded-none border-0 py-1 pr-3 pl-4 text-left text-sm font-normal shadow-none outline-none ${
                opt.parentId === null && isProtectedSectorName(opt.name) ? PROTECTED_SECTOR_TEXT_CLASS : 'text-ui-white'
              } ${index === search.highlightedIndex ? 'bg-ui-white/10' : 'bg-transparent'}`}
            >
              {isSingleLevel ? opt.name : opt.label}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// 대분류/소분류 셀. 검색창 열림 상태를 이 컴포넌트 안에서만 갖고 있어서,
// 타이핑해도 전체 종목 테이블(2700여 행)이 다시 렌더되지 않는다.
export function AdminStockSectorCell({
  value,
  options,
  onAssign,
  isHighlighted,
  rowHoverClass,
  onHoverStart,
  onHoverEnd,
  onEditingChange,
  contextLabel,
  disabled,
  disabledHint,
  title,
  orderMode,
}: {
  value: string
  options: SectorOption[]
  onAssign: (sectorId: number) => void
  isHighlighted: boolean
  rowHoverClass: string
  onHoverStart: () => void
  onHoverEnd: () => void
  onEditingChange: (editing: boolean) => void
  contextLabel?: string
  // 예: 중분류가 아직 지정 안 된 상태의 소분류 셀 — 고를 수 있는 범위 자체가 없으니 클릭해도 팝업을 안 띄운다.
  disabled?: boolean
  // disabled일 때 마우스를 올리면 공통 말풍선(data-hint)으로 뜨는 안내 문구.
  disabledHint?: string
  // 팝업 제목과 "가나다 순 / 시가총액 순" 선택(일괄 변경 팝업과 같은 모양).
  title?: string
  orderMode?: { value: 'alpha' | 'cap'; onChange: (value: 'alpha' | 'cap') => void }
}) {
  const [isOpen, setIsOpen] = useState(false)
  const cellRef = useRef<HTMLTableCellElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const search = useSectorSearchState(options, isOpen)

  // 바깥 클릭/스크롤로 닫힐 때도(usePopupPosition 내부에서 직접 호출) 항상 이 함수를 거치도록,
  // 팝업 열림 상태를 바꾸는 지점을 하나로 모은다 — 그래야 행 하이라이트(onEditingChange)가 항상 같이 갱신된다.
  const updateOpen = (open: boolean) => {
    setIsOpen(open)
    onEditingChange(open)
    // 팝업이 열려있는 동안 마우스가 밖으로 나가도(예: 검색 목록 클릭) 진한 컬럼 강조가 그대로 남지 않도록 끈다.
    if (open) onHoverEnd()
  }

  // 섹터 목록 팝업은 세로로 훨씬 커져서(약 12개 높이), 기본 임계값(80%)보다 일찍 위로 뒤집어야 화면 밖으로 안 잘린다.
  // 대분류/소분류는 테이블 우측에 몰려있어 오른쪽으로 열면 화면 밖으로 잘리므로, 필터 팝업과 동일하게
  // 셀 우측 끝에 맞춰 왼쪽으로 열리게 한다.
  const position = usePopupPosition(isOpen, updateOpen, cellRef, popupRef, () => inputRef.current?.focus(), 0.6, true)

  const handleSelect = (sectorId: number) => {
    onAssign(sectorId)
    updateOpen(false)
  }

  return (
    <td
      ref={cellRef}
      data-no-row-select
      data-hint={disabled ? disabledHint : undefined}
      className={`truncate pl-2 text-left ${disabled ? 'cursor-default text-ui-muted' : 'cursor-pointer'} ${
        isHighlighted ? 'bg-[var(--brand)]/35' : rowHoverClass
      }`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={
        disabled
          ? e => e.stopPropagation()
          : e => {
              // 행 전체 클릭 시 체크박스가 토글되는 동작(AdminStockRow)과 별개로 동작해야 하므로 버블링을 막는다.
              e.stopPropagation()
              search.reset()
              updateOpen(true)
            }
      }
    >
      {value}
      {!disabled && isOpen && position && (
        <SectorSearchPopup
          popupRef={popupRef}
          inputRef={inputRef}
          position={position}
          search={search}
          onSelect={handleSelect}
          onEscape={() => updateOpen(false)}
          contextLabel={contextLabel}
          title={title}
          orderMode={orderMode}
        />
      )}
    </td>
  )
}

// 체크된 종목들을 한 섹터로 한 번에 재배정하는 버튼. 팝업 자체는 AdminStockSectorCell과 동일하게 동작한다.
export function BulkAssignButton({
  count,
  options,
  onAssign,
  disabled = false,
  disabledHint,
  label,
  title,
  orderMode,
}: {
  count: number
  options: SectorOption[]
  onAssign: (sectorId: number) => void
  // 버튼에 보일 글자(대분류·중분류·소분류) — "일괄 변경"은 위 섹션 제목이 말해 준다.
  label: string
  title: string
  orderMode: { value: 'alpha' | 'cap'; onChange: (value: 'alpha' | 'cap') => void }
  // 선행 단계(1차/2차)가 아직 적용 안 된 상태의 2차/3차 버튼 — 버튼 자체는 평소와 똑같이 보이되,
  // 누르면 아무 일도 없고, 마우스를 올리면 안내 문구가 공통 말풍선(data-hint)으로 뜬다(AdminStockSectorCell의 disabled 셀과 동일한 패턴).
  disabled?: boolean
  disabledHint?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // 설정창은 좌우로 옮길 수 있어서, 누르는 순간 버튼이 화면 오른쪽 절반에 있으면 팝업을 왼쪽으로 연다.
  const [alignRight, setAlignRight] = useState(false)
  const search = useSectorSearchState(options, isOpen)

  const position = usePopupPosition(
    isOpen,
    setIsOpen,
    buttonRef,
    popupRef,
    () => inputRef.current?.focus(),
    0.6,
    alignRight,
  )

  // 고른 종목이 없으면 흐리게 비활성이다(누르면 아무 일도 없다).
  const isIdle = count === 0
  const handleClick = () => {
    if (isIdle) return
    if (disabled) return
    search.reset()
    setAlignRight((buttonRef.current?.getBoundingClientRect().left ?? 0) > window.innerWidth / 2)
    setIsOpen(true)
  }

  const handleSelect = (sectorId: number) => {
    onAssign(sectorId)
    setIsOpen(false)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        aria-disabled={isIdle}
        data-hint={!isIdle && disabled ? disabledHint : undefined}
        className={`flex h-[25px] w-full items-center justify-center whitespace-nowrap rounded-[5px] border-0 px-1.5 text-[13px] leading-[1.3] font-medium transition-colors ${
          isIdle ? 'cursor-not-allowed bg-[var(--ui-control)] text-ui-white opacity-35' : 'settings-chip-hover bg-[var(--ui-control)] text-ui-white'
        }`}
      >
        {label}
      </button>
      {isOpen && position && !disabled && createPortal(
        <SectorSearchPopup
          popupRef={popupRef}
          inputRef={inputRef}
          position={position}
          search={search}
          onSelect={handleSelect}
          onEscape={() => setIsOpen(false)}
          title={title}
          orderMode={orderMode}
        />,
        document.body,
      )}
    </>
  )
}

// 약칭 셀. 클릭하면 입력창으로 바뀌고, Enter로 저장/Escape로 취소. 빈 값으로 저장하면 약칭이 지워진다(null).
function AdminAliasCell({
  alias,
  onUpdate,
  isHighlighted,
  rowHoverClass,
  onHoverStart,
  onHoverEnd,
  onEditingChange,
}: {
  alias: string | null
  onUpdate: (alias: string | null) => void
  isHighlighted: boolean
  rowHoverClass: string
  onHoverStart: () => void
  onHoverEnd: () => void
  onEditingChange: (editing: boolean) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState('')

  const startEdit = () => {
    setValue(alias ?? '')
    setIsEditing(true)
    onEditingChange(true)
    // 입력창으로 바뀌면서 이 <td>가 통째로 사라지므로, onMouseLeave가 못 불리기 전에 직접 강조를 꺼준다.
    onHoverEnd()
  }

  const stopEdit = () => {
    setIsEditing(false)
    onEditingChange(false)
  }

  const submit = () => {
    const trimmed = value.trim()
    const next = trimmed === '' ? null : trimmed
    stopEdit()
    if (next === alias) return
    onUpdate(next)
  }

  if (isEditing) {
    return (
      // 입력칸은 칸 안쪽(좌우 4px 여백)에 두고 입력 글자 시작선을 보통 글자(pl-2=8px)와 맞춘다.
      <td className={`text-left px-1 ${rowHoverClass}`} data-no-row-select onClick={e => e.stopPropagation()}>
        <input
          type="text"
          autoFocus
          aria-label="운영자 전용 약칭"
          value={value}
          maxLength={ALIAS_MAX_LENGTH}
          // 한글 조합 중에 maxLength를 넘는 한 글자가 잠깐 들어오므로 넘는 순간 바로 잘라 낸다.
          onChange={e => setValue(e.target.value.slice(0, ALIAS_MAX_LENGTH))}
          onBlur={stopEdit}
          onKeyDown={e => {
            // 한글 조합 중의 엔터는 글자를 확정할 뿐이라 저장으로 넘기지 않는다(마지막 글자가 따로 한 번 더 저장되는 것을 막는다).
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') stopEdit()
          }}
          className="nes-input is-dark block h-5 w-full rounded-md border-0 bg-[var(--ui-panel)] px-1 text-left text-sm text-ui-white outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]"
        />
      </td>
    )
  }

  return (
    <td
      className={`cursor-pointer truncate pl-2 text-left text-ui-white ${isHighlighted ? 'bg-[var(--brand)]/35' : rowHoverClass}`}
      data-no-row-select
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={e => {
        // 행 전체 클릭 시 체크박스가 토글되는 동작(AdminStockRow)과 별개로 동작해야 하므로 버블링을 막는다.
        e.stopPropagation()
        startEdit()
      }}
    >
      {alias ?? '-'}
    </td>
  )
}

// 종목 한 행. React.memo로 감싸서, 다른 행의 체크박스/hover로 부모가 리렌더돼도
// props가 안 바뀐 행은 리렌더를 건너뛴다 (행이 2700여 개라 이게 없으면 체크박스 하나 눌러도 전체가 다시 그려진다).
const AdminStockRow = memo(function AdminStockRow({
  item,
  index,
  isSelected,
  onToggleSelected,
  onRowMouseDown,
  hoveredKind,
  onParentSectorHoverStart,
  onMidSectorHoverStart,
  onSubSectorHoverStart,
  onAliasHoverStart,
  onHoverEnd,
  sectorOptions,
  sectorOptionsById,
  onAssign,
  onUpdateAlias,
  showAlias,
  nameColSpan,
  showSizeTier,
  showIndustry,
  showTotalMarketValue,
  showStockCode,
  showMarket,
  showNxt,
  isNxt,
  sectorOrderMode,
  onSectorOrderModeChange,
  sectorStats,
}: {
  item: StockSectorListItem
  index: number
  isSelected: boolean
  onToggleSelected: (stockCode: string, shiftKey: boolean) => void
  onRowMouseDown: (stockCode: string, index: number, x: number, y: number) => void
  hoveredKind: 'parentSector' | 'midSector' | 'subSector' | 'alias' | null
  onParentSectorHoverStart: (stockCode: string) => void
  onMidSectorHoverStart: (stockCode: string) => void
  onSubSectorHoverStart: (stockCode: string) => void
  onAliasHoverStart: (stockCode: string) => void
  onHoverEnd: () => void
  sectorOptions: SectorOption[]
  sectorOptionsById: Map<number, SectorOption>
  onAssign: (stockCode: string, sectorId: number) => void
  onUpdateAlias: (stockCode: string, alias: string | null) => void
  showAlias: boolean
  nameColSpan: number
  showSizeTier: boolean
  showIndustry: boolean
  showTotalMarketValue: boolean
  showStockCode: boolean
  showMarket: boolean
  showNxt: boolean
  isNxt: boolean
  // 섹터 선택 팝업의 보기 순서 — 가나다 순이거나 시가총액 합이 큰 순서(sectorStats).
  sectorOrderMode: 'alpha' | 'cap'
  onSectorOrderModeChange: (value: 'alpha' | 'cap') => void
  sectorStats: SectorStats
}) {
  // 행 어디에 마우스를 올려도(체크박스/#/시가총액 등 포함) 줄 전체가 옅게 강조되고, 대분류/소분류/약칭
  // 중 하나를 hover 중일 때는 그 열만 추가로 진하게 표시해서 어떤 걸 hover 중인지 구분되게 한다.
  // 체크박스로 선택된 행도 hover 중이 아니어도 항상 동일한 옅은 강조를 유지한다.
  const [isRowHovered, setIsRowHovered] = useState(false)
  // 약칭 수정 중이거나 대분류/소분류 검색 팝업이 열려있는 동안은, 마우스가 그 행 위에 없어도
  // (예: 입력하다가 다른 곳으로 시선이 옮겨간 경우) 지금 어느 행을 수정 중인지 계속 보이도록 강조를 유지한다.
  const [editingCells, setEditingCells] = useState<Set<'alias' | 'sector1' | 'sector2' | 'sector3'>>(new Set())
  const setCellEditing = (key: 'alias' | 'sector1' | 'sector2' | 'sector3', editing: boolean) => {
    setEditingCells(prev => {
      const next = new Set(prev)
      if (editing) next.add(key)
      else next.delete(key)
      return next
    })
  }
  // 마우스를 올린 줄과 선택한 줄은 같은 청록 계열로 칠하고, 선택한 줄을 다시 가리키면 한 단계 진하게 표시한다.
  const rowHoverClass = isSelected
    ? isRowHovered ? 'bg-[var(--brand)]/35 border-ui-white/20!' : 'bg-[var(--brand)]/20 border-ui-white/20!'
    : isRowHovered || editingCells.size > 0
      ? 'bg-[var(--brand)]/20 border-ui-white/20!'
      : ''
  // 읽기 전용 칸은 업종 표와 같은 옅은 청록, 편집 칸은 한 단계 진한 청록으로 구분한다.
  const readOnlyHoverClass = isSelected ? rowHoverClass : isRowHovered || editingCells.size > 0 ? 'bg-[var(--brand)]/10 border-ui-white/20!' : ''

  // 대분류 팝업엔 최상위 섹터만, 중분류 팝업엔 "지금 이 종목의 대분류"의 자식만, 소분류 팝업엔
  // "지금 이 종목의 중분류"의 자식만 보여준다. sectorId(실제 배정된 섹터)를 parentId로 거슬러
  // 올라가서 전체 조상 체인을 구한 뒤, 뎁스별로 슬롯에 나눠 담는다.
  const chain = resolveSectorChain(sectorOptionsById, item.sectorId)
  const arrange = (options: SectorOption[]) => (sectorOrderMode === 'alpha' ? options : sortByMarketValue(options, sectorStats))
  // 거래 정지 업종은 서버만 종목을 넣으므로 고를 수 있는 목록에서 뺀다. 이미 거래 정지인 종목은 업종 칸을 눌러도 바뀌지 않는다.
  const isSuspendedStock = isSuspendedSectorName(chain.rootName)
  // 보호 업종(미분류·신규 상장)은 정렬 방식과 상관없이 맨 아래에 둔다 — 업종 표·필터와 같은 규칙이다.
  const parentSectorOptions = placeProtectedSectorsLast(
    arrange(sectorOptions.filter(opt => opt.parentId === null && !isSuspendedSectorName(opt.name))),
    opt => opt.name,
  )
  // 이미 한 단계 위로 좁혀진 목록이라 "- " 들여쓰기 접두어가 필요 없다 — 그냥 이름 그대로 보여준다.
  const midSectorOptions = arrange(sectorOptions.filter(opt => opt.parentId === chain.rootId))
    .map(opt => ({ ...opt, label: opt.name }))
  const subSectorOptions =
    chain.midId != null
      ? arrange(sectorOptions.filter(opt => opt.parentId === chain.midId)).map(opt => ({ ...opt, label: opt.name }))
      : []
  const cellOrderMode = { value: sectorOrderMode, onChange: onSectorOrderModeChange }

  // 체크박스를 정확히 조준하지 않아도, hover 강조가 뜨는 영역(약칭/대분류/소분류 제외 전체) 아무 곳이나
  // 클릭하면 체크가 토글되게 한다. 약칭/대분류/소분류 셀은 자기 클릭(stopPropagation)으로 배제된다.
  // 체크박스 자신의 클릭도 이 줄 클릭으로 올라와 한 번만 처리된다(Shift 키 여부를 여기서 알 수 있어서).
  // Shift를 누르고 누르면 직전에 누른 줄부터 이 줄까지 범위를 한 번에 선택한다(부모의 toggleSelected 참고).
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    onToggleSelected(item.stockCode, e.shiftKey)
  }
  // Shift+클릭이 브라우저의 글자 범위 선택(파란 드래그 표시)을 일으키지 않게 한다. 그냥 누른 경우에는 드래그 선택을
  // 시작할 수 있게 부모에 알린다(편집하는 칸은 data-no-row-select로 제외).
  const handleRowMouseDown = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (e.shiftKey) {
      e.preventDefault()
      return
    }
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-no-row-select]')) return
    onRowMouseDown(item.stockCode, index, e.clientX, e.clientY)
  }

  return (
    <tr
      data-row-index={index}
      onClick={handleRowClick}
      onMouseDown={handleRowMouseDown}
      onMouseEnter={() => setIsRowHovered(true)}
      onMouseLeave={() => setIsRowHovered(false)}
    >
      <td className={`text-center ${readOnlyHoverClass}`} style={CHECKBOX_CELL_STYLE}>
        {/* 상태 변경은 줄 클릭(handleRowClick)에서 하므로 onChange는 비워 둔다 — 제어되는 체크박스에 필요한 자리표시다. */}
        <input type="checkbox" className="mx-auto my-0 block thin-check" checked={isSelected} onChange={() => {}} />
      </td>
      {showStockCode && <td className={`${alignClass('center')} text-ui-muted ${readOnlyHoverClass}`}>{item.stockCode}</td>}
      <td colSpan={nameColSpan} className={`truncate pl-2 text-left ${marketColorClass(item.market)} ${readOnlyHoverClass}`}>{item.stockName}</td>
      {showAlias && (
        <AdminAliasCell
          alias={item.alias}
          onUpdate={alias => onUpdateAlias(item.stockCode, alias)}
          isHighlighted={hoveredKind === 'alias'}
          rowHoverClass={rowHoverClass}
          onHoverStart={() => onAliasHoverStart(item.stockCode)}
          onHoverEnd={onHoverEnd}
          onEditingChange={editing => setCellEditing('alias', editing)}
        />
      )}
      {showTotalMarketValue && (
        <td className={`${alignClass('right')} text-ui-muted ${readOnlyHoverClass}`}>
          {item.totalMarketValue != null ? toJoEokDecimal(item.totalMarketValue / 100_000_000) : '-'}
        </td>
      )}
      {showSizeTier && <td className={`text-center text-ui-muted ${readOnlyHoverClass}`}>{item.marketValueTier || '-'}</td>}
      {showMarket && <td className={`text-center ${marketColorClass(item.market)} ${readOnlyHoverClass}`}>{MARKET_LABEL[item.market]}</td>}
      {showNxt && <td className={`text-center ${isNxt ? 'text-ui-muted' : 'text-ui-muted'} ${readOnlyHoverClass}`}>{isNxt ? 'O' : '-'}</td>}
      {showIndustry && <td className={`truncate pl-2 text-left text-ui-muted ${readOnlyHoverClass}`}>{item.industryName ?? '-'}</td>}
      <AdminStockSectorCell
        value={chain.rootName}
        options={parentSectorOptions}
        onAssign={sectorId => onAssign(item.stockCode, sectorId)}
        isHighlighted={hoveredKind === 'parentSector'}
        rowHoverClass={rowHoverClass}
        onHoverStart={() => onParentSectorHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
        onEditingChange={editing => setCellEditing('sector1', editing)}
        disabled={isSuspendedStock}
        disabledHint={SUSPENDED_STOCK_HINT}
        title="대분류 개별 변경"
        orderMode={cellOrderMode}
      />
      <AdminStockSectorCell
        value={chain.midName ?? '-'}
        options={midSectorOptions}
        onAssign={sectorId => onAssign(item.stockCode, sectorId)}
        isHighlighted={hoveredKind === 'midSector'}
        rowHoverClass={rowHoverClass}
        onHoverStart={() => onMidSectorHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
        onEditingChange={editing => setCellEditing('sector2', editing)}
        contextLabel={`대분류: ${chain.rootName}`}
        disabled={isSuspendedStock}
        disabledHint={SUSPENDED_STOCK_HINT}
        title="중분류 개별 변경"
        orderMode={cellOrderMode}
      />
      <AdminStockSectorCell
        value={chain.leafName ?? '-'}
        options={subSectorOptions}
        onAssign={sectorId => onAssign(item.stockCode, sectorId)}
        isHighlighted={hoveredKind === 'subSector'}
        rowHoverClass={chain.midId == null || isSuspendedStock ? readOnlyHoverClass : rowHoverClass}
        onHoverStart={() => onSubSectorHoverStart(item.stockCode)}
        onHoverEnd={onHoverEnd}
        onEditingChange={editing => setCellEditing('sector3', editing)}
        contextLabel={chain.midName ? `중분류: ${chain.midName}` : undefined}
        disabled={chain.midId == null || isSuspendedStock}
        disabledHint={isSuspendedStock ? SUSPENDED_STOCK_HINT : '중분류를 먼저 지정해 주세요'}
        title="소분류 개별 변경"
        orderMode={cellOrderMode}
      />
    </tr>
  )
})

export default function AdminStockTable({
  items,
  sectors,
  snapshotTime,
  toolbarContainer,
  historyContainer,
  excelContainer,
  resetContainer,
  bulkContainer,
  onCountLabelChange,
  nxtStockCodes = NO_NXT_CODES,
  sectorStats = EMPTY_SECTOR_STATS,
  isLoading = false,
  isError = false,
  onRetry,
}: Props) {
  const queryClient = useQueryClient()
  const [sortKey, setSortKey] = useState<SortKey | null>(DEFAULT_SORT_KEY)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [isPending, startTransition] = useTransition()
  // 헤더가 sticky + 스크롤 컨테이너(overflow-auto) 안에 있어서, 그 위로 뜨는 툴팁은 일반 absolute로는
  // 부모의 overflow에 잘린다 — body에 포털로 그려서 잘리지 않게 한다(StockBox 등과 동일한 패턴).
  const [snapshotTooltipPos, setSnapshotTooltipPos] = useState<{ left: number; top: number } | null>(null)

  const assignStockSector = useAssignStockSector()
  const bulkAssignStockSector = useBulkAssignStockSector()
  const resetCustomClassificationMutation = useResetCustomClassification()
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isApplyingUpload, setIsApplyingUpload] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const updateAlias = useUpdateStockAlias()
  // 약칭 지정은 관리자 전용이다 — 관리자의 약칭은 MARKETRY로 올릴 내용에만 쓰이고, 다른 사용자의 데이터는 건드리지 않는다.
  // 일반 사용자에게는 약칭 값을 보여주지도 수정하게 하지도 않는다(백엔드도 관리자만 허용한다). 열 자리만 빈칸으로 두어 다른 시트와 열 위치를 맞춘다.
  const isAdmin = isAdminSession(useSession().data)
  // 약칭 열은 관리자에게만 보인다 — 일반 사용자의 표에서는 열 자체를 뺀다. 이때 종목명 열이 약칭 자리까지 차지해서(StockTableColGroup) 나머지 열 위치는 같다.
  // 열 폭 표(colgroup)는 약칭 열을 그대로 두고, 일반 사용자는 머리글·본문에서 종목명 칸이 두 칸(colSpan 2)을 차지한다 — 그래서 나머지 열 폭이 MARKETRY 표와 똑같다.
  const columns = useMemo(() => (isAdmin ? COLUMNS : COLUMNS.filter(col => col.key !== 'alias')), [isAdmin])
  const columnKeys = useMemo(() => COLUMNS.map(col => col.columnKey), [])
  // handleAssign/runBulkAssign에서 "변경 전" 섹터를 읽어야 하는데, items를 그대로 의존성에 넣으면
  // 섹터가 바뀔 때마다(=매 변경마다) 콜백 identity가 바뀌어 AdminStockRow의 memo가 무력화된다 —
  // ref로 최신 값만 따라가게 해서 콜백은 그대로 안정적으로 유지한다.
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Ctrl+Z/Y 실행취소·다시실행 스택(섹터 변경만 대상, 메모리에만 유지).
  const [undoStack, setUndoStack] = useState<UndoableAction[]>([])
  const [redoStack, setRedoStack] = useState<UndoableAction[]>([])
  const actionIdRef = useRef(0)
  const pushUndo = useCallback((action: UndoableActionInput) => {
    const withId: UndoableAction = { ...action, id: String(actionIdRef.current++) }
    setUndoStack(prev => [...prev.slice(-UNDO_STACK_LIMIT + 1), withId])
    setRedoStack([])
  }, [])
  const applySectorAction = (action: UndoableAction, direction: 'before' | 'after') => {
    if (action.type === 'sector') {
      assignStockSector.mutate({ stockCode: action.stockCode, sectorId: direction === 'before' ? action.before : action.after })
    } else {
      for (const entry of action.entries) {
        assignStockSector.mutate({ stockCode: entry.stockCode, sectorId: direction === 'before' ? entry.before : action.after })
      }
    }
  }
  const handleUndo = () => {
    const action = undoStack[undoStack.length - 1]
    if (!action) return
    applySectorAction(action, 'before')
    setUndoStack(prev => prev.slice(0, -1))
    setRedoStack(prev => [...prev, action])
  }
  const handleRedo = () => {
    const action = redoStack[redoStack.length - 1]
    if (!action) return
    applySectorAction(action, 'after')
    setRedoStack(prev => prev.slice(0, -1))
    setUndoStack(prev => [...prev, action])
  }
  // 목록에서 항목을 고르면 그 항목까지 순서대로 모두 적용한다 — 맨 위(다음 차례)부터 고른 항목까지 한 단계씩 되돌리거나 다시 적용해서,
  // 건너뛴 항목이 남아 값이 꼬이지 않게 한다.
  const handleUndoItem = (id: string) => {
    const index = undoStack.findIndex(a => a.id === id)
    if (index < 0) return
    const applied = undoStack.slice(index).reverse()
    for (const action of applied) applySectorAction(action, 'before')
    setUndoStack(prev => prev.slice(0, index))
    setRedoStack(prev => [...prev, ...applied])
  }
  const handleRedoItem = (id: string) => {
    const index = redoStack.findIndex(a => a.id === id)
    if (index < 0) return
    const applied = redoStack.slice(index).reverse()
    for (const action of applied) applySectorAction(action, 'after')
    setRedoStack(prev => prev.slice(0, index))
    setUndoStack(prev => [...prev, ...applied])
  }
  // 목록 팝업 위치 기준은 화살표가 아니라 UNDO/REDO 버튼 전체(테두리) — 팝업 좌측이 버튼 좌측 테두리와 맞도록.
  // 키보드 리스너는 마운트 시 한 번만 등록하고(=종목 탭에 있는 동안만, 언마운트되면 자동 해제),
  // 매번 최신 핸들러를 부르도록 ref로 우회한다.
  const undoRef = useRef(handleUndo)
  undoRef.current = handleUndo
  const redoRef = useRef(handleRedo)
  redoRef.current = handleRedo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // 입력창 안에서는 브라우저 기본 실행취소(텍스트 되돌리기)에 맡긴다.
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redoRef.current()
        else undoRef.current()
      } else if (key === 'y') {
        e.preventDefault()
        redoRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  // sectors가 안 바뀌면 참조를 유지해야 AdminStockRow의 React.memo가 제대로 스킵된다.
  const sectorOptions = useMemo(() => buildSectorOptions(sectors), [sectors])
  const sectorOptionsById = useMemo(() => new Map(sectorOptions.map(opt => [opt.id, opt])), [sectorOptions])
  const sectorParentHints = useMemo(() => buildSectorParentHints(sectorOptions.map(option => {
    const chain = resolveSectorChain(sectorOptionsById, option.id)
    return [chain.rootName, chain.midName, chain.leafName].filter((name): name is string => name !== null)
  })), [sectorOptions, sectorOptionsById])
  // 거래소 분류와 대·중·소분류 필터는 "가나다 순"과 "시가총액 순" 중 고른 대로 보여준다(기본 가나다 순, 브라우저에 저장).
  const [sectorFilterMode, setSectorFilterMode] = useState<'alpha' | 'cap'>(() => (localStorage.getItem('marketry:sector-filter-order') === 'cap' ? 'cap' : 'alpha'))
  const changeSectorFilterMode = useCallback((value: 'alpha' | 'cap') => {
    localStorage.setItem('marketry:sector-filter-order', value)
    setSectorFilterMode(value)
  }, [])
  const sectorFilterOrder = useMemo(() => sectorNamesByDepth(sectors, sectorStats), [sectors, sectorStats])
  const industryFilterOrder = useMemo(() => {
    const marketValueByIndustry = new Map<string, number>()
    for (const item of items) {
      const name = item.industryName ?? '-'
      if (name !== '-') marketValueByIndustry.set(name, (marketValueByIndustry.get(name) ?? 0) + (item.totalMarketValue ?? 0))
    }
    return [...marketValueByIndustry]
      .sort(([nameA, valueA], [nameB, valueB]) => valueB - valueA || compareKoreanText(nameA, nameB))
      .map(([name]) => name)
  }, [items])
  // 필터/정렬/컬럼 표시에 쓰는 대분류·중분류·소분류 문자열을 종목마다 한 번씩만 미리 계산해둔다.
  const displayByStockCode = useMemo(
    () => new Map(items.map(item => [item.stockCode, computeDisplayValues(item, sectorOptionsById, nxtStockCodes)])),
    [items, sectorOptionsById, nxtStockCodes],
  )
  // 대분류/중분류/소분류는 이제 각각 별도로 assign 요청을 보내는 독립된 액션이라, 셀마다 따로 강조한다.
  const [hoveredRow, setHoveredRow] = useState<{
    stockCode: string
    kind: 'parentSector' | 'midSector' | 'subSector' | 'alias'
  } | null>(null)
  // 필터/정렬이 바뀌어도 선택 상태는 stockCode 기준으로 유지된다 (전체선택만 "지금 보이는 것" 기준으로 동작).
  const [selectedStockCodes, setSelectedStockCodes] = useState<Set<string>>(new Set())
  // 1차→2차→3차 순서로 일괄적용하는 단계형 플로우 상태 — 이번 선택 안에서 방금 일괄적용한 1차/2차를
  // 기억해뒀다가, 2차/3차 버튼의 선택지를 그 하위 섹터로만 좁힌다. 선택이 전부 풀리면(새 작업 시작) 초기화.
  const [bulkParentId, setBulkParentId] = useState<number | null>(null)
  const [bulkMidId, setBulkMidId] = useState<number | null>(null)
  // 방금 일괄 적용한 종목 — 바뀐 분류가 열 필터 조건에서 벗어나도(예: 대분류 `신규 상장` 필터를 걸어 두고 `금융`으로 적용) 선택을 모두
  // 풀기 전까지 표에 남겨, 이어서 중분류·소분류를 정할 수 있게 한다. 하나씩 체크를 풀 때는 줄이 바로 사라지지 않는다(눌린 채 줄이 밀려
  // 옆 종목의 체크까지 풀리는 것을 막는다). 선택이 전부 풀리면 필터대로 돌아간다.
  const [pinnedStockCodes, setPinnedStockCodes] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (selectedStockCodes.size === 0) {
      setBulkParentId(null)
      setBulkMidId(null)
      setPinnedStockCodes(previous => (previous.size === 0 ? previous : new Set()))
    }
  }, [selectedStockCodes])

  const handleSort = (key: SortKey) => {
    startTransition(() => {
      // 같은 열을 계속 누르면 오름차순 → 내림차순 → 정렬 해제(기본 순서(시가총액 내림차순)) 순으로 돈다.
      if (key === sortKey) {
        if (sortDirection === 'asc') setSortDirection('desc')
        else setSortKey(null)
      } else {
        setSortKey(key)
        setSortDirection('asc')
      }
    })
  }

  const handleUpdateAlias = useCallback(
    (stockCode: string, alias: string | null) => {
      // 다른 종목의 이름이나 약칭과 같은 약칭은 저장하지 않는다 — 지도에서 서로 다른 종목이 같은 이름으로 보여 오해를 낳는다.
      const conflict = alias === null ? null : findAliasConflict(itemsRef.current, stockCode, alias)
      if (conflict) {
        void appAlert(`"${alias}"은(는) 다른 종목과 겹치는 약칭이라 저장하지 않았습니다.\n겹치는 종목: ${conflict}`, { title: '약칭 저장' })
        return
      }
      updateAlias.mutate({ stockCode, alias })
    },
    [updateAlias],
  )

  // Shift+클릭 범위 선택용 — 마지막으로 누른 줄(기준 줄)과, 지금 화면에 보이는 순서의 목록(콜백을 고정하려고 ref로 둔다).
  const lastClickedStockCodeRef = useRef<string | null>(null)
  const visibleItemsRef = useRef<StockSectorListItem[]>([])

  // 여러 줄 선택 안내 — 드래그나 Shift+클릭을 모른 채 줄을 하나씩 계속 누르는 사용자에게 한 번 알려준다. 페이지를 새로 열 때마다
  // 처음부터 다시 센다(저장하지 않는다): 또 하나씩 누르고 있다면 그새 잊은 것이라는 판단이다. 한 번 보여주거나 드래그·Shift를
  // 쓰면 그 페이지에서는 다시 띄우지 않는다.
  const SELECTION_HINT_CLICK_COUNT = 3
  const SELECTION_HINT_DURATION_MS = 6000
  const [isSelectionHintOpen, setIsSelectionHintOpen] = useState(false)
  const plainSelectClickCountRef = useRef(0)
  const selectionHintShownRef = useRef(false)
  const noteMultiSelectUsed = useCallback(() => {
    selectionHintShownRef.current = true
    setIsSelectionHintOpen(false)
  }, [])
  useEffect(() => {
    if (!isSelectionHintOpen) return
    const timer = setTimeout(() => setIsSelectionHintOpen(false), SELECTION_HINT_DURATION_MS)
    return () => clearTimeout(timer)
  }, [isSelectionHintOpen])

  // 드래그 선택 상태 — 누른 줄(기준)과 그 시점의 선택 상태(baseline), 끌어서 적용할 상태(selectTo)를 들고 있다가
  // 마우스가 움직일 때마다 baseline에 [기준 줄 ~ 지금 줄] 범위를 적용한다. baseline에서 매번 다시 계산하므로
  // 마우스를 되돌리면 선택 범위도 줄어든다.
  const dragRef = useRef<{
    anchorIndex: number
    baseline: Set<string>
    selectTo: boolean
    moved: boolean
    lastIndex: number
    pointer: { x: number; y: number }
  } | null>(null)
  // 끌기를 마친 직후 따라오는 click이 한 줄을 다시 토글하지 않게 막는 표시.
  const suppressClickRef = useRef(false)
  const dragFrameRef = useRef<number | null>(null)
  const selectedRef = useRef(selectedStockCodes)
  useEffect(() => {
    selectedRef.current = selectedStockCodes
  }, [selectedStockCodes])

  const handleRowMouseDown = useCallback((stockCode: string, index: number, x: number, y: number) => {
    // Shift+클릭 범위 선택이 이 줄에서 이어지도록 기준 줄도 같이 기억한다.
    lastClickedStockCodeRef.current = stockCode
    dragRef.current = {
      anchorIndex: index,
      baseline: new Set(selectedRef.current),
      selectTo: !selectedRef.current.has(stockCode),
      moved: false,
      lastIndex: index,
      pointer: { x, y },
    }
  }, [])

  // 마우스 아래의 줄을 좌표로 찾아 선택 범위를 갱신한다 — 표가 화면에 보이는 줄만 그려서, 자동 스크롤 중에는
  // mouseenter에 기대지 않고 좌표로 찾는 편이 확실하다. 마우스가 표 밖(위·아래)에 있어도 가장자리 줄로 본다.
  const applyDragAtPointer = useCallback(() => {
    const drag = dragRef.current
    const container = scrollContainerRef.current
    if (!drag || !container) return
    const rect = container.getBoundingClientRect()
    const y = Math.min(Math.max(drag.pointer.y, rect.top + 1), rect.bottom - 1)
    const row = document.elementFromPoint(drag.pointer.x, y)?.closest<HTMLElement>('tr[data-row-index]')
    if (!row) return
    const index = Number(row.dataset.rowIndex)
    if (!drag.moved && index === drag.anchorIndex) return
    if (!drag.moved) {
      drag.moved = true
      document.body.style.userSelect = 'none'
      noteMultiSelectUsed()
    }
    if (index === drag.lastIndex) return
    drag.lastIndex = index
    const visibleItems = visibleItemsRef.current
    const next = new Set(drag.baseline)
    const from = Math.min(drag.anchorIndex, index)
    const to = Math.max(drag.anchorIndex, index)
    for (let i = from; i <= to; i++) {
      const code = visibleItems[i]?.stockCode
      if (code === undefined) continue
      if (drag.selectTo) next.add(code)
      else next.delete(code)
    }
    setSelectedStockCodes(next)
  }, [noteMultiSelectUsed])

  useEffect(() => {
    const EDGE_PX = 40
    const MAX_SCROLL_PX = 24
    // 끌다가 표 위·아래 가장자리에 닿으면 그쪽으로 스크롤한다(가장자리에 가까울수록 빠르게).
    const tick = () => {
      const drag = dragRef.current
      const container = scrollContainerRef.current
      if (!drag || !container) {
        dragFrameRef.current = null
        return
      }
      if (drag.moved) {
        const rect = container.getBoundingClientRect()
        let delta = 0
        if (drag.pointer.y < rect.top + EDGE_PX) {
          delta = -Math.min(MAX_SCROLL_PX, Math.ceil((MAX_SCROLL_PX * (rect.top + EDGE_PX - drag.pointer.y)) / EDGE_PX))
        } else if (drag.pointer.y > rect.bottom - EDGE_PX) {
          delta = Math.min(MAX_SCROLL_PX, Math.ceil((MAX_SCROLL_PX * (drag.pointer.y - (rect.bottom - EDGE_PX))) / EDGE_PX))
        }
        if (delta !== 0) {
          container.scrollTop += delta
          applyDragAtPointer()
        }
      }
      dragFrameRef.current = requestAnimationFrame(tick)
    }
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      drag.pointer = { x: e.clientX, y: e.clientY }
      applyDragAtPointer()
      if (dragFrameRef.current === null) dragFrameRef.current = requestAnimationFrame(tick)
    }
    const stopDrag = () => {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null
      document.body.style.userSelect = ''
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }
      if (drag.moved) {
        // 끌기가 끝난 직후의 click(같은 줄에서 뗀 경우)은 선택을 다시 뒤집지 않도록 한 번만 무시한다.
        suppressClickRef.current = true
        setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopDrag)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopDrag)
      stopDrag()
    }
  }, [applyDragAtPointer])

  const toggleSelected = useCallback((stockCode: string, shiftKey: boolean) => {
    if (suppressClickRef.current) return
    if (shiftKey) {
      noteMultiSelectUsed()
    } else if (!selectedRef.current.has(stockCode)) {
      // 하나씩 눌러서 선택을 늘리는 횟수만 센다(해제는 세지 않는다).
      plainSelectClickCountRef.current += 1
      if (plainSelectClickCountRef.current >= SELECTION_HINT_CLICK_COUNT && !selectionHintShownRef.current) {
        selectionHintShownRef.current = true
        setIsSelectionHintOpen(true)
      }
    }
    const anchorStockCode = lastClickedStockCodeRef.current
    lastClickedStockCodeRef.current = stockCode
    setSelectedStockCodes(prev => {
      const next = new Set(prev)
      if (shiftKey && anchorStockCode && anchorStockCode !== stockCode) {
        const visibleItems = visibleItemsRef.current
        const anchorIndex = visibleItems.findIndex(item => item.stockCode === anchorStockCode)
        const clickedIndex = visibleItems.findIndex(item => item.stockCode === stockCode)
        // 기준 줄이 필터/정렬로 화면에서 사라졌으면 범위를 알 수 없으니 평소처럼 한 줄만 토글한다.
        if (anchorIndex >= 0 && clickedIndex >= 0) {
          // 범위 전체에 기준 줄의 지금 상태(선택됨/해제됨)를 적용한다 — 탐색기·메일 목록과 같은 방식.
          const select = prev.has(anchorStockCode)
          const from = Math.min(anchorIndex, clickedIndex)
          const to = Math.max(anchorIndex, clickedIndex)
          for (let i = from; i <= to; i++) {
            if (select) next.add(visibleItems[i].stockCode)
            else next.delete(visibleItems[i].stockCode)
          }
          return next
        }
      }
      if (next.has(stockCode)) next.delete(stockCode)
      else next.add(stockCode)
      return next
    })
  }, [noteMultiSelectUsed])

  const handleParentSectorHoverStart = useCallback(
    (stockCode: string) => setHoveredRow({ stockCode, kind: 'parentSector' }),
    [],
  )
  const handleMidSectorHoverStart = useCallback(
    (stockCode: string) => setHoveredRow({ stockCode, kind: 'midSector' }),
    [],
  )
  const handleSubSectorHoverStart = useCallback(
    (stockCode: string) => setHoveredRow({ stockCode, kind: 'subSector' }),
    [],
  )
  const handleAliasHoverStart = useCallback((stockCode: string) => setHoveredRow({ stockCode, kind: 'alias' }), [])
  const handleHoverEnd = useCallback(() => setHoveredRow(null), [])

  // 1차→2차→3차 단계형 일괄적용 공통 로직. 각 단계는 독립된 assign 호출이라(서버 입장에선 sectorId를
  // 여러 번 덮어쓰는 흐름이지만), 다음 단계 버튼에서 계속 이어서 좁혀나갈 수 있도록 선택은 유지한다.
  const runBulkAssign = (sectorId: number, onSuccessExtra?: () => void) => {
    const targets = [...selectedStockCodes]
    // 결과 반영으로 필터에서 빠지더라도 표에 남겨 둔다. 분류가 바뀌기 전에 미리 표시해야 필터 갱신 때 선택이 풀리지 않는다.
    setPinnedStockCodes(previous => new Set([...previous, ...targets]))
    // 실행취소용으로 각 종목의 "변경 전" 섹터를 미리 스냅샷 — 일괄적용은 종목마다 원래 섹터가
    // 달랐을 수 있어서, 되돌릴 때도 종목별로 각자의 이전 값으로 복원해야 한다.
    const beforeByStockCode = new Map(targets.map(stockCode => [stockCode, itemsRef.current.find(item => item.stockCode === stockCode)?.sectorId]))
    bulkAssignStockSector.mutate(
      { stockCodes: targets, sectorId: sectorId },
      {
        onSuccess: result => {
          onSuccessExtra?.()
          const sectorName = sectorOptions.find(opt => opt.id === result.sectorId)?.name ?? ''
          const entries = targets
            .filter(stockCode => !result.failedStockCodes.includes(stockCode))
            .map(stockCode => ({ stockCode, before: beforeByStockCode.get(stockCode) }))
            .filter((entry): entry is { stockCode: string; before: number } => entry.before != null && entry.before !== sectorId)
          if (entries.length > 0) {
            pushUndo({ type: 'bulkSector', sectorName, after: sectorId, entries })
          }
          if (result.failedStockCodes.length === 0) {
            appAlert(`[${sectorName}]\n일괄 적용 완료되었습니다.`, { title: '일괄 변경 완료' })
          } else {
            appAlert(
              `[${sectorName}]\n다음 종목은 반영되지 않았습니다:\n${result.failedStockCodes.join(', ')}`,
              { title: '일괄 변경 실패' },
            )
          }
        },
      },
    )
  }

  const handleBulkAssignParent = (sectorId: number) => {
    runBulkAssign(sectorId, () => {
      setBulkParentId(sectorId)
      setBulkMidId(null)
    })
  }
  const handleBulkAssignMid = (sectorId: number) => {
    runBulkAssign(sectorId, () => setBulkMidId(sectorId))
  }
  const handleBulkAssignSub = (sectorId: number) => {
    runBulkAssign(sectorId)
  }

  // 선택한 종목들의 대분류(중분류)가 모두 같으면 그 아래 중분류(소분류)를 바로 일괄 변경할 수 있다. 서로 다르면 위 단계를 먼저 일괄적용한 값을 쓴다.
  const selectedCommonChain = useMemo(() => {
    let rootId: number | null | undefined
    let midId: number | null | undefined
    for (const item of items) {
      if (!selectedStockCodes.has(item.stockCode)) continue
      const chain = resolveSectorChain(sectorOptionsById, item.sectorId)
      rootId = rootId === undefined || rootId === chain.rootId ? chain.rootId : null
      midId = midId === undefined || midId === chain.midId ? chain.midId : null
    }
    return { rootId: rootId ?? null, midId: midId ?? null }
  }, [items, selectedStockCodes, sectorOptionsById])
  const effectiveParentId = selectedCommonChain.rootId ?? bulkParentId
  const effectiveMidId = selectedCommonChain.midId ?? bulkMidId
  // 일괄 변경 목록은 필터와 같은 "가나다 순 / 시가총액 순" 선택을 따른다.
  const bulkOrderMode = { value: sectorFilterMode, onChange: changeSectorFilterMode }
  const orderedChildren = (parentId: number | null) => {
    const children = sectorOptions.filter(opt => opt.parentId === parentId)
    return sectorFilterMode === 'alpha' ? children : sortByMarketValue(children, sectorStats)
  }
  // 일괄 변경으로도 거래 정지 업종에는 넣을 수 없다 — 목록에서 뺀다.
  const bulkParentOptions = placeProtectedSectorsLast(
    orderedChildren(null).filter(opt => !isSuspendedSectorName(opt.name)),
    opt => opt.name,
  )
  const bulkMidOptions = effectiveParentId != null ? orderedChildren(effectiveParentId) : []
  const bulkSubOptions = effectiveMidId != null ? orderedChildren(effectiveMidId) : []

  // 표 위 검색창 — 종목명·코드·분류명(관리자는 약칭도)을 대소문자·공백 무시와 초성으로 찾는다.
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedSearch = searchQuery.trim()
  const searched = useMemo(() => {
    if (!trimmedSearch) return items
    return items.filter(createStockMatcher<StockSectorListItem>(trimmedSearch, item => ({
      name: item.stockName,
      code: item.stockCode,
      alias: isAdmin ? item.alias : null,
      labels: [item.industryName, item.parentSectorName, item.sectorName],
    })))
  }, [items, trimmedSearch, isAdmin])

  // 머리글 필터 — 규모·마켓·거래소 분류·대/중/소분류·NXT. 값이 없으면 '-'이다.
  const filterValueOf = useCallback(
    (item: StockSectorListItem, key: StockFilterKey): string => {
      const display = displayByStockCode.get(item.stockCode)
      switch (key) {
        case 'sizeTier': return item.marketValueTier || '-'
        case 'market': return display?.market || '-'
        case 'industry': return display?.originCategoryName || '-'
        case 'parentSector': return display?.parentSectorName || '-'
        case 'midSector': return display?.midSectorName || '-'
        case 'subSector': return display?.subSectorName || '-'
        case 'nxt': return display?.isNxt ? 'O' : '-'
      }
    },
    [displayByStockCode],
  )
  const columnFilters = useStockColumnFilters(searched, filterValueOf)
  // 개별 변경으로 분류 필터에서 빠질 때도 이어서 편집할 수 있게 한다. 선택하지 않은 행이면 이전 선택 대신 이 행만 선택한다.
  const handleAssign = useCallback((stockCode: string, sectorId: number) => {
    const before = itemsRef.current.find(item => item.stockCode === stockCode)?.sectorId
    const chain = resolveSectorChain(sectorOptionsById, sectorId)
    const leavesFilter = (['parentSector', 'midSector', 'subSector'] as const).some((key, index) =>
      columnFilters.excluded[key]?.has([chain.rootName, chain.midName ?? '-', chain.leafName ?? '-'][index]))
    assignStockSector.mutate({ stockCode, sectorId }, {
      onSuccess: () => {
        if (!leavesFilter || before === sectorId) return
        if (!selectedStockCodes.has(stockCode)) {
          setSelectedStockCodes(new Set([stockCode]))
          setPinnedStockCodes(new Set([stockCode]))
          setBulkParentId(null)
          setBulkMidId(null)
        } else {
          setPinnedStockCodes(previous => new Set([...previous, stockCode]))
        }
      },
    })
    if (before != null && before !== sectorId) pushUndo({ type: 'sector', stockCode, before, after: sectorId })
  }, [assignStockSector, columnFilters.excluded, pushUndo, sectorOptionsById, selectedStockCodes])
  const filtered = useMemo(() => {
    const rows = columnFilters.filteredRows
    if (pinnedStockCodes.size === 0) return rows
    const matchedStockCodes = new Set(rows.map(item => item.stockCode))
    const kept = searched.filter(item => pinnedStockCodes.has(item.stockCode) && !matchedStockCodes.has(item.stockCode))
    return kept.length === 0 ? rows : [...rows, ...kept]
  }, [columnFilters.filteredRows, pinnedStockCodes, searched])
  // 규모 필터의 보기 순서 — 큰 구간부터(Top 2, 대형주, ...).
  const { data: valueTiers } = useMarketValueTiers()
  const tierOrder = useMemo(() => [...(valueTiers ?? [])].sort((a, b) => b.thresholdValue - a.thresholdValue).map(tier => tier.label), [valueTiers])

  // 필터에 걸려서 화면에서 사라진 종목은 선택도 같이 해제한다 — 안 보이는 종목이 일괄 변경에
  // 딸려 들어가는 걸 막기 위함. filtered가 실제로 바뀔 때(=필터 조작 시)만 실행되므로 체크박스/hover
  // 같은 잦은 조작과는 무관하다.
  useEffect(() => {
    const visibleStockCodes = new Set(filtered.map(item => item.stockCode))
    setSelectedStockCodes(prev => {
      let changed = false
      const next = new Set<string>()
      for (const stockCode of prev) {
        if (visibleStockCodes.has(stockCode)) {
          next.add(stockCode)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [filtered])

  // 정렬 방향은 비교 안에 넣는다. 같은 값끼리(예: 같은 마켓)는 방향과 상관없이 항상 시가총액이 큰 종목이 위에 온다.
  // 정렬이 꺼진 상태(sortKey null)는 기본 순서인 시가총액 내림차순이다.
  const sorted = useMemo(() => {
    // 일반 사용자는 약칭 열이 없으므로, 예전에 약칭으로 정렬해 둔 값은 기본 순서로 본다.
    const effectiveSortKey = !isAdmin && sortKey === 'alias' ? null : sortKey
    const key = effectiveSortKey ?? DEFAULT_SORT_KEY
    const sign = effectiveSortKey && sortDirection === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const diff = compareByKey(a, b, key, displayByStockCode)
      if (diff !== 0) return sign * diff
      return (b.totalMarketValue ?? -Infinity) - (a.totalMarketValue ?? -Infinity) || compareKoreanText(a.stockCode, b.stockCode)
    })
  }, [filtered, sortKey, sortDirection, displayByStockCode, isAdmin])
  useEffect(() => {
    visibleItemsRef.current = sorted
  }, [sorted])

  // 엑셀 업로드 — 파일의 대·중·소분류대로 종목 분류를 한 번에 바꾼다. 적용 전에 요약을 보여 주고, 없는 분류는 새로 만든다.
  const handleUploadFile = async (file: File) => {
    setIsUploading(true)
    let createdCount = 0
    let appliedCount = 0
    const failed: string[] = []
    let applying = false
    let requestPending = false
    let uploadAttempted = false
    try {
      const rows = await readClassificationFile(file)
      if (rows.length === 0) {
        appAlert('읽을 수 있는 줄이 없습니다.\n열 이름이 종목코드·대분류·중분류·소분류인지 확인해 주세요.', { title: '적용 실패' })
        return
      }
      const plan = buildUploadPlan(rows, sectors, new Map(itemsRef.current.map(item => [item.stockCode, item.sectorId])))
      // 창이 길어지지 않게 개수만 한 줄씩 적는다 — 건너뛰는 종목은 비어 있음·대분류 없음·목록에 없는 코드를 합친 수다.
      const skippedCount = plan.blankCount + plan.invalidCount + plan.unknownCodes.length + plan.autoAssignedCount
      if (plan.changedCount === 0) {
        const parts = [plan.unchangedCount > 0 && `이미 같은 분류 ${toCount(plan.unchangedCount)}개`, skippedCount > 0 && `건너뜀 ${toCount(skippedCount)}개`].filter(Boolean)
        appAlert(`바뀌는 종목이 없습니다.${parts.length > 0 ? `\n${parts.join(' · ')}` : ''}`, { title: '적용 없음' })
        return
      }
      // 종목은 "변경"되는 수다 — 파일 전체 수와 다르게 읽히지 않도록 이미 같은 분류인 종목과 건너뛰는 종목을 함께 적어 합계가 맞게 보이게 한다.
      const keptParts = [plan.unchangedCount > 0 && `이미 같은 분류 ${toCount(plan.unchangedCount)}개`, skippedCount > 0 && `건너뜀 ${toCount(skippedCount)}개`].filter(Boolean)
      const summary = [
        `업종: 신규 ${toCount(plan.newSectors.length)}개`,
        `종목: 변경 ${toCount(plan.changedCount)}개${keptParts.length > 0 ? ` (${keptParts.join(', ')})` : ''}`,
        '이대로 적용할까요?',
      ].join('\n')
      if (!(await appConfirm(summary, { title: '엑셀 적용' }))) return

      applying = true
      setIsApplyingUpload(true)
      const before = new Map(itemsRef.current.map(item => [item.stockCode, item.sectorId]))
      uploadAttempted = true
      requestPending = true
      const result = await uploadClassification(plan.assignments)
      requestPending = false
      createdCount = result.createdSectorCount
      failed.push(...result.failedStockCodes)
      for (const group of result.appliedAssignments) {
        appliedCount += group.stockCodes.length
        const entries = group.stockCodes
          .map(stockCode => ({ stockCode, before: before.get(stockCode) }))
          .filter((entry): entry is { stockCode: string; before: number } => entry.before != null && entry.before !== group.sectorId)
        if (entries.length > 0) pushUndo({ type: 'bulkSector', sectorName: group.path.join(' > '), after: group.sectorId, entries })
      }
      appAlert(`업종: ${createdCount.toLocaleString('ko-KR')}개\n종목 ${appliedCount.toLocaleString('ko-KR')}개${failed.length > 0 ? `\n반영되지 않은 종목 ${failed.length.toLocaleString('ko-KR')}개\n${failed.join(', ')}` : '\n적용되었습니다.'}`, { title: failed.length > 0 ? '일부 적용' : '적용 완료' })
    } catch (error) {
      if (error instanceof ClassificationUploadError) {
        appAlert(error.message, { title: '파일 확인' })
      } else if (isAxiosError(error) && error.response?.status === 429) {
        appAlert('업로드는 1시간에 3회까지 가능합니다.', { title: '업로드 제한' })
      } else if (applying) {
        appAlert([
          '엑셀 적용을 완료하지 못했습니다.',
          ...(requestPending ? ['서버 반영 여부를 확인한 뒤 목록을 새로고침해 주세요.'] : []),
          getErrorDetail(error),
        ].join('\n'), { title: '적용 중단' })
      } else {
        appAlert('엑셀을 읽지 못했습니다.\n파일 형식과 열 이름을 확인해 주세요.', { title: '파일 확인' })
      }
    } finally {
      const refreshes: Promise<void>[] = []
      if (uploadAttempted) refreshes.push(queryClient.invalidateQueries({ queryKey: customHeatmapKeys.sectors() }))
      if (uploadAttempted) refreshes.push(queryClient.invalidateQueries({ queryKey: customHeatmapKeys.stockSectors() }))
      if (uploadAttempted) refreshes.push(invalidateCustomTaxonomy(queryClient))
      await Promise.all(refreshes)
      setIsApplyingUpload(false)
      setIsUploading(false)
    }
  }

  const handleResetCustomClassification = async () => {
    const confirmed = await appWarnConfirm(
      '업종 목록과 종목 분류 초기화합니다.\n진행하시겠습니까?',
      { title: '업종·종목 초기화' },
    )
    if (!confirmed) return
    try {
      await resetCustomClassificationMutation.mutateAsync()
      setUndoStack([])
      setRedoStack([])
    } catch {
      await appAlert('업종 목록과 종목 분류를 초기화하지 못했습니다.', { title: '초기화 실패' })
    }
  }

  // 지금 화면에 필터/정렬 적용된 상태 그대로 내려받는다 — 전체를 받고 싶으면 필터를 먼저 풀면 된다.
  const handleExportExcel = async () => {
    if (sorted.length === 0) {
      appAlert('다운로드할 종목이 없습니다.\n검색어와 필터를 확인해 주세요.', { title: '다운로드 불가' })
      return
    }
    setIsExporting(true)
    try {
      const filename = `[MARKETRY-업종분류] ${fileTimestamp()}.xlsx`
      const rows = sorted.map(item => {
        const display = displayByStockCode.get(item.stockCode)!
        return {
          종목코드: item.stockCode,
          종목명: item.stockName,
          '규모': item.marketValueTier ?? '',
          마켓: display.market,
          '거래소 분류': display.originCategoryName,
          '대분류': display.parentSectorName,
          '중분류': display.midSectorName,
          '소분류': display.subSectorName,
        }
      })
      await exportRowsToExcel(filename, '업종 분류', rows, {
        alignByHeader: { 종목코드: 'center', '규모': 'center', 마켓: 'center' },
        fixedWidths: { 종목코드: 15, 종목명: 30, '규모': 15, 마켓: 10, '거래소 분류': 20, 대분류: 20, 중분류: 20, 소분류: 20 },
        // 업로드로 바꾸는 대·중·소분류만 수정할 수 있고 나머지 열은 잠근다.
        editableHeaders: ['대분류', '중분류', '소분류'],
      })
    } catch {
      appAlert('엑셀 파일을 만들지 못했습니다.\n다시 시도해 주세요.', { title: '다운로드 실패' })
    } finally {
      setIsExporting(false)
    }
  }

  // 전체선택은 항상 "지금 필터링돼서 보이는" 종목만 대상으로 한다. 개별 체크는 필터가 바뀌어도 유지된다.
  const isAllVisibleSelected = sorted.length > 0 && sorted.every(item => selectedStockCodes.has(item.stockCode))
  const toggleSelectAllVisible = () => {
    setSelectedStockCodes(prev => {
      const next = new Set(prev)
      if (isAllVisibleSelected) {
        for (const item of sorted) next.delete(item.stockCode)
      } else {
        for (const item of sorted) next.add(item.stockCode)
      }
      return next
    })
  }

  // 행이 수천 개라 전부 DOM에 그려두면(가상화 없이) 체크박스 하나만 바꿔도 브라우저가 그 거대한
  // DOM 전체를 놓고 스타일/레이아웃을 다시 계산한다 — React.memo로는 못 줄이는 비용이라 가상화가 필요하다.
  // 실제 <table>/<tr> 구조는 유지한 채(NES.css 스타일이 table 요소를 대상으로 하므로), 보이는 행 앞뒤로
  // 스페이서 <tr>만 넣어서 스크롤 높이를 흉내내는 방식.
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // 머리글 필터가 걸린 열은 좁은 창에서도 숨기지 않는다.
  const pinnedColumns = useMemo(() => pinnedStockColumns(columnFilters.excluded), [columnFilters.excluded])
  const columnWidths = useStockColumnWidths(scrollContainerRef, pinnedColumns)
  // 좁은 창에서 숨긴 열은 폭 표에 키가 없다 — 머리글·본문 칸·빈 줄의 칸 수를 거기에 맞춘다.
  // 약칭 열이 숨으면 관리자는 약칭 칸이 없어지고, 일반 사용자는 종목명 칸이 약칭 자리(colSpan 2)를 더는 차지하지 않는다.
  const isAliasColumnVisible = columnWidths.alias !== undefined
  const nameColSpan = !isAdmin && isAliasColumnVisible ? 2 : 1
  const showSizeTier = columnWidths.sizeTier !== undefined
  const showIndustry = columnWidths.industry !== undefined
  const showTotalMarketValue = columnWidths.totalMarketValue !== undefined
  const showStockCode = columnWidths.stockCode !== undefined
  const showMarket = columnWidths.market !== undefined
  const showNxt = columnWidths.nxt !== undefined
  const tableColSpan = 1 + columnKeys.filter(key => columnWidths[key] !== undefined).length
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 29,
    overscan: 15,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0

  // 툴바 버튼은 테두리·채운 배경 없이 아이콘/글자만 둔다 — 올리면 옅은 배경이 깔리고, 비활성이면 흐려진다.
  // 세 번째 바(페이지 공통 상태/옵션 바) 높이(h-7=28px)에 맞춰야 해서, nes.css 기본 버튼 패딩(6px 8px)보다
  // 좁게 오버라이드한다 — 그 외 로직/상태는 전부 그대로다.
  // 설정창 "변경 내역" 항목 — 종목 화면과 업종 화면이 같은 부품(ChangeHistoryControls)을 쓴다.
  const historyControls = (
    <ChangeHistoryControls
      undoStack={undoStack}
      redoStack={redoStack}
      describe={action => describeUndoableAction(action, items, sectorOptionsById)}
      onUndo={handleUndo}
      onRedo={handleRedo}
      onUndoItem={handleUndoItem}
      onRedoItem={handleRedoItem}
    />
  )

  const rootRef = useRef<HTMLDivElement>(null)
  // 윗줄(드롭다운 오른쪽)에 그리는 검색창과 필터 초기화. 실행취소·다시실행은 설정창의 변경 내역 위치에만 표시한다.
  const toolbar = (
    <div className="flex h-full min-h-0 w-full items-center gap-2">
      <SearchBar
        inline
        query={searchQuery}
        onChange={query => {
          setSearchQuery(query)
          scrollContainerRef.current?.scrollTo({ top: 0 })
        }}
        placeholder="검색"
        ariaLabel="종목 검색"
        maxLength={STOCK_SEARCH_MAX_LENGTH}
        afterInput={
          columnFilters.activeCount > 0 ? (
            <button
              type="button"
              onClick={columnFilters.clearAll}
              className="toolbar-badge flex h-6 items-center gap-1 whitespace-nowrap rounded border border-ui-border bg-transparent px-2 text-sm font-normal text-ui-text transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
            >
              <FunnelIcon className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
              필터 초기화
            </button>
          ) : null
        }
      />
    </div>
  )


  useReportCountLabel(`${toCount(sorted.length)}/${toCount(items.length)}종목`, onCountLabelChange)
  const hasCustomClassification = sectors.length > 0 || items.some(item => item.sectorId != null)
  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 flex-col">
      {isApplyingUpload && (
        <div role="status" aria-live="polite" aria-busy="true" className="absolute inset-0 z-40 flex items-center justify-center bg-ui-background">
          <div className="relative flex flex-col items-center">
            <Spinner showElapsed className="h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]" />
            <span className="absolute left-1/2 top-full mt-4 -translate-x-1/2 whitespace-nowrap text-base text-ui-text">처리 중입니다.<br />1분 내외 소요.</span>
          </div>
        </div>
      )}
      {toolbarContainer && createPortal(toolbar, toolbarContainer)}
      {historyContainer && createPortal(
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">변경 내역</h2>
          {historyControls}
        </div>,
        historyContainer,
      )}
      {excelContainer && createPortal(
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">간편 업종 분류</h2>
          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">다운받아서 AI로 간편 분류 추천</p>
          <div className="grid max-w-full settings-control-inset grid-cols-2 gap-[6px]">
            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={isExporting || isUploading || resetCustomClassificationMutation.isPending}
              className="flex h-[25px] items-center justify-center gap-1 settings-chip-hover rounded-[4px] border-0 bg-[var(--ui-control)] text-[13px] leading-[1.3] font-medium text-ui-white disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="엑셀 다운로드"
            >
              <DownloadIcon className="h-4 w-4 text-ui-text" />
              {isExporting ? '생성 중…' : '다운로드'}
            </button>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={isUploading || isExporting || resetCustomClassificationMutation.isPending}
              className="flex h-[25px] items-center justify-center gap-1 settings-chip-hover rounded-[4px] border-0 bg-[var(--ui-control)] text-[13px] leading-[1.3] font-medium text-ui-white disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="엑셀 업로드"
            >
              <UploadIcon className="h-4 w-4 text-ui-text" />
              업로드
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void handleUploadFile(file)
              }}
            />
          </div>
        </div>,
        excelContainer,
      )}
      {resetContainer && createPortal(
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">초기화</h2>
          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">업종 목록과 종목 분류를 초기화</p>
          <div className="settings-control-inset flex items-center justify-center">
            <button
              type="button"
              onClick={() => void handleResetCustomClassification()}
              disabled={resetCustomClassificationMutation.isPending || isUploading || isExporting || !hasCustomClassification}
              className="flex h-[25px] w-full items-center justify-center gap-1 rounded-[4px] border-0 bg-[#BC2F2F] px-3 text-[13px] leading-[1.3] font-medium text-ui-white transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              aria-label="업종과 종목 분류 초기화"
            >
              초기화
            </button>
          </div>
        </div>,
        resetContainer,
      )}
      {bulkContainer && createPortal(
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">일괄 변경</h2>
          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">
            {selectedStockCodes.size > 0 ? `선택한 종목 ${selectedStockCodes.size}개의 분류를 한 번에 바꿉니다` : '표에서 종목을 먼저 선택해 주세요'}
          </p>
          <div className="grid max-w-full settings-control-inset grid-cols-3 gap-[6px]">
            <BulkAssignButton count={selectedStockCodes.size} options={bulkParentOptions} onAssign={handleBulkAssignParent} label="대분류" title="대분류 일괄 변경" orderMode={bulkOrderMode} />
            <BulkAssignButton
              count={selectedStockCodes.size}
              options={bulkMidOptions}
              onAssign={handleBulkAssignMid}
              label="중분류"
              title="중분류 일괄 변경"
              orderMode={bulkOrderMode}
              disabled={effectiveParentId == null}
              disabledHint={'선택한 종목의 대분류가 같아야 합니다.\n다르면 대분류를 먼저 일괄적용해 주세요'}
            />
            <BulkAssignButton
              count={selectedStockCodes.size}
              options={bulkSubOptions}
              onAssign={handleBulkAssignSub}
              label="소분류"
              title="소분류 일괄 변경"
              orderMode={bulkOrderMode}
              disabled={effectiveMidId == null}
              disabledHint={'선택한 종목의 중분류가 같아야 합니다.\n다르면 중분류를 먼저 일괄적용해 주세요'}
            />
          </div>
        </div>,
        bulkContainer,
      )}
      {/* 종목 목록을 처음 받는 중이거나 받지 못했으면 표 대신 본문 한가운데에 원을 보여 준다(마켓트리·거래소 표와 같다). 정렬 중의 원은 아래 표 안에 그대로 있다. */}
      {isLoading || isError ? (
        <div className="flex min-h-0 flex-1 items-center justify-center pt-4 pb-[47.5px]">
          {isLoading ? <Spinner showElapsed /> : <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={onRetry} />}
        </div>
      ) : (
      <div className="relative min-h-0 flex-1 border border-ui-border">
        {isSelectionHintOpen && <SelectionHintBubble onClose={() => setIsSelectionHintOpen(false)} />}
        <div ref={scrollContainerRef} className="relative h-full overflow-auto">
          {/* 표 글자는 드래그해도 파랗게 선택되지 않게 한다(줄 드래그 선택과 겹치기 때문). 입력창 안의 글자는 그대로 선택할 수 있다. */}
          <table style={{ minWidth: stockColumnWidthsTotal(columnWidths) }} className="nes-table is-dark custom-page-table w-full table-fixed select-none text-sm [&_input]:select-text [border-collapse:separate] [border-spacing:0] [&_td]:border-ui-border [&_td]:py-1 [&_th]:border-ui-white/20 [&_th]:border-b-0 [&_th]:py-1">
          <StockTableColGroup keys={columnKeys} widths={columnWidths} />
          <thead className="sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_var(--ui-border)]">
            <tr style={{ height: STOCK_HEADER_ROW_PX }}>
              <th
                className="cursor-pointer bg-[var(--ui-panel)] px-0 text-center font-bold text-ui-white"
                style={CHECKBOX_CELL_STYLE}
                onClick={e => {
                  // 체크박스 자신을 클릭한 경우는 onChange가 이미 처리하므로 여기서 중복 토글하지 않는다.
                  if ((e.target as HTMLElement).tagName === 'INPUT') return
                  toggleSelectAllVisible()
                }}
              >
                <input type="checkbox" className="mx-auto my-0 block thin-check" checked={isAllVisibleSelected} onChange={toggleSelectAllVisible} />
              </th>
              {columns.filter(col => columnWidths[col.columnKey] !== undefined).map(col => {
                const filterKey = FILTER_KEY_BY_COLUMN[col.key]
                const label = (
                  <StockSortHeader
                    label={col.header}
                    state={sortKey === col.key ? sortDirection : null}
                    onSort={() => handleSort(col.key)}
                    filter={
                      filterKey ? (
                        <ColumnFilterButton
                          label={col.header}
                          isProtected={filterKey === 'parentSector' ? isProtectedSectorName : undefined}
                          getOptions={() => columnFilters.optionValues(filterKey)}
                          excluded={columnFilters.excluded[filterKey] ?? NO_EXCLUDED}
                          onToggle={value => columnFilters.toggle(filterKey, value)}
                          onSelectAll={() => columnFilters.selectAll(filterKey)}
                          onSelectNone={values => columnFilters.selectNone(filterKey, values)}
                          selectOnlyOnSearch={filterKey === 'industry' || filterKey === 'parentSector' || filterKey === 'midSector' || filterKey === 'subSector'}
                          hintOf={filterKey === 'midSector' || filterKey === 'subSector' ? value => sectorParentHints[filterKey].get(value) : undefined}
                          optionOrder={filterKey === 'sizeTier' ? tierOrder : filterKey === 'market' ? ['코스피', '코스닥'] : filterKey === 'nxt' ? ['O', '-'] : filterKey === 'industry' ? industryFilterOrder : filterKey === 'parentSector' ? sectorFilterOrder[0] : filterKey === 'midSector' ? sectorFilterOrder[1] : filterKey === 'subSector' ? sectorFilterOrder[2] : undefined}
                          orderMode={filterKey === 'industry' || filterKey === 'parentSector' || filterKey === 'midSector' || filterKey === 'subSector' ? { value: sectorFilterMode, onChange: changeSectorFilterMode } : undefined}
                          labelOf={filterKey === 'nxt' ? value => (value === 'O' ? 'NXT 거래' : 'NXT 미거래') : undefined}
                        />
                      ) : undefined
                    }
                  />
                )
                return (
                  <th
                    key={col.key}
                    data-column-key={col.key}
                    colSpan={col.key === 'stockName' && nameColSpan === 2 ? 2 : undefined}
                    className="whitespace-nowrap bg-[var(--ui-panel)] text-center align-middle font-bold text-ui-white"
                    data-hint={col.key === 'alias' && isAdmin ? '약칭은 운영자만 관리할 수 있습니다.' : undefined}
                  >
                    {col.key === 'totalMarketValue' ? (
                      <>
                        <span
                          onMouseEnter={e => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setSnapshotTooltipPos({ left: rect.left + rect.width / 2, top: rect.top })
                          }}
                          onMouseLeave={() => setSnapshotTooltipPos(null)}
                        >
                          {label}
                        </span>
                        {snapshotTime &&
                          snapshotTooltipPos &&
                          createPortal(
                            <div
                              className={`fixed z-50 w-max -translate-x-1/2 -translate-y-full ${HINT_BUBBLE_CLASS}`}
                              style={{ left: snapshotTooltipPos.left, top: snapshotTooltipPos.top - 4 }}
                            >
                              {/* 툴바 시계와 같은 표기 — "2026-10-02 (금) 20:00". */}
                              {toSnapshotDateLabel(snapshotTime)} {toSnapshotTimeOnlyLabel(snapshotTime)}
                            </div>,
                            document.body,
                          )}
                      </>
                    ) : (
                      label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={tableColSpan} className="p-8">
                  {/* 정렬을 바꾸는 동안의 로딩 원 — 지도·그룹 페이지처럼 크게 가운데에 보여준다. */}
                  <div className="flex h-[min(32rem,60vh)] items-center justify-center">
                    <Spinner showElapsed />
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={tableColSpan} style={{ height: paddingTop, padding: 0, border: 'none' }} />
                  </tr>
                )}
                {virtualRows.map(virtualRow => {
                  const item = sorted[virtualRow.index]
                  return (
                    <AdminStockRow
                      key={item.stockCode}
                      showAlias={isAdmin && isAliasColumnVisible}
                      nameColSpan={nameColSpan}
                      showSizeTier={showSizeTier}
                      showIndustry={showIndustry}
                      showTotalMarketValue={showTotalMarketValue}
                      showStockCode={showStockCode}
                      showMarket={showMarket}
                      showNxt={showNxt}
                      isNxt={nxtStockCodes.has(item.stockCode)}
                      item={item}
                      index={virtualRow.index}
                      isSelected={selectedStockCodes.has(item.stockCode)}
                      onToggleSelected={toggleSelected}
                      onRowMouseDown={handleRowMouseDown}
                      hoveredKind={hoveredRow?.stockCode === item.stockCode ? hoveredRow.kind : null}
                      onParentSectorHoverStart={handleParentSectorHoverStart}
                      onMidSectorHoverStart={handleMidSectorHoverStart}
                      onSubSectorHoverStart={handleSubSectorHoverStart}
                      onAliasHoverStart={handleAliasHoverStart}
                      onHoverEnd={handleHoverEnd}
                      sectorOptions={sectorOptions}
                      sectorOptionsById={sectorOptionsById}
                      onAssign={handleAssign}
                      onUpdateAlias={handleUpdateAlias}
                      sectorOrderMode={sectorFilterMode}
                      onSectorOrderModeChange={changeSectorFilterMode}
                      sectorStats={sectorStats}
                    />
                  )
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={tableColSpan} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
          </table>
          {/* 보여줄 종목이 없으면 거래소·MARKETRY 표와 같은 안내 글을 가운데에 보여준다. */}
          {!isPending && sorted.length === 0 && <EmptyMessage message={items.length === 0 ? EMPTY_DATA_MESSAGE : EMPTY_SEARCH_MESSAGE} />}
        </div>
      </div>
      )}
    </div>
  )
}
