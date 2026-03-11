// backend/utils/email.js
function canonicalizeEmail(raw) {
  if (!raw) return "";
  let email = String(raw).trim().toLowerCase();

  const at = email.indexOf("@");
  if (at === -1) return email;

  let local = email.slice(0, at);
  let domain = email.slice(at + 1);

  // Normalize googlemail -> gmail
  if (domain === "googlemail.com") domain = "gmail.com";

  if (domain === "gmail.com") {
    // Drop +tag and remove dots in local-part for Gmail
    local = local.split("+")[0].replace(/\./g, "");
  }

  return `${local}@${domain}`;
}

module.exports = { canonicalizeEmail };
