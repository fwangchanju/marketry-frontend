// 확인창·알림창 뒤의 막힌 곳을 눌렀을 때 내는 짧은 "딩" 소리. 음원 파일 없이 Web Audio로 만든다(윈도우의 진짜 시스템 소리는 웹에서 낼 수 없어 비슷한 톤으로 만든다).
// 사용자가 누른 순간에 부르므로 브라우저의 자동재생 제한에 걸리지 않는다. 연타해도 시끄럽지 않게 BLOCKED_SOUND_GAP_MS에 한 번만 낸다.
const BLOCKED_SOUND_GAP_MS = 300
let audioContext: AudioContext | null = null
let lastPlayedAt = 0

export function playDialogBlockedSound(): void {
  const now = performance.now()
  if (now - lastPlayedAt < BLOCKED_SOUND_GAP_MS) return
  lastPlayedAt = now
  try {
    audioContext ??= new AudioContext()
    const context = audioContext
    if (context.state === 'suspended') void context.resume()
    const start = context.currentTime
    // 높은 음 하나가 길게 울리고(1175Hz) 위의 배음(2350Hz)이 짧게 같이 울리는 종소리 모양. 소리 크기는 작게(0.12) 시작해 0.25초에 걸쳐 사라진다.
    for (const [frequency, volume, length] of [[1175, 0.12, 0.25], [2350, 0.04, 0.12]] as const) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(volume, start)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + length)
    }
  } catch {
    // 소리를 못 내는 환경(오디오 장치 없음 등)에서는 흔들기만 한다.
  }
}
