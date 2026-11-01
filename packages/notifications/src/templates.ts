import { provinceName } from "@licita/domain/provinces";

import { notificationsEnv } from "./env.ts";
import type { EmailMessage } from "./mailer.ts";

const APP_NAME = "Licita";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const euro = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const dateFormat = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});

function layout(title: string, body: string, footer: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;font-weight:600;font-size:16px">${APP_NAME}</td></tr>
<tr><td style="padding:24px">${body}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export function passwordResetEmail({ to, url }: { to: string; url: string }): EmailMessage {
  const title = "Restablecer contraseña";
  return {
    to,
    subject: `${APP_NAME}: restablece tu contraseña`,
    text: `Hemos recibido una solicitud para restablecer tu contraseña.\n\nAbre este enlace (válido durante 1 hora):\n${url}\n\nSi no lo has solicitado, ignora este correo.`,
    html: layout(
      title,
      `<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
<p style="margin:0 0 20px;line-height:1.5">Hemos recibido una solicitud para restablecer tu contraseña. El enlace es válido durante 1 hora.</p>
<a href="${escapeHtml(url)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Elegir nueva contraseña</a>`,
      "Si no lo has solicitado, puedes ignorar este correo.",
    ),
  };
}

export interface DigestTender {
  tenderId: string;
  title: string;
  authorityName: string | null;
  score: number;
  baseBudgetExVatEur: number | null;
  submissionDeadlineAt: Date | null;
  executionProvinces: string[];
  officialUrl: string | null;
  firstReason?: string;
}

export interface DigestSection {
  profileName: string;
  tenders: DigestTender[];
}

const MAX_PER_SECTION = 20;

function tenderLines(t: DigestTender, appUrl: string) {
  const facts = [
    t.authorityName,
    t.baseBudgetExVatEur != null ? `${euro.format(t.baseBudgetExVatEur)} sin IVA` : null,
    t.submissionDeadlineAt ? `Plazo: ${dateFormat.format(t.submissionDeadlineAt)}` : null,
    t.executionProvinces.length
      ? t.executionProvinces.map((p) => provinceName(p) ?? p).join(", ")
      : null,
  ].filter(Boolean) as string[];
  return { facts, detailUrl: `${appUrl}/licitaciones/${t.tenderId}` };
}

export function digestEmail({
  to,
  heading,
  intro,
  sections,
  subjectPrefix = APP_NAME,
}: {
  to: string;
  heading: string;
  intro: string;
  sections: DigestSection[];
  subjectPrefix?: string;
}): EmailMessage {
  const appUrl = notificationsEnv().APP_URL.replace(/\/$/, "");
  const total = sections.reduce((n, s) => n + s.tenders.length, 0);

  const htmlSections = sections
    .map((section) => {
      const items = section.tenders
        .slice(0, MAX_PER_SECTION)
        .map((t) => {
          const { facts, detailUrl } = tenderLines(t, appUrl);
          return `<tr><td style="padding:14px 0;border-top:1px solid #e2e8f0">
<a href="${escapeHtml(detailUrl)}" style="color:#0f172a;font-weight:600;text-decoration:none;line-height:1.4">${escapeHtml(t.title)}</a>
<div style="font-size:13px;color:#475569;margin-top:4px">${facts.map(escapeHtml).join(" · ")}</div>
${t.firstReason ? `<div style="font-size:12px;color:#64748b;margin-top:4px">${escapeHtml(t.firstReason)}</div>` : ""}
<div style="font-size:12px;margin-top:6px">Relevancia ${Math.round(t.score)}/100 · <a href="${escapeHtml(detailUrl)}" style="color:#1d4ed8">Ver ficha</a>${t.officialUrl ? ` · <a href="${escapeHtml(t.officialUrl)}" style="color:#1d4ed8">Expediente oficial</a>` : ""}</div>
</td></tr>`;
        })
        .join("");
      const more =
        section.tenders.length > MAX_PER_SECTION
          ? `<p style="font-size:13px;margin:8px 0 0"><a href="${appUrl}/dashboard" style="color:#1d4ed8">Y ${section.tenders.length - MAX_PER_SECTION} más en tu panel</a></p>`
          : "";
      return `<h2 style="font-size:15px;margin:24px 0 4px">${escapeHtml(section.profileName)} <span style="color:#64748b;font-weight:400">(${section.tenders.length})</span></h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>${more}`;
    })
    .join("");

  const textSections = sections
    .map((section) => {
      const items = section.tenders
        .slice(0, MAX_PER_SECTION)
        .map((t) => {
          const { facts, detailUrl } = tenderLines(t, appUrl);
          return `- ${t.title}\n  ${facts.join(" · ")}\n  Relevancia ${Math.round(t.score)}/100\n  Ficha: ${detailUrl}${t.officialUrl ? `\n  Expediente oficial: ${t.officialUrl}` : ""}`;
        })
        .join("\n");
      return `## ${section.profileName} (${section.tenders.length})\n${items}`;
    })
    .join("\n\n");

  const footer = `La puntuación de relevancia indica el encaje con tu perfil de alertas; no es una probabilidad de adjudicación ni valida tu capacidad legal para licitar. Comprueba siempre los datos en el expediente oficial. <a href="${appUrl}/alertas" style="color:#64748b">Gestionar alertas y frecuencia</a>.`;

  return {
    to,
    subject: `${subjectPrefix}: ${total} ${total === 1 ? "licitación relevante" : "licitaciones relevantes"}`,
    html: layout(
      heading,
      `<h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(heading)}</h1><p style="margin:0;color:#475569;line-height:1.5">${escapeHtml(intro)}</p>${htmlSections}`,
      footer,
    ),
    text: `${heading}\n\n${intro}\n\n${textSections}\n\n—\nLa puntuación indica el encaje con tu perfil; no es una probabilidad de adjudicación. Gestiona tus alertas: ${appUrl}/alertas`,
  };
}
