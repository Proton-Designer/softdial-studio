import { useState } from 'react';
import { motion } from 'motion/react';
import {
  User,
  Phone,
  CreditCard,
  Users as UsersIcon,
  Zap,
  Shield,
  Globe,
  Search,
  Loader2,
} from 'lucide-react';
import { usePhoneNumbers } from '@/contexts/PhoneNumbersContext';
import { searchPhoneNumbers, purchasePhoneNumber } from '@/lib/api';

type SettingsTab = 'profile' | 'phone' | 'billing' | 'team' | 'integrations' | 'security';

export function Settings() {
  const {
    numbers: phoneNumbers,
    loading: phoneNumbersLoading,
    error: phoneNumbersError,
    refetch: refetchPhoneNumbers,
  } = usePhoneNumbers();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [browserPush, setBrowserPush] = useState(true);

  const [searchAreaCode, setSearchAreaCode] = useState('');
  const [searchResults, setSearchResults] = useState<
    { phone_number: string; monthly_cost?: string }[]
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const tabs = [
    { id: 'profile' as SettingsTab, label: 'Profile', icon: User },
    { id: 'phone' as SettingsTab, label: 'Phone Numbers', icon: Phone },
    { id: 'billing' as SettingsTab, label: 'Billing', icon: CreditCard },
    { id: 'team' as SettingsTab, label: 'Team', icon: UsersIcon },
    { id: 'integrations' as SettingsTab, label: 'Integrations', icon: Zap },
    { id: 'security' as SettingsTab, label: 'Security', icon: Shield },
  ];

  const handleSearchNumbers = async () => {
    setSearchLoading(true);
    setPhoneError(null);
    setSearchResults([]);
    setSearchAttempted(false);
    try {
      const numbers = await searchPhoneNumbers(searchAreaCode);
      setSearchResults(numbers);
    } catch (e) {
      setPhoneError(String(e));
    } finally {
      setSearchLoading(false);
      setSearchAttempted(true);
    }
  };

  const handlePurchaseNumber = async (phoneNumber: string) => {
    setPurchaseLoading(phoneNumber);
    setPhoneError(null);
    try {
      await purchasePhoneNumber(phoneNumber);
      await refetchPhoneNumbers();
      setSearchResults((prev) => prev.filter((n) => n.phone_number !== phoneNumber));
    } catch (e) {
      setPhoneError(String(e));
    } finally {
      setPurchaseLoading(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-72px)]">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-[#1A2332]/60 backdrop-blur-xl border-r border-white/5 p-6">
        <h2 className="text-white font-bold text-lg mb-6">Settings</h2>
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#0066FF]/10 text-white border-l-4 border-[#00D9FF]'
                    : 'text-[#B0BEC5] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl">
          {activeTab === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold text-white mb-8">Profile Settings</h1>

              {/* Profile Card */}
              <div className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-8 border border-white/5 shadow-[0_4px_24px_rgba(0,102,255,0.15)] mb-8">
                <div className="flex items-center gap-6 mb-8">
                  <div className="relative group cursor-pointer">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#00D9FF] to-[#0066FF] flex items-center justify-center text-white text-4xl font-bold">
                      JD
                    </div>
                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm">Upload</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">John Doe</h3>
                    <p className="text-[#B0BEC5]">john@acme.com</p>
                    <button className="mt-3 px-4 py-2 bg-transparent border border-[#00D9FF] rounded-lg text-[#00D9FF] hover:bg-[#00D9FF]/10 transition-all">
                      Edit Profile
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">Personal Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-[#B0BEC5] mb-2">First Name</label>
                        <input
                          type="text"
                          defaultValue="John"
                          className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00D9FF] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-[#B0BEC5] mb-2">Last Name</label>
                        <input
                          type="text"
                          defaultValue="Doe"
                          className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00D9FF] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-[#B0BEC5] mb-2">Email</label>
                        <input
                          type="email"
                          defaultValue="john@acme.com"
                          className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00D9FF] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-[#B0BEC5] mb-2">Phone</label>
                        <input
                          type="tel"
                          defaultValue="+1 (415) 555-0199"
                          className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00D9FF] transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">
                      Notification Preferences
                    </h4>
                    <div className="space-y-3">
                      {[
                        {
                          label: 'Email notifications',
                          sublabel: 'Get campaign reports daily',
                          state: emailNotifications,
                          setState: setEmailNotifications,
                        },
                        {
                          label: 'SMS alerts',
                          sublabel: 'Missed calls & voicemails',
                          state: smsAlerts,
                          setState: setSmsAlerts,
                        },
                        {
                          label: 'Browser push',
                          sublabel: 'Real-time call notifications',
                          state: browserPush,
                          setState: setBrowserPush,
                        },
                      ].map((pref) => (
                        <label
                          key={pref.label}
                          className="flex items-center justify-between cursor-pointer p-4 bg-[#1E2A3A]/60 rounded-xl hover:bg-[#1E2A3A] transition-colors"
                        >
                          <div>
                            <div className="text-white font-medium">{pref.label}</div>
                            <div className="text-sm text-[#B0BEC5]">{pref.sublabel}</div>
                          </div>
                          <button
                            onClick={() => pref.setState(!pref.state)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                              pref.state ? 'bg-[#00E676]' : 'bg-[#1E2A3A] border border-white/10'
                            }`}
                          >
                            <motion.div
                              className="absolute top-1 w-4 h-4 bg-white rounded-full"
                              animate={{ left: pref.state ? 28 : 4 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-white mb-4">Time Zone & Region</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-[#B0BEC5] mb-2">Time Zone</label>
                        <select className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00D9FF] transition-colors">
                          <option>Pacific Time (PT)</option>
                          <option>Eastern Time (ET)</option>
                          <option>Central Time (CT)</option>
                          <option>Mountain Time (MT)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-[#B0BEC5] mb-2">Language</label>
                        <select className="w-full bg-[#1E2A3A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00D9FF] transition-colors">
                          <option>🇺🇸 English</option>
                          <option>🇪🇸 Spanish</option>
                          <option>🇫🇷 French</option>
                          <option>🇩🇪 German</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/5">
                  <button className="px-6 py-3 bg-[#1E2A3A] hover:bg-[#252F3E] border border-white/10 rounded-xl text-white transition-all">
                    Cancel
                  </button>
                  <button className="px-6 py-3 bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-xl text-white font-semibold shadow-[0_4px_24px_rgba(0,217,255,0.3)] hover:shadow-[0_6px_32px_rgba(0,217,255,0.4)] transition-all">
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'phone' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold text-white mb-8">Phone Numbers</h1>

              {(phoneError || phoneNumbersError) && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {phoneError || phoneNumbersError}
                </div>
              )}

              {/* Numbers List */}
              <div className="space-y-4 mb-8">
                {phoneNumbersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-[#00D9FF] animate-spin" />
                  </div>
                ) : phoneNumbers.length === 0 ? (
                  <div className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-8 border border-white/5 text-center">
                    <p className="text-[#B0BEC5]">
                      No phone numbers yet. Search and purchase below.
                    </p>
                  </div>
                ) : (
                  phoneNumbers.map((phone) => (
                    <div
                      key={phone.id}
                      className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-[0_4px_24px_rgba(0,102,255,0.15)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-2xl font-bold text-white mb-1">
                            {phone.phone_number}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-[#B0BEC5]">
                            <span className="flex items-center gap-1.5">
                              <Globe className="w-4 h-4" />
                              US
                            </span>
                            <span className="px-2 py-1 rounded-full text-xs bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
                              Active
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Purchase New Numbers */}
              <div className="bg-gradient-to-r from-[#0066FF]/10 to-[#00D9FF]/10 backdrop-blur-xl rounded-2xl p-8 border border-[#0066FF]/20">
                <h3 className="text-xl font-bold text-white mb-4">Purchase Numbers</h3>
                <p className="text-[#B0BEC5] mb-4">
                  Search by area code (e.g. 415, 920) or leave blank to browse US numbers.
                </p>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Area code (e.g. 415) or leave blank"
                    value={searchAreaCode}
                    onChange={(e) =>
                      setSearchAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))
                    }
                    className="flex-1 bg-[#1E2A3A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#B0BEC5]/50 focus:outline-none focus:border-[#00D9FF]"
                  />
                  <button
                    onClick={handleSearchNumbers}
                    disabled={searchLoading}
                    className="px-6 py-3 bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-xl text-white font-semibold disabled:opacity-50 flex items-center gap-2"
                  >
                    {searchLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                    Search
                  </button>
                </div>
                {searchLoading && (
                  <div className="py-4 text-center text-[#B0BEC5]">
                    Searching Telnyx marketplace…
                  </div>
                )}
                {searchAttempted && !searchLoading && searchResults.length === 0 && (
                  <div className="py-4 text-center text-[#B0BEC5] text-sm">
                    No numbers found for this area. Try a different area code or leave blank for US
                    numbers.
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {searchResults.map((n) => (
                      <div
                        key={n.phone_number}
                        className="flex items-center justify-between p-3 bg-[#1E2A3A]/60 rounded-lg"
                      >
                        <span className="text-white font-medium">{n.phone_number}</span>
                        <span className="text-[#B0BEC5] text-sm">
                          {n.monthly_cost ? `$${n.monthly_cost}/mo` : ''}
                        </span>
                        <button
                          onClick={() => handlePurchaseNumber(n.phone_number)}
                          disabled={purchaseLoading === n.phone_number}
                          className="px-4 py-2 bg-[#00E676]/20 hover:bg-[#00E676]/30 border border-[#00E676]/30 rounded-lg text-[#00E676] text-sm font-medium disabled:opacity-50 flex items-center gap-1"
                        >
                          {purchaseLoading === n.phone_number ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : null}
                          Purchase
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold text-white mb-8">Billing</h1>

              {/* Current Plan */}
              <div className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-8 border border-[#00D9FF]/20 shadow-[0_4px_24px_rgba(0,102,255,0.15)] mb-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <span className="px-3 py-1 bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/20 rounded-full text-sm font-semibold">
                      Professional
                    </span>
                    <div className="text-4xl font-bold text-white mt-4">
                      $149<span className="text-lg text-[#B0BEC5]">/month</span>
                    </div>
                  </div>
                  <button className="px-6 py-3 bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-xl text-white font-semibold shadow-[0_4px_24px_rgba(0,217,255,0.3)] hover:shadow-[0_6px_32px_rgba(0,217,255,0.4)] transition-all">
                    Upgrade Plan
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  {[
                    '5,000 minutes included',
                    '10 team seats',
                    'Advanced analytics',
                    'Local presence',
                    'Priority support',
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-[#B0BEC5]">
                      <div className="w-5 h-5 rounded-full bg-[#00E676]/10 flex items-center justify-center">
                        <span className="text-[#00E676]">✓</span>
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-[#B0BEC5]">Minutes used</span>
                      <span className="text-white font-semibold">3,247 / 5,000</span>
                    </div>
                    <div className="h-2 bg-[#1E2A3A] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#00D9FF] to-[#0066FF] rounded-full"
                        style={{ width: '65%' }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-[#B0BEC5]">Seats</span>
                      <span className="text-white font-semibold">8 / 10</span>
                    </div>
                    <div className="h-2 bg-[#1E2A3A] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#00E676] to-[#00D9FF] rounded-full"
                        style={{ width: '80%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-[#1A2332]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/5 shadow-[0_4px_24px_rgba(0,102,255,0.15)] mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Payment Method</h3>
                <div className="flex items-center justify-between p-4 bg-[#1E2A3A]/60 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-8 bg-gradient-to-br from-[#00D9FF] to-[#0066FF] rounded flex items-center justify-center text-white font-bold text-xs">
                      VISA
                    </div>
                    <div>
                      <div className="text-white font-semibold">•••• •••• •••• 4242</div>
                      <div className="text-sm text-[#B0BEC5]">Expires 12/25</div>
                    </div>
                  </div>
                  <button className="text-[#00D9FF] hover:underline">Update</button>
                </div>
              </div>
            </motion.div>
          )}

          {['team', 'integrations', 'security'].includes(activeTab) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="text-6xl mb-4">🚧</div>
              <h3 className="text-2xl font-bold text-white mb-2">Coming Soon</h3>
              <p className="text-[#B0BEC5]">This feature is under development</p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
