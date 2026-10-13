import { Button, render, Text } from "react-email";
import { EmailShell, emailButton, emailMeta, emailText } from "./EmailShell";

export type ConfirmationEmailProps = {
  title: string;
  subject: string;
  intro: string;
  action: string;
  link: string;
  expiry: string;
};

export function ConfirmationEmail({ title, subject, intro, action, link, expiry }: ConfirmationEmailProps) {
  return (
    <EmailShell title={title} preview={subject}>
      <Text style={emailText}>{intro}</Text>
      <Button href={link} style={emailButton}>
        {action}&nbsp; →
      </Button>
      <Text style={emailMeta}>{expiry}</Text>
    </EmailShell>
  );
}

export const renderConfirmationEmail = (props: ConfirmationEmailProps) => render(<ConfirmationEmail {...props} />);
