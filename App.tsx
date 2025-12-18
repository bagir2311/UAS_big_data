import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  TrendingUp, 
  Wallet, 
  Receipt, 
  Award, 
  PieChart as PieIcon, 
  List, 
  AlertTriangle, 
  RotateCcw,
  Search,
  ChevronDown,
  RefreshCw,
  Clock
} from 'lucide-react';

// --- Configuration & Constants ---
const API_URL = 'https://script.google.com/macros/s/AKfycbyblKFAKIlX9zjtV_o-SVfr2BDsIKyV6Mo0PgwEtz8MbHhy-Esd-axAZRHD__WB2sBA/exec';
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6'];
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// --- Types & Interfaces ---
interface SaleRecord {
  tanggal: string;
  nama_pembeli: string;
  nama_barang: string;
  total_penjualan_motor: number | string;
  nominal: number | string;
  bulan_tahun?: string;
}

interface FilterState {
  periode: string;
  nama_barang: string;
}

// --- Utility Functions ---
const formatIDR = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const parseNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9.-]+/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// Helper to sort dates in "D MMMM YYYY" format
const sortDates = (dates: string[]) => {
  return [...dates].sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;
    return new Date(a).getTime() - new Date(b).getTime();
  });
};

// --- Main Component ---
const App: React.FC = () => {
  // State
  const [data, setData] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    periode: 'all',
    nama_barang: 'all'
  });

  // Derived State
  const isFiltered = filters.periode !== 'all' || filters.nama_barang !== 'all';

  // Fetch Data Function
  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setRefreshing(true);
      
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Koneksi ke server gagal. Pastikan API URL benar.');
      
      const json = await response.json();
      // FIX 1: Explicitly cast the data to SaleRecord[]
      const records = (Array.isArray(json) ? json : (json.data || [])) as SaleRecord[];
      
      if (records.length === 0) {
        throw new Error('Data tidak ditemukan atau format data tidak sesuai.');
      }
      
      setData(records);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      if (!isSilent) setError(err.message || 'Terjadi kesalahan sistem saat memuat data.');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial Load and Auto-Refresh Setup
  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData(true); // Silent refresh
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter Logic
  // FIX 2: Explicitly tell Set that it contains <string> to avoid 'unknown' inference
  const uniquePeriods = useMemo(() => {
    const dates = Array.from(new Set<string>(data.map(d => String(d.tanggal))));
    return ['all', ...sortDates(dates).reverse()];
  }, [data]);

  const uniqueItems = useMemo(() => ['all', ...Array.from(new Set(data.map(d => d.nama_barang)))].sort(), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchPeriode = filters.periode === 'all' || item.tanggal === filters.periode;
      const matchItem = filters.nama_barang === 'all' || item.nama_barang === filters.nama_barang;
      return matchPeriode && matchItem;
    });
  }, [data, filters]);

  // Statistics Calculation
  const stats = useMemo(() => {
    const totalOmzet = filteredData.reduce((acc, curr) => acc + parseNumber(curr.nominal), 0);
    const totalTransactions = filteredData.length;
    
    const itemCounts: Record<string, number> = {};
    filteredData.forEach(item => {
      const qty = parseNumber(item.total_penjualan_motor);
      itemCounts[item.nama_barang] = (itemCounts[item.nama_barang] || 0) + qty;
    });
    
    let topSellingItem = '-';
    let maxQty = 0;
    Object.entries(itemCounts).forEach(([name, qty]) => {
      if (qty > maxQty) {
        maxQty = qty;
        topSellingItem = name;
      }
    });

    return { totalOmzet, totalTransactions, topSellingItem };
  }, [filteredData]);

  // Chart Data Preparation
  const topBuyersData = useMemo(() => {
    const buyers: Record<string, number> = {};
    filteredData.forEach(item => {
      const buyerName = item.nama_pembeli || 'Anonim';
      buyers[buyerName] = (buyers[buyerName] || 0) + parseNumber(item.nominal);
    });
    return Object.entries(buyers)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredData]);

  const dailyTrendData = useMemo(() => {
    const trend: Record<string, number> = {};
    filteredData.forEach(item => {
      trend[item.tanggal] = (trend[item.tanggal] || 0) + parseNumber(item.nominal);
    });
    // Sorting keys by actual date value
    return Object.entries(trend)
      .map(([date, nominal]) => ({ date, nominal }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredData]);

  const itemProportionData = useMemo(() => {
    const props: Record<string, number> = {};
    filteredData.forEach(item => {
      props[item.nama_barang] = (props[item.nama_barang] || 0) + parseNumber(item.nominal);
    });
    return Object.entries(props).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const handleReset = () => {
    setFilters({ periode: 'all', nama_barang: 'all' });
  };

  const handleManualRefresh = () => {
    fetchData(true);
  };

  // Render Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-slate-600 font-semibold tracking-wide">Sinkronisasi Data Penjualan...</p>
      </div>
    );
  }

  // Render Error State
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="text-red-500 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Oops! Ada Masalah</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all font-bold shadow-lg shadow-slate-200"
          >
            Muat Ulang Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12">
      {/* Navbar Section */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-5 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Sales Analytics</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Performance Monitor v2.2</p>
                {lastUpdated && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-full text-[9px] font-bold text-slate-400">
                    <Clock className="w-2.5 h-2.5" />
                    Sync: {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-end gap-3 lg:gap-4">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Periode Tanggal</label>
              <div className="relative">
                <select 
                  value={filters.periode}
                  onChange={(e) => setFilters(prev => ({ ...prev, periode: e.target.value }))}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer"
                >
                  {uniquePeriods.map(p => (
                    <option key={p} value={p}>{p === 'all' ? 'Semua Tanggal' : p}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Kategori Barang</label>
              <div className="relative">
                <select 
                  value={filters.nama_barang}
                  onChange={(e) => setFilters(prev => ({ ...prev, nama_barang: e.target.value }))}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer"
                >
                  {uniqueItems.map(i => (
                    <option key={i} value={i}>{i === 'all' ? 'Semua Produk' : i}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex gap-2">
              {isFiltered && (
                <button 
                  onClick={handleReset}
                  className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all border border-indigo-100 active:scale-95 shadow-sm"
                  title="Bersihkan semua filter"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              )}
              <button 
                onClick={handleManualRefresh}
                disabled={refreshing}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border active:scale-95 shadow-sm ${
                  refreshing 
                    ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Updating...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 space-y-8">
        
        {/* Subtle Refresh Indicator (Top Banner) */}
        {refreshing && !loading && (
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl flex items-center justify-center gap-3 animate-pulse shadow-lg shadow-indigo-100">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest">Refreshing Dashboard Data...</span>
          </div>
        )}

        {/* Scorecards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 group transition-all hover:shadow-xl hover:shadow-indigo-100/50">
            <div className="flex items-center justify-between mb-5">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                <Wallet className="w-7 h-7" />
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Omzet</p>
                <div className="h-1 w-8 bg-indigo-200 ml-auto mt-1 rounded-full group-hover:w-12 transition-all"></div>
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900 leading-none">{formatIDR(stats.totalOmzet)}</h3>
            <p className="text-slate-400 text-sm mt-3 font-medium">Nilai penjualan akumulatif</p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 group transition-all hover:shadow-xl hover:shadow-emerald-100/50">
            <div className="flex items-center justify-between mb-5">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                <Receipt className="w-7 h-7" />
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transaksi</p>
                <div className="h-1 w-8 bg-emerald-200 ml-auto mt-1 rounded-full group-hover:w-12 transition-all"></div>
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900 leading-none">{stats.totalTransactions.toLocaleString()} <span className="text-sm font-bold text-slate-400">Order</span></h3>
            <p className="text-slate-400 text-sm mt-3 font-medium">Volume pesanan sukses</p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 group transition-all hover:shadow-xl hover:shadow-amber-100/50 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-5">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
                <Award className="w-7 h-7" />
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Best Seller</p>
                <div className="h-1 w-8 bg-amber-200 ml-auto mt-1 rounded-full group-hover:w-12 transition-all"></div>
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 truncate" title={stats.topSellingItem}>
              {stats.topSellingItem}
            </h3>
            <p className="text-slate-400 text-sm mt-3 font-medium">Produk dengan Qty tertinggi</p>
          </div>
        </div>

        {/* Top Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                Tren Pendapatan Harian
              </h3>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={10} 
                    tickFormatter={(val) => {
                      const parts = val.split(' ');
                      return parts.length > 1 ? `${parts[0]} ${parts[1].substring(0,3)}` : val;
                    }}
                    stroke="#94a3b8"
                    tickMargin={12}
                  />
                  <YAxis 
                    fontSize={11} 
                    tickFormatter={(val) => `Rp${(val/1000000).toFixed(0)}M`}
                    stroke="#94a3b8"
                    tickMargin={12}
                  />
                  <Tooltip 
                    formatter={(val: number) => [formatIDR(val), 'Nominal']}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#64748b' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="nominal" 
                    stroke="#6366f1" 
                    strokeWidth={4} 
                    dot={{ fill: '#6366f1', strokeWidth: 2, r: 4, stroke: '#fff' }}
                    activeDot={{ r: 7, strokeWidth: 0, fill: '#4f46e5' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
                Top 5 Pembeli Terbesar
              </h3>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBuyersData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    fontSize={11} 
                    width={100}
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(val: number) => [formatIDR(val), 'Akumulasi Belanja']}
                    cursor={{fill: '#f8fafc', radius: 10}}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[0, 10, 10, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Section: Pie & Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 lg:col-span-1">
            <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-3">
              <div className="w-2 h-6 bg-amber-500 rounded-full"></div>
              Proporsi Barang
            </h3>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={itemProportionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {itemProportionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: number) => [formatIDR(val), 'Kontribusi']}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 lg:col-span-2 overflow-hidden flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                <div className="w-2 h-6 bg-slate-800 rounded-full"></div>
                Data Transaksi Detail
              </h3>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <List className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-500">{filteredData.length} Records</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[380px] custom-scrollbar rounded-xl border border-slate-50">
              <table className="w-full text-sm text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                  <tr>
                    <th className="px-5 py-4 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">Tanggal</th>
                    <th className="px-5 py-4 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">Pembeli</th>
                    <th className="px-5 py-4 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">Barang</th>
                    <th className="px-5 py-4 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 text-center">Qty</th>
                    <th className="px-5 py-4 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredData.length > 0 ? (
                    filteredData.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50 transition-all duration-200">
                        <td className="px-5 py-4 text-slate-500 font-medium whitespace-nowrap">{item.tanggal}</td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{item.nama_pembeli}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase">{item.nama_barang}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="font-bold text-slate-700">{item.total_penjualan_motor}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="font-black text-slate-900">{formatIDR(parseNumber(item.nominal))}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center gap-4 text-slate-300">
                          <Search className="w-12 h-12" />
                          <p className="font-bold">Tidak ada data yang cocok dengan filter aktif</p>
                          <button onClick={handleReset} className="text-indigo-50 font-bold underline hover:text-indigo-700">Atur ulang semua filter</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>

      <footer className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-[11px] font-bold uppercase tracking-widest">
        <div>&copy; {new Date().getFullYear()} Enterprise Dashboard System</div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${refreshing ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}></div> 
            System {refreshing ? 'Refreshing' : 'Online'}
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1">
            Auto-refresh: 5m
          </span>
          <span className="text-slate-300">|</span>
          <span>Powered by Google Apps Script</span>
        </div>
      </footer>
    </div>
  );
};

export default App;