export function getNavigationPermissionTitle(child: { title: string; view?: boolean }) {
  return child.view === true ? `${child.title}/view` : child.title
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
