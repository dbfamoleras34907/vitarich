export function getNavigationPermissionTitle(child: { title: string; permissionTitle?: string; view?: boolean }) {
  const title = child.permissionTitle ?? child.title
  return child.view === true ? `${title}/view` : title
}

export function canInsertDocument(
  child: { url: string; insert?: boolean; newDocumentUrl?: string },
  permissions: ReadonlyArray<{ ilink?: string; is_visible: boolean }>,
  userType: number,
) {
  return child.insert === true &&
    Boolean(child.newDocumentUrl) &&
    (userType === 1 || permissions.some(
      permission => permission.ilink === `${child.url}/insert` && permission.is_visible,
    ))
}
