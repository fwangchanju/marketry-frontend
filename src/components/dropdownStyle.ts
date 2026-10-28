// 드롭다운(버튼을 눌러 그 아래에 뜨는 목록 창)의 공통 규격이다. 모양·간격은 docs/ui-areas.md의 "드롭다운 규칙"을 따른다.
// 창마다 클래스를 따로 적으면 조금씩 어긋나므로, 새 드롭다운도 이 값을 가져다 쓴다.

// 여는 버튼(눈에 보이는 버튼)과 창 사이 간격. 바탕색이 같아 붙으면 구분이 안 된다.
export const DROPDOWN_GAP_PX = 4

// 창 틀: 바탕·테두리·모서리·그림자·글자색. 위아래 안쪽 여백은 두지 않으므로 넘침 처리(`overflow-hidden` 또는 `overflow-y-auto`)는 쓰는 쪽에서 붙인다.
export const DROPDOWN_PANEL_CLASS = 'rounded-md border border-ui-border bg-[var(--ui-panel)] text-ui-white shadow-xl'

// 항목: 창 끝까지 닿는 직각 줄, 좌우 12px, 올리거나 포커스가 오면 흰색 10%.
export const DROPDOWN_ITEM_CLASS = 'rounded-none border-0 px-3 transition-colors hover:bg-ui-white/10 focus-visible:bg-ui-white/10'

// 스크롤되는 목록: 항목 단위로 멈추고(snap) 목록 높이를 항목 수의 정수배로 맞춰, 어느 위치에서 멈춰도 반쯤 잘린 항목이 남지 않게 한다.
// 목록 컨테이너에 DROPDOWN_SCROLL_CLASS와 `style={{ maxHeight: dropdownListMaxHeight(보일 항목 수) }}`를, 각 항목에 DROPDOWN_SNAP_ITEM_CLASS를 붙인다.
export const DROPDOWN_SCROLL_CLASS = 'snap-y snap-mandatory overflow-y-auto'
export const DROPDOWN_SNAP_ITEM_CLASS = 'snap-start'

// 항목 한 줄 높이(px). 분류 필터처럼 항목이 다른 높이를 쓰면 rowPx로 넘긴다.
export const DROPDOWN_ROW_PX = 25

// 항목 rows개가 딱 보이는 목록 높이. 목록 컨테이너 자체에 테두리가 있으면(창이 곧 목록인 경우) borderPx에 위아래 합계(2)를 넘긴다.
export function dropdownListMaxHeight(rows: number, rowPx: number = DROPDOWN_ROW_PX, borderPx = 0): number {
  return rows * rowPx + borderPx
}

