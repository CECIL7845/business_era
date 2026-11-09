import { requireBusiness } from "@/lib/auth/context";
import { ActionForm, Select, SubmitButton, TextArea } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { HelpGuide, SupportContacts } from "@/components/help-guide";
import { feedbackAction } from "../actions";

export const metadata = { title: "Help & feedback" };

export default async function HelpPage() {
  await requireBusiness();
  return (
    <>
      <PageHeader title="Help & feedback" />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card title="Getting started guide" className="lg:col-span-3"><div className="p-5"><HelpGuide /></div></Card>
        <div className="space-y-5 lg:col-span-2">
          <Card title="Report a problem or suggest an idea">
            <div className="p-5">
              <ActionForm action={feedbackAction} resetOnSuccess>
                <Select name="category" label="Type" options={[{ value: "bug", label: "Something isn't working" }, { value: "idea", label: "Idea / feature request" }, { value: "question", label: "Question" }, { value: "billing", label: "Billing" }, { value: "other", label: "Other" }]} />
                <TextArea name="message" label="Message" rows={5} required placeholder="What happened, and what did you expect?" />
                <SubmitButton pendingText="Sending…">Send</SubmitButton>
              </ActionForm>
            </div>
          </Card>
          <Card title="Talk to a person"><div className="p-5"><SupportContacts /></div></Card>
        </div>
      </div>
    </>
  );
}
