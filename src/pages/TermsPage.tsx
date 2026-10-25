import DocumentPageLayout from '@/components/DocumentPageLayout'
import { INFO_LIST, InfoCallout, InfoPageHeading, InfoSection } from '@/components/InfoDocument'

const CONTACT_EMAIL = 'marketry2026@gmail.com'
const EFFECTIVE_DATE = '2026-10-25'

export default function TermsPage() {
  return (
    <DocumentPageLayout title="TERMS" panelDescription="서비스 이용 기준과 회원 가입·탈퇴에 관한 약속을 안내합니다.">
      <article className="mx-auto max-w-4xl space-y-5">
        <InfoPageHeading
          title="이용약관"
          effectiveDate={EFFECTIVE_DATE}
          summary="MARKETRY 서비스를 이용할 때 적용되는 기준입니다. 비회원 방문과 회원 기능 모두 이 약관의 적용을 받습니다."
        />

        <InfoCallout title="투자 정보는 참고 자료입니다">
          서비스의 시세와 통계는 외부 데이터를 가공해 보여 주며 지연되거나 틀릴 수 있습니다. 투자 권유나 자문이 아니므로 투자 판단과 결과는 이용자 본인의 책임입니다.
        </InfoCallout>

        <InfoSection number="1" title="서비스">
          <p>
            MARKETRY(marketry.co.kr)는 개인이 운영하는 시장 데이터 조회·시각화 서비스입니다. 대부분의 화면은 로그인 없이 볼 수
            있고, 구글·네이버·카카오 계정으로 가입하거나 로그인하면 설정과 내 기준을 저장할 수 있습니다.
          </p>
        </InfoSection>

        <InfoSection number="2" title="회원 가입과 탈퇴">
          <ul className={INFO_LIST}>
            <li>구글·네이버·카카오 계정으로 가입하거나 로그인할 수 있습니다. 로그인 과정에서 이메일 주소를 제공하지 않으면 회원 가입과 로그인을 할 수 없습니다.</li>
            <li>한 사람이 여러 계정을 만들어 서비스를 방해해서는 안 됩니다.</li>
            <li>프로필 화면에서 언제든 탈퇴할 수 있습니다. 탈퇴하면 운영 데이터에서 개인정보와 저장한 데이터를 삭제합니다. 장애 대비 백업에는 삭제한 정보가 최대 10일 남을 수 있고, 복구할 수 없습니다.</li>
            <li>1년 동안 접속하지 않은 계정은 삭제될 수 있습니다.</li>
          </ul>
        </InfoSection>

        <InfoSection number="3" title="닉네임과 프로필">
          <ul className={INFO_LIST}>
            <li>닉네임은 2~12자의 한글·영문·숫자만 쓸 수 있고 다른 회원과 겹칠 수 없으며 7일에 한 번만 바꿀 수 있습니다.</li>
            <li>운영자나 거래소로 오해받을 수 있는 이름, 다른 사람을 사칭하거나 불쾌감을 주는 닉네임·사진은 쓸 수 없습니다.</li>
            <li>기준에 맞지 않으면 운영자가 알리지 않고 닉네임을 지울 수 있습니다. 지워진 뒤에는 새 닉네임을 바로 등록할 수 있습니다.</li>
          </ul>
        </InfoSection>

        <InfoSection number="4" title="이용자가 지켜야 할 일">
          <ul className={INFO_LIST}>
            <li>서비스와 데이터를 자동화 도구로 과도하게 불러오거나 서버·계정에 무단으로 접근하고 방해하지 않습니다.</li>
            <li>서비스의 시세·분류 데이터를 허락 없이 대량으로 복제해 다른 곳에 제공하지 않습니다.</li>
            <li>이를 어기면 이용을 제한하거나 계정을 삭제할 수 있습니다.</li>
          </ul>
        </InfoSection>

        <InfoSection number="5" title="공지·광고와 서비스 변경">
          <p>
            홈페이지에는 서비스 공지나 광고 배너가 표시될 수 있습니다. 배너 링크로 외부 사이트에 이동하면 해당 사이트의 이용약관과
            개인정보처리방침이 적용됩니다.
          </p>
          <p>
            개인이 운영하는 서비스라 기능과 화면이 예고 없이 바뀌거나, 점검·장애·운영 사정으로 일시 또는 영구히 중단될 수 있습니다.
            중단할 때는 가능한 한 미리 알립니다. 무료 서비스 이용으로 생긴 손해에 대해서는 법이 허용하는 범위 안에서 책임지지 않습니다.
          </p>
        </InfoSection>

        <InfoSection number="6" title="개인정보">
          <p>
            개인정보는{' '}
            <a href="/info/privacy" className="font-bold text-[var(--accent)] hover:underline">
              개인정보처리방침
            </a>
            에 따라 처리합니다.
          </p>
        </InfoSection>

        <InfoSection number="7" title="약관의 변경과 문의">
          <p>약관을 바꾸면 이 페이지에 시행일과 함께 올립니다.</p>
          <p>
            문의:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-[var(--accent)] hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </InfoSection>

        <InfoSection title="개정 이력">
          <ul className={INFO_LIST}>
            <li>2026-10-25: 구글·네이버·카카오 가입·로그인, 공지·광고 배너, 탈퇴 후 백업 보관 안내 반영</li>
            <li>2026-10-22: 최초 시행</li>
          </ul>
        </InfoSection>
      </article>
    </DocumentPageLayout>
  )
}
