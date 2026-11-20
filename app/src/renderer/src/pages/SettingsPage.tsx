import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Database, Download, FolderOpen, Loader2, RotateCcw, Save, ShieldCheck, Upload, UserRound } from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { useApp } from '../store'
import { PageShell } from '../components/PageShell'
import { Modal } from '../components/Modal'

export function SettingsPage() {
  const settings = useApp((s) => s.settings)
  const saveSettings = useApp((s) => s.saveSettings)
  const version = useApp((s) => s.version)
  const dataDir = useApp((s) => s.dataDir)
  const toast = useApp((s) => s.toast)
  const refreshAll = useApp((s) => s.refreshAll)
  const navigate = useNavigate()

  const [form, setForm] = useState<AppSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [importing, setImporting] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => { setForm(settings) }, [settings])

  function patch<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      await saveSettings({
        userName: form.userName.trim() || '旅人',
        autoMemory: form.autoMemory,
        demoMode: form.demoMode,
        allowPrivateNetwork: form.allowPrivateNetwork,
        contextLimit: Math.max(4000, Number(form.contextLimit) || 32000),
        maxContextChars: Math.max(4000, Number(form.maxContextChars) || 24000)
      })
      toast('设置已保存在本地', 'success')
    } finally { setSaving(false) }
  }

  async function exportBackup() {
    setBusy('export')
    try {
      const res = await window.tea.exportBackup()
      if (res.ok) toast(`备份已导出：${res.data}`, 'success')
      else if (!res.error?.includes('取消')) toast(res.error, 'error')
    } finally { setBusy(null) }
  }

  async function importBackup() {
    setBusy('import')
    try {
      const res = await window.tea.importBackup()
      if (!res.ok) {
        if (!res.error?.includes('取消')) toast(res.error, 'error')
        return
      }
      await refreshAll()
      toast(`已从备份恢复：${res.data}`, 'success')
      setImporting(false)
    } finally { setBusy(null) }
  }

  return (
    <PageShell
      title="应用设置"
      eyebrow="PREFERENCES"
      subtitle="所有设置只保存在这台设备上。这里是本地工作台，没有云端账号，也没有遥测上报。"
      actions={<button className="btn primary" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} 保存设置</button>}
      wide
    >
      <div className="settings-grid">
        <section className="settings-card">
          <header><span className="settings-icon"><UserRound size={17} /></span><div><h3>对话偏好</h3><p>你希望 Agent 怎么称呼你，以及记忆与上下文的策略</p></div></header>
          <label className="field"><span>用户称呼</span><input value={form.userName} onChange={(e) => patch('userName', e.target.value)} placeholder="旅人" maxLength={32} /></label>
          <label className="switch-row">
            <div><strong>开启独立记忆</strong><p>聊天后自动沉淀短期记忆，并可按相关度路由进上下文</p></div>
            <button className={`switch ${form.autoMemory ? 'on' : ''}`} onClick={() => patch('autoMemory', !form.autoMemory)}><span /></button>
          </label>
          <div className="form-grid two">
            <label className="field"><span>模型上下文上限（Token）</span><input type="number" min={4000} step={1000} value={form.contextLimit} onChange={(e) => patch('contextLimit', Number(e.target.value))} /></label>
            <label className="field"><span>单次请求最大上下文字符</span><input type="number" min={4000} step={1000} value={form.maxContextChars} onChange={(e) => patch('maxContextChars', Number(e.target.value))} /></label>
          </div>
          <p className="hint">接近上限时会先整理摘要再续接，不会把完整历史无限发送。</p>
        </section>

        <section className="settings-card">
          <header><span className="settings-icon"><ShieldCheck size={17} /></span><div><h3>网络与模拟</h3><p>控制网络边界，以及没有 Key 时的体验方式</p></div></header>
          <label className="switch-row">
            <div><strong>允许私有网络地址</strong><p>允许连接 127.0.0.1、局域网与自定义内网地址。开启前请确认这些服务由你自己管理</p></div>
            <button className={`switch ${form.allowPrivateNetwork ? 'on' : ''}`} onClick={() => patch('allowPrivateNetwork', !form.allowPrivateNetwork)}><span /></button>
          </label>
          <label className="switch-row">
            <div><strong>演示模式（模拟回复）</strong><p>开启后所有对话使用本地模拟回复，不消耗 Token，也不会访问网络。演示内容会明确标注</p></div>
            <button className={`switch ${form.demoMode ? 'on' : ''}`} onClick={() => patch('demoMode', !form.demoMode)}><span /></button>
          </label>
          <div className="notice soft"><p>演示模式只适合先体验界面与流程。接入真实模型请关闭它，并在「模型与 API」里配置 Provider。</p></div>
        </section>

        <section className="settings-card span-two">
          <header><span className="settings-icon"><Database size={17} /></span><div><h3>本地数据</h3><p>数据库、头像与角色配置都在本机。导出的备份包含聊天记录，但不包含 API Key</p></div></header>
          <div className="data-row-line"><span className="hint">数据目录</span><code>{dataDir || '读取中…'}</code><button className="btn ghost tiny-btn" onClick={() => void window.tea.revealDataDir()}><FolderOpen size={13} /> 打开</button></div>
          <div className="backup-actions">
            <button className="btn soft" onClick={() => void exportBackup()} disabled={busy !== null}>{busy === 'export' ? <Loader2 size={15} className="spin" /> : <Download size={15} />} 导出备份</button>
            <button className="btn ghost" onClick={() => setImporting(true)} disabled={busy !== null}><Upload size={15} /> 从备份恢复</button>
          </div>
          <p className="hint">恢复会覆盖当前数据库与头像目录。应用会先把当前数据库另存一份，再执行恢复。</p>
        </section>

        <section className="settings-card">
          <header><span className="settings-icon"><RotateCcw size={17} /></span><div><h3>引导与信息</h3><p>重新走一遍首次启动流程，或查看当前版本</p></div></header>
          <div className="info-line"><span>版本</span><strong>v{version || '1.0.0'}</strong></div>
          <div className="info-line"><span>数据策略</span><strong>本地优先 · 无遥测</strong></div>
          <button className="btn ghost wide-btn" onClick={() => setResetting(true)}>重新查看首次启动引导 <ArrowRight size={15} /></button>
        </section>

        <section className="settings-card">
          <header><span className="settings-icon"><ShieldCheck size={17} /></span><div><h3>隐私说明</h3><p>你的 Key 与聊天记录去了哪里</p></div></header>
          <ul className="plain-list">
            <li>API Key 使用系统凭据（DPAPI）加密，不进入数据库或日志</li>
            <li>聊天只在本地数据库保存，不会上传到开发者服务器</li>
            <li>在线请求只发送到你选择的模型供应商地址</li>
            <li>导出备份不包含 API Key，分享前请自行检查内容</li>
          </ul>
        </section>
      </div>

      {importing ? (
      <Modal title="从备份恢复？" subtitle="当前数据库与头像会被备份中的内容替换" onClose={() => setImporting(false)} width={460}
        footer={<><button className="btn ghost" onClick={() => setImporting(false)} disabled={busy !== null}>取消</button><button className="btn primary" onClick={() => void importBackup()} disabled={busy !== null}>{busy === 'import' ? <Loader2 size={15} className="spin" /> : <Upload size={15} />} 选择备份并恢复</button></>}>
        <p>接下来会打开文件选择器，请选择由本应用导出的 .zip 备份。恢复会覆盖当前 Agent、茶会与聊天记录；API Key 不在备份内，需要重新填写。</p>
      </Modal>
      ) : null}

      {resetting ? (
      <Modal title="重新查看首次启动引导？" subtitle="不会删除任何数据" onClose={() => setResetting(false)} width={440}
        footer={<><button className="btn ghost" onClick={() => setResetting(false)}>取消</button><button className="btn primary" onClick={async () => { await saveSettings({ onboarded: false }); setResetting(false); navigate('/onboarding') }}>进入引导</button></>}>
        <p>引导会带你重新配置 Provider 并创建 Agent。已经存在的 Agent、茶会与聊天记录都会保留，不会被覆盖。</p>
      </Modal>
      ) : null}
    </PageShell>
  )
}
