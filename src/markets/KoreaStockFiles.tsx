import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { SectorItem, StockSectorListItem } from '@/types/api'
import { toCount } from '@/utils/format'
import { appAlert, appConfirm, appWarnConfirm } from '@/utils/appDialogBus'
import { ClassificationUploadError, buildUploadPlan, readClassificationFile } from '@/utils/classificationUpload'
import { getErrorDetail } from '@/utils/errorMessage'
import { exportRowsToExcel } from '@/utils/exportExcel'
import { fileTimestamp } from '@/utils/fileTimestamp'
import { invalidateCustomTaxonomy, useResetCustomClassification } from '@/hooks/useHeatmapCustom'
import Spinner from '@/components/Spinner'
import { customHeatmapKeys } from '@/hooks/queryKeys'
import { DownloadIcon, UploadIcon } from '@/components/icons/AppIcons'
import { isAxiosError } from 'axios'
import { uploadClassification } from '@/api/custom'

import type { StockHistoryAction, StockRow } from '@/components/StockTable'
import { createPortal } from 'react-dom'

// 한국 내 기준의 엑셀(간편 업종 분류)과 초기화. 설정창 자리에 그린다.
export default function KoreaStockFiles({ items, sectors, rows, excelContainer, resetContainer, pushHistory, clearHistory }: {
  items: readonly StockSectorListItem[]
  sectors: SectorItem[]
  // 지금 화면에 필터·정렬이 적용된 종목.
  rows: readonly StockRow[]
  excelContainer: HTMLElement | null
  resetContainer: HTMLElement | null
  pushHistory: (action: Omit<StockHistoryAction, 'id'>) => void
  clearHistory: () => void
}) {
  const queryClient = useQueryClient()
  const resetCustomClassificationMutation = useResetCustomClassification()
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isApplyingUpload, setIsApplyingUpload] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
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
      const fileRows = await readClassificationFile(file)
      if (fileRows.length === 0) {
        appAlert('읽을 수 있는 줄이 없습니다.\n열 이름이 종목코드·대분류·중분류·소분류인지 확인해 주세요.', { title: '적용 실패' })
        return
      }
      const plan = buildUploadPlan(fileRows, sectors, new Map(items.map(item => [item.stockCode, item.sectorId])))
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
      const before = new Map(items.map(item => [item.stockCode, item.sectorId]))
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
        if (entries.length > 0) pushHistory({ afterLabel: group.path.join(' > '), after: group.sectorId, entries: entries.map(entry => ({ code: entry.stockCode, before: entry.before })) })
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
      clearHistory()
    } catch {
      await appAlert('업종 목록과 종목 분류를 초기화하지 못했습니다.', { title: '초기화 실패' })
    }
  }

  // 지금 화면에 필터/정렬 적용된 상태 그대로 내려받는다 — 전체를 받고 싶으면 필터를 먼저 풀면 된다.
  const handleExportExcel = async () => {
    if (rows.length === 0) {
      appAlert('다운로드할 종목이 없습니다.\n검색어와 필터를 확인해 주세요.', { title: '다운로드 불가' })
      return
    }
    setIsExporting(true)
    try {
      const filename = `[MARKETRY-업종분류] ${fileTimestamp()}.xlsx`
      const lines = rows.map(row => ({
        종목코드: row.code,
        종목명: row.name,
        '규모': row.cells.sizeTier ?? '',
        마켓: row.cells.market ?? '',
        '거래소 분류': row.cells.industry || '-',
        '대분류': row.path[0],
        '중분류': row.path[1],
        '소분류': row.path[2],
      }))
      await exportRowsToExcel(filename, '업종 분류', lines, {
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

  const hasCustomClassification = sectors.length > 0 || items.some(item => item.sectorId != null)
  return (
    <>
      {isApplyingUpload && (
        <div role="status" aria-live="polite" aria-busy="true" className="absolute inset-0 z-40 flex items-center justify-center bg-ui-background">
          <div className="relative flex flex-col items-center">
            <Spinner showElapsed className="h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]" />
            <span className="absolute left-1/2 top-full mt-4 -translate-x-1/2 whitespace-nowrap text-base text-ui-text">처리 중입니다.<br />1분 내외 소요.</span>
          </div>
        </div>
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
    </>
  )
}
