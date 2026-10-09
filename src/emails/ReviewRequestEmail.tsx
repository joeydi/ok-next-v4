import { render, Section, Text } from "react-email";
import { EMAIL_COLOR, emailMeta, emailText, SiteCheckEmailShell } from "./SiteCheckEmailShell";

export type ReviewRequestEmailProps = {
  subject: string;
  request: string;
  scoreLine: string;
  categories: { name: string; score: number | null }[];
  results: { mark: string; status: "ok" | "warn" | "fail" | "skipped"; summary: string }[];
  runLine: string;
  attachment: string;
};

export function ReviewRequestEmail({
  subject,
  request,
  scoreLine,
  categories,
  results,
  runLine,
  attachment,
}: ReviewRequestEmailProps) {
  return (
    <SiteCheckEmailShell title={subject} preview={request}>
      <Text style={emailText}>{request}</Text>
      <Section style={scoreCard}>
        <Text style={score}>{scoreLine}</Text>
        <ScoreBreakdown categories={categories} />
      </Section>
      <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" border={0} style={resultsTable}>
        <tbody>
          {results.map((result, index) => (
            <tr key={`${result.summary}-${index}`}>
              <td width="38" valign="top" style={markCell}>
                <span style={{ ...statusMark, color: statusColor[result.status] }}>{result.mark}</span>
              </td>
              <td style={resultCell}>{result.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Text style={emailMeta}>
        {runLine}
        <br />
        {attachment}
      </Text>
    </SiteCheckEmailShell>
  );
}

export const renderReviewRequestEmail = (props: ReviewRequestEmailProps) => render(<ReviewRequestEmail {...props} />);

function ScoreBreakdown({ categories }: { categories: ReviewRequestEmailProps["categories"] }) {
  return (
    <table role="presentation" width="100%" cellSpacing="0" cellPadding="0" border={0} style={breakdownTable}>
      <tbody>
        {categories.map((category, index) => {
          const isLast = index === categories.length - 1;
          return (
            <tr key={category.name}>
              <td width="124" style={isLast ? breakdownNameLast : breakdownName}>
                {category.name}
              </td>
              <td style={isLast ? breakdownBarCellLast : breakdownBarCell}>
                <table
                  role="presentation"
                  width="100%"
                  cellSpacing="0"
                  cellPadding="0"
                  border={0}
                  style={breakdownTrack}
                >
                  <tbody>
                    <tr>
                      <td width={`${category.score ?? 0}%`} height="6" style={breakdownFill} />
                      <td height="6" />
                    </tr>
                  </tbody>
                </table>
              </td>
              <td width="42" align="right" style={isLast ? breakdownValueLast : breakdownValue}>
                {category.score ?? "n/a"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const scoreCard = {
  margin: "0 0 24px",
  padding: "20px 20px 8px",
  borderLeft: `3px solid ${EMAIL_COLOR.pink}`,
  backgroundColor: EMAIL_COLOR.paper,
};
const score = { ...emailText, margin: "0 0 8px", fontWeight: 700 };
const breakdownTable = {
  width: "100%",
  margin: "8px 0 0",
  borderTop: `1px solid ${EMAIL_COLOR.rule}`,
};
const breakdownName = {
  padding: "12px 12px 12px 0",
  borderBottom: `1px solid ${EMAIL_COLOR.rule}`,
  color: EMAIL_COLOR.muted,
  fontFamily: "Arial, sans-serif",
  fontSize: "16px",
  lineHeight: "1.3",
};
const breakdownNameLast = { ...breakdownName, borderBottom: 0 };
const breakdownBarCell = {
  padding: "12px 12px",
  borderBottom: `1px solid ${EMAIL_COLOR.rule}`,
};
const breakdownBarCellLast = { ...breakdownBarCell, borderBottom: 0 };
const breakdownTrack = { width: "100%", backgroundColor: EMAIL_COLOR.paperLight };
const breakdownFill = { backgroundColor: EMAIL_COLOR.ink, fontSize: 0, lineHeight: 0 };
const breakdownValue = {
  padding: "12px 0 12px 8px",
  borderBottom: `1px solid ${EMAIL_COLOR.rule}`,
  color: EMAIL_COLOR.ink,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "14px",
  lineHeight: "1.3",
};
const breakdownValueLast = { ...breakdownValue, borderBottom: 0 };
const resultsTable = { width: "100%", margin: "0 0 24px" };
const markCell = {
  padding: "7px 0",
  borderBottom: `1px solid ${EMAIL_COLOR.rule}`,
  fontFamily: "Arial, sans-serif",
  fontSize: "15px",
  fontWeight: 700,
  lineHeight: "1.45",
};
const statusMark = {
  display: "inline-block",
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  backgroundColor: EMAIL_COLOR.ink,
  lineHeight: "24px",
  textAlign: "center" as const,
};
const statusColor = {
  ok: EMAIL_COLOR.termGreen,
  warn: EMAIL_COLOR.termYellow,
  fail: EMAIL_COLOR.pink,
  skipped: EMAIL_COLOR.muted,
} as const;
const resultCell = {
  padding: "7px 0",
  borderBottom: `1px solid ${EMAIL_COLOR.rule}`,
  color: EMAIL_COLOR.ink,
  fontFamily: "Arial, sans-serif",
  fontSize: "15px",
  lineHeight: "1.45",
};
