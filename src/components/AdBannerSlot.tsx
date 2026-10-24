import { useLayoutEffect, useState, type ReactNode } from 'react'

// 광고 배너 자리 — 상단 로고 줄과 메뉴 줄(Home·Map·Graph·Custom) 가운데의 빈 곳에 겹쳐 놓는다. 상단 바 높이는 키우지 않는다.
// 화면 맨 위에 붙이고, 가능하면 화면 가운데에 둔다(설정창이 왼쪽·오른쪽 어디에 있든 같은 자리).
// 메뉴(관리자는 Admin까지 5개)나 오른쪽 프로필 묶음에 걸리면 이 순서로 줄여 본다:
//  1) 가운데에서 빈 칸 안쪽으로 밀기  2) 메뉴 글자 앞 아이콘을 숨겨 메뉴 폭 줄이기  3) 작은 규격으로 바꾸기. 어느 것으로도 안 들어갈 때만 숨긴다.
// 메뉴 끝과 프로필 묶음 시작은 화면에서 실제로 재서 쓴다. 광고 크기·규격을 바꿀 때는 아래 값만 고친다.
export interface AdBannerSize {
  width: number
  height: number
}
const AD_BANNER_SIZES: AdBannerSize[] = [
  { width: 728, height: 90 },
  { width: 468, height: 60 },
]
// 배너와 메뉴·프로필 묶음 사이의 최소 간격.
const GAP = 16
// 아직 재지 못했을 때(첫 그림) 쓰는 값 — 메뉴 4개 끝(300px)과 프로필 묶음 폭(130px), 메뉴 아이콘 한 개가 차지하는 폭(아이콘 18px + 글자와의 간격 4.5px).
const FALLBACK_MENU_RIGHT = 300
const FALLBACK_ACCOUNT_WIDTH = 130
const FALLBACK_ICON_SPACE = 22.5
const COMPACT_ATTRIBUTE = 'data-nav-compact'

interface Layout {
  screenWidth: number
  // 메뉴 아이콘을 보일 때와 숨길 때의 메뉴 끝 위치.
  menuRightWithIcons: number
  menuRightWithoutIcons: number
  accountLeft: number
}

let iconSpace = FALLBACK_ICON_SPACE

function measure(): Layout {
  const screenWidth = window.innerWidth
  const menus = document.querySelector<HTMLElement>('[data-nav-menus]')
  const account = document.querySelector<HTMLElement>('[data-account-area]')
  const accountLeft = account ? account.getBoundingClientRect().left : screenWidth - FALLBACK_ACCOUNT_WIDTH
  if (!menus) return { screenWidth, menuRightWithIcons: FALLBACK_MENU_RIGHT, menuRightWithoutIcons: FALLBACK_MENU_RIGHT - 4 * iconSpace, accountLeft }
  const isCompact = document.documentElement.hasAttribute(COMPACT_ATTRIBUTE)
  const icon = menus.querySelector<SVGElement>('svg')
  // 아이콘이 보일 때만 한 개가 차지하는 폭(아이콘 + 간격)을 새로 잰다. 숨겨져 있으면 마지막으로 잰 값을 쓴다.
  if (!isCompact && icon) {
    const gap = parseFloat(getComputedStyle(icon.parentElement ?? icon).columnGap)
    iconSpace = icon.getBoundingClientRect().width + (Number.isNaN(gap) ? 0 : gap)
  }
  const iconTotal = menus.children.length * iconSpace
  const measuredRight = menus.getBoundingClientRect().right
  return isCompact
    ? { screenWidth, menuRightWithIcons: measuredRight + iconTotal, menuRightWithoutIcons: measuredRight, accountLeft }
    : { screenWidth, menuRightWithIcons: measuredRight, menuRightWithoutIcons: measuredRight - iconTotal, accountLeft }
}

interface Placement {
  size: AdBannerSize
  left: number
  hideMenuIcons: boolean
}

// 큰 규격부터, 같은 규격이면 아이콘을 보이는 쪽부터 차례로 보고 빈 칸(메뉴 끝 + 간격 ~ 프로필 시작 - 간격)에 들어가는 첫 경우를 돌려준다. 가운데가 안 맞으면 빈 칸 안쪽으로 민다.
function place({ screenWidth, menuRightWithIcons, menuRightWithoutIcons, accountLeft }: Layout): Placement | null {
  const zoneRight = accountLeft - GAP
  for (const size of AD_BANNER_SIZES) {
    for (const hideMenuIcons of [false, true]) {
      const left = Math.max((screenWidth - size.width) / 2, (hideMenuIcons ? menuRightWithoutIcons : menuRightWithIcons) + GAP)
      if (left + size.width <= zoneRight) return { size, left, hideMenuIcons }
    }
  }
  return null
}

// children은 들어간 규격을 받아 광고를 그린다. 광고가 없으면(null) 아무것도 그리지 않는다 — 숨긴 채로 불러오지 않는다.
export default function AdBannerSlot({ children }: { children: (size: AdBannerSize) => ReactNode }) {
  const [layout, setLayout] = useState<Layout>(() => measure())
  useLayoutEffect(() => {
    const update = () => setLayout(measure())
    update()
    window.addEventListener('resize', update)
    // 로그인 상태가 바뀌면 메뉴(Admin)와 프로필 묶음 폭이 달라지고, 아이콘을 숨기면 메뉴 폭이 줄어드므로 두 칸의 크기 변화도 따라간다.
    const observer = new ResizeObserver(update)
    document.querySelectorAll('[data-nav-menus], [data-account-area]').forEach(element => observer.observe(element))
    return () => {
      window.removeEventListener('resize', update)
      observer.disconnect()
      document.documentElement.removeAttribute(COMPACT_ATTRIBUTE)
    }
  }, [])
  const placed = place(layout)
  const content = placed ? children(placed.size) : null
  // 아이콘은 배너가 실제로 그려질 때만 숨긴다.
  const hideMenuIcons = Boolean(placed && content && placed.hideMenuIcons)
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute(COMPACT_ATTRIBUTE, hideMenuIcons)
  }, [hideMenuIcons])
  if (!placed || !content) return null
  return (
    // 메뉴 줄(z-30)보다 위에 둬서 가려지지 않게 한다. 상단 바 안에 두면 상단 바의 쌓임 순서(z-20)에 갇혀 메뉴 줄 뒤로 숨는다.
    <div data-ad-banner-slot={`${placed.size.width}x${placed.size.height}`} className="fixed top-0 z-[35] overflow-hidden" style={{ left: placed.left, width: placed.size.width, height: placed.size.height }}>
      {content}
    </div>
  )
}
