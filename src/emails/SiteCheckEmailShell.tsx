import "server-only";
import type { ReactNode } from "react";
import { Body, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text } from "react-email";
import { SITE } from "@/data/site";
import { mediaImageUrl } from "@/lib/media-url";

export const EMAIL_COLOR = {
  ink: "#28252a",
  muted: "#706970",
  paper: "#eee9e6",
  paperLight: "#f8f5f3",
  sand: "#ece2df",
  pink: "#ff4d6a",
  rule: "#d8cfca",
  termGreen: "#c3e88d",
  termYellow: "#ffc777",
} as const;

export const emailText = {
  margin: "0 0 20px",
  color: EMAIL_COLOR.ink,
  fontFamily: "Arial, sans-serif",
  fontSize: "17px",
  lineHeight: "1.55",
};

export const emailMeta = {
  margin: "0 0 20px",
  color: EMAIL_COLOR.muted,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "13px",
  lineHeight: "1.55",
};

export function SiteCheckEmailShell({
  title,
  preview,
  children,
}: {
  title: string;
  preview: string;
  children: ReactNode;
}) {
  const logo = `${SITE.url}/assets/okayplus.svg`;
  const headshot = mediaImageUrl("home/headshot.jpg", { width: 96, quality: 85, format: "jpeg" });

  return (
    <Html lang="en" style={html}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Link href={SITE.url} style={logoLink}>
              <Img src={logo} width="132" height="31" alt={SITE.name} style={logoImage} />
            </Link>
          </Section>
          <Hr style={rule} />
          <Section style={content}>
            <Heading as="h1" style={heading}>
              {title}
            </Heading>
            {children}
          </Section>
          <Section style={signature}>
            <table role="presentation" cellSpacing="0" cellPadding="0" border={0}>
              <tbody>
                <tr>
                  <td width="56" style={avatarCell}>
                    <Img src={headshot} width="48" height="48" alt="" role="presentation" style={avatar} />
                  </td>
                  <td style={identityCell}>
                    <strong style={author}>{SITE.author}</strong>
                    <Link href={SITE.url} style={siteName}>
                      {SITE.name}
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
          <Text style={footer}>
            Sent by{" "}
            <Link href={SITE.url} style={footerLink}>
              {SITE.name}
            </Link>{" "}
            in {SITE.location}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  margin: 0,
  padding: 0,
  backgroundColor: EMAIL_COLOR.paperLight,
  color: EMAIL_COLOR.ink,
};

const html = { backgroundColor: EMAIL_COLOR.paperLight };

const container = {
  width: "100%",
  maxWidth: "600px",
  margin: "0 auto",
  padding: "32px 16px 0",
};

const header = { padding: "0 0 28px" };
const logoLink = { display: "inline-block", color: EMAIL_COLOR.ink, textDecoration: "none" };
const logoImage = { display: "block", width: "132px", height: "auto", border: 0 };
const rule = { margin: 0, borderTop: `1px solid ${EMAIL_COLOR.sand}` };
const content = { padding: "36px 0 12px" };
const heading = {
  margin: "0 0 24px",
  color: EMAIL_COLOR.ink,
  fontFamily: "Georgia, serif",
  fontSize: "34px",
  fontWeight: 400,
  letterSpacing: "-.02em",
  lineHeight: "1.1",
};
const signature = { padding: "20px 0 0" };
const avatarCell = { padding: "0 8px 0 0" };
const avatar = { display: "block", width: "48px", height: "48px", border: 0, borderRadius: "50%" };
const identityCell = { padding: 0, fontFamily: "Arial, sans-serif" };
const author = { display: "block", color: EMAIL_COLOR.ink, fontSize: "16px", lineHeight: "1.3" };
const siteName = {
  display: "block",
  marginTop: "3px",
  color: EMAIL_COLOR.pink,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "14px",
  lineHeight: "1.3",
  textDecoration: "none",
};
const footer = {
  margin: 0,
  padding: "24px 0",
  color: EMAIL_COLOR.muted,
  fontFamily: "Arial, sans-serif",
  fontSize: "12px",
  lineHeight: "1.5",
};
const footerLink = { color: EMAIL_COLOR.muted };
