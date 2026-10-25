// 개인정보처리방침 — 소셜 로그인 제공자 동의 화면에 등록한 공개 문서다. 누구나 볼 수 있고,
// 공통 상단 계정 영역은 현재 로그인 상태에 따라 표시한다.
import DocumentPageLayout from '@/components/DocumentPageLayout'
import { INFO_FACTS, INFO_LIST, InfoCallout, InfoFact, InfoPageHeading, InfoSection } from '@/components/InfoDocument'

const CONTACT_EMAIL = 'marketry2026@gmail.com'
const EFFECTIVE_DATE = '2026-10-25'

export default function PrivacyPolicyPage() {
  return (
    <DocumentPageLayout title="PRIVACY" panelDescription="개인정보 수집·이용·보관 기준입니다.">
      <article className="mx-auto max-w-4xl space-y-5">
        <InfoPageHeading
          title="개인정보처리방침"
          effectiveDate={EFFECTIVE_DATE}
          summary="MARKETRY가 어떤 정보를 수집하고, 어디에 쓰며, 언제 삭제하는지 안내합니다."
        />

        <InfoSection number="1" title="서비스와 개인정보">
          <p>
            MARKETRY(marketry.co.kr)는 개인이 운영하는 시장 데이터 조회·시각화 서비스입니다. 개인정보 문의와 권리 행사는 아래 문의처로
            요청할 수 있습니다.
          </p>
        </InfoSection>

        <InfoSection number="2" title="수집하는 정보">
          <InfoCallout title="비회원 방문 집계">
            로그인하지 않아도 이름·이메일 같은 계정 정보는 저장하지 않습니다. 방문자 수를 세기 위해 접속 IP와 브라우저 정보를 서버 비밀값으로 날짜별
            가명 처리한 값과 날짜를 저장합니다. 원래 IP와 브라우저 정보는 방문 집계 기록에 저장하지 않으며 날짜별 값은 서로 연결되지 않습니다.
            유입 경로는 이전 페이지의 도메인이나 주소의 utm_source 값을 네이버·구글·직접·기타로 분류합니다. 이전 페이지의 전체 주소와 utm_source 원문은
            집계 기록에 보관하지 않습니다. 집계 기록은 180일 뒤 삭제합니다.
          </InfoCallout>
          <div className={INFO_FACTS}>
            <InfoFact label="로그인 정보">구글·네이버·카카오 계정 식별자와 발급자, 제공자가 전달한 경우 이메일 주소</InfoFact>
            <InfoFact label="프로필">이용자가 등록한 닉네임과 프로필 사진</InfoFact>
            <InfoFact label="저장 데이터">화면 설정, 내 기준과 내 분류, 저장해 둔 스냅샷</InfoFact>
            <InfoFact label="접속 기록">마지막 접속 시각과 접속한 날짜</InfoFact>
            <InfoFact label="운영 지표">화면별 표시 시간, 오류 횟수, 모바일 지도 캡처 시간. 날짜·화면·측정 종류별 합계만 저장하며 계정 식별자, IP 주소, 오류 내용은 측정 기록에 넣지 않습니다.</InfoFact>
          </div>
        </InfoSection>

        <InfoSection number="3" title="이용 목적">
          <p>
            로그인과 사용자 식별, 닉네임·프로필 사진 표시, 사용자별 설정과 분류 저장을 위해 이용합니다. 접속 기록과 운영 지표는 회원 수와 이용 현황을
            파악하고 화면 속도·오류를 확인해 서비스를 운영·개선하는 데에만 씁니다.
          </p>
          <p>공지·광고 배너가 표시될 수 있지만, 개인정보를 이용해 광고를 맞춤 제공하거나 광고 효과를 추적하지 않습니다.</p>
        </InfoSection>

        <InfoSection number="4" title="쿠키와 브라우저 저장소">
          <ul className={INFO_LIST}>
            <li>로그인 유지용 쿠키(mm_access, mm_refresh)는 HttpOnly·Secure로 설정되어 스크립트가 읽을 수 없습니다. 접근용은 약 15분, 갱신용은 14일 뒤 만료되며 로그아웃하면 지워집니다.</li>
            <li>로그인 과정에서 요청 위조를 막고 로그인 후 돌아갈 화면을 기억하기 위해 임시 쿠키를 추가로 사용합니다. 10분 뒤 만료되거나 로그인이 끝나면 지워집니다.</li>
            <li>비회원이 바꾼 화면 설정은 이 브라우저 탭(sessionStorage)에만 남고 앱을 다시 열면 지워집니다. 업종 표시 순서 같은 일부 화면 구성은 이 브라우저(localStorage)에 저장됩니다.</li>
            <li>광고·행태 분석 쿠키나 추적 도구는 사용하지 않습니다. 운영 지표는 로그인 계정이나 접속 IP와 연결하지 않고 쿠키 없이 집계합니다.</li>
          </ul>
        </InfoSection>

        <InfoSection number="5" title="외부 서비스와 정보 처리">
          <p>개인정보를 광고주나 다른 사업자에게 판매하지 않습니다. 로그인 인증과 서비스 운영을 위해 아래 외부 서비스를 이용합니다.</p>
          <div className={INFO_FACTS}>
            <InfoFact label="구글·네이버·카카오">로그인 인증을 처리합니다. 제공자의 개인정보처리방침에 따라 로그인 정보가 처리되며, 서비스는 계정 식별자와 제공된 이메일 주소를 받습니다.</InfoFact>
            <InfoFact label="Cloudflare">서비스 접속을 중계하고 보호합니다. 접속 IP와 요청 정보가 전 세계 네트워크를 통해 처리될 수 있습니다.</InfoFact>
            <InfoFact label="Cloudflare R2">장애에 대비해 서비스 데이터를 하루 한 번 백업합니다. 백업에는 회원 정보가 포함되며 저장 위치는 R2 버킷 설정에 따릅니다.</InfoFact>
            <InfoFact label="외부 사이트">광고 배너 링크를 누르면 외부 사이트로 이동할 수 있습니다. 해당 사이트의 개인정보 처리는 각 사이트의 방침을 따릅니다.</InfoFact>
          </div>
        </InfoSection>

        <InfoSection number="6" title="보관 기간과 삭제">
          <div className={INFO_FACTS}>
            <InfoFact label="회원 정보">탈퇴하기 전까지 보관합니다. 1년 동안 접속하지 않은 계정은 삭제될 수 있습니다. 탈퇴하면 운영 데이터에서 개인정보와 저장한 데이터를 삭제합니다.</InfoFact>
            <InfoFact label="장애 대비 백업">서버 백업은 7일, Cloudflare R2 백업은 10일 보관한 뒤 자동으로 삭제합니다. 백업 복원 시 탈퇴한 정보는 다시 삭제합니다.</InfoFact>
            <InfoFact label="비회원 방문 집계">180일 보관한 뒤 삭제합니다.</InfoFact>
            <InfoFact label="운영 지표">날짜별 합계로 30일 보관한 뒤 삭제합니다.</InfoFact>
          </div>
          <InfoCallout title="탈퇴 후 백업">
            탈퇴 직후 운영 데이터에서는 삭제되지만, 이미 만들어진 백업에는 보관 기간 동안 정보가 남을 수 있습니다. 백업에서 복구하는 경우 탈퇴 정보도 다시 삭제합니다.
          </InfoCallout>
        </InfoSection>

        <InfoSection number="7" title="이용자의 권리">
          <p>
            이용자는 개인정보를 확인·정정·삭제할 수 있습니다. 닉네임과 프로필 사진은 프로필 화면에서 직접 바꾸고, 탈퇴도 프로필 화면에서 할 수 있습니다.
            그 밖의 요청은 문의처로 알려 주세요.
          </p>
        </InfoSection>

        <InfoSection number="8" title="문의">
          <p>개인정보 관련 문의와 권리 행사는 아래 이메일로 요청해 주세요.</p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex border border-brand bg-brand-surface px-3 py-2 font-bold text-ui-white hover:bg-brand-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {CONTACT_EMAIL}
          </a>
        </InfoSection>

        <InfoSection title="개정 이력">
          <ul className={INFO_LIST}>
            <li>2026-10-25: 소셜 로그인·임시 인증 쿠키·공지/광고 배너·방문자 가명 집계·운영 지표 안내 반영</li>
            <li>2026-10-22: 비회원 방문자 집계, 접속 기록, Cloudflare 백업, 탈퇴·미접속 계정 삭제, 보관 기간, 저장 정보 안내 반영</li>
            <li>2026-10-11: 서비스 이름·주소 변경과 수집 항목·쿠키·저장소·외부 서비스·이용자 권리 안내 보강</li>
            <li>2026-09-26: 최초 시행</li>
          </ul>
        </InfoSection>
      </article>
    </DocumentPageLayout>
  )
}
