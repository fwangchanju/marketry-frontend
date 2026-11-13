// 뉴욕 증시 세션. 이름은 한국 증시 세션 칩과 같다. 미국 화면은 마감 값만 하루 한 번 저장하므로 지금 보이는 세션은 늘 '마켓 종료'이고,
// 안내창의 시간표만 한국 칩처럼 보여 준다(세션을 실제로 따라가지는 않는다).
// 시각은 모두 뉴욕 현지 기준이고, 저장된 시각(snapshotTime)도 현지 마감 16:00이다.
export type UsaSession = '프리 마켓' | '메인 마켓' | '애프터 마켓' | '마켓 종료'

export const USA_SESSION: UsaSession = '마켓 종료'

export const USA_SESSION_GUIDE: readonly { session: UsaSession; range: string }[] = [
  { session: '프리 마켓', range: '04:00~09:30' },
  { session: '메인 마켓', range: '09:30~16:00' },
  { session: '애프터 마켓', range: '16:00~20:00' },
]

const pad = (value: number) => String(value).padStart(2, '0')

// 그 날짜의 현지 마감 16:00이 한국 시각으로 몇 시인지. 서머타임이면 05:00, 아니면 06:00이고 둘 다 다음 날이다.
export function usaCloseInKst(date: string): { time: string; nextDay: boolean } {
  const [year, month, day] = date.split('-').map(Number)
  const newYorkHourAt = (utcHour: number) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }).format(new Date(Date.UTC(year, month - 1, day, utcHour))))
  const utcHour = newYorkHourAt(20) === 16 ? 20 : 21
  return { time: `${pad((utcHour + 9) % 24)}:00`, nextDay: utcHour + 9 >= 24 }
}

// 새로고침 칸에 마우스를 올리면 보이는 안내. 현지 마감이 한국 시간으로 몇 시인지 먼저 알린다.
export function usaRefreshHelp(snapshotTime: string | null): string {
  const kst = snapshotTime ? usaCloseInKst(snapshotTime.slice(0, 10)) : null
  const lines = [
    ...(kst ? [`한국 시간으로 ${kst.nextDay ? '다음 날 ' : ''}${kst.time}에 마감됩니다.`] : []),
    '하루 한 번 갱신됩니다.',
    '마감 후 10분쯤 뒤에 반영됩니다.',
  ]
  return lines.join('\n')
}
