import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import pages from '@/utils/searchMetadata.json'
import { pageTitle } from '@/utils/pageTitles'
import { isNoIndexPath } from '@/utils/searchIndexing'

const siteUrl = 'https://marketry.co.kr'

function setMeta(property: string, value: string) {
  document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)?.setAttribute('content', value)
}

export default function SearchMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    // 관리자·프로필은 검색에 노출하지 않는다(robots 메타). 다른 화면으로 옮기면 표시를 지운다.
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (isNoIndexPath(pathname)) {
      const tag = robots ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }))
      tag.setAttribute('content', 'noindex, nofollow')
    } else {
      robots?.remove()
    }
    const page = (pages as Record<string, { title: string; description: string; canonicalPath?: string }>)[pathname]
    if (!page) {
      // 검색에 등록된 주소가 아니어도 화면마다 탭 제목이 다르다(규칙은 pageTitles.ts). 규칙에 없는 주소는 사이트 기본 제목이다.
      const title = pageTitle(pathname) ?? 'MARKETRY - Design Your Market'
      document.title = title
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', '코스피·코스닥 종목을 업종별 시장 지도와 그래프로 살펴보는 MARKETRY입니다.')
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.removeAttribute('href')
      setMeta('og:title', title)
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
