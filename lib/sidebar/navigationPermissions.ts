export function getNavigationPermissionTitle(child: { title: string; view?: boolean }) {
  return child.view === true ? `${child.title}/view` : child.title
}
