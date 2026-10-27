import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const siteUrl = 'https://marketry.co.kr'

const pages: Record<string, { title: string; description: string }> = {
  '/guide/stock-heatmap': {
    title: '나만의 주식 시장 지도 만들기 | MARKETRY',
    description: '함께 움직이는 종목을 내 업종으로 묶고, 시가총액 비중을 조절해 대형주에 가려진 흐름을 살펴보세요. MARKETRY로 코스피·코스닥 시장을 내 기준으로 설계할 수 있습니다.',
  },
  '/home': {
    title: 'MARKETRY | 코스피·코스닥 주식 시장 지도',
    description: '코스피·코스닥 종목과 업종의 움직임을 시장 지도와 그래프로 살펴보세요. MARKETRY에서 관심 시장의 흐름을 한눈에 확인하고 업종 분류를 직접 설계할 수 있습니다.',
  },
  '/map/kospi': {
    title: '코스피 주식 히트맵·업종 지도 | MARKETRY',
    description: '코스피 종목의 등락과 업종별 흐름을 주식 히트맵으로 살펴보세요. 시가총액과 등락률을 기준으로 시장을 한눈에 비교할 수 있습니다.',
  },
  '/map/kosdaq': {
    title: '코스닥 주식 히트맵·업종 지도 | MARKETRY',
    description: '코스닥 종목의 등락과 업종별 흐름을 주식 히트맵으로 살펴보세요. 시가총액과 등락률을 기준으로 시장을 한눈에 비교할 수 있습니다.',
  },
  '/map/allstock': {
    title: '국내 주식 시장 히트맵 | MARKETRY',
    description: '코스피와 코스닥 종목을 함께 보는 국내 주식 시장 지도입니다. 업종과 종목의 등락 흐름을 히트맵으로 비교할 수 있습니다.',
  },
  '/graph/kospi': {
    title: '코스피 업종별 등락률 그래프 | MARKETRY',
    description: '코스피 업종별 등락률과 시장 흐름을 그래프로 비교해 보세요. 관심 업종의 움직임을 MARKETRY에서 살펴볼 수 있습니다.',
  },
  '/graph/kosdaq': {
    title: '코스닥 업종별 등락률 그래프 | MARKETRY',
    description: '코스닥 업종별 등락률과 시장 흐름을 그래프로 비교해 보세요. 관심 업종의 움직임을 MARKETRY에서 살펴볼 수 있습니다.',
  },
  '/graph/allstock': {
    title: '국내 주식 업종별 등락률 그래프 | MARKETRY',
    description: '코스피·코스닥 업종별 등락률을 한 화면에서 비교해 보세요. 국내 주식 시장의 업종별 흐름을 그래프로 살펴볼 수 있습니다.',
  },
}

function setMeta(property: string, value: string) {
  document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)?.setAttribute('content', value)
}

export default function SearchMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const page = pages[pathname]
    if (!page) {
      document.title = 'MARKETRY - Design Your Market'
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', '코스피·코스닥 종목을 업종별 시장 지도와 그래프로 살펴보는 MARKETRY입니다.')
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.removeAttribute('href')
      setMeta('og:title', 'MARKETRY - Design Your Market')
      setMeta('og:description', '코스피·코스닥 종목을 업종별 시장 지도와 그래프로 살펴보는 MARKETRY입니다.')
      setMeta('og:url', `${siteUrl}${pathname}`)
      return
    }
    const url = `${siteUrl}${pathname}`
    document.title = page.title
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', page.description)
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', url)
    setMeta('og:title', page.title)
    setMeta('og:description', page.description)
    setMeta('og:url', url)
  }, [pathname])

  return null
}
