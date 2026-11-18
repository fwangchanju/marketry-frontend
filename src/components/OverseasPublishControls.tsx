import { createPortal } from 'react-dom'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'
import Spinner from '@/components/Spinner'
import { useMainAreaRect } from '@/hooks/useMainAreaRect'
import { appAlert, appWarnConfirm } from '@/utils/appDialogBus'
import { CloudUploadIcon, HistoryIcon } from '@/components/icons/AppIcons'
import { overseasMarketInfo, type OverseasMarket } from '@/utils/markets'

// 한국의 MARKETRY 업데이트·롤백 버튼(MarketryPublishControls)과 같은 모양의 회색 칩.
const BUTTON_CLASS =
  'settings-chip-hover flex h-[25px] w-full items-center justify-center gap-1 whitespace-nowrap rounded-[5px] border-0 bg-[var(--ui-control)] px-2 text-[13px] leading-[1.3] font-medium text-ui-white disabled:cursor-not-allowed disabled:opacity-40'

type Status = { hasDraft: boolean; canRollback: boolean; backupCreatedAt: string | null }

// 일본·미국 설정창의 "MARKETRY 분류" 항목 — 내 기준(초안)을 MARKETRY(운영 분류)로 업데이트하고, 직전 업데이트 전으로 한 번 롤백한다.
export default function OverseasPublishControls({ market }: { market: OverseasMarket }) {
  const { routeSegment } = overseasMarketInfo(market)
  const queryClient = useQueryClient()
  const base = `/admin/overseas-classification-drafts/${market}`
  const statusKey = ['overseas-draft', market, 'status'] as const
  const status = useQuery({ queryKey: statusKey, queryFn: async () => (await client.get<Status>(`${base}/status`)).data })
  const [isBusy, setIsBusy] = useState(false)
  const mainAreaRect = useMainAreaRect(isBusy)

  // 운영 분류가 바뀌었으니 지도·그래프·표가 쓰는 분류 데이터와 상태를 다시 받는다.
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [routeSegment, 'categories'] }),
      queryClient.invalidateQueries({ queryKey: [routeSegment, 'classifications'] }),
      queryClient.invalidateQueries({ queryKey: statusKey }),
      queryClient.invalidateQueries({ queryKey: ['overseas-published-at', market] }),
    ])
  }

  const run = async (path: 'publish' | 'rollback', failure: { message: string; title: string }, success: { message: string; title: string }) => {
    setIsBusy(true)
    try {
      const response = await client.post<{ changed?: boolean } | ''>(`${base}/${path}`)
      await refresh()
      // 초안이 운영 분류와 같으면 서버가 아무것도 바꾸지 않는다(직전 백업을 지키려는 것).
      if (path === 'publish' && typeof response.data === 'object' && response.data?.changed === false) void appAlert('내 기준이 MARKETRY와 같아서 바꿀 내용이 없습니다.', { title: '변경 사항 없음' })
      else void appAlert(success.message, { title: success.title })
    } catch {
      void appAlert(failure.message, { title: failure.title })
    } finally {
      setIsBusy(false)
    }
  }

  const handlePublish = async () => {
    if (!await appWarnConfirm('[내 기준]을 [MARKETRY]로 업데이트하시겠습니까?', { title: 'MARKETRY 업데이트' })) return
    await run('publish', { message: 'MARKETRY에 올리지 못했습니다.', title: '업데이트 실패' }, { message: '[MARKETRY] 모드가 업데이트되었습니다.', title: '업데이트 완료' })
  }

  const handleRollback = async () => {
    if (!await appWarnConfirm('[MARKETRY]를 직전 업데이트 전으로 되돌리시겠습니까?\n되돌리면 이전 상태는 다시 복구할 수 없습니다.', { title: 'MARKETRY 롤백' })) return
    await run('rollback', { message: 'MARKETRY를 되돌리지 못했습니다.', title: '롤백 실패' }, { message: 'MARKETRY 롤백이 완료되었습니다.', title: '롤백 완료' })
  }

  return (
    <div className="relative grid w-full grid-cols-2 gap-[6px]">
      <button type="button" onClick={handlePublish} disabled={isBusy} className={BUTTON_CLASS}>
        <CloudUploadIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ui-text" />
        업데이트
      </button>
      <button type="button" onClick={handleRollback} disabled={isBusy || !status.data?.canRollback} className={BUTTON_CLASS} data-hint={status.data?.canRollback ? undefined : '되돌릴 이전 업데이트가 없습니다'}>
        <HistoryIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-ui-text" />
        롤백
      </button>
      {/* 올리거나 되돌리는 동안 화면 전체를 가리고 로딩을 보여 준다(한국 버튼과 같다). */}
      {isBusy && createPortal(
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
    </div>
  )
}
