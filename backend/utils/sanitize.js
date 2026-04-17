const escapeHtml = (str) => {
  if (str == null) return str;
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

const stripTags = (str) => {
  if (str == null) return str;
  return String(str).replace(/<[^>]*>/g, '');
};

const sanitizePlainText = (str, maxLength = 5000) => {
  if (str == null) return str;
  let s = String(str);
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return stripTags(s).trim();
};

module.exports = { escapeHtml, stripTags, sanitizePlainText };
