import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  getMarketryPublications,
  publishMarketry,
  restoreMarketryPublication,
  type MarketryPublication,
} from '@/api/marketryPublish'
import { heatmapKeys } from '@/hooks/queryKeys'
import Spinner from '@/components/Spinner'
import { useMainAreaRect } from '@/hooks/useMainAreaRect'
import { appAlert, appWarnConfirm, appWarnConfirmWithInput } from '@/utils/appDialogBus'
import { CloudUploadIcon, HistoryIcon } from '@/components/icons/AppIcons'
import { DROPDOWN_PANEL_CLASS, DROPDOWN_ROW_PX, DROPDOWN_SCROLL_CLASS, DROPDOWN_SNAP_ITEM_CLASS, dropdownListMaxHeight } from '@/components/dropdownStyle'

// 업데이트할 때 적는 메모의 최대 글자 수 — 롤백 목록 한 줄에 들어가는 길이다. 서버의 버전 이름 칸(50자)보다 짧다.
const MEMO_MAX_LENGTH = 20

// 롤백 목록에는 최근에 올린 버전만 이 개수까지 보인다(서버에는 더 오래된 버전도 남아 있다).
const ROLLBACK_VERSION_COUNT = 5

// 커스텀 설정창의 다운로드·업로드 버튼과 같은 회색 칩(마우스를 올리면 강조색이 은은하게 비친다). 위험 작업이라는 표시는 설정창 헤더의 ADMIN 경고가 맡는다.
const BUTTON_CLASS =
  'settings-chip-hover flex h-[25px] w-full items-center justify-center gap-1 whitespace-nowrap rounded-[5px] border-0 bg-[var(--ui-control)] px-2 text-[13px] leading-[1.3] font-medium text-ui-white disabled:cursor-not-allowed disabled:opacity-35'

// "MARKETRY 2026-10-08 14:30"에서 앞의 이름을 뺀 날짜·시간만 — 안내 문구에서 이름이 겹쳐 보이지 않게 한다.
function toDateTimeLabel(label: string) {
  return label.replace(/^MARKETRY\s+/, '')
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

// 메모 없이 올린 버전 이름("MARKETRY 2026-10-08 14:30") — 이 모양이면 메모가 없는 것으로 본다.
const TIME_ONLY_LABEL = /^MARKETRY\s+\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/

// 올린 버전의 시각("2026-10-28 15:53")은 서버가 저장한 시각을 쓰고, 메모는 버전 이름이 시각 모양이 아닐 때만 있다.
function describeVersion(version: { label: string; createdAt: string }) {
  return {
    time: version.createdAt.slice(0, 16).replace('T', ' '),
    memo: TIME_ONLY_LABEL.test(version.label) ? null : version.label,
  }
}

// 알림창 첫 줄 — 메모가 있으면 [메모] 아래 줄에 시각, 없으면 [시각]이다.
function versionHeadLines(version: { label: string; createdAt: string }) {
  const { time, memo } = describeVersion(version)
  return memo ? `[${memo}]\n${time}` : `[${time}]`
}

// 올린 버전 이름 — 브라우저 시각(한국)으로 "MARKETRY 2026-10-08 14:30"처럼 만든다.
function createPublicationLabel(now: Date) {
  return `MARKETRY ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

// 관리자 전용 — 내 분류를 MARKETRY로 올리고, 이전 버전으로 되돌린다. 다른 사용자의 데이터는 건드리지 않는다.
export default function MarketryPublishControls() {
  const queryClient = useQueryClient()
  // 올리거나 되돌리는 중이면 true.
  const [isBusy, setIsBusy] = useState(false)
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

  const refreshMaps = () => queryClient.invalidateQueries({ queryKey: heatmapKeys.all })

  const handlePublish = async () => {
    const { confirmed, value: memo } = await appWarnConfirmWithInput(
      `[${toDateTimeLabel(createPublicationLabel(new Date()))}]\n[내 기준]을 [MARKETRY] 분류로 업데이트하시겠습니까?`,
      { title: 'MARKETRY 업데이트', placeholder: `메모 (선택, ${MEMO_MAX_LENGTH}자까지)`, maxLength: MEMO_MAX_LENGTH },
    )
    if (!confirmed) return
    setIsBusy(true)
    try {
      // 메모를 적었으면 그것을 버전 이름으로 올리고, 비워 두었으면 예전처럼 "MARKETRY 시각"으로 올린다.
      const published = await publishMarketry(memo || createPublicationLabel(new Date()))
      setVersions(null)
      await refreshMaps()
      appAlert(`${versionHeadLines(published)}\nMARKETRY 분류가 업데이트되었습니다.`, { title: '업데이트 완료' })
    } catch {
      appAlert('MARKETRY에 올리지 못했습니다.', { title: '업데이트 실패' })
    } finally {
      setIsBusy(false)
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
      setVersions((await getMarketryPublications()).slice(0, ROLLBACK_VERSION_COUNT))
    } catch {
      setIsVersionsOpen(false)
      appAlert('이전 버전 목록을 불러오지 못했습니다.', { title: '불러오기 실패' })
    }
  }

  const handleRestore = async (version: MarketryPublication) => {
    const confirmed = await appWarnConfirm(`${versionHeadLines(version)}\n[MARKETRY] 분류를 되돌리시겠습니까?`, { title: 'MARKETRY 롤백' })
    if (!confirmed) return
    setIsBusy(true)
    try {
      await restoreMarketryPublication(version.id)
      setIsVersionsOpen(false)
      await refreshMaps()
      appAlert(`${versionHeadLines(version)}\nMARKETRY 롤백이 완료되었습니다.`, { title: '롤백 완료' })
    } catch {
      appAlert('MARKETRY를 되돌리지 못했습니다.', { title: '롤백 실패' })
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div ref={rootRef} className="relative grid w-full grid-cols-2 gap-[6px]">
      <button type="button" onClick={handlePublish} disabled={isBusy} className={BUTTON_CLASS}>
        <CloudUploadIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ui-text" />
        업데이트
      </button>
      <button type="button" onClick={handleToggleVersions} disabled={isBusy} className={BUTTON_CLASS}>
        <HistoryIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ui-text" />
        롤백
      </button>
      {/* 올리거나 되돌리는 동안 화면 전체를 가리고 큰 로딩을 보여준다 — 오래 걸려도 "진행 중"임을 알 수 있고, 그 사이 다른 곳을 누르지 못한다. */}
      {isBusy && createPortal(
        // 설정창(겹침 순서·잘림 영역) 밖, 문서 맨 위에 그려서 설정창으로 옮겨도 화면 전체를 가린다.
        // 어두운 배경은 화면 전체를 덮고, 메인 영역은 일반 로딩 화면처럼 단색 바탕으로 가려 그 위 가운데에 로딩 원을 놓는다.
        <div className="fixed inset-0 z-[90] bg-ui-background/70">
          <div
            className={`flex items-center justify-center bg-ui-background ${mainAreaRect ? 'absolute' : 'h-full w-full'}`}
            style={mainAreaRect ? { left: mainAreaRect.left, top: mainAreaRect.top, width: mainAreaRect.width, height: mainAreaRect.height } : undefined}
          >
            <Spinner showElapsed />
          </div>
        </div>,
        document.body,
      )}
      {isVersionsOpen && (
        <div style={{ maxHeight: dropdownListMaxHeight(10, DROPDOWN_ROW_PX, 2) }} className={`absolute left-0 top-full z-50 mt-1 w-full ${DROPDOWN_SCROLL_CLASS} ${DROPDOWN_PANEL_CLASS} text-sm font-normal`}>
          {versions === null ? (
            <p className="px-3 py-1 text-ui-muted">불러오는 중…</p>
          ) : versions.length === 0 ? (
            <p className="px-3 py-1 text-ui-muted">올린 버전이 없습니다.</p>
          ) : (
            versions.map(version => {
              const { time, memo } = describeVersion(version)
              return (
              <button
                key={version.id}
                type="button"
                onClick={() => handleRestore(version)}
                disabled={isBusy}
                className={`${DROPDOWN_SNAP_ITEM_CLASS} flex min-h-[25px] w-full items-center rounded-none border-0 bg-transparent px-3 text-left text-ui-white transition-colors hover:bg-ui-white/10 focus-visible:bg-ui-white/10 focus-visible:outline-none disabled:opacity-50`}
              >
                {/* 메모가 있으면 메모만 보이고 시각은 마우스를 올렸을 때 툴팁으로 뜬다. 메모 없이 올린 옛 버전은 시각(대괄호 없이)이 보인다. */}
                <span className="truncate" data-hint={memo ? time : undefined}>{memo ?? time}</span>
              </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
