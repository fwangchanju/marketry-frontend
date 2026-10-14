// 개인정보처리방침 — Google OAuth 동의 화면에 등록하는 공개 페이지라 로그인 여부와 무관하게 누구나
// 볼 수 있어야 하고, 세션/시세 등 어떤 데이터 API도 호출하지 않아야 한다(NavBar는 useSession으로
// 세션 조회 API를 부르므로 여기서는 쓰지 않는다). 그래서 이 페이지는 다른 페이지의 훅을 전혀 쓰지
// 않는 순수 정적 컴포넌트다. 톤은 LoginModal(어두운 배경, var(--surface) 패널, 흰 제목 + 회색 본문,
// accent만 강조에 사용)을 그대로 따르고, 등락률 전용 색(red/blue 계열)은 쓰지 않는다.
//
const CONTACT_EMAIL = 'fwangchanju1@gmail.com'

const SERVICE_NAME = 'MARKETRY'
const SERVICE_DOMAIN = 'marketry.co.kr'
const EFFECTIVE_DATE = '2026-10-11'

const SECTION_TITLE = 'text-lg font-bold text-white'
const BODY = 'mt-2 text-sm leading-relaxed text-gray-300'
const LIST = 'mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed text-gray-300'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex h-12 items-center bg-zinc-900 px-4 shadow-lg">
        <a href="/" className="text-sm font-bold text-white">
          {SERVICE_NAME}
        </a>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="nes-container is-dark">
          <h1 className="text-2xl font-bold text-white">개인정보처리방침</h1>
          <p className="mt-2 text-sm text-gray-300">시행일: {EFFECTIVE_DATE}</p>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>1. 서비스 개요</h2>
            <p className={BODY}>
              {SERVICE_NAME}({SERVICE_DOMAIN})는 개인이 운영하는 시장 데이터 조회·시각화 서비스입니다. 이 방침은 서비스를
              이용할 때 처리되는 개인정보와 그 이용 방법을 설명합니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>2. 수집하는 개인정보 항목</h2>
            <p className={BODY}>로그인하지 않고 이용할 때는 서버에 개인정보를 저장하지 않습니다. Google로 로그인하면 아래 정보를 저장합니다.</p>
            <ul className={LIST}>
              <li>Google 로그인 시: Google 계정 식별자(sub), 발급자(issuer), 이메일 주소</li>
              <li>이용자가 직접 입력하거나 올린 정보: 닉네임, 프로필 사진</li>
              <li>이용자가 저장한 정보: 화면 설정, 내 업종 분류, 북마크, 저장해 둔 스냅샷</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>3. 개인정보의 이용 목적</h2>
            <p className={BODY}>
              로그인과 사용자 식별, 닉네임·프로필 사진 표시, 사용자별 설정과 분류 저장을 위해서만 이용합니다. 광고·마케팅
              목적으로 이용하지 않습니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>4. 쿠키와 브라우저 저장소</h2>
            <ul className={LIST}>
              <li>
                로그인 상태 유지를 위한 인증 쿠키(mm_access, mm_refresh)만 사용합니다. 이 쿠키는 HttpOnly·Secure로 설정되어
                스크립트가 읽을 수 없고, 접근용은 약 15분, 갱신용은 14일 뒤에 만료되며 로그아웃하면 지워집니다.
              </li>
              <li>
                로그인하지 않은 상태에서 바꾼 화면 설정은 이 브라우저 탭(sessionStorage)에만 남고 서버로 보내지 않으며, 앱을
                다시 열면 지워집니다. 업종 표시 순서 같은 일부 화면 구성은 이 브라우저(localStorage)에 저장됩니다.
              </li>
              <li>광고·행태 분석을 위한 쿠키나 추적 도구는 사용하지 않습니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>5. 제3자 제공 및 외부 서비스</h2>
            <p className={BODY}>
              수집한 개인정보를 제3자에게 제공하지 않습니다. 다만 로그인은 Google의 인증 서비스를 통해 이루어지며, 이때
              Google이 계정 인증을 처리합니다. Google이 처리하는 정보는 Google의 개인정보처리방침을 따릅니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>6. 보관 기간 및 파기</h2>
            <p className={BODY}>
              수집한 개인정보는 계정 삭제를 요청하기 전까지 보관합니다. 삭제를 요청하면 계정과 닉네임·프로필 사진, 저장한
              설정·분류·스냅샷을 모두 삭제합니다. 프로필 사진은 프로필 화면에서 직접 지울 수도 있습니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>7. 이용자의 권리</h2>
            <p className={BODY}>
              이용자는 언제든 자신의 개인정보를 확인하고 정정·삭제를 요청할 수 있습니다. 닉네임과 프로필 사진은 프로필
              화면에서 직접 바꿀 수 있고, 그 밖의 요청은 아래 문의처로 알려 주세요.
            </p>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>8. 문의</h2>
            <p className={BODY}>
              문의:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent)] hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>개정 이력</h2>
            <ul className={LIST}>
              <li>2026-10-11: 서비스 이름과 주소 변경, 수집 항목(닉네임·프로필 사진·북마크)·쿠키·저장소·외부 서비스·이용자 권리 안내 보강</li>
              <li>2026-09-26: 최초 시행</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
