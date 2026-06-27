ALTER TABLE users
  ADD COLUMN add_permissions LONGTEXT NULL AFTER views,
  ADD COLUMN edit_permissions LONGTEXT NULL AFTER add_permissions,
  ADD COLUMN delete_permissions LONGTEXT NULL AFTER edit_permissions;
