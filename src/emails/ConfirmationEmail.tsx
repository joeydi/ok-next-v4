import { Button, render, Text } from "react-email";
import { EMAIL_COLOR, emailMeta, emailText, SiteCheckEmailShell } from "./SiteCheckEmailShell";

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
    <SiteCheckEmailShell title={title} preview={subject}>
      <Text style={emailText}>{intro}</Text>
      <Button href={link} style={button}>
        {action}&nbsp; →
      </Button>
      <Text style={emailMeta}>{expiry}</Text>
    </SiteCheckEmailShell>
  );
}

export const renderConfirmationEmail = (props: ConfirmationEmailProps) => render(<ConfirmationEmail {...props} />);

const button = {
  margin: "8px 0 28px",
  padding: "17px 24px",
  borderRadius: "2px",
  backgroundColor: EMAIL_COLOR.pink,
  color: EMAIL_COLOR.ink,
  fontFamily: "Arial, sans-serif",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: ".06em",
  lineHeight: "1",
  textDecoration: "none",
  textTransform: "uppercase" as const,
};
