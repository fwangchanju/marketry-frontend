import { BUTTON_ACCENT_CLASS, BUTTON_BASE_CLASS } from '@/components/buttonStyles'
import { useEffect, useState } from 'react'
import { screenshotElementToDataUrl, screenshotFixedHomeFrameToDataUrl } from '@/utils/screenshotToPreview'
import { captureRegionRect, fullScreenshotSize } from '@/utils/screenshotScale'
import { CheckIcon, CopyIcon, HomeFrameCaptureIcon, MonitorIcon, SmartphoneIcon } from '@/components/icons/AppIcons'
import Spinner from '@/components/Spinner'

// 팝업 미리보기 높이 상한(px) — 큰 창에서 팝업이 지나치게 커지지 않게 한다.
const PREVIEW_MAX_HEIGHT_PX = 640

interface Props {
  onClose: () => void
  // 미리보기 이미지(data URL)를 넘긴다 — 있으면 같은 영역을 다시 찍지 않고 그 이미지를 쓴다.
  onCopy: (previewSrc: string | null) => void
  copyLabel: string
  isCopying: boolean
  screenshotTarget: HTMLElement | null
  fixedHomeCaptureRef?: { current: HTMLElement | null }
  // 지도에서 전체 화면(모니터)과 지도 영역(모바일)을 고르는 버튼을 표시한다.
  mobileRegionOption?: { label: string; selector: string; mode?: 'through-right-edge' | 'element' | 'content'; onCloneNode?: (cloned: Node) => void; monitorHorizontalPadding?: number }
  onMobileSelectionChange?: (selected: boolean) => void
  // 홈의 각 요약 항목을 따로 캡처하는 버튼들.
  frameCaptureOptions?: Array<{ id: string; label: string; selector: string; selectedSlot: 0 | 1 | 2; mode?: 'element' | 'content' }>
}

// 마지막으로 고른 캡처 범위를 이 브라우저에만 남긴다(서버에는 보내지 않는다). 페이지 종류마다 고를 수 있는 버튼이 달라서(지도: 모바일, 홈: 항목별) 종류별로 따로 둔다.
// 저장된 값이 지금 페이지에 없는 버튼이면 기본(전체 화면)으로 연다. 접근이 막힌 환경에서는 저장 없이 기본값으로 동작한다.
function captureChoiceKey(hasMobile: boolean, hasFrames: boolean) {
  return `marketry-screenshot-capture:${hasMobile ? 'mobile' : hasFrames ? 'frames' : 'full'}`
}

function readSavedCapture(key: string, hasMobile: boolean, frameIds: string[]): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown
    if (saved === 'mobile' && hasMobile) return 'mobile'
    if (typeof saved === 'string' && frameIds.some(id => saved === `frame:${id}`)) return saved
  } catch {
    // 저장값을 못 읽으면 기본값으로 연다.
  }
  return null
}

function saveCapture(key: string, value: string | null) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장이 막혀도 캡처는 그대로 된다.
  }
}

export default function ScreenshotModal({
  onClose,
  onCopy,
  copyLabel,
  isCopying,
  screenshotTarget,
  fixedHomeCaptureRef,
  mobileRegionOption,
  onMobileSelectionChange,
  frameCaptureOptions,
}: Props) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [contextPreviewSrc, setContextPreviewSrc] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [captureAttempt, setCaptureAttempt] = useState(0)
  // 스크린샷 창은 마지막으로 고른 캡처 범위로 열고, 고른 적이 없거나 지금 페이지에 없는 범위면 전체 화면(모니터) 캡처로 연다.
  const choiceKey = captureChoiceKey(Boolean(mobileRegionOption), Boolean(frameCaptureOptions))
  const [selectedCapture, setSelectedCapture] = useState<string | null>(() =>
    readSavedCapture(choiceKey, Boolean(mobileRegionOption), frameCaptureOptions?.map(option => option.id) ?? []),
  )
  useEffect(() => {
    onMobileSelectionChange?.(selectedCapture === 'mobile')
  }, [onMobileSelectionChange, selectedCapture])
  // 항목(프레임) 캡처로 열 때는 전체 화면 위에 그 항목 자리를 표시해야 하므로 처음 값도 selectCapture와 같은 방식으로 만든다.
  const [highlightRegion, setHighlightRegion] = useState<{ left: number; top: number; width: number; height: number } | null>(() => {
    const frameOption = frameCaptureOptions?.find(option => selectedCapture === `frame:${option.id}`)
    if (!frameOption || !screenshotTarget) return null
    return regionOverlay(screenshotTarget, frameOption.selector, frameOption.mode ?? 'element', mobileRegionOption?.monitorHorizontalPadding ?? 4)
  })
  const selectedFrame = frameCaptureOptions?.find(option => selectedCapture === `frame:${option.id}`)
  const showContextPreview = Boolean(selectedFrame)
  const regionSelector = selectedCapture === 'mobile' ? mobileRegionOption?.selector : selectedFrame?.selector
  const regionMode = selectedCapture === 'mobile' ? mobileRegionOption?.mode : selectedFrame?.mode ?? (selectedFrame ? 'element' : undefined)
  const onCloneNode = selectedCapture === 'mobile' ? mobileRegionOption?.onCloneNode : undefined
  // 모니터·전체 화면 캡처에는 페이지와 무관하게 좌우 4px 바깥 여백을 포함한다.
  const horizontalPadding = selectedCapture === null ? mobileRegionOption?.monitorHorizontalPadding ?? 4 : 0
  const fullPreviewPadding = mobileRegionOption?.monitorHorizontalPadding ?? 4
  // 미리보기 이미지의 가로/세로 비율 — 화면에 꽉 차는 폭을 이 비율로 계산한다. 스크린샷 전(스피너)에도 같은 크기로 자리를 잡도록 처음에는
  // 스크린샷으로 찍을 영역의 비율로 어림잡고, 이미지가 로드되면 실제 비율로 바로잡는다.
  // 항목(프레임) 캡처로 열 때 팝업은 항목 하나가 아니라 전체 화면 위에 그 자리를 표시하는 그림을 보여 주므로, 처음 크기도 selectCapture와 같이 전체 화면 비율로 잡는다.
  // 모바일 캡처로 열 때는 그 틀이 팝업이 열린 뒤에 생기므로 아직 재지 못한다 — 틀 크기는 화면 높이로 정해지니(가로 = 높이 × 3/4 + 8px, 세로 = 높이 + 4px) 같은 식으로 미리 잡는다.
  const [previewRatio, setPreviewRatio] = useState<number | null>(() => {
    if (selectedFrame) return elementRatio(screenshotTarget, undefined, undefined, fullPreviewPadding)
    if (selectedCapture === 'mobile' && regionSelector && !screenshotTarget?.querySelector(regionSelector)) {
      return (window.innerHeight * 0.75 + 8) / (window.innerHeight + 4)
    }
    return elementRatio(screenshotTarget, regionSelector, regionMode, horizontalPadding)
  })
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
    // 스크린샷 작업이 무거워서 같은 프레임에서 바로 시작하면 모달이 뜨는 페인트 자체가 밀린다.
    // 두 번의 requestAnimationFrame으로 모달(+스피너)이 먼저 그려진 뒤에 스크린샷을 시작한다.
    let cancelled = false
    let finished = false
    let rafId = 0
    let missingMobileFrames = 0
    const failCapture = (message: string) => {
      if (cancelled || finished) return
      finished = true
      cancelAnimationFrame(rafId)
      setCaptureError(message)
    }
    const timeoutId = window.setTimeout(() => failCapture('캡처 시간이 초과되었습니다. 다시 시도해 주세요.'), 10_000)
    const captureWhenReady = () => {
      if (cancelled || finished) return
      if (regionSelector && selectedCapture === 'mobile' && screenshotTarget && !screenshotTarget.querySelector(regionSelector) && missingMobileFrames++ < 10) {
        // 저장된 모바일 선택으로 열면 부모가 모바일 판을 한 번 더 렌더링해야 한다.
        rafId = requestAnimationFrame(captureWhenReady)
        return
      }
      if (!screenshotTarget || (regionSelector && !screenshotTarget.querySelector(regionSelector))) {
        window.clearTimeout(timeoutId)
        failCapture('캡처할 영역이 없습니다.')
        return
      }
      // 모바일용 지도는 별도 크기로 다시 배치한다. ResizeObserver가 새 레이아웃을 계산할 때까지 기다린다.
      if (onCloneNode && !screenshotTarget.querySelector('[data-map-mobile-capture] [data-treemap-layout-ready="true"]')) {
        rafId = requestAnimationFrame(captureWhenReady)
        return
      }
      const capture = async () => {
        try {
          // 프레임 선택 중에는 전체 화면을 배경으로 먼저 보여주고, 선택 프레임은 별도로 캡처해 복사한다.
          let context: string | null = null
          if (showContextPreview) {
            context = await screenshotElementToDataUrl(screenshotTarget, undefined, undefined, undefined, fullPreviewPadding)
            if (cancelled || finished) return
            setContextPreviewSrc(context)
          }
          const fixedHome = fixedHomeCaptureRef?.current
          if (showContextPreview && fixedHomeCaptureRef && !fixedHome) throw new Error('Fixed home capture is unavailable')
          const dataUrl = showContextPreview && regionSelector && fixedHome
            ? await screenshotFixedHomeFrameToDataUrl(fixedHome, regionSelector)
            : await screenshotElementToDataUrl(screenshotTarget, regionSelector, regionMode, onCloneNode, horizontalPadding)
          if (!cancelled && !finished) {
            finished = true
            window.clearTimeout(timeoutId)
            setPreviewSrc(dataUrl)
          }
        } catch (error) {
          window.clearTimeout(timeoutId)
          failCapture(error instanceof Error && error.message === '캡처 폭에 상단 정보가 모두 들어가지 않습니다.'
            ? error.message
            : '화면을 캡처하지 못했습니다. 다시 시도해 주세요.')
        }
      }
      void capture()
    }
    const raf1 = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(captureWhenReady)
    })
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(rafId)
    }
  }, [screenshotTarget, fixedHomeCaptureRef, selectedCapture, regionSelector, regionMode, onCloneNode, horizontalPadding, fullPreviewPadding, showContextPreview, captureAttempt])

  const retryCapture = () => {
    setPreviewSrc(null)
    setContextPreviewSrc(null)
    setCaptureError(null)
    setCaptureAttempt(attempt => attempt + 1)
  }

  // 범위를 바꾸면 새 이미지를 찍는 동안 스피너를 보여 준다.
  const selectCapture = (next: string | null) => {
    if (next === selectedCapture) return
    saveCapture(choiceKey, next)
    setPreviewSrc(null)
    setCaptureError(null)
    setSelectedCapture(next)
    const option = next === 'mobile' ? mobileRegionOption : frameCaptureOptions?.find(item => next === `frame:${item.id}`)
    const mode = next === 'mobile' ? mobileRegionOption?.mode : option && 'mode' in option ? option.mode ?? 'element' : undefined
    const horizontalPadding = next === null ? mobileRegionOption?.monitorHorizontalPadding ?? 4 : 0
    const frameOption = frameCaptureOptions?.find(item => next === `frame:${item.id}`)
    if (frameOption && screenshotTarget) {
      setPreviewRatio(elementRatio(screenshotTarget, undefined, undefined, fullPreviewPadding))
      setHighlightRegion(regionOverlay(screenshotTarget, frameOption.selector, frameOption.mode ?? 'element', fullPreviewPadding))
    } else {
      setHighlightRegion(null)
      setPreviewRatio(elementRatio(screenshotTarget, option?.selector, mode, horizontalPadding))
    }
  }

  // 높이는 화면(버튼 줄과 팝업 여백을 뺀 만큼)과 상한 중 작은 쪽, 폭은 화면 폭 안에서 이미지 비율로 정한다 — 큰 창에서도 팝업이 끝없이 커지지 않게
  // 높이에 상한을 둔다(보여 주는 크기만 정하며 캡처 이미지에는 영향이 없다). 스피너 칸과 이미지가 같은 값을 써서, 미리보기가 뜰 때 팝업 크기가 바뀌지 않는다.
  const fitWidth = previewRatio ? `min(calc(100vw - 4rem), calc(min(100dvh - 11rem, ${PREVIEW_MAX_HEIGHT_PX}px) * ${previewRatio}))` : undefined
  const displayPreviewSrc = contextPreviewSrc ?? previewSrc
  const toolbar = screenshotTarget?.querySelector<HTMLElement>('.main-toolbar')
  const headerSelections = toolbar && screenshotTarget && highlightRegion
    ? Array.from(toolbar.children).slice(0, 2).map(child => {
      const headerPadding = 6
      const rect = child.getBoundingClientRect()
      const origin = screenshotTarget.getBoundingClientRect()
      const toolbarRect = toolbar.getBoundingClientRect()
      const size = fullScreenshotSize(screenshotTarget)
      const width = size.width + fullPreviewPadding * 2
      // 전체 화면 미리보기에서 가로 스크롤 폭을 펼치면 오른쪽 배지도 새 오른쪽 끝으로 이동한다.
      const childLeft = child === toolbar.lastElementChild
        ? toolbarRect.left - origin.left + size.width - (toolbarRect.right - rect.right) - rect.width
        : rect.left - origin.left
      const left = Math.max(0, (childLeft + fullPreviewPadding - headerPadding) / width)
      const top = Math.max(0, (rect.top - origin.top - headerPadding) / size.height)
      const right = Math.min(1, (childLeft + rect.width + fullPreviewPadding + headerPadding) / width)
      const bottom = Math.min(highlightRegion.top - 4 / size.height, (rect.bottom - origin.top + headerPadding) / size.height)
      return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
    })
    : []

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ui-background/70">
      {/* 팝업은 미리보기 이미지 크기에 딱 맞게 줄어든다(w-fit) — 이미지 주변에 빈 여백(레터박스)이 생기지
          않는다. 이미지는 화면(폭 95vw, 높이 85dvh에서 버튼 줄을 뺀 만큼) 안에서 비율을 유지한 채 최대한
          크게 그린다. 스크린샷 전(스피너)에는 임시 크기 칸으로 자리를 잡는다. */}
      <div
        className="flex max-w-[calc(100vw-2rem)] select-none flex-col rounded-md border border-ui-border bg-[var(--ui-panel)]"
        onClick={e => e.stopPropagation()}
        onDragStart={e => e.preventDefault()}
      >
        {/* 설정창 헤더와 같은 모양 — 왼쪽 제목, 오른쪽 ✕, 아래 구분선. */}
        <div className="flex shrink-0 items-center border-b border-ui-border p-4">
          <p className="font-roboto-latin flex h-7 items-center whitespace-nowrap text-lg font-bold leading-none text-ui-white">
            {/* 설정창 헤더 제목 앞의 막대와 같은 모양(청록 세로 막대)이다. */}
            <span aria-hidden="true" className="mr-[6px] inline-block h-5 w-1 shrink-0 rounded-sm bg-[var(--brand)]" />
            Screenshot
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="ml-auto shrink-0 border-0 bg-transparent text-xl text-ui-muted hover:text-[var(--brand)] focus-visible:text-[var(--brand)]"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col p-4">
        {displayPreviewSrc ? (
          <div className="relative max-w-full self-center overflow-hidden" style={fitWidth ? { width: fitWidth } : undefined}>
            <img
              src={displayPreviewSrc}
              alt="마켓 화면 미리보기"
              draggable={false}
              onLoad={e => {
                if (!highlightRegion) setPreviewRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)
              }}
              className="block h-auto w-full"
            />
            {highlightRegion && (
              <>
                <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <mask id="home-capture-selection-mask">
                      <rect width="100" height="100" fill="white" />
                      {headerSelections.map((region, index) => (
                        <rect key={index} x={region.left * 100} y={region.top * 100} width={region.width * 100} height={region.height * 100} fill="black" />
                      ))}
                      <rect x={highlightRegion.left * 100} y={highlightRegion.top * 100} width={highlightRegion.width * 100} height={highlightRegion.height * 100} fill="black" />
                    </mask>
                  </defs>
                  <rect width="100" height="100" fill="rgba(0,0,0,0.78)" mask="url(#home-capture-selection-mask)" />
                </svg>
                {headerSelections.map((region, index) => (
                  <div key={index} aria-hidden="true" className="capture-selection-outline pointer-events-none absolute" style={{ left: `${region.left * 100}%`, top: `${region.top * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />
                ))}
                <div
                  aria-hidden="true"
                  className="capture-selection-outline pointer-events-none absolute"
                  style={{ left: `${highlightRegion.left * 100}%`, top: `${highlightRegion.top * 100}%`, width: `${highlightRegion.width * 100}%`, height: `${highlightRegion.height * 100}%` }}
                />
              </>
            )}
          </div>
        ) : (
          <div
            className={`flex items-center justify-center self-center [container-type:size] ${fitWidth ? '' : 'h-[50dvh] w-[60vw]'}`}
            style={fitWidth && previewRatio ? { width: fitWidth, aspectRatio: previewRatio } : undefined}
          >
            <Spinner className="h-[min(20rem,90cqw,90cqh)] w-[min(20rem,90cqw,90cqh)]" showElapsed={!captureError} errorMessage={captureError ?? undefined} onRetry={captureError ? retryCapture : undefined} />
          </div>
        )}
        {/* 양끝 칸의 폭을 같게 유지해 문구 길이와 무관하게 복사 상태를 정중앙에 둔다.
            좁은 화면에서는 복사 상태 아래로 양끝 버튼을 내려 겹치지 않게 한다. */}
        <div className="mt-4 flex shrink-0 items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {frameCaptureOptions && (
              <button
                type="button"
                aria-label="전체 화면 캡처"
                aria-pressed={selectedCapture === null}
                onClick={() => selectCapture(null)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-0 p-1 transition-colors ${selectedCapture === null ? 'bg-brand-surface text-ui-white hover:bg-brand-surface-hover' : 'bg-ui-control text-ui-white hover:bg-ui-control-hover'}`}
              >
                <HomeFrameCaptureIcon selectedSlot="all" className="h-7 w-7 text-ui-white" />
              </button>
            )}
            {mobileRegionOption && (
              <>
                <button type="button" aria-pressed={selectedCapture === null} onClick={() => selectCapture(null)} className={selectedCapture === null ? BUTTON_ACCENT_CLASS : BUTTON_BASE_CLASS}>
                  <MonitorIcon className="h-4 w-4" />
                  모니터
                </button>
                <button type="button" aria-pressed={selectedCapture === 'mobile'} onClick={() => selectCapture('mobile')} className={selectedCapture === 'mobile' ? BUTTON_ACCENT_CLASS : BUTTON_BASE_CLASS}>
                  <SmartphoneIcon className="h-4 w-4" />
                  {mobileRegionOption.label}
                </button>
              </>
            )}
            {frameCaptureOptions?.map(option => {
              const active = selectedCapture === `frame:${option.id}`
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={`${option.label} 항목 캡처`}
                  aria-pressed={active}
                  onClick={() => selectCapture(`frame:${option.id}`)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-0 p-1 transition-colors ${active ? 'bg-brand-surface text-ui-white hover:bg-brand-surface-hover' : 'bg-ui-control text-ui-white hover:bg-ui-control-hover'}`}
                >
                  <HomeFrameCaptureIcon selectedSlot={option.selectedSlot} className="h-7 w-7 text-ui-white" />
                </button>
              )
            })}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* 복사는 자동으로 하지 않고 이 버튼으로만 한다. 공유는 대부분 붙여 넣는 용도라 이 버튼이 강조 버튼이다(청록). 글자는 다른 버튼과 같은 4글자로 고정하고,
                상태는 아이콘(복사 중=스피너, 완료=체크)으로 보여준다. 실패만 "복사실패"(4글자). */}
            <button
              type="button"
              onClick={() => onCopy(previewSrc)}
              disabled={!previewSrc || isCopying}
              className={copyLabel === 'Copied' ? BUTTON_ACCENT_CLASS : BUTTON_BASE_CLASS}
            >
              {isCopying ? <Spinner className="h-4 w-4" /> : copyLabel === 'Copied' ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
              {copyLabel === 'Copied' ? '복사완료' : copyLabel === 'Failed' ? '복사실패' : '클립보드'}
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

function regionOverlay(element: HTMLElement, selector: string, mode: 'element' | 'content', horizontalPadding = 0): { left: number; top: number; width: number; height: number } | null {
  const region = captureRegionRect(element, selector, mode)
  const size = fullScreenshotSize(element)
  const fullWidth = size.width + horizontalPadding * 2
  if (!region || fullWidth <= 0 || size.height <= 0) return null
  // 본문 점선은 원본 패널의 외곽선 안쪽에 둔다. content 범위의 3px 여유도 함께 걷어 낸다.
  const inset = 4
  const left = Math.max(0, Math.min(fullWidth, region.x + horizontalPadding + inset))
  const top = Math.max(0, Math.min(size.height, region.y + inset))
  const right = Math.max(left, Math.min(fullWidth, region.x + horizontalPadding + region.width - inset))
  const bottom = Math.max(top, Math.min(size.height, region.y + region.height - inset))
  return { left: left / fullWidth, top: top / size.height, width: (right - left) / fullWidth, height: (bottom - top) / size.height }
}

// 스크린샷으로 찍을 영역의 가로/세로 비율 — 아직 없거나 크기를 못 재면 null.
function elementRatio(element: HTMLElement | null, regionSelector: string | undefined, regionMode?: 'through-right-edge' | 'element' | 'content', horizontalPadding = 0): number | null {
  if (!element) return null
  const region = regionSelector ? captureRegionRect(element, regionSelector, regionMode) : null
  const size = region ?? fullScreenshotSize(element)
  const width = size.width + horizontalPadding * 2
  const { height } = size
  return width > 0 && height > 0 ? width / height : null
}
