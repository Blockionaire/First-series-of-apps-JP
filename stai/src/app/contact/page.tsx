import type { Metadata } from "next";
import EnquiryForm from "@/components/training/EnquiryForm";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        Contact
      </p>
      <h1 className="f-display mt-2 text-4xl text-cream-100 sm:text-5xl">Reach the desk</h1>
      <p className="mt-4 max-w-xl" style={{ color: "var(--ink-muted)" }}>
        Training, membership for teams, corrections, story tips — everything lands on the same desk and gets a
        reply within one working day.
      </p>
      <div className="f-mono mt-6 space-y-1 text-[0.78rem] text-cream-400">
        <p>Editorial — desk@stai.ai</p>
        <p>Training — training@stai.ai</p>
        <p>Membership — members@stai.ai</p>
      </div>
      <div className="mt-10 border-t pt-8 rule">
        <h2 className="f-label mb-6" style={{ color: "var(--ink-faint)" }}>
          Or use the form
        </h2>
        <EnquiryForm preselect="Not sure yet — advise us" />
      </div>
    </div>
  );
}
