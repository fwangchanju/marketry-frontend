import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getAdminMemberSummary, getAdminMembers } from '@/api/adminMembers'
import ColumnFilterButton from '@/components/ColumnFilterButton'
import { DownloadIcon } from '@/components/icons/AppIcons'
import { SearchBar } from '@/components/ReadOnlyTaxonomySheet'
import StockSortHeader from '@/components/StockSortHeader'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import { appAlert } from '@/utils/appDialogBus'
import { exportRowsToExcel } from '@/utils/exportExcel'
import { fileTimestamp } from '@/utils/fileTimestamp'
import { useStockSearchWidth } from '@/utils/stockSearchWidth'
import { STOCK_HEADER_ROW_PX } from '@/utils/stockTableColumns'

const PAGE_SIZE = 50
const controlClass = 'h-6 shrink-0 border-0 bg-[var(--ui-panel)] px-2 text-sm font-normal text-ui-white outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--brand)] disabled:opacity-40'
type SortKey = 'id' | 'email' | 'nickname' | 'role' | 'createdAt' | 'lastAccessAt'
type SortOrder = 'asc' | 'desc'
// 로딩 원에서 숫자 세기가 끝나면 나오는 "다시 시도" 버튼(Spinner)과 같은 모양이다.
const retryButtonClass = 'rounded border-0 bg-[var(--brand-surface)] px-3 py-1 text-sm font-bold text-ui-white transition-colors hover:bg-[var(--brand-surface-hover)] disabled:opacity-40'
const columns: { label: string; key: SortKey }[] = [
  { label: '회원 ID', key: 'id' },
  { label: '이메일', key: 'email' },
  { label: '닉네임', key: 'nickname' },
  { label: '권한', key: 'role' },
  { label: '회원가입 시각', key: 'createdAt' },
  { label: '최근 접속 시각', key: 'lastAccessAt' },
]
// 정렬을 풀면 최근 가입순으로 돌아간다.
const DEFAULT_SORT: { key: SortKey; order: SortOrder } = { key: 'createdAt', order: 'desc' }

// 권한 필터 — 종목 표 머리글 필터와 같은 방식이다. 체크를 푼 권한은 빼고 보며, 서버에는 하나만 남았을 때만 권한을 넘긴다.
const ROLE_VALUES = ['USER', 'ADMIN'] as const
const roleLabelOf = (value: string) => (value === 'ADMIN' ? '관리자' : '일반 회원')
// 입력을 멈추고 이 시간이 지나면 검색한다(검색 버튼 없이 바로 찾는다).
const SEARCH_DELAY_MS = 300
// 내보내기에서 이어 받는 최대 페이지 수 — 회원 수가 이만큼 늘면 서버에서 한 번에 내려 주는 방식으로 바꾼다.
const MAX_EXPORT_PAGES = 200

function formatTime(value: string | null) {
  if (!value) return '기록 없음'
  // 서버의 LocalDateTime은 한국 시각이다. 브라우저 시간대로 재해석하지 않는다.
  return value.replace('T', ' ').slice(0, 19)
}

export default function AdminMembers({ userId, summaryContainer, exportContainer }: { userId: number; summaryContainer: HTMLElement | null; exportContainer: HTMLElement | null }) {
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [excludedRoles, setExcludedRoles] = useState<ReadonlySet<string>>(new Set())
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder } | null>(null)
  const appliedSort = sort ?? DEFAULT_SORT
  const sortLabel = sort === null ? '최근 가입순' : `${columns.find(column => column.key === sort.key)?.label} ${sort.order === 'asc' ? '오름차순' : '내림차순'}`
  const stockSearchWidthPx = useStockSearchWidth()
  const includedRoles = ROLE_VALUES.filter(value => !excludedRoles.has(value))
  const role = includedRoles.length === 1 ? includedRoles[0] : ''
  // 모든 권한을 뺐으면 보여 줄 회원이 없다 — 서버에 묻지 않는다.
  const noRoleSelected = includedRoles.length === 0
  const members = useQuery({
    queryKey: ['admin-members', userId, query, role, appliedSort.key, appliedSort.order, page],
    queryFn: ({ signal }) => getAdminMembers({ query, role, sort: appliedSort.key, order: appliedSort.order, page }, signal),
    enabled: !noRoleSelected,
    // 검색·정렬·필터를 바꿀 때 표가 비었다 다시 차지 않고 이전 목록을 둔 채 바뀐다.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  })
  const summary = useQuery({
    queryKey: ['admin-member-summary', userId],
    queryFn: ({ signal }) => getAdminMemberSummary(signal),
    staleTime: 30_000,
    retry: false,
  })
  const [isExporting, setIsExporting] = useState(false)
  const total = noRoleSelected ? 0 : members.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // 같은 열을 계속 누르면 오름차순 → 내림차순 → 정렬 해제 순으로 돈다(종목 표와 같다).
  const handleSort = (key: SortKey) => {
    setSort(current => current?.key !== key ? { key, order: 'asc' } : current.order === 'asc' ? { key, order: 'desc' } : null)
    setPage(0)
  }
  // 지금 검색·필터·정렬이 걸린 목록 전체를 엑셀로 받는다(페이지마다 50명씩 이어서 받아 합친다).
  const handleExport = async () => {
    if (total === 0) {
      appAlert('다운로드할 회원이 없습니다.\n검색어와 필터를 확인해 주세요.', { title: '다운로드 불가' })
      return
    }
    setIsExporting(true)
    try {
      const items = []
      for (let nextPage = 0; items.length < total && nextPage < MAX_EXPORT_PAGES; nextPage += 1) {
        const result = await getAdminMembers({ query, role, sort: appliedSort.key, order: appliedSort.order, page: nextPage })
        if (result.items.length === 0) break
        items.push(...result.items)
      }
      await exportRowsToExcel(`MEMBERS-${fileTimestamp()}.xlsx`, '회원', items.map(member => ({
        '회원 ID': member.id,
        이메일: member.email ?? '',
        닉네임: member.nickname ?? '',
        권한: roleLabelOf(member.role),
        '회원가입 시각': formatTime(member.createdAt),
        '최근 접속 시각': members.data?.accessTrackingAvailable ? formatTime(member.lastAccessAt) : '수집 전',
      })), {
        alignByHeader: { '회원 ID': 'right', 권한: 'center', '회원가입 시각': 'center', '최근 접속 시각': 'center' },
        fixedWidths: { '회원 ID': 10, 이메일: 40, 닉네임: 20, 권한: 12, '회원가입 시각': 22, '최근 접속 시각': 22 },
      })
    } catch {
      appAlert('엑셀 파일을 만들지 못했습니다.\n다시 시도해 주세요.', { title: '다운로드 실패' })
    } finally {
      setIsExporting(false)
    }
  }
  const searchTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(searchTimer.current), [])
  const changeSearch = (value: string) => {
    setDraft(value)
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => {
      setQuery(value.trim())
      setPage(0)
    }, SEARCH_DELAY_MS)
  }
  const changeExcludedRoles = (next: ReadonlySet<string>) => {
    setExcludedRoles(next)
    setPage(0)
  }

  return (
    <section aria-label="회원 정보" className="flex h-full min-h-0 w-full flex-col text-sm">
      <Toolbar>
        <ToolbarModeText page="ADMIN" label="MEMBER" />
        <div className="ml-1 flex min-w-0 flex-1 items-center">
          <SearchBar
            inline
            inputRightEdgePx={stockSearchWidthPx}
            query={draft}
            onChange={changeSearch}
            placeholder="이메일 · 닉네임"
            ariaLabel="회원 검색"
            afterInput={excludedRoles.size > 0 ? (
              <button
                type="button"
                onClick={() => changeExcludedRoles(new Set())}
                className="toolbar-badge flex h-6 items-center whitespace-nowrap rounded border border-ui-border bg-transparent px-2 text-sm font-normal text-ui-text transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                필터 초기화
              </button>
            ) : null}
          />
        </div>
        <button type="button" className={`toolbar-badge ml-2 ${controlClass}`} disabled={members.isFetching} onClick={() => { void members.refetch() }}>{members.isFetching ? '조회 중…' : '새로고침'}</button>
      </Toolbar>
      <div className="relative min-h-0 flex-1 overflow-auto border border-ui-border" aria-busy={members.isFetching}>
        <table className="nes-table is-dark custom-page-table w-full min-w-[900px] table-fixed text-sm [border-collapse:separate] [border-spacing:0] [&_td]:border-ui-border [&_td]:border-r-0 [&_td]:py-1 [&_th]:border-ui-white/20 [&_th]:border-b-0 [&_th:not(:last-child)]:border-r [&_th]:py-1">
          <colgroup><col style={{ width: 75 }} /><col /><col style={{ width: 140 }} /><col style={{ width: 90 }} /><col style={{ width: 180 }} /><col style={{ width: 180 }} /></colgroup>
          <thead className="sticky top-0 z-10">
            <tr style={{ height: STOCK_HEADER_ROW_PX }}>{columns.map(({ label, key }) => (
              <th
                key={label}
                scope="col"
                aria-sort={sort?.key === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}
                className="cursor-pointer bg-[var(--ui-panel)] px-2 text-center font-bold text-ui-white"
                onClick={() => handleSort(key)}
                tabIndex={0}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleSort(key) } }}
              >
                <StockSortHeader
                  label={label}
                  state={sort?.key === key ? sort.order : null}
                  filter={key === 'role' ? (
                    <ColumnFilterButton
                      label={label}
                      getOptions={() => ROLE_VALUES}
                      optionOrder={ROLE_VALUES}
                      labelOf={roleLabelOf}
                      excluded={excludedRoles}
                      onToggle={value => changeExcludedRoles(new Set(excludedRoles.has(value) ? [...excludedRoles].filter(item => item !== value) : [...excludedRoles, value]))}
                      onSelectAll={() => changeExcludedRoles(new Set())}
                      onSelectNone={values => changeExcludedRoles(new Set(values))}
                    />
                  ) : undefined}
                />
              </th>
            ))}</tr>
          </thead>
          <tbody className="select-text">
            {members.isError ? null : noRoleSelected ? (
              <tr><td colSpan={6} className="text-center"><div className="flex min-h-40 items-center justify-center text-ui-muted">조건에 맞는 회원이 없습니다.</div></td></tr>
            ) : members.isPending ? (
              <tr><td colSpan={6} className="text-center"><div role="status" className="flex min-h-40 items-center justify-center text-ui-muted">회원 정보를 불러오는 중입니다.</div></td></tr>
            ) : members.data.items.length === 0 ? (
              <tr><td colSpan={6} className="text-center"><div className="flex min-h-40 items-center justify-center text-ui-muted">{query || excludedRoles.size > 0 ? '조건에 맞는 회원이 없습니다.' : '등록된 회원이 없습니다.'}</div></td></tr>
            ) : members.data.items.map(member => (
              <tr key={member.id} className="hover:bg-[var(--brand)]/10">
                <td className="px-2 text-right tabular-nums text-ui-muted">{member.id}</td>
                <td className="break-all px-2 text-left">{member.email || <span className="text-ui-muted">미등록</span>}</td>
                <td className="break-all px-2 text-left">{member.nickname || <span className="text-ui-muted">미설정</span>}</td>
                <td className={`px-2 text-center ${member.role === 'ADMIN' ? 'text-[var(--brand)]' : 'text-ui-text'}`}>{member.role === 'ADMIN' ? '관리자' : '일반 회원'}</td>
                <td className="px-2 text-center tabular-nums text-ui-text">{formatTime(member.createdAt)}</td>
                <td className="px-2 text-center tabular-nums text-ui-text">{members.data.accessTrackingAvailable ? formatTime(member.lastAccessAt) : '수집 전'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.isError && (
          <div role="alert" className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-3 text-xl text-ui-text" style={{ top: STOCK_HEADER_ROW_PX }}>
            <p className="m-0">회원 정보를 불러오지 못했습니다.</p>
            <button type="button" className={retryButtonClass} disabled={members.isFetching} onClick={() => { void members.refetch() }}>다시 시도</button>
          </div>
        )}
      </div>
      <div className="flex h-7 shrink-0 items-center justify-between gap-2 text-xs text-ui-muted">
        <span>{members.data || noRoleSelected ? `${query || excludedRoles.size > 0 ? '검색 결과' : '전체'} ${total.toLocaleString()}명 · ` : ''}{sortLabel} · 한국 시각(KST)</span>
        <div className="flex items-center gap-2">
          <button type="button" className={controlClass} disabled={page === 0 || members.isFetching} onClick={() => setPage(value => value - 1)}>이전</button>
          <span aria-live="polite">{page + 1} / {pages}</span>
          <button type="button" className={controlClass} disabled={!members.data || members.isError || page + 1 >= pages || members.isFetching} onClick={() => setPage(value => value + 1)}>다음</button>
        </div>
      </div>
      <p className="m-0 pb-1 text-xs text-ui-muted">{members.data?.accessTrackingAvailable ? '최근 접속은 세션 확인·갱신 기준입니다. 과거 기록은 소급되지 않습니다.' : '최근 접속 기록 수집은 준비 중입니다.'}</p>
      {summaryContainer && createPortal(
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">회원 현황</h2>
          <p className="settings-description m-0 mt-1 max-w-[16rem] text-xs font-medium text-ui-muted">전체 · 권한별 · 최근 7일 신규 가입</p>
          <div className="settings-button-area mt-4 grid max-w-[16rem] settings-control-inset grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] tabular-nums">
            {([['전체', summary.data?.total], ['관리자', summary.data?.admins], ['일반 회원', summary.data?.users], ['7일 신규', summary.data?.joinedRecently]] as const).map(([label, value]) => (
              <span key={label} className="flex items-baseline justify-between gap-2 whitespace-nowrap text-ui-text">
                <span className="text-ui-muted">{label}</span>
                <span className="font-medium text-ui-white">{value === undefined ? '-' : `${value.toLocaleString()}명`}</span>
              </span>
            ))}
          </div>
        </div>,
        summaryContainer,
      )}
      {exportContainer && createPortal(
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">목록 내보내기</h2>
          <p className="settings-description m-0 mt-1 max-w-[16rem] text-xs font-medium text-ui-muted">검색·필터가 적용된 목록을 엑셀로</p>
          <div className="mt-4 grid max-w-[16rem] settings-control-inset grid-cols-1 gap-[6px]">
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={isExporting}
              className="flex h-7 items-center justify-center gap-1 settings-chip-hover rounded-[4px] border-0 bg-[var(--ui-control)] text-[13px] font-medium text-ui-white disabled:cursor-not-allowed disabled:opacity-35"
              data-hint={'엑셀 다운로드\n필터가 적용된 목록'}
              aria-label="엑셀 다운로드"
            >
              <DownloadIcon className="h-4 w-4 text-ui-text" />
              {isExporting ? '생성 중…' : '다운로드'}
            </button>
          </div>
        </div>,
        exportContainer,
      )}
    </section>
  )
}
