import { isAxiosError } from 'axios'
import { useSectorDeletePreview, useDeleteSector } from './useTreemapCustom'
import type { StockSectorItem } from '@/types/api'
import { getErrorDetail } from '@/utils/errorMessage'
import { appAlert, appConfirm } from '@/utils/appDialogBus'

function confirmDeletable(sectorName: string, deletableSectors: string[]) {
  // 하위 업종이 많아도 한 줄에 들어가게 앞의 3개만 적는다.
  const list = deletableSectors.length === 0
    ? '없음'
    : `${deletableSectors.slice(0, 3).map(name => `[${name}]`).join(' ')}${deletableSectors.length > 3 ? ` 외 ${deletableSectors.length - 3}개` : ''}`
  return appConfirm(`[${sectorName}]\n삭제하시겠습니까?\n하위 업종 ${list}`, { title: '업종 삭제' })
}

function alertBlocked(sectorName: string, blockingStocks: StockSectorItem[]) {
  // 같은 종목이 하위 섹터 여러 곳에 걸려 있을 수 있어 종목 코드로 중복을 없애서 센다.
  const stockCount = new Set(blockingStocks.map(s => s.stockCode)).size
  if (stockCount === 0) {
    appAlert(`[${sectorName}]\n삭제할 수 없습니다.`, { title: '삭제 불가' })
    return
  }
  appAlert(`[${sectorName}]\n${stockCount}종목이 있어 삭제할 수 없습니다.`, { title: '삭제 불가' })
}

function alertDeleteFailed(sectorName: string, error: unknown) {
  appAlert(`[${sectorName}]\n${getErrorDetail(error)}`, { title: '삭제 실패' })
}

/** 섹터 삭제 미리보기→확인→삭제 플로우. 삭제 실행 자체가 409(레이스)로 실패하면
 * 미리보기를 재조회해서 그 시점 기준 차단 사유를 다시 보여준다(#95). */
export function useSectorDeleteFlow() {
  const deletePreview = useSectorDeletePreview()
  const deleteSector = useDeleteSector()

  const remove = async (sectorId: number, sectorName: string) => {
    let preview
    try {
      preview = await deletePreview.mutateAsync(sectorId)
    } catch (e) {
      alertDeleteFailed(sectorName, e)
      return
    }

    if (!preview.deletable) {
      alertBlocked(preview.sectorName, preview.blockingStocks)
      return
    }
    if (!await confirmDeletable(preview.sectorName, preview.deletableSectors)) return

    try {
      await deleteSector.mutateAsync(sectorId)
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409) {
        try {
          const retried = await deletePreview.mutateAsync(sectorId)
          alertBlocked(retried.sectorName, retried.blockingStocks)
        } catch (retryError) {
          alertDeleteFailed(sectorName, retryError)
        }
        return
      }
      alertDeleteFailed(sectorName, e)
    }
  }

  return { remove }
}
