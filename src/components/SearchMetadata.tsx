import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import pages from '@/utils/searchMetadata.json'

const siteUrl = 'https://marketry.co.kr'

function setMeta(property: string, value: string) {
  document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)?.setAttribute('content', value)
}

export default function SearchMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const page = (pages as Record<string, { title: string; description: string; canonicalPath?: string }>)[pathname]
    if (!page) {
      document.title = 'MARKETRY - Design Your Market'
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', '코스피·코스닥 종목을 업종별 시장 지도와 그래프로 살펴보는 MARKETRY입니다.')
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.removeAttribute('href')
      setMeta('og:title', 'MARKETRY - Design Your Market')
      setMeta('og:description', '코스피·코스닥 종목을 업종별 시장 지도와 그래프로 살펴보는 MARKETRY입니다.')
      setMeta('og:url', `${siteUrl}${pathname}`)
      return
    }
    const url = `${siteUrl}${page.canonicalPath ?? pathname}`
    document.title = page.title
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', page.description)
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', url)
    setMeta('og:title', page.title)
    setMeta('og:description', page.description)
    setMeta('og:url', url)
  }, [pathname])

  return null
}
