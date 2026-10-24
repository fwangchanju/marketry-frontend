import { GoogleLogoIcon, KakaoLogoIcon, NaverLogoIcon } from '@/components/icons/AppIcons'
import { AUTH_PROVIDER_ISSUERS, isAuthProviderIssuer } from '@/utils/authProvider'

const PROVIDERS = {
  [AUTH_PROVIDER_ISSUERS.google]: {
    label: '구글',
    className: 'bg-ui-white',
    Icon: GoogleLogoIcon,
  },
  [AUTH_PROVIDER_ISSUERS.naver]: {
    label: '네이버',
    className: 'bg-[#03a94d] text-white',
    Icon: NaverLogoIcon,
  },
  [AUTH_PROVIDER_ISSUERS.kakao]: {
    label: '카카오',
    className: 'bg-[#fee500]',
    Icon: KakaoLogoIcon,
  },
} as const

interface Props {
  issuer: string | null | undefined
  className?: string
}

// 로그인 제공자 표시는 프로필과 관리자 회원 목록에서 같은 20px 칸·14px 로고를 쓴다.
export default function AuthProviderIcon({ issuer, className = '' }: Props) {
  if (!isAuthProviderIssuer(issuer)) return null
  const provider = PROVIDERS[issuer as keyof typeof PROVIDERS]
  const Icon = provider.Icon

  return (
    <span
      role="img"
      aria-label={provider.label}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] ${provider.className} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  )
}
