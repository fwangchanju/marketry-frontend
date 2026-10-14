import { BUTTON_ACCENT_CLASS, BUTTON_BASE_CLASS } from '@/components/buttonStyles'
import { useEffect, useState } from 'react'
import { screenshotElementToDataUrl } from '@/utils/screenshotToPreview'
import { CheckIcon, CopyIcon, DownloadIcon, TelegramIcon } from '@/components/icons/AppIcons'
import Spinner from '@/components/Spinner'

interface Props {
  onClose: () => void
  // 미리보기 이미지(data URL)를 넘긴다 — 있으면 같은 영역을 다시 찍지 않고 그 이미지를 쓴다.
  onCopy: (previewSrc: string | null) => void
  onDownload: (previewSrc: string | null) => void
  copyLabel: string
  downloadLabel: string
  isCopying: boolean
  isDownloading: boolean
  screenshotTarget: HTMLElement | null
}

// 텔레그램 버튼은 임시로 숨겼다. 다시 쓰라는 요청이 오면 새 버튼을 만들지 말고 이 값을 true로 바꿔 기존 버튼을 복원한다.
const SHOW_TELEGRAM_BUTTON = false

// MARKETRY 텔레그램 방 초대 링크 — 텔레그램 버튼이 연다.
const TELEGRAM_ROOM_URL = 'https://t.me/+dqHQ460Ni5BmODdl'

export default function ScreenshotModal({
  onClose,
  onCopy,
  onDownload,
  downloadLabel,
  isDownloading,
  copyLabel,
  isCopying,
  screenshotTarget,
}: Props) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  // 미리보기 이미지의 가로/세로 비율 — 화면에 꽉 차는 폭을 이 비율로 계산한다. 스크린샷 전(스피너)에도 같은 크기로 자리를 잡도록 처음에는
  // 스크린샷으로 찍을 영역의 비율로 어림잡고, 이미지가 로드되면 실제 비율로 바로잡는다.
  const [previewRatio, setPreviewRatio] = useState<number | null>(() => elementRatio(screenshotTarget))
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!screenshotTarget) return
    // 스크린샷 작업이 무거워서 같은 프레임에서 바로 시작하면 모달이 뜨는 페인트 자체가 밀린다.
    // 두 번의 requestAnimationFrame으로 모달(+스피너)이 먼저 그려진 뒤에 스크린샷을 시작한다.
    let cancelled = false
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        screenshotElementToDataUrl(screenshotTarget)
          .then(dataUrl => {
            if (!cancelled) setPreviewSrc(dataUrl)
          })
          .catch(() => {
            if (!cancelled) setPreviewSrc(null)
          })
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
    }
  }, [screenshotTarget])

  // 텔레그램 — 모든 기기에서 MARKETRY 텔레그램 방 링크를 연다. 링크에는 이미지를 붙일 수 없으니, 이미지는 클립보드에 복사해 두어
  // 열린 방의 대화창에 붙여넣게 한다.
  const handleTelegramShare = () => {
    window.open(TELEGRAM_ROOM_URL, '_blank', 'noopener,noreferrer')
    onCopy(previewSrc)
  }

  // 높이는 화면(85dvh에서 버튼 줄을 뺀 만큼), 폭은 화면 폭 안에서 이미지 비율로 정한다 — 원래 크기보다 작으면 키우고 크면 줄여서 화면에
  // 최대한 꽉 채운다. 스피너 칸과 이미지가 같은 값을 써서, 미리보기가 뜰 때 팝업 크기가 바뀌지 않는다.
  const fitWidth = previewRatio ? `min(calc(100vw - 4rem), calc((85dvh - 11rem) * ${previewRatio}))` : undefined

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70" onClick={onClose}>
      {/* 팝업은 미리보기 이미지 크기에 딱 맞게 줄어든다(w-fit) — 이미지 주변에 빈 여백(레터박스)이 생기지
          않는다. 이미지는 화면(폭 95vw, 높이 85dvh에서 버튼 줄을 뺀 만큼) 안에서 비율을 유지한 채 최대한
          크게 그린다. 스크린샷 전(스피너)에는 임시 크기 칸으로 자리를 잡는다. */}
      <div
        className="flex max-w-[calc(100vw-2rem)] flex-col rounded-md border border-gray-500 bg-[#363639]"
        onClick={e => e.stopPropagation()}
      >
        {/* 설정창 헤더와 같은 모양 — 왼쪽 제목, 오른쪽 ✕, 아래 구분선. */}
        <div className="flex shrink-0 items-center border-b border-gray-500 p-4">
          <p className="font-roboto-latin flex h-7 items-center whitespace-nowrap text-lg font-bold leading-none text-white">
            {/* 설정창 헤더 제목 앞의 막대와 같은 모양(청록 세로 막대)이다. */}
            <span aria-hidden="true" className="mr-[6px] inline-block h-5 w-1 shrink-0 rounded-sm bg-[var(--brand)]" />
            Screenshot
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="ml-auto shrink-0 border-0 bg-transparent text-xl text-gray-400 hover:text-[var(--brand)] focus-visible:text-[var(--brand)]"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col p-4">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt="마켓맵 미리보기"
            onLoad={e => setPreviewRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
            style={fitWidth ? { width: fitWidth } : undefined}
            className="block h-auto max-w-full self-center"
          />
        ) : (
          <div
            className={`flex items-center justify-center self-center ${fitWidth ? '' : 'h-[50dvh] w-[60vw]'}`}
            style={fitWidth && previewRatio ? { width: fitWidth, aspectRatio: previewRatio } : undefined}
          >
            <Spinner showElapsed />
          </div>
        )}
        {/* 양끝 칸의 폭을 같게 유지해 문구 길이와 무관하게 복사 상태를 정중앙에 둔다.
            좁은 화면에서는 복사 상태 아래로 양끝 버튼을 내려 겹치지 않게 한다. */}
        <div className="mt-4 flex shrink-0 items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onDownload(previewSrc)}
              disabled={isDownloading}
              className={BUTTON_BASE_CLASS}
            >
              {isDownloading ? <Spinner className="h-4 w-4" /> : <DownloadIcon className="h-4 w-4" />}
              {downloadLabel}
            </button>
            {SHOW_TELEGRAM_BUTTON && (
              <button
                type="button"
                onClick={handleTelegramShare}
                disabled={!previewSrc}
                aria-label="텔레그램으로 공유"
                className={BUTTON_BASE_CLASS}
              >
                <TelegramIcon className="h-4 w-4" />
                텔레그램
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 복사는 자동으로 하지 않고 이 버튼으로만 한다. 공유는 대부분 붙여 넣는 용도라 이 버튼이 강조 버튼이다(청록). 글자는 다른 버튼과 같은 4글자로 고정하고,
                상태는 아이콘(복사 중=스피너, 완료=체크)으로 보여준다. 실패만 "복사실패"(4글자). */}
            <button
              type="button"
              onClick={() => onCopy(previewSrc)}
              disabled={!previewSrc || isCopying}
              className={BUTTON_ACCENT_CLASS}
            >
              {isCopying ? <Spinner className="h-4 w-4" /> : copyLabel === 'Copied' ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
              {copyLabel === 'Failed' ? '복사실패' : '클립보드'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={BUTTON_BASE_CLASS}
            >
              닫기
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

// 스크린샷으로 찍을 영역의 가로/세로 비율 — 아직 없거나 크기를 못 재면 null.
function elementRatio(element: HTMLElement | null): number | null {
  if (!element) return null
  const { width, height } = element.getBoundingClientRect()
  return width > 0 && height > 0 ? width / height : null
}
