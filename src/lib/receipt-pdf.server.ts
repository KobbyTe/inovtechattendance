/**
 * Minimal, dependency-free PDF writer (single page, Helvetica) used for
 * payment receipts. Worker-safe: pure string/Buffer work, no DOM, no natives.
 */

export type ReceiptData = {
  receiptNo: string;
  orgName: string;
  studentName: string;
  studentCode: string;
  planName: string;
  installmentLabel: string;
  amount: number;
  currency: string;
  channel: string;
  provider?: string | null;
  reference?: string | null;
  paidAt: string;
  invoiceTotal: number;
  balanceRemaining: number;
};

function esc(s: string) {
  return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function ascii(s: string) {
  return String(s)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E]/g, "");
}

function money(n: number, currency: string) {
  return `${currency} ${n.toFixed(2)}`;
}

type Line = { text: string; size: number; bold?: boolean; gap?: number };

/** Build the PDF bytes for one receipt. */
export function buildReceiptPdf(d: ReceiptData): Buffer {
  const lines: Line[] = [
    { text: d.orgName, size: 18, bold: true, gap: 26 },
    { text: "Payment receipt", size: 12, gap: 30 },
    { text: `Receipt no.   ${d.receiptNo}`, size: 11, gap: 18 },
    { text: `Date          ${d.paidAt}`, size: 11, gap: 26 },
    { text: "Student", size: 11, bold: true, gap: 18 },
    { text: `${d.studentName} (${d.studentCode})`, size: 11, gap: 26 },
    { text: "Payment", size: 11, bold: true, gap: 18 },
    { text: `Plan          ${d.planName}`, size: 11, gap: 16 },
    { text: `Installment   ${d.installmentLabel}`, size: 11, gap: 16 },
    { text: `Channel       ${d.channel}${d.provider ? ` (${d.provider})` : ""}`, size: 11, gap: 16 },
    ...(d.reference
      ? [{ text: `Reference     ${d.reference}`, size: 11, gap: 16 } as Line]
      : []),
    { text: `Amount paid   ${money(d.amount, d.currency)}`, size: 13, bold: true, gap: 26 },
    { text: "Invoice", size: 11, bold: true, gap: 18 },
    { text: `Invoice total     ${money(d.invoiceTotal, d.currency)}`, size: 11, gap: 16 },
    { text: `Balance remaining ${money(d.balanceRemaining, d.currency)}`, size: 11, gap: 34 },
    {
      text:
        d.balanceRemaining <= 0
          ? "This installment is fully settled. Thank you."
          : "Thank you. The balance above remains outstanding.",
      size: 10,
      gap: 20,
    },
    { text: "Computer generated receipt - no signature required.", size: 9, gap: 0 },
  ];

  let y = 780;
  const parts: string[] = ["0.08 0.09 0.11 rg"];
  for (const l of lines) {
    parts.push(
      `BT /${l.bold ? "F2" : "F1"} ${l.size} Tf 56 ${y} Td (${esc(ascii(l.text))}) Tj ET`,
    );
    y -= l.gap ?? 16;
  }
  // rules
  parts.push("0.85 0.86 0.88 RG 0.8 w 56 792 m 539 792 l S");
  parts.push(`56 ${y - 8} m 539 ${y - 8} l S`);

  const content = parts.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
