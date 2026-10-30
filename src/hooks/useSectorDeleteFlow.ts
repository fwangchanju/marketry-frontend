import { isAxiosError } from 'axios'
import { useSectorDeletePreview, useDeleteSector } from './useHeatmapCustom'
import type { SectorDeletePreview } from '@/types/api'
import { getErrorDetail } from '@/utils/errorMessage'
import { getProtectedSectorDeleteMessage } from '@/utils/protectedSector'
import { appAlert, appWarnConfirm } from '@/utils/appDialogBus'

// 확인한 종목 수가 그사이 바뀌어 서버가 삭제를 멈추면 새 수로 다시 확인한다. 계속 바뀌면 이 횟수까지만 다시 묻는다.
const MAX_CONFIRM_ATTEMPTS = 3
const MOVE_COUNT_CHANGED_CODE = 'SECTOR_MOVE_COUNT_CHANGED'

function confirmDelete(preview: SectorDeletePreview) {
  // 담긴 종목은 지울 때 미분류로 옮겨진다 — 몇 종목이 옮겨지는지 알려 주고, 없으면 확인만 묻는다.
  const moveNote = preview.moveStockCount > 0 ? `\n${preview.moveStockCount.toLocaleString('ko-KR')}종목이 미분류로 이동합니다.` : ''
  return appWarnConfirm(`[${preview.sectorName}]\n삭제하시겠습니까?${moveNote}`, { title: '업종 삭제' })
}

function alertBlocked(preview: SectorDeletePreview) {
  if (preview.blockReason === 'PROTECTED') {
    appAlert(`[${preview.sectorName}]\n${getProtectedSectorDeleteMessage(preview.sectorName)}`, { title: '삭제 불가' })
    return
  }
  if (preview.blockReason === 'HAS_SUB_SECTORS') {
    // 하위 업종이 많아도 한 줄에 들어가게 앞의 3개만 적는다.
    const names = preview.subSectorNames
    const list = `${names.slice(0, 3).map(name => `[${name}]`).join(' ')}${names.length > 3 ? ` 외 ${names.length - 3}개` : ''}`
    appAlert(`[${preview.sectorName}]\n하위 업종이 있어 삭제할 수 없습니다.\n하위 업종 ${list}`, { title: '삭제 불가' })
    return
  }
  appAlert(`[${preview.sectorName}]\n삭제할 수 없습니다.`, { title: '삭제 불가' })
}

function alertDeleteFailed(sectorName: string, error: unknown) {
  appAlert(`[${sectorName}]\n${getErrorDetail(error)}`, { title: '삭제 실패' })
}

const isMoveCountChanged = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 409 && error.response.data?.errorCode === MOVE_COUNT_CHANGED_CODE

/** 섹터 삭제 미리보기→확인→삭제 플로우. 삭제는 하위 업종이 없을 때만 되고, 담긴 종목은 미분류로 옮겨진다.
 * 확인한 종목 수를 삭제 요청에 함께 보내서, 그사이 수가 바뀌면 삭제하지 않고 새 수로 다시 확인한다.
 * 그 밖의 409(레이스)는 미리보기를 재조회해서 그 시점 기준 차단 사유를 다시 보여준다(#95). */
export function useSectorDeleteFlow() {
  const deletePreview = useSectorDeletePreview()
  const deleteSector = useDeleteSector()

  const remove = async (sectorId: number, sectorName: string) => {
    for (let attempt = 0; attempt < MAX_CONFIRM_ATTEMPTS; attempt += 1) {
      let preview: SectorDeletePreview
      try {
        preview = await deletePreview.mutateAsync(sectorId)
      } catch (e) {
        alertDeleteFailed(sectorName, e)
        return
      }

      if (!preview.deletable) {
        alertBlocked(preview)
        return
      }
      if (!await confirmDelete(preview)) return

      try {
        await deleteSector.mutateAsync({ id: sectorId, expectedMoveCount: preview.moveStockCount })
        return
      } catch (e) {
        if (isMoveCountChanged(e)) continue
        if (isAxiosError(e) && e.response?.status === 409) {
          try {
            const retried = await deletePreview.mutateAsync(sectorId)
            if (retried.deletable) alertDeleteFailed(sectorName, e)
            else alertBlocked(retried)
          } catch (retryError) {
            alertDeleteFailed(sectorName, retryError)
          }
          return
        }
        alertDeleteFailed(sectorName, e)
        return
      }
    }
    appAlert(`[${sectorName}]\n옮길 종목 수가 계속 바뀌어 삭제하지 못했습니다.\n잠시 후 다시 시도해 주세요.`, { title: '삭제 실패' })
  }

  return { remove }
}
