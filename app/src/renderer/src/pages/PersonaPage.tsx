import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { PersonaStudio } from '../components/PersonaStudio'

export function PersonaPage() {
  const navigate = useNavigate()
  return (
    <PageShell
      title="人格工作室"
      eyebrow="PERSONA ATELIER"
      subtitle="四种方式并存：社区预设、十道题、Markdown 导入、自由输入。生成只是草稿，你的手动修改永远优先。"
      wide
    >
      <PersonaStudio onCreated={() => navigate('/agents')} onConfigProvider={() => navigate('/providers')} initialMode="questions" />
    </PageShell>
  )
}
