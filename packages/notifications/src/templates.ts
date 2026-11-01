import { ACTION_TYPE_LABELS, type ActionType } from "@felina/domain/felina";

import { notificationsEnv } from "./env.ts";
import type { EmailMessage } from "./mailer.ts";

export const APP_NAME = "GestiónFelina";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const dateTimeFormat = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export function appUrl(path = "/"): string {
  return `${notificationsEnv().APP_URL.replace(/\/$/, "")}${path}`;
}

function layout(title: string, body: string, footer: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f7f5f1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e7e2da;border-radius:12px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e7e2da;font-weight:600;font-size:16px">${APP_NAME}</td></tr>
<tr><td style="padding:24px">${body}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e7e2da;font-size:12px;color:#78716c">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a>`;
}

function simpleEmail({
  to,
  subject,
  title,
  paragraphs,
  action,
  footer = "Recibes este correo porque participas en una organización de GestiónFelina.",
}: {
  to: string;
  subject: string;
  title: string;
  paragraphs: string[];
  action?: { url: string; label: string };
  footer?: string;
}): EmailMessage {
  const html = layout(
    title,
    `<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(p)}</p>`).join("\n")}
${action ? `<p style="margin:20px 0 0">${button(action.url, action.label)}</p>` : ""}`,
    escapeHtml(footer),
  );
  const text = [title, "", ...paragraphs, ...(action ? ["", `${action.label}: ${action.url}`] : [])]
    .join("\n")
    .concat(`\n\n—\n${footer}`);
  return { to, subject: `${APP_NAME}: ${subject}`, html, text };
}

export function passwordResetEmail({ to, url }: { to: string; url: string }): EmailMessage {
  return simpleEmail({
    to,
    subject: "restablece tu contraseña",
    title: "Restablecer contraseña",
    paragraphs: [
      "Hemos recibido una solicitud para restablecer tu contraseña. El enlace es válido durante 1 hora.",
    ],
    action: { url, label: "Elegir nueva contraseña" },
    footer: "Si no lo has solicitado, puedes ignorar este correo.",
  });
}

export function invitationEmail({
  to,
  organizationName,
  inviterName,
  role,
  url,
  expiresInDays,
}: {
  to: string;
  organizationName: string;
  inviterName: string | null;
  role: "admin" | "member";
  url: string;
  expiresInDays: number;
}): EmailMessage {
  const who = inviterName ? `${inviterName} te ha invitado` : "Te han invitado";
  return simpleEmail({
    to,
    subject: `invitación a ${organizationName}`,
    title: `Únete a ${organizationName}`,
    paragraphs: [
      `${who} a ${organizationName} en ${APP_NAME}${role === "admin" ? " como administrador/a" : ""}.`,
      `Crea tu cuenta (o inicia sesión) con este email: ${to}. La invitación caduca en ${expiresInDays} días.`,
    ],
    action: { url, label: "Aceptar invitación" },
    footer: "Si no esperabas esta invitación, ignora este correo.",
  });
}

export function organizationReviewedEmail({
  to,
  organizationName,
  status,
  note,
}: {
  to: string;
  organizationName: string;
  status: "approved" | "rejected" | "suspended" | "pending";
  note: string | null;
}): EmailMessage {
  const titles = {
    approved: `${organizationName} ya está aprobada`,
    rejected: `No hemos podido aprobar ${organizationName}`,
    suspended: `${organizationName} está suspendida`,
    pending: `${organizationName} vuelve a estar en revisión`,
  } as const;
  const bodies = {
    approved: "Ya podéis registrar colonias, gatos y acciones e invitar a más personas.",
    rejected: "La solicitud de alta no se ha aprobado.",
    suspended: "Mientras dure la suspensión no podréis acceder a los datos de la organización.",
    pending: "La organización está de nuevo pendiente de revisión.",
  } as const;
  return simpleEmail({
    to,
    subject: titles[status],
    title: titles[status],
    paragraphs: [bodies[status], ...(note ? [`Nota del equipo: ${note}`] : [])],
    action: { url: appUrl("/panel"), label: "Ir a GestiónFelina" },
  });
}

export function newOrganizationEmail({
  to,
  organizationName,
}: {
  to: string;
  organizationName: string;
}): EmailMessage {
  return simpleEmail({
    to,
    subject: `nueva asociación pendiente: ${organizationName}`,
    title: "Nueva asociación pendiente de aprobación",
    paragraphs: [`${organizationName} se ha registrado y espera tu revisión.`],
    action: { url: appUrl("/admin"), label: "Revisar solicitudes" },
    footer: "Recibes este correo porque eres superadministrador/a de GestiónFelina.",
  });
}

export function proposalReceivedEmail({
  to,
  townHallName,
  targetLabel,
  url,
}: {
  to: string;
  townHallName: string;
  targetLabel: string;
  url: string;
}): EmailMessage {
  return simpleEmail({
    to,
    subject: `${townHallName} propone un cambio`,
    title: "Propuesta de cambio del ayuntamiento",
    paragraphs: [
      `${townHallName} propone modificar ${targetLabel}. Los cambios no se aplican hasta que una persona administradora de tu asociación los acepte.`,
    ],
    action: { url, label: "Revisar propuesta" },
  });
}

export function proposalResolvedEmail({
  to,
  targetLabel,
  accepted,
  note,
  url,
}: {
  to: string;
  targetLabel: string;
  accepted: boolean;
  note: string | null;
  url: string;
}): EmailMessage {
  const title = accepted ? "Propuesta aceptada" : "Propuesta rechazada";
  return simpleEmail({
    to,
    subject: `${title.toLowerCase()}: ${targetLabel}`,
    title,
    paragraphs: [
      accepted
        ? `La asociación gestora ha aceptado tu propuesta sobre ${targetLabel}; los cambios ya están aplicados.`
        : `La asociación gestora ha rechazado tu propuesta sobre ${targetLabel}.`,
      ...(note ? [`Comentario: ${note}`] : []),
    ],
    action: { url, label: "Ver detalle" },
  });
}

export interface ReminderAction {
  id: string;
  name: string;
  actionType: ActionType;
  scheduledAt: Date;
  isUrgent: boolean;
  colonyName: string | null;
}

export function actionRemindersEmail({
  to,
  actions,
}: {
  to: string;
  actions: ReminderAction[];
}): EmailMessage {
  const lines = actions.map((a) => {
    const when = dateTimeFormat.format(a.scheduledAt);
    const where = a.colonyName ? ` · ${a.colonyName}` : "";
    return {
      text: `${a.isUrgent ? "[URGENTE] " : ""}${a.name} (${ACTION_TYPE_LABELS[a.actionType]}) — ${when}${where}\n  ${appUrl(`/acciones/${a.id}`)}`,
      html: `<tr><td style="padding:12px 0;border-top:1px solid #e7e2da">
${a.isUrgent ? '<span style="color:#b91c1c;font-weight:600;font-size:12px">URGENTE · </span>' : ""}<a href="${escapeHtml(appUrl(`/acciones/${a.id}`))}" style="color:#1c1917;font-weight:600;text-decoration:none">${escapeHtml(a.name)}</a>
<div style="font-size:13px;color:#57534e;margin-top:4px">${escapeHtml(ACTION_TYPE_LABELS[a.actionType])} · ${escapeHtml(when)}${escapeHtml(where)}</div></td></tr>`,
    };
  });
  const title =
    actions.length === 1 ? "Tienes 1 acción hoy" : `Tienes ${actions.length} acciones hoy`;
  const footer = "Recibes este recordatorio porque participas en estas acciones.";
  return {
    to,
    subject: `${APP_NAME}: ${title.toLowerCase()}`,
    html: layout(
      title,
      `<h1 style="font-size:20px;margin:0 0 8px">${escapeHtml(title)}</h1><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines.map((l) => l.html).join("")}</table>`,
      footer,
    ),
    text: `${title}\n\n${lines.map((l) => `- ${l.text}`).join("\n")}\n\n—\n${footer}`,
  };
}
