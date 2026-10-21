import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdminMembers } from '@/api/adminMembers'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import { STOCK_HEADER_ROW_PX } from '@/utils/stockTableColumns'

const PAGE_SIZE = 50
const controlClass = 'h-6 shrink-0 border-0 bg-[var(--ui-panel)] px-2 text-sm font-normal text-ui-white outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--brand)] disabled:opacity-40'
const columns = ['회원 ID', '이메일', '닉네임', '권한', '회원가입 시각', '최근 접속 시각']

function formatTime(value: string | null) {
  if (!value) return '기록 없음'
  // 서버의 LocalDateTime은 한국 시각이다. 브라우저 시간대로 재해석하지 않는다.
  return value.replace('T', ' ').slice(0, 19)
}

export default function AdminMembers({ userId }: { userId: number }) {
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(0)
  const members = useQuery({
    queryKey: ['admin-members', userId, query, role, page],
    queryFn: ({ signal }) => getAdminMembers({ query, role, sort: 'createdAt', page }, signal),
    staleTime: 30_000,
    retry: false,
  })
  const total = members.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const search = (event: FormEvent) => {
    event.preventDefault()
    setQuery(draft.trim())
    setPage(0)
  }

  return (
    <section aria-label="회원 정보" className="flex h-full min-h-0 w-full flex-col text-sm">
      <Toolbar>
        <ToolbarModeText page="ADMIN" label="MEMBER" />
        <form onSubmit={search} className="ml-1 flex min-w-0 flex-1 items-center gap-1">
          <input aria-label="이메일 또는 닉네임 검색" placeholder="이메일 · 닉네임 검색" maxLength={100} value={draft} onChange={event => setDraft(event.target.value)} className="nes-input is-dark toolbar-badge h-6 min-w-20 w-[15.5rem] !rounded-none !border-0 !bg-[var(--ui-panel)] text-sm font-normal text-ui-white outline-none placeholder:text-ui-muted focus:placeholder:text-transparent focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]" style={{ paddingLeft: 'calc(0.5rem - 1px)' }} />
          <button type="submit" className={`toolbar-badge ${controlClass}`}>검색</button>
          <select aria-label="회원 권한" value={role} onChange={event => { setRole(event.target.value); setPage(0) }} className={`toolbar-badge ${controlClass}`}>
            <option value="">전체 권한</option><option value="USER">일반 회원</option><option value="ADMIN">관리자</option>
          </select>
        </form>
        <button type="button" className={`toolbar-badge ml-2 ${controlClass}`} disabled={members.isFetching} onClick={() => { void members.refetch() }}>{members.isFetching ? '조회 중…' : '새로고침'}</button>
      </Toolbar>
      <div className="relative min-h-0 flex-1 overflow-auto border border-ui-border" aria-busy={members.isFetching}>
        <table className="nes-table is-dark custom-page-table w-full min-w-[900px] table-fixed text-sm [border-collapse:separate] [border-spacing:0] [&_td]:border-ui-border [&_td]:border-r-0 [&_td]:py-1 [&_th]:border-ui-white/20 [&_th]:border-b-0 [&_th]:border-r [&_th]:py-1">
          <colgroup><col style={{ width: 75 }} /><col /><col style={{ width: 140 }} /><col style={{ width: 90 }} /><col style={{ width: 180 }} /><col style={{ width: 180 }} /></colgroup>
          <thead className="sticky top-0 z-10">
            <tr style={{ height: STOCK_HEADER_ROW_PX }}>{columns.map(label => <th key={label} scope="col" className="bg-[var(--ui-panel)] px-2 text-center font-bold text-ui-white">{label}</th>)}</tr>
          </thead>
          <tbody className="select-text">
            {members.isError ? (
              <tr><td colSpan={6} className="text-center"><div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-3 text-ui-muted">
                <p className="m-0">회원 정보를 불러오지 못했습니다.</p>
                <button type="button" className={controlClass} disabled={members.isFetching} onClick={() => { void members.refetch() }}>다시 시도</button>
              </div></td></tr>
            ) : members.isPending ? (
              <tr><td colSpan={6} className="text-center"><div role="status" className="flex min-h-40 items-center justify-center text-ui-muted">회원 정보를 불러오는 중입니다.</div></td></tr>
            ) : members.data.items.length === 0 ? (
              <tr><td colSpan={6} className="text-center"><div className="flex min-h-40 items-center justify-center text-ui-muted">{query || role ? '조건에 맞는 회원이 없습니다.' : '등록된 회원이 없습니다.'}</div></td></tr>
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
      </div>
      <div className="flex h-7 shrink-0 items-center justify-between gap-2 text-xs text-ui-muted">
        <span>{members.data ? `${query || role ? '검색 결과' : '전체'} ${total.toLocaleString()}명 · ` : ''}최근 가입순 · 한국 시각(KST)</span>
        <div className="flex items-center gap-2">
          <button type="button" className={controlClass} disabled={page === 0 || members.isFetching} onClick={() => setPage(value => value - 1)}>이전</button>
          <span aria-live="polite">{page + 1} / {pages}</span>
          <button type="button" className={controlClass} disabled={!members.data || members.isError || page + 1 >= pages || members.isFetching} onClick={() => setPage(value => value + 1)}>다음</button>
        </div>
      </div>
      <p className="m-0 pb-1 text-xs text-ui-muted">{members.data?.accessTrackingAvailable ? '최근 접속은 세션 확인·갱신 기준입니다. 과거 기록은 소급되지 않습니다.' : '최근 접속 기록 수집은 준비 중입니다.'}</p>
    </section>
  )
}
