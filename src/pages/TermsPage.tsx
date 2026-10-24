// 이용약관 — 개인정보처리방침과 같은 공개 정적 문서. 공통 화면 틀은 쓰되 세션·데이터 API는 부르지 않는다.
import DocumentPageLayout from '@/components/DocumentPageLayout'
const CONTACT_EMAIL = 'marketry2026@gmail.com'

const SERVICE_NAME = 'MARKETRY'
const SERVICE_DOMAIN = 'marketry.co.kr'
const EFFECTIVE_DATE = '2026-10-22'

const SECTION_TITLE = 'text-lg font-bold text-ui-white'
const BODY = 'mt-2 text-sm leading-relaxed text-ui-text'
const LIST = 'mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed text-ui-text'

export default function TermsPage() {
  return (
    <DocumentPageLayout title="TERMS">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ui-white">
            <span aria-hidden="true" className="h-7 w-1 shrink-0 rounded-sm bg-brand" />
            이용약관
          </h1>
          <p className="mt-2 text-sm text-ui-text">시행일: {EFFECTIVE_DATE}</p>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>1. 서비스</h2>
            <p className={BODY}>
              {SERVICE_NAME}({SERVICE_DOMAIN})는 개인이 운영하는 시장 데이터 조회·시각화 서비스입니다. 로그인하지 않아도
              대부분의 화면을 볼 수 있고, Google로 로그인하면 설정과 내 기준을 저장할 수 있습니다. 이 약관은 서비스를 이용하는
              모든 분께 적용됩니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>2. 투자 정보에 대한 안내</h2>
            <ul className={LIST}>
              <li>서비스에 보이는 시세와 통계는 외부 데이터를 가공한 참고 자료이며 지연되거나 틀릴 수 있습니다.</li>
              <li>투자 권유나 자문이 아닙니다. 투자 판단과 그 결과의 책임은 이용자 본인에게 있습니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>3. 회원 가입과 탈퇴</h2>
            <ul className={LIST}>
              <li>Google 계정으로 로그인하면 회원이 됩니다. 한 사람이 여러 계정을 만들어 서비스를 방해해서는 안 됩니다.</li>
              <li>프로필 화면에서 언제든 탈퇴할 수 있습니다. 탈퇴하면 개인정보와 저장한 데이터가 즉시 삭제되며 복구할 수 없습니다.</li>
              <li>1년 동안 접속하지 않은 계정은 삭제될 수 있습니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>4. 닉네임과 프로필</h2>
            <ul className={LIST}>
              <li>닉네임은 2~12자의 한글·영문·숫자만 쓸 수 있고 다른 회원과 겹칠 수 없으며 7일에 한 번만 바꿀 수 있습니다.</li>
              <li>운영자나 거래소로 오해받을 수 있는 이름, 다른 사람을 사칭하거나 불쾌감을 주는 닉네임·사진은 쓸 수 없습니다.</li>
              <li>위 기준에 맞지 않으면 운영자가 알리지 않고 닉네임을 지울 수 있습니다. 지워진 뒤에는 새 닉네임을 바로 등록할 수 있습니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>5. 이용자가 지켜야 할 일</h2>
            <ul className={LIST}>
              <li>서비스와 데이터를 자동화 도구로 과도하게 불러오거나, 서버·계정에 대한 무단 접근과 방해를 하지 않습니다.</li>
              <li>서비스의 시세·분류 데이터를 허락 없이 대량으로 복제해 다른 곳에 제공하지 않습니다.</li>
              <li>이를 어기면 이용을 제한하거나 계정을 삭제할 수 있습니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>6. 서비스의 변경과 중단</h2>
            <p className={BODY}>
              개인이 운영하는 서비스라 기능과 화면이 예고 없이 바뀌거나, 점검·장애·운영 사정으로 일시 또는 영구히 중단될 수
              있습니다. 중단할 때는 가능한 한 미리 알립니다. 무료로 제공하는 서비스라서 이로 인한 손해에 대해 법이 허용하는
              범위 안에서 책임지지 않습니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>7. 개인정보</h2>
            <p className={BODY}>
              개인정보는{' '}
              <a href="/info/privacy" className="text-[var(--accent)] hover:underline">
                개인정보처리방침
              </a>
              에 따라 처리합니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className={SECTION_TITLE}>8. 약관의 변경과 문의</h2>
            <p className={BODY}>
              약관을 바꾸면 이 페이지에 시행일과 함께 올립니다. 문의:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--accent)] hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </div>
    </DocumentPageLayout>
  )
}
