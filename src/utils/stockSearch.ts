// 종목 검색 매칭 — 대소문자·공백을 무시하고, 검색어의 자음(ㄱ~ㅎ)은 한글 글자의 초성으로 찾는다. 'ㅎㄷ'처럼 자음만 쳐도, 'hdㅎㄷ'처럼 영문과 섞어 쳐도 된다.
// 쉼표로 여러 검색어를 이어 쓰면 하나라도 맞는 행을 모두 찾는다.
const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, '')

function choseongOf(char: string): string {
  const code = char.charCodeAt(0)
  return code >= HANGUL_START && code <= HANGUL_END ? CHOSEONG[Math.floor((code - HANGUL_START) / 588)] : char
}

// 검색어 글자와 본문 글자를 한 칸씩 견준다 — 검색어가 자음이면 본문 글자의 초성과, 아니면 글자 그대로 견준다.
function includesWithChoseong(text: string, needleChars: readonly string[]): boolean {
  const chars = Array.from(text)
  for (let start = 0; start + needleChars.length <= chars.length; start++) {
    if (needleChars.every((needleChar, offset) => (CHOSEONG.includes(needleChar) ? choseongOf(chars[start + offset]) : chars[start + offset]) === needleChar)) return true
  }
  return false
}

// 한 행에서 검색에 쓸 값 — 종목명·코드는 항상, 약칭과 분류명은 있는 것만 넘긴다.
export interface StockSearchFields {
  name: string
  code: string
  alias?: string | null
  labels?: readonly (string | null | undefined)[]
}

function createSingleMatcher<T>(query: string, fieldsOf: (row: T) => StockSearchFields): (row: T) => boolean {
  const needle = normalize(query)
  const needleChars = Array.from(needle)
  const hasChoseong = needleChars.some(char => CHOSEONG.includes(char))
  const matches = (text: string) => {
    const value = normalize(text)
    return hasChoseong ? includesWithChoseong(value, needleChars) : value.includes(needle)
  }
  return row => {
    const { name, code, alias, labels } = fieldsOf(row)
    return code.toLowerCase().includes(needle) || matches(name) || (alias != null && matches(alias)) || (labels ?? []).some(label => label != null && matches(label))
  }
}

// 쉼표(,)로 여러 검색어를 이어 쓰면 하나라도 맞는 행을 모두 찾는다(예: '5801,5019,6724'). 쉼표가 없으면 이전과 같고,
// 끝에 쉼표만 남은 입력('5801,')이나 빈 검색어는 남은 검색어 하나(없으면 전체)로 본다.
// 종목 검색창의 입력 길이 한도 — 쉼표로 여러 검색어를 이어 쓸 수 있게 업종 검색창(12글자)보다 넉넉하다.
export const STOCK_SEARCH_MAX_LENGTH = 100

export function createStockMatcher<T>(query: string, fieldsOf: (row: T) => StockSearchFields): (row: T) => boolean {
  const terms = query.split(/[,，]/).map(term => term.trim()).filter(term => term !== '')
  if (terms.length <= 1) return createSingleMatcher(terms[0] ?? '', fieldsOf)
  const matchers = terms.map(term => createSingleMatcher(term, fieldsOf))
  return row => matchers.some(matcher => matcher(row))
}
