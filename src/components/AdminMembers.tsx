import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminMemberSummary, getAdminMembers, resetMembersNickname, setMembersSpecial } from '@/api/adminMembers'
import ColumnFilterButton from '@/components/ColumnFilterButton'
import AuthProviderIcon from '@/components/AuthProviderIcon'
import { SearchBar } from '@/components/ReadOnlyTaxonomySheet'
import StockSortHeader from '@/components/StockSortHeader'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import { appAlert, appConfirm } from '@/utils/appDialogBus'
import SelectionHintBubble from '@/components/SelectionHintBubble'
import { useRowRangeSelection } from '@/hooks/useRowRangeSelection'
import { useStockSearchWidth } from '@/utils/stockSearchWidth'
import { STOCK_CHECKBOX_COLUMN_PX, STOCK_HEADER_ROW_PX } from '@/utils/stockTableColumns'
import { displayEmail } from '@/utils/displayEmail'
import { isAuthProviderIssuer } from '@/utils/authProvider'

const PAGE_SIZE = 50
const controlClass = 'flex h-5 min-w-9 shrink-0 items-center justify-center whitespace-nowrap rounded-sm border border-brand bg-brand px-1.5 text-[11px] font-semibold leading-none text-ui-background outline-none transition-colors hover:brightness-110 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-75'
type SortKey = 'id' | 'issuer' | 'email' | 'nickname' | 'role' | 'createdAt' | 'lastAccessAt'
type SortOrder = 'asc' | 'desc'
// 로딩 원에서 숫자 세기가 끝나면 나오는 "다시 시도" 버튼(Spinner)과 같은 모양이다.
const retryButtonClass = 'rounded border-0 bg-[var(--brand-surface)] px-3 py-1 text-sm font-bold text-ui-white transition-colors hover:bg-[var(--brand-surface-hover)] disabled:opacity-40'
const columns: { label: string; key: SortKey }[] = [
  { label: '아이디', key: 'id' },
  { label: '연동', key: 'issuer' },
  { label: '이메일', key: 'email' },
  { label: '닉네임', key: 'nickname' },
  { label: '권한', key: 'role' },
  { label: '회원 가입', key: 'createdAt' },
  { label: '최근 접속', key: 'lastAccessAt' },
]
// 정렬을 풀면 최근 가입순으로 돌아간다.
const DEFAULT_SORT: { key: SortKey; order: SortOrder } = { key: 'createdAt', order: 'desc' }

// 권한 필터 — 종목 표 머리글 필터와 같은 방식이다. 체크를 푼 구분은 빼고 보며, 서버에는 남은 구분을 쉼표로 이어 넘긴다(셋 모두면 비운다).
// 구분은 관리자 → 특별 회원 → 일반 회원이다. 특별 회원은 권한이 아니라 일반 권한 회원에게 붙는 표시다.
const GRADE_VALUES = ['USER', 'SPECIAL', 'ADMIN'] as const
type MemberGrade = (typeof GRADE_VALUES)[number]
const gradeLabelOf = (value: string) => (value === 'ADMIN' ? '관리자' : value === 'SPECIAL' ? '특별 회원' : '일반 회원')
const GRADE_COLOR_CLASS: Record<MemberGrade, string> = { ADMIN: 'text-admin-only', SPECIAL: 'text-[var(--sub-purple)]', USER: 'text-ui-text' }
const gradeOf = (member: { role: string; special: boolean }): MemberGrade => (member.role === 'ADMIN' ? 'ADMIN' : member.special ? 'SPECIAL' : 'USER')
// 로그인 연동 — OAuth 제공자별 표시. 그 밖(시스템·로컬 테스트 회원)은 줄표로 둔다.
const CHECKBOX_COLUMN_WIDTH = `${STOCK_CHECKBOX_COLUMN_PX}px`
// 종목 표 체크박스 칸과 같은 폭·여백이다.
const CHECKBOX_CELL_STYLE = { width: CHECKBOX_COLUMN_WIDTH, minWidth: CHECKBOX_COLUMN_WIDTH, maxWidth: CHECKBOX_COLUMN_WIDTH, paddingLeft: 0, paddingRight: 0 } as const
// 입력을 멈추고 이 시간이 지나면 검색한다(검색 버튼 없이 바로 찾는다).
const SEARCH_DELAY_MS = 300
function formatTime(value: string | null) {
  if (!value) return '기록 없음'
  // 서버의 LocalDateTime은 한국 시각이다. 브라우저 시간대로 재해석하지 않는다.
  return value.replace('T', ' ').slice(0, 19)
}

export default function AdminMembers({ userId, summaryContainer, specialContainer, nicknameContainer, paginationContainer }: { userId: number; summaryContainer: HTMLElement | null; specialContainer: HTMLElement | null; nicknameContainer: HTMLElement | null; paginationContainer: HTMLElement | null }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [excludedRoles, setExcludedRoles] = useState<ReadonlySet<string>>(new Set())
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder } | null>(null)
  const appliedSort = sort ?? DEFAULT_SORT
  const stockSearchWidthPx = useStockSearchWidth()
  const includedRoles = GRADE_VALUES.filter(value => !excludedRoles.has(value))
  const role = includedRoles.length === GRADE_VALUES.length ? '' : includedRoles.join(',')
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
  // 표에 줄이 없을 때 표 영역 한가운데에 보여 주는 안내(오류는 따로 그린다).
  const centerMessage = noRoleSelected ? '조건에 맞는 회원이 없습니다.'
    : members.isPending ? '회원 정보를 불러오는 중입니다.'
    : members.data?.items.length === 0 ? (query || excludedRoles.size > 0 ? '조건에 맞는 회원이 없습니다.' : '등록된 회원이 없습니다.')
    : null
  const summary = useQuery({
    queryKey: ['admin-member-summary', userId],
    queryFn: ({ signal }) => getAdminMemberSummary(signal),
    staleTime: 30_000,
    retry: false,
  })
  const [isChangingSpecial, setIsChangingSpecial] = useState(false)
  const [isResettingNickname, setIsResettingNickname] = useState(false)
  // 체크한 회원 — 검색·정렬·필터·페이지를 바꾸면 비운다(보이는 목록 기준이다).
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set())
  const clearSelection = () => setSelectedIds(new Set())
  const total = noRoleSelected ? 0 : members.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // 같은 열을 계속 누르면 오름차순 → 내림차순 → 정렬 해제 순으로 돈다(종목 표와 같다).
  const handleSort = (key: SortKey) => {
    setSort(current => current?.key !== key ? { key, order: 'asc' } : current.order === 'asc' ? { key, order: 'desc' } : null)
    setPage(0)
    clearSelection()
  }
  // 체크한 회원을 특별 회원으로 지정하거나 해제한다 — 일반 권한 회원만 가능하다(서버도 같은 규칙으로 막는다).
  const handleChangeSpecial = async (special: boolean) => {
    const selected = (members.data?.items ?? []).filter(member => selectedIds.has(member.id))
    if (selected.length === 0) return
    if (selected.some(member => member.role === 'ADMIN')) {
      appAlert('관리자는 특별 회원으로 바꿀 수 없습니다.\n관리자를 빼고 다시 체크해 주세요.', { title: '지정 불가' })
      return
    }
    const confirmed = await appConfirm(`체크한 ${selected.length}명을 ${special ? '특별 회원으로 지정' : '일반 회원으로 해제'}하시겠습니까?`, { adminOnly: true, title: special ? '특별 회원 지정' : '특별 회원 해제' })
    if (!confirmed) return
    setIsChangingSpecial(true)
    try {
      await setMembersSpecial(selected.map(member => member.id), special)
      clearSelection()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-members'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-member-summary'] }),
      ])
    } catch {
      appAlert('특별 회원을 바꾸지 못했습니다.\n잠시 후 다시 시도해 주세요.', { title: '변경 실패' })
    } finally {
      setIsChangingSpecial(false)
    }
  }
  // 체크한 회원의 닉네임을 지운다 — 부적절한 닉네임을 정리할 때 쓴다. 지워진 회원은 바로 새 닉네임을 등록할 수 있다.
  const handleResetNickname = async () => {
    const selected = (members.data?.items ?? []).filter(member => selectedIds.has(member.id))
    if (selected.length === 0) return
    if (selected.some(member => member.role === 'ADMIN')) {
      appAlert('관리자의 닉네임은 지울 수 없습니다.\n관리자를 빼고 다시 체크해 주세요.', { title: '초기화 불가' })
      return
    }
    const confirmed = await appConfirm(`체크한 ${selected.length}명의 닉네임을 지우시겠습니까?\n지워진 회원은 바로 새 닉네임을 등록할 수 있습니다.`, { adminOnly: true, title: '닉네임 지우기' })
    if (!confirmed) return
    setIsResettingNickname(true)
    try {
      await resetMembersNickname(selected.map(member => member.id))
      clearSelection()
      await queryClient.invalidateQueries({ queryKey: ['admin-members'] })
    } catch {
      appAlert('닉네임을 지우지 못했습니다.\n잠시 후 다시 시도해 주세요.', { title: '변경 실패' })
    } finally {
      setIsResettingNickname(false)
    }
  }
  const visibleIds = members.data?.items.map(member => member.id) ?? []
  const isAllSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id))
  const toggleSelectAll = () => setSelectedIds(isAllSelected ? new Set() : new Set(visibleIds))
  // 줄 선택 — 커스텀 종목 표와 같다(체크박스가 아닌 곳을 눌러도 선택, Shift+클릭 범위, 끌어서 연속 선택).
  // 줄 선택 훅은 글자 키를 쓰므로 회원 번호를 글자로 바꿔 넘긴다.
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const rowKeys = visibleIds.map(String)
  const selectedKeys = useMemo(() => new Set([...selectedIds].map(String)) as ReadonlySet<string>, [selectedIds])
  const setSelectedKeys: Dispatch<SetStateAction<ReadonlySet<string>>> = update =>
    setSelectedIds(current => {
      const next = typeof update === 'function' ? update(new Set([...current].map(String))) : update
      return new Set([...next].map(Number))
    })
  const { rowProps, selectionHint } = useRowRangeSelection(rowKeys, scrollContainerRef, selectedKeys, setSelectedKeys)
  const searchTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(searchTimer.current), [])
  const changeSearch = (value: string) => {
    setDraft(value)
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => {
      setQuery(value.trim())
      setPage(0)
      clearSelection()
    }, SEARCH_DELAY_MS)
  }
  const changeExcludedRoles = (next: ReadonlySet<string>) => {
    setExcludedRoles(next)
    setPage(0)
    clearSelection()
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
      </Toolbar>
      <div className="flex min-h-0 flex-1 flex-col border border-ui-border">
      <div ref={scrollContainerRef} className="relative min-h-0 flex-1 overflow-auto" aria-busy={members.isFetching}>
        {selectionHint.isOpen && <SelectionHintBubble onClose={selectionHint.close} />}
        <table className="nes-table is-dark custom-page-table w-full min-w-[1150px] table-fixed text-sm [border-collapse:separate] [border-spacing:0] [&_td]:border-ui-border [&_td]:py-1 [&_th]:border-ui-white/20 [&_th]:border-b-0 [&_th]:py-1">
          <colgroup><col style={{ width: CHECKBOX_COLUMN_WIDTH }} /><col style={{ width: 75 }} /><col style={{ width: 64 }} /><col style={{ width: 300 }} /><col style={{ width: 140 }} /><col style={{ width: 90 }} /><col style={{ width: 180 }} /><col style={{ width: 180 }} /><col style={{ width: 90 }} /></colgroup>
          <thead className="sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_var(--ui-border)]">
            <tr style={{ height: STOCK_HEADER_ROW_PX }}>
              <th
                className="cursor-pointer bg-[var(--ui-panel)] px-0 text-center font-bold text-ui-white"
                style={CHECKBOX_CELL_STYLE}
                onClick={event => {
                  // 체크박스 자신을 클릭한 경우는 onChange가 이미 처리하므로 여기서 중복 토글하지 않는다.
                  if ((event.target as HTMLElement).tagName === 'INPUT') return
                  toggleSelectAll()
                }}
              >
                <input type="checkbox" aria-label="이 페이지 회원 전체 선택" className="mx-auto my-0 block thin-check" checked={isAllSelected} onChange={toggleSelectAll} />
              </th>
              {columns.map(({ label, key }) => (
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
                      getOptions={() => GRADE_VALUES}
                      optionOrder={GRADE_VALUES}
                      labelOf={gradeLabelOf}
                      excluded={excludedRoles}
                      onToggle={value => changeExcludedRoles(new Set(excludedRoles.has(value) ? [...excludedRoles].filter(item => item !== value) : [...excludedRoles, value]))}
                      onSelectAll={() => changeExcludedRoles(new Set())}
                      onSelectNone={values => changeExcludedRoles(new Set(values))}
                    />
                  ) : undefined}
                />
              </th>
            ))}
              {/* 정렬하지 않는 열 — 일별 접속 기록에서 세므로 서버 정렬 기준이 없다. */}
              <th scope="col" className="bg-[var(--ui-panel)] px-2 text-center font-bold text-ui-white">30일 접속</th>
            </tr>
          </thead>
          <tbody className="select-text">
            {members.isError || noRoleSelected || members.isPending || members.data.items.length === 0 ? null : members.data.items.map((member, index) => {
              return <tr key={member.id} {...rowProps(index)} className={`cursor-pointer ${selectedIds.has(member.id) ? 'bg-[var(--brand)]/15' : 'hover:bg-[var(--brand)]/10'}`}>
                <td className="text-center" style={CHECKBOX_CELL_STYLE}>
                  <input type="checkbox" aria-label={`${displayEmail(member.email) ?? member.id} 선택`} className="mx-auto my-0 block thin-check" checked={selectedIds.has(member.id)} onChange={() => {}} />
                </td>
                <td className="px-2 text-right tabular-nums text-ui-muted">{member.id}</td>
                <td className="px-2 text-center text-ui-muted">
                  {isAuthProviderIssuer(member.issuer) ? <AuthProviderIcon issuer={member.issuer} className="mx-auto" /> : '-'}
                </td>
                <td className="break-normal whitespace-nowrap px-2 text-left">{displayEmail(member.email) || <span className="text-ui-muted">미등록</span>}</td>
                <td className="break-normal px-2 text-left">{member.nickname || <span className="text-ui-muted">미설정</span>}</td>
                <td className={`px-2 text-center ${GRADE_COLOR_CLASS[gradeOf(member)]}`}>{gradeLabelOf(gradeOf(member))}</td>
                <td className="px-2 text-center tabular-nums text-ui-text">{formatTime(member.createdAt)}</td>
                <td className="px-2 text-center tabular-nums text-ui-text">{members.data.accessTrackingAvailable ? formatTime(member.lastAccessAt) : '수집 전'}</td>
                <td className="px-2 text-right tabular-nums text-ui-text">{member.accessDays ?? 0}일</td>
              </tr>
            })}
          </tbody>
        </table>
        {!members.isError && centerMessage && (
          <div role="status" className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center px-6 text-center text-base text-ui-text" style={{ top: STOCK_HEADER_ROW_PX }}>{centerMessage}</div>
        )}
        {members.isError && (
          <div role="alert" className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-3 text-base text-ui-text" style={{ top: STOCK_HEADER_ROW_PX }}>
            <p className="m-0">회원 정보를 불러오지 못했습니다.</p>
            <button type="button" className={retryButtonClass} disabled={members.isFetching} onClick={() => { void members.refetch() }}>다시 시도</button>
          </div>
        )}
      </div>
      {paginationContainer && createPortal(
        <div className="flex h-7 items-end gap-1.5 pb-[4px] text-[11px] leading-none text-ui-muted">
          <button type="button" className={controlClass} disabled={page === 0 || members.isFetching} onClick={() => { setPage(value => value - 1); clearSelection() }}>이전</button>
          <span aria-live="polite" className="inline-flex h-5 items-center text-sm font-medium leading-none tabular-nums text-ui-white">{page + 1} / {pages}</span>
          <button type="button" className={controlClass} disabled={!members.data || members.isError || page + 1 >= pages || members.isFetching} onClick={() => { setPage(value => value + 1); clearSelection() }}>다음</button>
        </div>,
        paginationContainer,
      )}
      </div>
      {summaryContainer && createPortal(
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">회원 현황</h2>
          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">전체 · 특별 회원 · 최근 7일 신규 가입·접속</p>
          <div className="settings-button-area mt-4 grid max-w-full settings-control-inset grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] tabular-nums">
            {([['전체', summary.data?.total], ['특별 회원', summary.data?.specials], ['7일 신규', summary.data?.joinedRecently], ['7일 접속', summary.data?.accessedRecently]] as const).map(([label, value]) => (
              <span key={label} className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                <span className="text-ui-white">{label}</span>
                <span className="font-medium text-ui-text">{value === undefined ? '-' : `${value.toLocaleString()}명`}</span>
              </span>
            ))}
          </div>
        </div>,
        summaryContainer,
      )}
      {specialContainer && createPortal(
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">특별 회원 지정</h2>
          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">체크한 회원을 특별 회원으로 지정·해제</p>
          <div className="mt-4 grid max-w-full translate-y-[6px] settings-control-inset grid-cols-2 gap-[6px]">
            {([['지정', true], ['해제', false]] as const).map(([label, special]) => (
              <button
                key={label}
                type="button"
                onClick={() => void handleChangeSpecial(special)}
                disabled={selectedIds.size === 0 || isChangingSpecial}
                className="flex h-[25px] items-center justify-center settings-chip-hover rounded-[4px] border-0 bg-[var(--ui-control)] text-[13px] leading-[1.3] font-medium text-ui-white disabled:cursor-not-allowed disabled:opacity-35"
                data-hint={selectedIds.size === 0 ? '표에서 회원을 먼저 체크하세요.' : `체크한 ${selectedIds.size}명을 ${special ? '특별 회원으로 지정' : '일반 회원으로 해제'}합니다.`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>,
        specialContainer,
      )}
      {nicknameContainer && createPortal(
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">닉네임 지우기</h2>
          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">체크한 회원의 닉네임을 지웁니다</p>
          <div className="mt-4 grid max-w-full translate-y-[6px] settings-control-inset grid-cols-1 gap-[6px]">
            <button
              type="button"
              onClick={() => void handleResetNickname()}
              disabled={selectedIds.size === 0 || isResettingNickname}
              className="flex h-[25px] items-center justify-center settings-chip-hover rounded-[4px] border-0 bg-[var(--ui-control)] text-[13px] leading-[1.3] font-medium text-ui-white disabled:cursor-not-allowed disabled:opacity-35"
              data-hint={selectedIds.size === 0 ? '표에서 회원을 먼저 체크하세요.' : `체크한 ${selectedIds.size}명의 닉네임을 지웁니다.`}
            >
              지우기
            </button>
          </div>
        </div>,
        nicknameContainer,
      )}
    </section>
  )
}
