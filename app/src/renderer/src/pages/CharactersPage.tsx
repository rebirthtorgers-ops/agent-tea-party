import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { PersonaStudio } from '../components/PersonaStudio'

export function CharactersPage() {
  const navigate = useNavigate()
  return (
    <PageShell
      title="社区娘化 AI"
      eyebrow="LOCAL CHARACTER PRESETS"
      subtitle="内置角色包只是本地人格模板，不是模型供应商，也不自带 API Key。创建后头像会复制到你的应用数据目录。"
      wide
    >
      <PersonaStudio initialMode="characters" onCreated={() => navigate('/agents')} onConfigProvider={() => navigate('/providers')} />
    </PageShell>
  )
}
