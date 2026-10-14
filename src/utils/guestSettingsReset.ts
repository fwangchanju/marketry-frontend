// 비로그인이 바꾼 지도·그룹 설정은 새로고침(페이지를 처음 여는 것)하면 기본값으로 돌아간다 — 설정을 저장하는 것이 로그인의 장점이다.
// 비로그인의 설정은 이 탭의 sessionStorage에만 남으므로, 앱이 시작될 때 그 키들을 지운다. 로그인 사용자의 설정은 서버에 저장되고
// 세션 정보(auth.*)와 로컬 개발용 비로그인 확인 모드(dev.*)는 건드리지 않는다. 같은 탭 안에서 페이지를 옮기는 것은 새로고침이
// 아니므로 초기화되지 않는다.
const GUEST_SETTING_KEY_PREFIXES = ['treemap.', 'sectorChangeRate.']

export function resetGuestSettingsOnLoad(): void {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index)
      if (key && GUEST_SETTING_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) sessionStorage.removeItem(key)
    }
  } catch {
    // 프라이빗 모드 등으로 접근이 막혀도 화면 동작 자체는 계속되게 조용히 무시
  }
}
