import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  getMarketryPublications,
  publishMarketry,
  restoreMarketryPublication,
  type MarketryPublication,
} from '@/api/marketryPublish'
import { treemapKeys } from '@/hooks/queryKeys'
import Spinner from '@/components/Spinner'
import { useMainAreaRect } from '@/hooks/useMainAreaRect'
import { appAlert, appConfirm } from '@/utils/appDialogBus'

// 검정 바탕에 빨간 테두리·글자 — 아래 롤백 목록(검정 바탕, 빨간 테두리)과 같은 모양이고, 올리면 빨간 바탕에 흰 글자가 된다.
const BUTTON_CLASS =
  'h-6 w-full whitespace-nowrap rounded-md border border-[#ff4d2e] bg-black px-2 text-xs font-bold text-[#ff6a4d] transition-colors hover:bg-[#ff4d2e] hover:text-white disabled:cursor-not-allowed disabled:opacity-50'

// "MARKETRY 2026-10-08 14:30"에서 앞의 이름을 뺀 날짜·시간만 — 안내 문구에서 이름이 겹쳐 보이지 않게 한다.
function toDateTimeLabel(label: string) {
  return label.replace(/^MARKETRY\s+/, '')
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

// 올린 버전 이름 — 브라우저 시각(한국)으로 "MARKETRY 2026-10-08 14:30"처럼 만든다.
function createPublicationLabel(now: Date) {
  return `MARKETRY ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

// 관리자 전용 — 내 분류를 MARKETRY로 올리고, 이전 버전으로 되돌린다. 다른 사용자의 데이터는 건드리지 않는다.
export default function MarketryPublishControls() {
  const queryClient = useQueryClient()
  // 올리거나 되돌리는 중이면 그 안내 문구, 아니면 null.
  const [busyMessage, setBusyMessage] = useState<string | null>(null)
  const isBusy = busyMessage !== null
  const mainAreaRect = useMainAreaRect(isBusy)
  const [isVersionsOpen, setIsVersionsOpen] = useState(false)
  const [versions, setVersions] = useState<MarketryPublication[] | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVersionsOpen) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsVersionsOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [isVersionsOpen])

  const refreshMaps = () => queryClient.invalidateQueries({ queryKey: treemapKeys.all })

  const handlePublish = async () => {
    const confirmed = await appConfirm(
      `[${toDateTimeLabel(createPublicationLabel(new Date()))}]\n내 분류를 서버에 업데이트하시겠습니까?\n유저들이 보는 MARKETRY 맵이 변경됩니다.`,
      { adminOnly: true, title: 'MARKETRY 업데이트' },
    )
    if (!confirmed) return
    setBusyMessage('MARKETRY를 업데이트 중입니다.')
    try {
      const published = await publishMarketry(createPublicationLabel(new Date()))
      setVersions(null)
      await refreshMaps()
      appAlert(`[${toDateTimeLabel(published.label)}]\nMARKETRY 업데이트가 완료되었습니다.`, { title: '업데이트 완료' })
    } catch {
      appAlert('MARKETRY에 올리지 못했습니다.', { title: '업데이트 실패' })
    } finally {
      setBusyMessage(null)
    }
  }

  const handleToggleVersions = async () => {
    if (isVersionsOpen) {
      setIsVersionsOpen(false)
      return
    }
    setIsVersionsOpen(true)
    if (versions !== null) return
    try {
      setVersions(await getMarketryPublications())
    } catch {
      setIsVersionsOpen(false)
      appAlert('이전 버전 목록을 불러오지 못했습니다.', { title: '불러오기 실패' })
    }
  }

  const handleRestore = async (version: MarketryPublication) => {
    const confirmed = await appConfirm(`[${toDateTimeLabel(version.label)}]\nMARKETRY 맵을 되돌리시겠습니까?\n유저들이 보는 MARKETRY 맵이 변경됩니다.`, { adminOnly: true, title: 'MARKETRY 롤백' })
    if (!confirmed) return
    setBusyMessage('MARKETRY를 롤백 중입니다.')
    try {
      await restoreMarketryPublication(version.id)
      setIsVersionsOpen(false)
      await refreshMaps()
      appAlert(`[${toDateTimeLabel(version.label)}]\nMARKETRY 롤백이 완료되었습니다.`, { title: '롤백 완료' })
    } catch {
      appAlert('MARKETRY를 되돌리지 못했습니다.', { title: '롤백 실패' })
    } finally {
      setBusyMessage(null)
    }
  }

  return (
    <div ref={rootRef} className="relative grid w-full grid-cols-2 gap-[6px]">
      <span className="col-span-2 inline-flex h-6 items-center justify-center rounded-md border border-[#ff4d2e] bg-[#ff4d2e] px-2 text-xs font-bold text-white">⚠ ADMIN</span>
      <button type="button" onClick={handlePublish} disabled={isBusy} className={BUTTON_CLASS}>
        UPDATE
      </button>
      <button type="button" onClick={handleToggleVersions} disabled={isBusy} className={BUTTON_CLASS}>
        ROLLBACK
      </button>
      {/* 올리거나 되돌리는 동안 화면 전체를 가리고 큰 로딩을 보여준다 — 오래 걸려도 "진행 중"임을 알 수 있고, 그 사이 다른 곳을 누르지 못한다. */}
      {isBusy && (
        // 어두운 배경은 화면 전체를 덮고, 로딩 원은 메인 영역 안의 가운데에 놓는다.
        <div className="fixed inset-0 z-[90] bg-black/70">
          <div
            className={`flex items-center justify-center ${mainAreaRect ? 'absolute' : 'h-full w-full'}`}
            style={mainAreaRect ? { left: mainAreaRect.left, top: mainAreaRect.top, width: mainAreaRect.width, height: mainAreaRect.height } : undefined}
          >
            <Spinner showElapsed message={busyMessage} />
          </div>
        </div>
      )}
      {isVersionsOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full overflow-y-auto border border-[#ff4d2e] bg-black p-1 text-sm font-normal">
          {versions !== null && versions.length > 0 && <p className="px-2 py-1 text-xs font-medium text-gray-300">해당 버전으로 롤백합니다.</p>}
          {versions === null ? (
            <p className="px-2 py-1 text-gray-400">불러오는 중…</p>
          ) : versions.length === 0 ? (
            <p className="px-2 py-1 text-gray-400">올린 버전이 없습니다.</p>
          ) : (
            versions.map(version => (
              <button
                key={version.id}
                type="button"
                onClick={() => handleRestore(version)}
                disabled={isBusy}
                className="flex w-full items-center border-0 bg-transparent px-2 py-1 text-left text-white hover:bg-white/10 disabled:opacity-50"
              >
                {/* 버전 이름 앞의 "MARKETRY"는 뺀다 — 구분되는 것은 시각이고, 알림창에서도 같은 [시각]으로 쓴다. */}
                <span className="truncate">[{toDateTimeLabel(version.label)}]</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
