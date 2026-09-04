import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import VnmForm from '../../VnmForm'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <NavigationBar currentLabel="" fatherLabel=""><VnmForm documentId={Number(id)} /></NavigationBar>
}
