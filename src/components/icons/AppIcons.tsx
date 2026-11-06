import type { SVGProps } from 'react'

// 설정 버튼 — 선 두 줄에 동그라미가 달린 모양(Lucide settings-2)이다. 켜지면 동그라미 안쪽이 채워진다.
// 그림은 4~20(16칸)이라 격자를 21.33칸(1.33~22.67)에 맞춰 20px에서 15px로 보이게 한다 — 전체화면·스크린샷 아이콘과 같은 크기다. 격자 1칸이 화면 0.9375px이라 선 값 1.44가 화면 약 1.35px다.
export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="1.33 1.33 21.33 21.33" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  )
}

// 전체화면 버튼 — 네 모서리로 퍼지는 화살표 네 개 모양이다(3~21 격자, 20px에서 15px).
export function MaximizeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m15 15 6 6" />
      <path d="m15 9 6-6" />
      <path d="M21 16v5h-5" />
      <path d="M21 8V3h-5" />
      <path d="M3 16v5h5" />
      <path d="m3 21 6-6" />
      <path d="M3 8V3h5" />
      <path d="M9 9 3 3" />
    </svg>
  )
}

// 전체화면 해제 버튼 — 네 모서리에서 가운데로 모이는 화살표 네 개 모양이다(3~21 격자).
export function MinimizeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m15 15 6 6m-6-6v4.8m0-4.8h4.8" />
      <path d="M9 19.8V15m0 0H4.2M9 15l-6 6" />
      <path d="M15 4.2V9m0 0h4.8M15 9l6-6" />
      <path d="M9 4.2V9m0 0H4.2M9 9 3 3" />
    </svg>
  )
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

// 파일 올리기(업로드) — DownloadIcon과 같은 받침 모양에 화살표가 위로 향한다.
export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

// 공개 분류 업데이트 — 구름으로 올리는 화살표.
export function CloudUploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 18H6a4 4 0 0 1-.9-7.9 7 7 0 0 1 13.6-1.6A5 5 0 0 1 18 18h-1" />
      <path d="m8 14 4-4 4 4M12 10v11" />
    </svg>
  )
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )
}

// 지도 위쪽 이동 경로의 "되돌아가기" 표시와 1-2 업종 제외 목록이 같은 모양을 쓴다.
// git 커밋 모양 — 세로선 가운데에 원이 있는 모양. 버전 하나를 확정한다는 뜻이다.
export function CommitIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v6" />
      <path d="M12 16v6" />
    </svg>
  )
}

export function ReturnArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  )
}

// 설정창의 되돌리기(저장값으로 되돌리기) 버튼 — 시계 바늘이 있는 반시계 화살표로 "이전 상태로"를 나타낸다.
export function HistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  )
}

// 브라우저 저장값 초기화 — 바깥 화살표에서 안쪽으로 감기는 한 줄의 소용돌이.
export function SpiralResetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M 26.50 24.04 L 26.65 24.33 L 26.77 24.66 L 26.84 25.01 L 26.87 25.38 L 26.85 25.78 L 26.78 26.18 L 26.65 26.59 L 26.46 26.99 L 26.22 27.38 L 25.92 27.75 L 25.57 28.10 L 25.16 28.41 L 24.70 28.68 L 24.20 28.90 L 23.66 29.07 L 23.09 29.17 L 22.49 29.21 L 21.87 29.17 L 21.24 29.06 L 20.62 28.88 L 20.00 28.62 L 19.40 28.27 L 18.83 27.86 L 18.29 27.36 L 17.81 26.80 L 17.38 26.17 L 17.01 25.48 L 16.72 24.73 L 16.52 23.94 L 16.39 23.12 L 16.37 22.26 L 16.44 21.40 L 16.61 20.52 L 16.88 19.66 L 17.25 18.81 L 17.72 17.99 L 18.30 17.22 L 18.97 16.50 L 19.72 15.85 L 20.56 15.28 L 21.48 14.79 L 22.46 14.40 L 23.49 14.12 L 24.57 13.95 L 25.68 13.90 L 26.80 13.98 L 27.93 14.18 L 29.05 14.51 L 30.14 14.97 L 31.19 15.55 L 32.18 16.25 L 33.10 17.08 L 33.94 18.01 L 34.69 19.04 L 35.32 20.17 L 35.84 21.38 L 36.22 22.65 L 36.47 23.97 L 36.57 25.34 L 36.52 26.72 L 36.32 28.11 L 35.96 29.48 L 35.45 30.83 L 34.78 32.12 L 33.97 33.36 L 33.01 34.51 L 31.93 35.56 L 30.72 36.50 L 29.39 37.31 L 27.97 37.98 L 26.47 38.49 L 24.91 38.85 L 23.29 39.03 L 21.65 39.04 L 20.00 38.86 L 18.36 38.50 L 16.75 37.96 L 15.19 37.24 L 13.71 36.35 L 12.31 35.29 L 11.03 34.07 L 9.87 32.70 L 8.86 31.20 L 8.01 29.58 L 7.33 27.87 L 6.84 26.07 L 6.55 24.21 L 6.46 22.31 L 6.57 20.39 L 6.90 18.48 L 7.44 16.60 L 8.18 14.77 L 9.13 13.02 L 10.27 11.37 L 11.60 9.83 L 13.10 8.44" strokeWidth={2.4} />
      <polygon points="16.2,5.1 11.1,17.2 4.6,10.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

// 설정창 저장 버튼 — 좌우 대칭 디스켓(위쪽 셔터와 아래쪽 라벨이 가운데에 있고 접힌 모서리가 없다).
export function SaveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 3v5h10V3M7 21v-8h10v8" />
    </svg>
  )
}

// 텔레그램 로고 — 파란 원 안의 흰 종이비행기. 색은 텔레그램 고유 색이라 켜짐 표시에서만 쓰고, 꺼짐은 바깥에서 회색으로 흐리게 한다.
export function TelegramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="12" fill="#2aabee" />
      <path
        fill="#fff"
        d="M16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
      />
    </svg>
  )
}

// 표 머리글 정렬 표시 — 정렬 중이면 방향을 가리키는 쐐기 하나(∧/∨), 아니면 위아래 쐐기 한 쌍. 줄기 없이 쐐기만 써서 작은 크기에서도 가볍다.
export function SortIcon({ active, direction, ...props }: { active: boolean; direction: 'asc' | 'desc' } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {!active ? (
        <>
          <path d="m8 9 4-4 4 4" />
          <path d="m8 15 4 4 4-4" />
        </>
      ) : direction === 'asc' ? (
        <path d="m6 15 6-6 6 6" />
      ) : (
        <path d="m6 9 6 6 6-6" />
      )}
    </svg>
  )
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// 스냅샷 날짜·시각 글자 앞에 붙이는 달력·시계 모양.
export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  )
}

// 화면 스크린샷 — 네 모서리 꺾쇠 안에 동그라미가 있는 모양(Lucide focus)이다. 그림이 3~21(18칸)이라 20px에서 15px로 보인다.
// filled: 꺾쇠 안쪽 네모를 35% 투명하게 채운다 — 열려 있을 때의 표시다(꺾쇠는 닫힌 모양이 아니라서 fill 클래스가 먹지 않는다).
export function ScreenshotIcon({ filled = false, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {filled && <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" fillOpacity={0.35} stroke="none" />}
      <circle cx="12" cy="12" r="3" />
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    </svg>
  )
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v7m4-7v7" />
    </svg>
  )
}

// 업종을 끌어 다른 업종 "하위로" 넣을 수 있는 자리 표시 — 오른쪽 위에서 휘어 왼쪽 아래로 내려가는 화살표다. Lucide corner-left-down 모양이다.
export function NestIntoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m14 15-5 5-5-5" />
      <path d="M20 4h-7a4 4 0 0 0-4 4v12" />
    </svg>
  )
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

// 공유 범위 아이콘 — 모니터(전체 영역)와 휴대폰(모바일로 보내는 영역). Lucide monitor·smartphone 모양이다.
export function MonitorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  )
}

export function SmartphoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  )
}

// 홈 요약의 세 항목 중 하나를 고르는 캡처 아이콘 — 같은 크기의 칸 세 개가 붙어 있고 선택한 칸만 채운다.
export function HomeFrameCaptureIcon({ selectedSlot, ...props }: SVGProps<SVGSVGElement> & { selectedSlot: 0 | 1 | 'all' }) {
  const filledSlots = selectedSlot === 'all' ? [0, 1] : [selectedSlot]
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {filledSlots.map(slot => <rect key={slot} x={3 + slot * 9} y="3" width="9" height="18" fill="var(--brand)" stroke="none" />)}
      <path d="M3 3h18v18H3zM12 3v18" />
    </svg>
  )
}

export function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

// 모바일 화면 모드 버튼 — 해(주간)와 달(야간). Lucide sun·moon이다.
export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

export function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

// 로그인 버튼·프로필 기본 모양 — 둥근 사람(Lucide user-round).
export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  )
}

// 구글 로고(G) — 색을 바꾸지 않고 그대로 쓴다(구글 브랜드 규정). 어두운 바탕 위에서는 흰 칸 위에 올려서 쓴다.
export function GoogleLogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

// 로그인 제공자의 고유 심볼은 일반 선 아이콘과 구분한다.
export function NaverLogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M16.27 12.88 7.54 0H0v24h7.73V11.12L16.46 24H24V0h-7.73v12.88Z" />
    </svg>
  )
}

export function KakaoLogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="#000000" d="M12 3C6.48 3 2 6.55 2 10.93c0 2.84 1.87 5.33 4.68 6.72l-.95 3.45a.45.45 0 0 0 .68.49l4.07-2.7c.5.07 1 .11 1.52.11 5.52 0 10-3.55 10-7.93S17.52 3 12 3Z" />
    </svg>
  )
}
