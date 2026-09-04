import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import VnmView from './Layout'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <NavigationBar currentLabel="" fatherLabel=""><VnmView documentId={Number(id)} /></NavigationBar>
}
