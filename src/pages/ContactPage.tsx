import DocumentPageLayout from '@/components/DocumentPageLayout'

export default function ContactPage() {
  return (
    <DocumentPageLayout title="CONTACT" panelIcon="mail">
      <div className="flex h-full items-center justify-center">
        <a
          href="mailto:marketry2026@gmail.com"
          className="text-xl font-bold text-ui-white hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          marketry2026@gmail.com
        </a>
      </div>
    </DocumentPageLayout>
  )
}
