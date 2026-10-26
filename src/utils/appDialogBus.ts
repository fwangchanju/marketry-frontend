export type AppDialogRequest = {
  id: number
  kind: 'alert' | 'confirm' | 'warning'
  message: string
  mutedMessage?: string
  followupMessage?: string
  title: string
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

// title: 종류 배지 오른쪽에 적는 제목. adminOnly: 운영자 전용 작업 — 창에 운영자 색 테두리·제목·⚠를 붙인다.
// 반환하는 Promise는 사용자가 정보창을 닫으면 끝난다 — 닫은 뒤에 할 일이 없으면 기다리지 않아도 된다.
export function appAlert(message: string, options: { title: string; adminOnly?: boolean }): Promise<void> {
  return new Promise(resolve => enqueue({ kind: 'alert', message, title: options.title, adminOnly: options.adminOnly, resolve: () => resolve() }))
}

export function appConfirm(message: string, options: { title: string; adminOnly?: boolean; mutedMessage?: string; followupMessage?: string }): Promise<boolean> {
  return new Promise(resolve => enqueue({ kind: 'confirm', message, mutedMessage: options.mutedMessage, followupMessage: options.followupMessage, title: options.title, adminOnly: options.adminOnly, resolve }))
}

export function appWarnConfirm(message: string, options: { title: string; adminOnly?: boolean; mutedMessage?: string; followupMessage?: string }): Promise<boolean> {
  return new Promise(resolve => enqueue({ kind: 'warning', message, mutedMessage: options.mutedMessage, followupMessage: options.followupMessage, title: options.title, adminOnly: options.adminOnly, resolve }))
}

export function resolveCurrentAppDialog(confirmed: boolean) {
  const [current, ...remaining] = queue
  if (!current) return
  queue = remaining
  current.resolve?.(confirmed)
  notify()
}
