// 종목 검색 매칭 — 대소문자·공백을 무시하고, 검색어가 자음만이면 종목명의 초성으로 찾는다.
const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, '')

function toChoseong(text: string): string {
  let result = ''
  for (const char of text) {
    const code = char.charCodeAt(0)
    result += code >= HANGUL_START && code <= HANGUL_END ? CHOSEONG[Math.floor((code - HANGUL_START) / 588)] : char
  }
  return result
}

const isChoseongOnly = (text: string) => text.length > 0 && [...text].every(char => CHOSEONG.includes(char))

// 한 행에서 검색에 쓸 값 — 종목명·코드는 항상, 약칭과 분류명은 있는 것만 넘긴다.
export interface StockSearchFields {
  name: string
  code: string
  alias?: string | null
  labels?: readonly (string | null | undefined)[]
}

export function createStockMatcher<T>(query: string, fieldsOf: (row: T) => StockSearchFields): (row: T) => boolean {
  const needle = normalize(query)
  const byChoseong = isChoseongOnly(needle)
  const matches = (text: string) => {
    const value = normalize(text)
    return value.includes(needle) || (byChoseong && toChoseong(value).includes(needle))
  }
  return row => {
    const { name, code, alias, labels } = fieldsOf(row)
    return code.includes(needle) || matches(name) || (alias != null && matches(alias)) || (labels ?? []).some(label => label != null && matches(label))
  }
}
