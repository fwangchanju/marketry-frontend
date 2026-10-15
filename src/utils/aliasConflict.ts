// 약칭이 다른 종목의 이름이나 약칭과 같으면 지도에서 서로 다른 종목이 같은 이름으로 보여 오해를 낳는다(예: 381970 KG모빌리티플랫폼의 약칭이 003620 KG모빌리티와 같음).
// 저장하기 전에 표 전체와 견줘 겹치는 종목을 찾는다. 대소문자와 공백은 무시하고, 자기 자신의 이름·약칭과 같은 것은 겹침으로 보지 않는다.
interface AliasCheckItem {
  stockCode: string
  stockName: string
  alias?: string | null
}

const normalize = (text: string) => text.replace(/\s+/g, '').toLowerCase()

// 겹치는 다른 종목을 "코드 이름" 형태로 돌려주고, 겹치지 않으면 null이다.
export function findAliasConflict(items: readonly AliasCheckItem[], stockCode: string, alias: string): string | null {
  const target = normalize(alias)
  if (!target) return null
  for (const item of items) {
    if (item.stockCode === stockCode) continue
    if (normalize(item.stockName) === target) return `${item.stockCode} ${item.stockName}`
    if (item.alias && normalize(item.alias) === target) return `${item.stockCode} ${item.stockName} (약칭 ${item.alias})`
  }
  return null
}
