import { Button, Link, render, Section, Text } from "react-email";
import { EMAIL_COLOR, EmailShell, emailButton, emailMeta, emailText } from "./EmailShell";

// Every booking email, to the guest and to Joe: a heading, a few paragraphs, the
// call's details as stacked label/value pairs, then an optional button and links.

export type BookingEmailProps = {
  title: string;
  preview: string;
  paragraphs: string[];
  details: { label: string; value: string; href?: string }[];
  action?: { label: string; href: string };
  links?: { label: string; href: string }[];
  note?: string;
};

export function BookingEmail({ title, preview, paragraphs, details, action, links, note }: BookingEmailProps) {
  return (
    <EmailShell title={title} preview={preview}>
      {paragraphs.map((p) => (
        <Text key={p} style={emailText}>
          {p}
        </Text>
      ))}
      <Section style={card}>
        <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" border={0}>
          <tbody>
            {details.map((d) => (
              <tr key={d.label}>
                <td style={detailCell}>
                  <div style={label}>{d.label}</div>
                  <div style={value}>
                    {d.href ? (
                      <Link href={d.href} style={valueLink}>
                        {d.value}
                      </Link>
                    ) : (
                      d.value
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      {action && (
        <Button href={action.href} style={emailButton}>
          {action.label}&nbsp; →
        </Button>
      )}
      {links && links.length > 0 && (
        <Text style={emailText}>
          {links.map((l, i) => (
            <span key={l.href}>
              {i > 0 && "  ·  "}
              <Link href={l.href} style={valueLink}>
                {l.label}
              </Link>
            </span>
          ))}
        </Text>
      )}
      {note && <Text style={emailMeta}>{note}</Text>}
    </EmailShell>
  );
}

export const renderBookingEmail = (props: BookingEmailProps) => render(<BookingEmail {...props} />);

const card = {
  margin: "4px 0 28px",
  padding: "16px 20px",
  borderRadius: "4px",
  backgroundColor: EMAIL_COLOR.paper,
};
const detailCell = { padding: "8px 0" };
const label = {
  margin: "0 0 2px",
  color: EMAIL_COLOR.muted,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "12px",
  letterSpacing: ".06em",
  lineHeight: "1.55",
  textTransform: "uppercase" as const,
};
const value = {
  color: EMAIL_COLOR.ink,
  fontFamily: "Arial, sans-serif",
  fontSize: "16px",
  lineHeight: "1.5",
  whiteSpace: "pre-wrap" as const,
};
const valueLink = { color: EMAIL_COLOR.ink, textDecoration: "underline", textDecorationColor: EMAIL_COLOR.pink };
