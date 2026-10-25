import DocumentPageLayout from '@/components/DocumentPageLayout'
import { InfoCallout, InfoPageHeading, InfoSection } from '@/components/InfoDocument'

const CONTACT_EMAIL = 'marketry2026@gmail.com'

export default function ContactPage() {
  return (
    <DocumentPageLayout title="CONTACT" panelIcon="mail" panelDescription="서비스 이용과 데이터, 개인정보 관련 문의를 이메일로 받습니다.">
      <article className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
        <InfoPageHeading
          title="문의"
          summary="서비스 이용, 데이터 정정, 개인정보 관련 요청은 이메일로 보내 주세요."
        />

        <InfoSection number="1" title="이메일 문의">
          <InfoCallout title="MARKETRY 문의처">
            문의 내용을 확인할 수 있도록 어떤 화면에서 무엇을 하셨는지 함께 적어 주세요. 개인정보 관련 요청은 개인정보처리방침도 확인해 주세요.
          </InfoCallout>
          <div className="mt-4 border border-ui-border bg-ui-panel p-5">
            <p className="text-xs font-bold text-ui-muted">이메일</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-2 inline-flex min-h-10 items-center border border-brand bg-brand-surface px-4 text-sm font-bold text-ui-white hover:bg-brand-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </InfoSection>
      </article>
    </DocumentPageLayout>
  )
}
