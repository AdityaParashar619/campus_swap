export const SATI_EMAIL_PATTERN = /^[a-z]+[0-9]{2}(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{3}@satiengg\.in$/;
export const normalizeInstitutionalEmail = (email) => String(email || '').trim().toLowerCase();
export const isValidInstitutionalEmail = (email) => SATI_EMAIL_PATTERN.test(normalizeInstitutionalEmail(email));
