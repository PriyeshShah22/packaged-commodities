/**
 * Utility to parse and format authenticated inspector profile details cleanly.
 * Guarantees that internal UUIDs/IDs are NEVER used as the person's display name,
 * and extracts the true human-readable display name, first name, initials, and role.
 */

function isUuidOrId(val) {
  if (!val) return false;
  const s = String(val).trim();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
    /^[0-9a-f]{20,}$/i.test(s) ||
    /^#?lm-[0-9a-f-]+$/i.test(s)
  );
}

function cleanHumanName(raw) {
  if (!raw) return '';
  let str = String(raw).trim();

  // If the raw string is an internal ID or UUID, reject it
  if (isUuidOrId(str)) return '';

  // Strip formal prefixes like "Insp.", "Inspector", "Officer", "Mr.", "Ms.", etc.
  str = str.replace(/^(insp\.?|inspector|officer|mr\.?|ms\.?|mrs\.?|dr\.?)\s+/i, '').trim();

  // If email was passed (e.g. officer.sharma@...), convert to capitalized name
  if (str.includes('@')) {
    str = str.split('@')[0].replace(/[._-]+/g, ' ');
  }

  // Capitalize words
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function parseInspectorName(user) {
  if (!user) {
    return {
      fullName: 'Inspector',
      titleName: 'Insp. Officer',
      firstName: 'Inspector',
      initials: 'IO',
      role: 'INSPECTOR',
      shortId: '#LM-8492',
      fullId: '#LM-8492',
    };
  }

  // Check candidate fields in order of human-readability
  const candidates = [
    user.displayName,
    user.full_name,
    user.fullName,
    user.name,
    user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null,
    user.username,
    user.email,
  ];

  let resolvedName = '';
  for (const c of candidates) {
    if (c && !isUuidOrId(c)) {
      const cleaned = cleanHumanName(c);
      if (cleaned && cleaned.length >= 2) {
        resolvedName = cleaned;
        break;
      }
    }
  }

  // If no name found or invalid, fallback to professional default
  const fullName = resolvedName || 'Inspector';

  // Extract First Name for friendly greeting
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || 'Inspector';

  // Compute initials (e.g. Ramesh Sharma -> RS, Priya Shah -> PS, Sameer Musani -> SM, Sameer -> SM)
  let initials = 'IO';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    initials = parts[0].substring(0, 2).toUpperCase();
  } else if (parts.length === 1) {
    initials = parts[0][0].toUpperCase();
  }

  // Formal title format for display
  const titleName = fullName === 'Inspector' ? 'Inspector' : `Insp. ${fullName}`;

  // Role extraction from user.roles array or user.role string
  let role = 'INSPECTOR';
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    role = user.roles.map((r) => String(r).toUpperCase()).join(' · ');
  } else if (user.role) {
    role = String(user.role).toUpperCase();
  }

  // Clean, truncated ID/Badge: NEVER overflow outside card
  const rawId = String(user.officerId || user.badge || user.id || '').trim();
  let shortId = '#LM-8492';
  let fullId = rawId || '#LM-8492';

  if (rawId) {
    const strippedId = rawId.replace(/^#?lm-?/i, '');
    if (strippedId.length > 8) {
      shortId = `#LM-${strippedId.slice(0, 8)}…`;
    } else {
      shortId = `#LM-${strippedId}`;
    }
  }

  return {
    fullName,
    titleName,
    firstName,
    initials,
    role,
    shortId,
    fullId,
  };
}
