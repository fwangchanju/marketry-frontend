export type AppDialogRequest = {
  id: number
  kind: 'alert' | 'confirm' | 'warning'
  message: string
  mutedMessage?: string
  followupMessage?: string
  title: string
  // 입력칸이 있는 창 — 확인하면 적은 글자(앞뒤 공백 제외)가 resolve의 둘째 값으로 간다.
  input?: { placeholder: string; maxLength: number }
  resolve?: (confirmed: boolean, value?: string) => void
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

// title: 종류 배지 오른쪽에 적는 제목.
// 반환하는 Promise는 사용자가 정보창을 닫으면 끝난다 — 닫은 뒤에 할 일이 없으면 기다리지 않아도 된다.
export function appAlert(message: string, options: { title: string }): Promise<void> {
  return new Promise(resolve => enqueue({ kind: 'alert', message, title: options.title, resolve: () => resolve() }))
}

export function appConfirm(message: string, options: { title: string; mutedMessage?: string; followupMessage?: string }): Promise<boolean> {
  return new Promise(resolve => enqueue({ kind: 'confirm', message, mutedMessage: options.mutedMessage, followupMessage: options.followupMessage, title: options.title, resolve }))
}

export function appWarnConfirm(message: string, options: { title: string; mutedMessage?: string; followupMessage?: string }): Promise<boolean> {
  return new Promise(resolve => enqueue({ kind: 'warning', message, mutedMessage: options.mutedMessage, followupMessage: options.followupMessage, title: options.title, resolve }))
}

// 확인 전에 한 줄 메모를 적을 수 있는 주의 창 — 비워 두어도 확인할 수 있다(value는 빈 글자).
export function appWarnConfirmWithInput(
  message: string,
  options: { title: string; mutedMessage?: string; placeholder: string; maxLength: number },
): Promise<{ confirmed: boolean; value: string }> {
  return new Promise(resolve => enqueue({
    kind: 'warning',
    message,
    mutedMessage: options.mutedMessage,
    title: options.title,
    input: { placeholder: options.placeholder, maxLength: options.maxLength },
    resolve: (confirmed, value) => resolve({ confirmed, value: value ?? '' }),
  }))
}

export function resolveCurrentAppDialog(confirmed: boolean, value?: string) {
  const [current, ...remaining] = queue
  if (!current) return
  queue = remaining
  current.resolve?.(confirmed, value)
  notify()
}
