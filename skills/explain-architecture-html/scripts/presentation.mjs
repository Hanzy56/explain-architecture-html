import fs from "node:fs";

export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function readPresentation(file) {
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const key of [
    "diagramHref",
    "backHref",
    "linkTitle",
    "linkKicker",
    "linkDescription",
  ]) {
    if (typeof config[key] !== "string" || !config[key].trim())
      throw new Error(`Missing presentation field: ${key}`);
  }
  for (const key of ["diagramHref", "backHref"]) {
    if (!/^[\w.-]+\.html(?:#[\w=-]+)?$/.test(config[key]))
      throw new Error(
        `${key} must reference a local HTML filename and optional fragment`,
      );
  }
  return config;
}
