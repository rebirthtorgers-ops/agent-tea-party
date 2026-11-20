import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { PersonaStudio } from '../components/PersonaStudio'

export function CharactersPage() {
  const navigate = useNavigate()
  return (
    <PageShell
      title="社区娘化 AI"
      eyebrow="LOCAL CHARACTER PRESETS"
      subtitle="本地人格模板，参考公开社区设定重绘。不含 API Key，头像保存在本机。"
      wide
    >
      <PersonaStudio initialMode="characters" onCreated={() => navigate('/agents')} onConfigProvider={() => navigate('/providers')} />
    </PageShell>
  )
}
