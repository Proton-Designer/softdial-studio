import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Phone, Target, Clock, DollarSign, Phone as PhoneIcon, Upload, Plus, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import {
  getDashboardStats,
  getTeamPerformanceChart,
  getUserPreferences,
  saveUserPreferences,
  type TeamPerformancePoint,
  type UserPreferences,
} from '@/lib/api';

type PerfRange = '7d' | '30d' | 'custom';

type DashboardProps = {
  onNavigateToDialer?: () => void;
  onNavigateToContacts?: () => void;
  onNavigateToCampaigns?: () => void;
};

export function Dashboard({ onNavigateToDialer, onNavigateToContacts, onNavigateToCampaigns }: DashboardProps = {}) {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ callsToday: number; connectRate: number; talkTimeFormatted: string } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [perfRange, setPerfRange] = useState<PerfRange>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartData, setChartData] = useState<TeamPerformancePoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const fetchChart = useCallback(async (range: PerfRange, start?: string, end?: string) => {
    setChartLoading(true);
    try {
      const data = await getTeamPerformanceChart(range, start, end);
      setChartData(data);
    } catch {
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    getDashboardStats()
      .then((data) => setStats({ callsToday: data.callsToday, connectRate: data.connectRate, talkTimeFormatted: data.talkTimeFormatted }))
      .catch((e) => setStatsError(e instanceof Error ? e.message : String(e)))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    getUserPreferences()
      .then((prefs: UserPreferences | null) => {
        if (prefs?.team_performance_range) {
          setPerfRange((prefs.team_performance_range as PerfRange) || '7d');
          if (prefs.custom_start) setCustomStart(prefs.custom_start);
          if (prefs.custom_end) setCustomEnd(prefs.custom_end);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (perfRange === 'custom' && customStart && customEnd) {
      fetchChart('custom', customStart, customEnd);
    } else {
      fetchChart(perfRange);
    }
  }, [perfRange, customStart, customEnd, fetchChart]);

  const handlePerfRange = (range: PerfRange) => {
    setPerfRange(range);
    if (range !== 'custom') {
      fetchChart(range);
      if (user?.id) {
        saveUserPreferences(user.id, { team_performance_range: range, custom_start: undefined, custom_end: undefined }).catch(() => {});
      }
    }
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;
    fetchChart('custom', customStart, customEnd);
    if (user?.id) {
      saveUserPreferences(user.id, { team_performance_range: 'custom', custom_start: customStart, custom_end: customEnd }).catch(() => {});
    }
  };

  const metricsFromBackend = [
    {
      icon: Phone,
      label: 'Calls Today',
      value: statsLoading ? '—' : statsError ? '—' : String(stats?.callsToday ?? 0),
      color: '#00D9FF',
      bgColor: 'bg-[#00D9FF]/10',
      borderColor: 'border-[#00D9FF]/20',
      loading: statsLoading,
    },
    {
      icon: Target,
      label: 'Connect Rate',
      value: statsLoading ? '—' : statsError ? '—' : `${stats?.connectRate ?? 0}%`,
      color: '#00E676',
      bgColor: 'bg-[#00E676]/10',
      borderColor: 'border-[#00E676]/20',
      loading: statsLoading,
    },
    {
      icon: Clock,
      label: 'Talk Time',
      value: statsLoading ? '—' : statsError ? '—' : (stats?.talkTimeFormatted ?? '0m'),
      color: '#FFB300',
      bgColor: 'bg-[#FFB300]/10',
      borderColor: 'border-[#FFB300]/20',
      loading: statsLoading,
    },
    {
      icon: DollarSign,
      label: 'Revenue Pipeline',
      value: 'Coming soon',
      color: '#0066FF',
      bgColor: 'bg-[#0066FF]/10',
      borderColor: 'border-[#0066FF]/20',
      loading: false,
    },
  ];

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metricsFromBackend.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-6 border ${metric.borderColor} shadow-[0_4px_24px_rgba(0,102,255,0.15)] hover:shadow-[0_8px_32px_rgba(0,102,255,0.25)] transition-all hover:-translate-y-1`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${metric.bgColor} flex items-center justify-center`} style={{ boxShadow: `0 4px 16px ${metric.color}40` }}>
                  <Icon className="w-6 h-6" style={{ color: metric.color }} />
                </div>
                {metric.loading && (
                  <Loader2 className="w-5 h-5 text-[#B0BEC5] animate-spin" />
                )}
              </div>
              <div className="text-4xl font-bold text-white mb-1">{metric.value}</div>
              <div className="text-sm text-[#B0BEC5]">{metric.label}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        {/* Team Performance - chart placeholder; will be wired to API in next step */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-[0_4px_24px_rgba(0,102,255,0.15)]"
        >
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2 className="text-xl font-bold text-white">Team Performance</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handlePerfRange('7d')}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${perfRange === '7d' ? 'bg-[#0066FF]/10 text-[#00D9FF] border-[#0066FF]/20 font-medium' : 'text-[#B0BEC5] hover:bg-white/5 border-transparent'}`}
              >
                7D
              </button>
              <button
                type="button"
                onClick={() => handlePerfRange('30d')}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${perfRange === '30d' ? 'bg-[#0066FF]/10 text-[#00D9FF] border-[#0066FF]/20 font-medium' : 'text-[#B0BEC5] hover:bg-white/5 border-transparent'}`}
              >
                30D
              </button>
              <button
                type="button"
                onClick={() => setPerfRange('custom')}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${perfRange === 'custom' ? 'bg-[#0066FF]/10 text-[#00D9FF] border-[#0066FF]/20 font-medium' : 'text-[#B0BEC5] hover:bg-white/5 border-transparent'}`}
              >
                Custom
              </button>
              {perfRange === 'custom' && (
                <>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="bg-[#1E2A3A] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                  />
                  <span className="text-[#B0BEC5]">–</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="bg-[#1E2A3A] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={handleCustomApply}
                    className="px-3 py-1.5 text-sm bg-[#00D9FF]/20 text-[#00D9FF] rounded-lg border border-[#00D9FF]/30 hover:bg-[#00D9FF]/30"
                  >
                    Apply
                  </button>
                </>
              )}
            </div>
          </div>

          {chartLoading ? (
            <div className="h-[320px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#00D9FF] animate-spin" />
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0066FF" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0066FF" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorConnections" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D9FF" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00D9FF" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="day"
                stroke="#B0BEC5"
                tick={{ fill: '#B0BEC5' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <YAxis
                stroke="#B0BEC5"
                tick={{ fill: '#B0BEC5' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A2332',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ color: '#B0BEC5' }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
              <Area
                type="monotone"
                dataKey="calls"
                stroke="#0066FF"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCalls)"
                name="Total Calls"
              />
              <Area
                type="monotone"
                dataKey="connections"
                stroke="#00D9FF"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorConnections)"
                name="Connections"
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 bg-gradient-to-r from-[#0066FF]/10 to-[#00D9FF]/10 backdrop-blur-xl rounded-2xl p-6 border border-[#0066FF]/20"
      >
        <div className="flex flex-wrap items-center justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onNavigateToDialer}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-xl text-white font-semibold shadow-[0_4px_24px_rgba(0,217,255,0.3)] hover:shadow-[0_6px_32px_rgba(0,217,255,0.4)] transition-all"
          >
            <PhoneIcon className="w-5 h-5" />
            Start Power Dialing
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onNavigateToContacts}
            className="flex items-center gap-3 px-6 py-4 bg-transparent border-2 border-[#00D9FF] rounded-xl text-[#00D9FF] font-semibold hover:bg-[#00D9FF]/10 transition-all"
          >
            <Upload className="w-5 h-5" />
            Upload Contacts
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onNavigateToCampaigns}
            className="flex items-center gap-3 px-6 py-4 bg-transparent border-2 border-[#00D9FF] rounded-xl text-[#00D9FF] font-semibold hover:bg-[#00D9FF]/10 transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Campaign
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
