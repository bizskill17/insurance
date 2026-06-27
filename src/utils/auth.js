const AUTH_STORAGE_KEY = "insurance_auth_user";

export function parseUserViews(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function parseUserPermissions(value, fallbackViews = []) {
  if (value === undefined || value === null || value === "") {
    return Array.isArray(fallbackViews) ? fallbackViews : [];
  }

  return parseUserViews(value);
}

export function normalizeAuthUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  const views = parseUserViews(user.views);

  return {
    ...user,
    id: user.id ? Number(user.id) : null,
    organization_id: user.organization_id ? Number(user.organization_id) : null,
    can_manage_organizations: Boolean(user.can_manage_organizations),
    views,
    add_permissions: parseUserPermissions(user.add_permissions, views),
    edit_permissions: parseUserPermissions(user.edit_permissions, views),
    delete_permissions: parseUserPermissions(user.delete_permissions, views)
  };
}

export function getStoredAuthUser() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeAuthUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user) {
  const normalized = normalizeAuthUser(user);

  if (!normalized) {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalized));
}

export function clearStoredAuthUser() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}