// 설정 저장 규칙: 비로그인 사용자는 어떤 설정도 저장하지 않는다(브라우저에도, 서버에도). 로그인한 사용자만 이 브라우저(localStorage)에 화면 취향을 남긴다.
// 로그인 여부는 세션 응답이 와야 안다. 응답이 오기 전에는 "읽기만" 허용해서, 로그인한 사용자가 저장해 둔 값이 첫 화면에서 기본값으로 번쩍이지 않게 한다.
// 쓰기는 로그인이 확인된 뒤에만 한다.
let sessionKnown = false
let loggedIn = false
let version = 0
const listeners = new Set<() => void>()

export function setSettingsStorageGate(authenticated: boolean): void {
  if (sessionKnown && loggedIn === authenticated) return
  sessionKnown = true
  loggedIn = authenticated
  version += 1
  listeners.forEach(listener => listener())
}

export const canReadSettingsStorage = (): boolean => !sessionKnown || loggedIn
export const canWriteSettingsStorage = (): boolean => sessionKnown && loggedIn

// 로그인 여부가 확인되거나 바뀔 때 알린다(화면이 저장값을 다시 읽거나 기본값으로 돌아가게 한다).
export function subscribeSettingsStorageGate(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getSettingsStorageGateVersion = (): number => version

// 로그인한 사용자의 값만 읽는다. 못 읽거나 비로그인이면 null이다.
export function readSettingStorage(key: string): string | null {
  if (!canReadSettingsStorage()) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// 로그인한 사용자의 값만 저장한다. 비로그인이면 저장하지 않는다(화면 안의 값은 호출한 쪽이 메모리로 계속 쓴다).
export function writeSettingStorage(key: string, value: string): void {
  if (!canWriteSettingsStorage()) return
  try {
    localStorage.setItem(key, value)
  } catch {
    // 저장이 막혀도 화면 동작은 계속되게 조용히 무시
  }
}
