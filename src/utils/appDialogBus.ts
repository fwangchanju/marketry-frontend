export type AppDialogRequest = {
  id: number
  kind: 'alert' | 'confirm'
  message: string
  adminOnly?: boolean
  resolve?: (confirmed: boolean) => void
}

let queue: AppDialogRequest[] = []
let nextId = 0
const subscribers = new Set<() => void>()

function notify() {
  subscribers.forEach(subscriber => subscriber())
}

export function subscribeAppDialogs(subscriber: () => void) {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export function getCurrentAppDialog() {
  return queue[0] ?? null
}

function enqueue(request: Omit<AppDialogRequest, 'id'>) {
  queue = [...queue, { ...request, id: ++nextId }]
  notify()
}

// adminOnly: 운영자 전용 작업 — 창에 경고색과 "ADMIN 전용" 띠를 붙인다.
// 반환하는 Promise는 사용자가 안내창을 닫으면 끝난다 — 닫은 뒤에 할 일이 없으면 기다리지 않아도 된다.
export function appAlert(message: string, options?: { adminOnly?: boolean }): Promise<void> {
  return new Promise(resolve => enqueue({ kind: 'alert', message, adminOnly: options?.adminOnly, resolve: () => resolve() }))
}

export function appConfirm(message: string, options?: { adminOnly?: boolean }): Promise<boolean> {
  return new Promise(resolve => enqueue({ kind: 'confirm', message, adminOnly: options?.adminOnly, resolve }))
}

export function resolveCurrentAppDialog(confirmed: boolean) {
  const [current, ...remaining] = queue
  if (!current) return
  queue = remaining
  current.resolve?.(confirmed)
  notify()
}
