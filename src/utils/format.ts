// 문장 구분마다 쓰는 탭 간격 — 일반 공백은 렌더링 시 하나로 뭉개지므로, non-breaking space 4개로
// tab처럼 보이는 간격을 낸다.
export const TAB_GAP = ' '

/** 소수점 1자리 + 천 단위 콤마 */
const withCommas1 = (value: number): string =>
  value.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** 퍼센트 포맷 (기본 소수점 2자리, 부호 포함) — decimalPlaces는 지도 페이지의 "소수점 아래 표시"
 * 설정처럼 호출부가 자릿수를 바꿔야 할 때만 넘긴다. 안 넘기면 기존과 동일하게 2자리. */
export const toPctSigned = (value: number, decimalPlaces = 2): string => {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimalPlaces)}%`
}

// TODO: 아래 날짜/시간 포맷터들은 백엔드가 항상 고정 자릿수 ISO 문자열(LocalDate/LocalDateTime)을
// 보낸다는 전제로 slice 기반으로 짜여있음. 요일 표시, 로케일별 포맷 등 더 복잡한 표기가 필요해지면
// new Date(iso) + Intl.DateTimeFormat 기반으로 전환할 것.

/** LocalDateTime(ISO) → 'MM/DD HH:mm' */
export const toDateTimeLabel = (iso: string | null): string => {
  if (!iso) return '-'
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/** LocalDateTime(ISO) → 'yyyy-MM-dd (요일)' — 마켓맵 상단 스냅샷 시각 전용 표기 중 날짜 부분.
 * 시간 부분(toSnapshotTimeOnlyLabel)과 따로 둬서 그 사이에 시계 아이콘을 끼워 넣을 수 있게 한다. */
export const toSnapshotDateLabel = (iso: string | null): string => {
  if (!iso) return '-'
  const weekday = WEEKDAY_KO[new Date(iso).getDay()]
  return `${iso.slice(0, 10)} (${weekday})`
}

/** LocalDateTime(ISO) → 'HH:mm (5분 간격)' — 마켓맵 상단 스냅샷 시각 전용 표기 중 시간 부분. */
export const toSnapshotTimeOnlyLabel = (iso: string | null): string => {
  if (!iso) return '-'
  return iso.slice(11, 16)
}

/** 데이터를 못 받았을 때 상단 시각 자리를 같은 폭으로 잡아 두기 위한 견본 시각(화면에는 보이지 않게 숨겨서 쓴다). */
export const MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO = '2026-10-05T12:00:00'

/** 거래량 포맷 (천 단위 콤마) */
export const toVolume = (value: number): string =>
  value.toLocaleString('ko-KR')

/** 정수 개수 표시(천 단위 구분 기호 포함) */
export const toCount = (value: number): string => value.toLocaleString('ko-KR')

/** 억 원 단위 값을 '조 단위 콤마 억' 형태로 포맷 (예: 12942675 → '1,294조 2,675억') */
export const toJoEok = (eokValue: number): string => {
  const rounded = Math.round(eokValue)
  const jo = Math.floor(rounded / 10_000)
  const eok = rounded % 10_000
  if (jo === 0) return `${eok.toLocaleString('ko-KR')}억`
  return `${jo.toLocaleString('ko-KR')}조 ${eok.toLocaleString('ko-KR')}억`
}

/** 억 원 단위 값을 십억 단위 반올림 후 '조/억' 소수 1자리와 천 단위 콤마로 포맷 (예: 12942675 → '1,294.3조') */
export const toJoEokDecimal = (eokValue: number): string => {
  const roundedToSipEok = Math.round(eokValue / 10) * 10
  if (roundedToSipEok >= 10_000) return `${withCommas1(roundedToSipEok / 10_000)}조`
  return `${withCommas1(roundedToSipEok)}억`
}
