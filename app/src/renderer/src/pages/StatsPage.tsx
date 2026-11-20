import { useEffect } from 'react'
import { BarChart3, Coins, Database, RefreshCw, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { useApp } from '../store'
import { PageShell } from '../components/PageShell'
import { EmptyState } from '../components/EmptyState'
import { formatMoney, formatNumber } from '../utils'

export function StatsPage() {
  const stats = useApp((s) => s.stats)
  const refreshStats = useApp((s) => s.refreshStats)
  const agents = useApp((s) => s.agents)

  useEffect(() => { void refreshStats() }, [])

  const total = stats?.totals
  const hasData = (total?.messages ?? 0) > 0

  return (
    <PageShell
      title="Token 统计"
      eyebrow="USAGE & COST"
      subtitle="真实用量来自供应商返回的 usage；缺少 usage 时按字符估算并明确标注。费用是按公开单价计算的估算值。"
      actions={<button className="btn ghost" onClick={() => void refreshStats()}><RefreshCw size={15} /> 刷新</button>}
      wide
    >
      <div className="stat-grid">
        <div className="stat-card accent-pink"><span className="stat-icon"><TrendingUp size={17} /></span><small>输入 Token</small><strong>{formatNumber(total?.inputTokens ?? 0)}</strong><em>IN</em></div>
        <div className="stat-card accent-violet"><span className="stat-icon"><Sparkles size={17} /></span><small>输出 Token</small><strong>{formatNumber(total?.outputTokens ?? 0)}</strong><em>OUT</em></div>
        <div className="stat-card accent-cyan"><span className="stat-icon"><Zap size={17} /></span><small>缓存 Token</small><strong>{formatNumber(total?.cachedTokens ?? 0)}</strong><em>CACHED</em></div>
        <div className="stat-card accent-gold"><span className="stat-icon"><Coins size={17} /></span><small>估算费用</small><strong>{formatMoney(total?.costUsd ?? 0)}</strong><em>估算 · USD</em></div>
        <div className="stat-card"><span className="stat-icon"><BarChart3 size={17} /></span><small>消息数</small><strong>{formatNumber(total?.messages ?? 0)}</strong><em>估算 {formatNumber(total?.estimatedMessages ?? 0)} 条</em></div>
        <div className="stat-card"><span className="stat-icon"><Database size={17} /></span><small>上下文续接</small><strong>{formatNumber(total?.continuations ?? 0)}</strong><em>自动整理记忆</em></div>
      </div>

      {!hasData ? (
        <EmptyState icon={<BarChart3 size={30} />} title="还没有用量记录" description="当你在茶会里发出第一条消息，这里会记录输入、输出、缓存与费用估算" />
      ) : (
        <>
          <div className="stats-columns">
            <section className="table-card">
              <header><h3>按 Agent</h3><span className="hint">共 {stats?.byAgent.length ?? 0} 位</span></header>
              <div className="data-table">
                <div className="data-row head"><span>Agent</span><span>输入</span><span>输出</span><span>消息</span><span>估算费用</span></div>
                {(stats?.byAgent ?? []).map((row) => {
                  const agent = agents.find((a) => a.id === row.agentId)
                  return (
                    <div key={row.agentId} className="data-row">
                      <span className="cell-name">{row.agentName}{agent?.name ? '' : '（已删除）'}</span>
                      <span>{formatNumber(row.input)}</span><span>{formatNumber(row.output)}</span><span>{row.messages}</span><span>{formatMoney(row.costUsd)}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="table-card">
              <header><h3>按 Provider</h3><span className="hint">共 {stats?.byProvider.length ?? 0} 个</span></header>
              <div className="data-table">
                <div className="data-row head"><span>Provider</span><span>输入</span><span>输出</span><span>消息</span><span>估算费用</span></div>
                {(stats?.byProvider ?? []).map((row) => (
                  <div key={row.providerId} className="data-row">
                    <span className="cell-name">{row.providerName}</span>
                    <span>{formatNumber(row.input)}</span><span>{formatNumber(row.output)}</span><span>{row.messages}</span><span>{formatMoney(row.costUsd)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="table-card">
            <header><h3>按茶会</h3><span className="hint">单次讨论费用按累计估算</span></header>
            <div className="data-table">
              <div className="data-row head"><span>茶会</span><span>输入</span><span>输出</span><span>消息</span><span>估算费用</span></div>
              {(stats?.byRoom ?? []).map((row) => (
                <div key={row.roomId} className="data-row">
                  <span className="cell-name">{row.roomName}</span>
                  <span>{formatNumber(row.input)}</span><span>{formatNumber(row.output)}</span><span>{row.messages}</span><span>{formatMoney(row.costUsd)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="table-card">
            <header><h3>最近调用</h3><span className="hint">真实 / 估算分开标注</span></header>
            <div className="data-table recent-table">
              <div className="data-row head"><span>时间</span><span>Agent</span><span>模型</span><span>输入</span><span>输出</span><span>来源</span><span>费用</span></div>
              {(stats?.recent ?? []).map((row) => (
                <div key={row.id} className="data-row">
                  <span>{new Date(row.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="cell-name">{row.agentName ?? '—'}</span>
                  <span className="mono-cell">{row.modelId ?? '—'}</span>
                  <span>{formatNumber(row.inputTokens)}</span><span>{formatNumber(row.outputTokens)}</span>
                  <span><span className={`tag ${row.estimated ? 'warn' : 'ok'}`}>{row.estimated ? '估算' : '真实'}</span></span>
                  <span>{formatMoney(row.costUsd)}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="page-note">价格表只覆盖常见公开模型；未知模型费用显示为 $0，不代表免费。缓存 Token 只有供应商返回时才记录。</div>
    </PageShell>
  )
}
