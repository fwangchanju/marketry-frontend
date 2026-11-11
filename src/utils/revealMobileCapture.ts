// keepPageLabel: K-STOCK 배지 위의 페이지 라벨(MAP)을 남긴다(텔레그램 판·스크린샷 창 모두, 홈 판의 HOME과 같은 모양). false를 주면 숨긴다.
export function revealMobileCapture(cloned: Node, keepPageLabel = true) {
  if (!(cloned instanceof Element)) return
  const mobileFrame = cloned.querySelector<HTMLElement>('[data-map-mobile-capture-frame]')
  if (mobileFrame) mobileFrame.style.opacity = '1'
  const mobileCapture = cloned.querySelector<HTMLElement>('[data-map-mobile-capture]')
  if (mobileCapture) mobileCapture.style.opacity = '1'
  const toolbarLeft = cloned.querySelector<HTMLElement>('.main-toolbar > div:first-child')
  const toolbarRight = cloned.querySelector<HTMLElement>('.main-toolbar > div:last-child')
  if (mobileCapture && toolbarLeft) {
    const toolbar = document.createElement('div')
    toolbar.className = 'main-toolbar home-capture-toolbar relative mt-[3px] mb-0 flex h-7 w-full shrink-0 items-center overflow-hidden bg-ui-background/70 text-sm font-bold text-ui-white'
    // 복제본에 새로 넣는 요소는 클래스 스타일이 적용되지 않으므로 홈 판 툴바와 같은 위치·정렬은 인라인으로 준다.
    toolbar.style.marginTop = '3px'
    toolbar.style.height = '28px'
    toolbar.style.alignItems = 'center'
    const leftContent = toolbarLeft.cloneNode(true) as HTMLElement
    leftContent.style.minWidth = '0'
    leftContent.style.overflow = 'hidden'
    // 화면·브라우저 캡처·DOM 이미지 복제에서 첫 배지 폭을 동일하게 유지한다.
    // 복제 후 새 툴바에 끼운 노드는 .home-capture-toolbar 규칙이 이미지 렌더러에 적용되지 않을 수 있다.
    const modeBadge = leftContent.querySelector<HTMLElement>('.toolbar-mode-badge')
    if (modeBadge) {
      modeBadge.style.width = '100px'
      modeBadge.style.minWidth = '100px'
      modeBadge.style.maxWidth = '100px'
    }
    // 복제본은 버튼 크기·배치를 유지하되 항상 시계·시간을 표시한다. 원본 버튼의 호버·갱신 상태가
    // 캡처 스타일에 남으면 새로고침 아이콘만 찍힐 수 있다.
    const refreshButton = leftContent.querySelector<HTMLElement>('.nav-refresh-button')
    if (refreshButton) {
      const clockLabel = refreshButton.querySelector<HTMLElement>(':scope > span:first-child')
      if (clockLabel) {
        const staticClock = clockLabel.cloneNode(true) as HTMLElement
        staticClock.removeAttribute('aria-hidden')
        staticClock.classList.remove('invisible', 'group-hover/refresh:invisible', 'group-focus-visible/refresh:invisible')
        staticClock.querySelectorAll<HTMLElement>('.invisible').forEach(node => node.classList.remove('invisible'))
        refreshButton.replaceChildren(staticClock)
      }
      refreshButton.classList.remove('group/refresh')
      refreshButton.classList.remove('cursor-pointer')
      refreshButton.style.pointerEvents = 'none'
    }
    // 모바일 캡처에서는 종가·합산·별도 중 현재 기준만 남기고, 세 버튼 중 첫 칸에 둔다.
    const changeRateSelector = leftContent.querySelector<HTMLElement>('[data-change-rate-selector]')
    const changeRateButton = changeRateSelector?.querySelector<HTMLButtonElement>('[data-change-rate-mode]')
    if (changeRateButton && changeRateSelector) {
      leftContent.querySelector('[aria-label="등락률 기준 선택"]')?.remove()
      // 지금 툴바의 칩 모양 그대로 두고 메뉴 동작만 뺀다.
      changeRateButton.removeAttribute('aria-expanded')
      changeRateButton.removeAttribute('aria-haspopup')
      changeRateButton.style.pointerEvents = 'none'
      changeRateButton.style.transition = 'none'
    }
    // 모바일 캡처에서는 K-STOCK과 겹치지 않도록 MAP 페이지 라벨을 숨긴다.
    if (keepPageLabel) {
      // 라벨이 툴바 위쪽으로 살짝 걸쳐 있어 잘리지 않게 한다.
      toolbar.style.overflow = 'visible'
      leftContent.style.overflow = 'visible'
    } else {
      leftContent.querySelector('.font-roboto-latin > span.absolute')?.remove()
    }
    toolbar.append(leftContent)
    if (toolbarRight) {
      const rightContent = toolbarRight.cloneNode(true) as HTMLElement
      rightContent.style.minWidth = 'max-content'
      rightContent.style.width = 'max-content'
      rightContent.style.maxWidth = 'none'
      rightContent.style.flexShrink = '0'
      rightContent.style.overflow = 'visible'
      const badgeWrapper = rightContent.firstElementChild as HTMLElement | null
      if (badgeWrapper) {
        badgeWrapper.style.width = 'max-content'
        badgeWrapper.style.minWidth = 'max-content'
        badgeWrapper.style.maxWidth = 'none'
      }
      rightContent.querySelectorAll<HTMLElement>('.toolbar-badge, .toolbar-badge > span, .toolbar-badge .truncate').forEach(node => {
        node.style.minWidth = 'max-content'
        node.style.maxWidth = 'none'
        node.style.overflow = 'visible'
        node.style.textOverflow = 'clip'
      })
      toolbar.style.display = 'grid'
      toolbar.style.gridTemplateColumns = 'minmax(0, 1fr) max-content'
      toolbar.style.columnGap = '4px'
      leftContent.style.width = '100%'
      leftContent.style.minWidth = '0'
      toolbar.append(rightContent)
    }
    mobileCapture.querySelector('[data-map-mobile-toolbar-placeholder]')?.replaceWith(toolbar)

    // 캡처 폭에 따라 flex 레이아웃이나 이미지 변환 과정에서 각 칩의 높이가 달라 보이지 않도록
    // 화면 툴바와 같은 높이를 인라인으로 고정한다. 배지는 폭이 좁아도 줄어들지 않는다.
    toolbar.querySelectorAll<HTMLElement>('.toolbar-badge, .toolbar-badge-control, [data-toolbar-session-chip]').forEach(badge => {
      badge.style.boxSizing = 'border-box'
      badge.style.height = '26.25px'
      badge.style.minHeight = '26.25px'
      badge.style.maxHeight = '26.25px'
      badge.style.flexShrink = '0'
    })
  }
}

