import { motion } from 'motion/react';
import { TrendingUp, Phone, Clock, Target, DollarSign } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const callVolumeData = [
  { day: 'Mon', calls: 245, connections: 89, voicemails: 76 },
  { day: 'Tue', calls: 312, connections: 118, voicemails: 94 },
  { day: 'Wed', calls: 298, connections: 102, voicemails: 88 },
  { day: 'Thu', calls: 367, connections: 145, voicemails: 112 },
  { day: 'Fri', calls: 389, connections: 152, voicemails: 118 },
];

const performanceData = [
  { name: 'Connected', value: 38, color: '#00E676' },
  { name: 'Voicemail', value: 24, color: '#FFB300' },
  { name: 'No Answer', value: 26, color: '#B0BEC5' },
  { name: 'Busy', value: 12, color: '#FF3D00' },
];

const agentData = [
  { name: 'Sarah Chen', calls: 145, connections: 58, rate: 40.0 },
  { name: 'James Wilson', calls: 132, connections: 51, rate: 38.6 },
  { name: 'Alex Kumar', calls: 128, connections: 46, rate: 35.9 },
  { name: 'Maria Garcia', calls: 118, connections: 45, rate: 38.1 },
  { name: 'Tom Anderson', calls: 105, connections: 37, rate: 35.2 },
];

export function Analytics() {
  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
        <p className="text-[#B0BEC5]">Track your team's performance and insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Calls', value: '1,611', change: '+12%', icon: Phone, color: '#0066FF' },
          {
            label: 'Avg Connect Rate',
            value: '38.2%',
            change: '+5.1%',
            icon: Target,
            color: '#00E676',
          },
          {
            label: 'Total Talk Time',
            value: '22h 45m',
            change: '+8%',
            icon: Clock,
            color: '#FFB300',
          },
          {
            label: 'Revenue Generated',
            value: '$127.5K',
            change: '+15%',
            icon: DollarSign,
            color: '#00D9FF',
          },
        ].map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-[0_4px_24px_rgba(0,102,255,0.15)]"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${metric.color}15` }}
                >
                  <Icon className="w-6 h-6" style={{ color: metric.color }} />
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-[#00E676]" />
                  <span className="text-[#00E676]">{metric.change}</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{metric.value}</div>
              <div className="text-sm text-[#B0BEC5]">{metric.label}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Call Volume Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-[0_4px_24px_rgba(0,102,255,0.15)]"
        >
          <h2 className="text-xl font-bold text-white mb-6">Call Volume & Performance</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={callVolumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="#B0BEC5" tick={{ fill: '#B0BEC5' }} />
              <YAxis stroke="#B0BEC5" tick={{ fill: '#B0BEC5' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A2332',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="calls" fill="#0066FF" name="Total Calls" radius={[8, 8, 0, 0]} />
              <Bar dataKey="connections" fill="#00E676" name="Connections" radius={[8, 8, 0, 0]} />
              <Bar dataKey="voicemails" fill="#FFB300" name="Voicemails" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Disposition Breakdown */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-[0_4px_24px_rgba(0,102,255,0.15)]"
        >
          <h2 className="text-xl font-bold text-white mb-6">Call Dispositions</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={performanceData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {performanceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A2332',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {performanceData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-[#B0BEC5]">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-white">{item.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Agent Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-[0_4px_24px_rgba(0,102,255,0.15)]"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Top Performers</h2>
          <button className="text-sm text-[#00D9FF] hover:underline">View All</button>
        </div>

        <div className="space-y-3">
          {agentData.map((agent, index) => (
            <div
              key={agent.name}
              className="bg-[#1E2A3A]/60 rounded-xl p-4 border border-white/5 hover:border-[#00D9FF]/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00D9FF] to-[#0066FF] flex items-center justify-center text-white font-semibold">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{agent.name}</div>
                    <div className="text-sm text-[#B0BEC5]">{agent.calls} calls made</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-sm text-[#B0BEC5] mb-1">Connections</div>
                    <div className="text-xl font-bold text-white">{agent.connections}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[#B0BEC5] mb-1">Connect Rate</div>
                    <div className="text-xl font-bold text-[#00E676]">{agent.rate}%</div>
                  </div>
                </div>

                <div className="w-32">
                  <div className="h-2 bg-[#1E2A3A] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00D9FF] to-[#00E676] rounded-full"
                      style={{ width: `${agent.rate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
