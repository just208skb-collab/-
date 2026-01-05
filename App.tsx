
import React, { useState, useMemo, useEffect } from 'react';
import { DiscountType, PaymentMethod, SktPlan, SktDevice, CalculatorState } from './types';

const STORAGE_KEY_DEVICES = 'skt_opt_devices_v3';
const STORAGE_KEY_PLANS = 'skt_opt_plans_v3';

const DEFAULT_DEVICES: SktDevice[] = [
  { id: 's25-ultra', name: '갤럭시 S25 울트라 (512GB)', price: 1698400, order: 1 },
  { id: 's25-plus', name: '갤럭시 S25 플러스 (256GB)', price: 1353000, order: 2 },
  { id: 's25-base', name: '갤럭시 S25 (256GB)', price: 1155000, order: 3 },
];

const DEFAULT_PLANS: SktPlan[] = [
  { id: '5gx-premium', name: '5GX 프리미엄', price: 125000, subsidy: { 's25-ultra': 520000, 's25-plus': 480000, 's25-base': 450000 } },
  { id: '5gx-prime-plus', name: '5GX 프라임플러스', price: 109000, subsidy: { 's25-ultra': 480000, 's25-plus': 440000, 's25-base': 400000 } },
  { id: '5gx-prime', name: '5GX 프라임', price: 89000, subsidy: { 's25-ultra': 420000, 's25-plus': 380000, 's25-base': 350000 } },
  { id: '5gx-regular', name: '5GX 레귤러', price: 69000, subsidy: { 's25-ultra': 300000, 's25-plus': 280000, 's25-base': 250000 } },
  { id: '5gx-slim', name: '5GX 슬림', price: 55000, subsidy: { 's25-ultra': 200000, 's25-plus': 180000, 's25-base': 150000 } },
];

const App: React.FC = () => {
  const [devices, setDevices] = useState<SktDevice[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DEVICES);
    return saved ? JSON.parse(saved) : DEFAULT_DEVICES;
  });
  const [plans, setPlans] = useState<SktPlan[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PLANS);
    return saved ? JSON.parse(saved) : DEFAULT_PLANS;
  });

  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');

  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDevicePrice, setNewDevicePrice] = useState<number | ''>('');
  const [newDeviceOrder, setNewDeviceOrder] = useState<number | ''>('');
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState<number | ''>('');

  // Sorted devices based on 'order' property
  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => (a.order || 999) - (b.order || 999));
  }, [devices]);

  // Sorted plans based on 'price' descending
  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => b.price - a.price);
  }, [plans]);

  const [state, setState] = useState<CalculatorState>({
    deviceId: sortedDevices[0]?.id || 's25-ultra',
    initialPlanId: sortedPlans[0]?.id || '5gx-premium',
    afterPlanId: sortedPlans[sortedPlans.length - 1]?.id || '5gx-slim',
    discountType: DiscountType.CONTRACT,
    paymentMethod: PaymentMethod.INSTALLMENT,
    employeeDiscount: 0,
    useFamilyDiscount: false,
    maintenanceMonths: 4,
  });

  useEffect(() => {
    const months = state.discountType === DiscountType.SUBSIDY ? 6 : 4;
    setState(prev => ({ ...prev, maintenanceMonths: months }));
  }, [state.discountType]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(devices));
    localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(plans));
  }, [devices, plans]);

  const selectedDevice = useMemo(() => devices.find(d => d.id === state.deviceId) || sortedDevices[0], [devices, sortedDevices, state.deviceId]);
  const initialPlan = useMemo(() => plans.find(p => p.id === state.initialPlanId) || sortedPlans[0], [plans, sortedPlans, state.initialPlanId]);
  const afterPlan = useMemo(() => plans.find(p => p.id === state.afterPlanId) || sortedPlans[sortedPlans.length - 1], [plans, sortedPlans, state.afterPlanId]);

  const results = useMemo(() => {
    if (!selectedDevice || !initialPlan || !afterPlan) return null;

    const subsidy = state.discountType === DiscountType.SUBSIDY ? (initialPlan.subsidy[selectedDevice.id] || 0) : 0;
    const principal = Math.max(0, selectedDevice.price - subsidy - state.employeeDiscount);

    let monthlyInstallment = 0;
    let totalInterest = 0;
    if (state.paymentMethod === PaymentMethod.INSTALLMENT && principal > 0) {
      const r = 0.059 / 12;
      const n = 24;
      monthlyInstallment = Math.floor(principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
      totalInterest = (monthlyInstallment * n) - principal;
    }

    const calcFee = (plan: SktPlan) => {
      const contractDiscount = state.discountType === DiscountType.CONTRACT ? Math.floor(plan.price * 0.25) : 0;
      const familyDiscount = state.useFamilyDiscount ? Math.floor(plan.price * 0.30) : 0;
      const finalFee = Math.max(0, plan.price - contractDiscount - familyDiscount);
      return { finalFee, contractDiscount, familyDiscount };
    };

    const initialFeeData = calcFee(initialPlan);
    const afterFeeData = calcFee(afterPlan);

    const m1 = initialFeeData.finalFee + monthlyInstallment;
    const m2 = afterFeeData.finalFee + monthlyInstallment;
    const maintenance = state.maintenanceMonths;
    const remaining = 24 - maintenance;
    
    let total2Year = (m1 * maintenance) + (m2 * remaining);
    
    if (state.paymentMethod === PaymentMethod.LUMP_SUM) {
      total2Year = principal + (initialFeeData.finalFee * maintenance) + (afterFeeData.finalFee * remaining);
    }

    return {
      principal,
      subsidy,
      monthlyInstallment,
      totalInterest,
      initial: { ...initialFeeData, total: m1 },
      after: { ...afterFeeData, total: m2 },
      total2Year
    };
  }, [state, selectedDevice, initialPlan, afterPlan]);

  const formatKrw = (val: number) => new Intl.NumberFormat('ko-KR').format(val) + '원';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginId === 'just208' && loginPw === 'skbnt082') {
      setIsAdmin(true);
      setShowLogin(false);
      setLoginId('');
      setLoginPw('');
    } else {
      alert('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  const addDevice = () => {
    if (newDeviceName && typeof newDevicePrice === 'number') {
      const order = typeof newDeviceOrder === 'number' ? newDeviceOrder : devices.length + 1;
      setDevices([...devices, { id: `dev-${Date.now()}`, name: newDeviceName, price: newDevicePrice, order }]);
      setNewDeviceName('');
      setNewDevicePrice('');
      setNewDeviceOrder('');
    }
  };

  const addPlan = () => {
    if (newPlanName && typeof newPlanPrice === 'number') {
      setPlans([...plans, { id: `plan-${Date.now()}`, name: newPlanName, price: newPlanPrice, subsidy: {} }]);
      setNewPlanName('');
      setNewPlanPrice('');
    }
  };

  const updateDeviceOrder = (id: string, order: number) => {
    setDevices(devices.map(d => d.id === id ? { ...d, order } : d));
  };

  const updateDevicePrice = (id: string, price: number) => {
    setDevices(devices.map(d => d.id === id ? { ...d, price } : d));
  };

  const updatePlanPrice = (id: string, price: number) => {
    setPlans(plans.map(p => p.id === id ? { ...p, price } : p));
  };

  const updateSubsidy = (planId: string, deviceId: string, value: number) => {
    setPlans(plans.map(p => p.id === planId ? { ...p, subsidy: { ...p.subsidy, [deviceId]: value } } : p));
  };

  const resetData = () => {
    if (confirm('모든 데이터를 초기 설정으로 되돌리시겠습니까?')) {
      localStorage.removeItem(STORAGE_KEY_DEVICES);
      localStorage.removeItem(STORAGE_KEY_PLANS);
      window.location.reload();
    }
  };

  if (!results) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans selection:bg-red-100 selection:text-red-900 pb-12 flex flex-col">
      <header className="bg-white border-b-4 border-[#E2000F] px-6 py-6 sticky top-0 z-40 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-tr from-[#E2000F] to-[#F37321] rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg">T</div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">SKT 최적 설계 계산기</h1>
              <p className="text-xs text-[#E2000F] font-black uppercase tracking-widest">Premium Consulting System</p>
            </div>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setIsAdmin(false)}
              className="px-6 py-3 rounded-2xl text-sm font-black bg-slate-800 text-white transition-all shadow-md hover:bg-slate-700"
            >
              관리 종료
            </button>
          )}
        </div>
      </header>

      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">관리자 로그인</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <input 
                type="text" 
                placeholder="아이디" 
                className="w-full px-6 py-4 rounded-2xl border-4 border-slate-100 focus:border-[#E2000F] outline-none font-bold transition-all"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
              />
              <input 
                type="password" 
                placeholder="비밀번호" 
                className="w-full px-6 py-4 rounded-2xl border-4 border-slate-100 focus:border-[#E2000F] outline-none font-bold transition-all"
                value={loginPw}
                onChange={(e) => setLoginPw(e.target.value)}
              />
              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setShowLogin(false)} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 font-black hover:bg-slate-200 transition-all">취소</button>
                <button type="submit" className="flex-1 py-4 rounded-2xl bg-[#E2000F] text-white font-black hover:bg-red-700 transition-all shadow-lg">로그인</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin ? (
        <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 flex-1">
          {/* Device Management Section */}
          <div className="bg-white rounded-3xl shadow-xl border-2 border-slate-200 overflow-hidden">
            <div className="bg-slate-100 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-slate-200">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><i className="fas fa-mobile-screen"></i> 단말기 관리</h2>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <input 
                  type="number" placeholder="순번" className="w-16 px-3 py-2 rounded-xl border-2 border-slate-300 font-bold text-sm outline-none focus:border-[#E2000F]"
                  value={newDeviceOrder} onChange={e => setNewDeviceOrder(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <input 
                  type="text" placeholder="모델명" className="flex-1 sm:w-40 px-3 py-2 rounded-xl border-2 border-slate-300 font-bold text-sm outline-none focus:border-[#E2000F]"
                  value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)}
                />
                <input 
                  type="number" placeholder="출고가" className="w-28 px-3 py-2 rounded-xl border-2 border-slate-300 font-bold text-sm outline-none focus:border-[#E2000F]"
                  value={newDevicePrice} onChange={e => setNewDevicePrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <button onClick={addDevice} className="bg-[#E2000F] text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-md hover:bg-red-700 transition">추가</button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-base">
                <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                  <tr className="border-b-2 border-slate-100">
                    <th className="px-6 py-4 text-left font-black text-slate-500 w-20 text-center">순번</th>
                    <th className="px-6 py-4 text-left font-black text-slate-500">모델명</th>
                    <th className="px-6 py-4 text-left font-black text-slate-500">출고가 (수정 가능)</th>
                    <th className="px-6 py-4 text-center font-black text-slate-500">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedDevices.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="number"
                          className="w-14 px-2 py-1 border-2 border-slate-200 rounded-lg text-sm font-black text-center focus:border-[#E2000F]"
                          value={d.order || ''}
                          onChange={(e) => updateDeviceOrder(d.id, Number(e.target.value))}
                        />
                      </td>
                      <td className="px-6 py-4 font-black text-slate-800">{d.name}</td>
                      <td className="px-6 py-4">
                        <input 
                          type="number"
                          className="w-32 px-3 py-1.5 border-2 border-slate-200 rounded-lg text-sm font-black focus:border-[#E2000F]"
                          value={d.price}
                          onChange={(e) => updateDevicePrice(d.id, Number(e.target.value))}
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => setDevices(devices.filter(x => x.id !== d.id))} className="text-red-400 hover:text-red-600 transition"><i className="fas fa-trash-alt"></i></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subsidies Management Section (Flipped: Devices Rows, Plans Columns Sorted by Price Desc) */}
          <div className="bg-white rounded-3xl shadow-xl border-2 border-slate-200 overflow-hidden">
            <div className="bg-slate-100 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-slate-200">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><i className="fas fa-hand-holding-dollar"></i> 지원금 및 요금제 관리</h2>
                <span className="text-[10px] bg-[#F37321] text-white px-2 py-1 rounded-md font-black">HIGH-PRICE FIRST</span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <input 
                  type="text" placeholder="요금제명" className="flex-1 sm:w-40 px-3 py-2 rounded-xl border-2 border-slate-300 font-bold text-sm outline-none focus:border-[#F37321]"
                  value={newPlanName} onChange={e => setNewPlanName(e.target.value)}
                />
                <input 
                  type="number" placeholder="월정액" className="w-28 px-3 py-2 rounded-xl border-2 border-slate-300 font-bold text-sm outline-none focus:border-[#F37321]"
                  value={newPlanPrice} onChange={e => setNewPlanPrice(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <button onClick={addPlan} className="bg-[#F37321] text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-md hover:bg-[#d65f1a] transition">요금제 추가</button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                  <tr className="border-b-2 border-slate-100">
                    <th className="px-6 py-4 text-left font-black text-slate-500 min-w-[200px] border-r">단말기 (아래로 나열)</th>
                    {sortedPlans.map(p => (
                      <th key={p.id} className="px-4 py-4 text-center font-black text-slate-700 min-w-[140px]">
                        <div className="flex flex-col items-center">
                          <span className="text-[11px] leading-tight mb-2 h-8 flex items-center">{p.name}</span>
                          <input 
                            type="number"
                            className="w-full px-2 py-1 border-2 border-slate-200 rounded-lg text-xs font-black text-center focus:border-[#F37321] mb-2"
                            value={p.price}
                            onChange={(e) => updatePlanPrice(p.id, Number(e.target.value))}
                          />
                          <button onClick={() => setPlans(plans.filter(x => x.id !== p.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                            <i className="fas fa-times-circle"></i>
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedDevices.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-black text-slate-800 border-r bg-slate-50/50">
                        <div className="flex flex-col">
                          <span className="text-xs uppercase text-slate-400 font-black mb-1">ORDER {d.order || '999'}</span>
                          <span className="leading-tight">{d.name}</span>
                        </div>
                      </td>
                      {sortedPlans.map(p => (
                        <td key={p.id} className="px-4 py-4 text-center">
                          <input 
                            type="number" 
                            className="w-full px-2 py-1.5 border-2 border-slate-200 rounded-lg text-xs font-black text-[#E2000F] text-center focus:border-[#E2000F]"
                            value={p.subsidy[d.id] || 0}
                            placeholder="0"
                            onChange={(e) => updateSubsidy(p.id, d.id, Number(e.target.value))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center pt-4">
            <button onClick={resetData} className="px-8 py-4 bg-slate-200 hover:bg-red-100 hover:text-red-700 text-slate-600 rounded-2xl font-black transition-all">
              <i className="fas fa-undo mr-2"></i> 데이터 초기화
            </button>
          </div>
        </div>
      ) : (
        <main className="max-w-6xl mx-auto p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start flex-1">
          <div className="lg:col-span-5 space-y-8">
            <section className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-slate-100 space-y-6">
              <div className="flex items-center gap-3 border-b-2 border-slate-50 pb-4">
                <i className="fas fa-check-circle text-[#E2000F] text-xl"></i>
                <h3 className="text-lg font-black text-slate-900 uppercase">기본 조건 설정</h3>
              </div>

              <div>
                <label className="block text-sm font-black text-slate-500 mb-2 uppercase tracking-tighter">단말기 모델</label>
                <select 
                  className="w-full px-6 py-4 rounded-2xl border-4 border-slate-100 bg-slate-50 font-black text-xl text-slate-900 focus:border-[#E2000F] outline-none transition-all appearance-none cursor-pointer"
                  value={state.deviceId}
                  onChange={(e) => setState({...state, deviceId: e.target.value})}
                >
                  {sortedDevices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-tighter">납부 방식</label>
                  <div className="flex bg-slate-100 p-2 rounded-2xl">
                    <button 
                      onClick={() => setState({...state, paymentMethod: PaymentMethod.INSTALLMENT})}
                      className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${state.paymentMethod === PaymentMethod.INSTALLMENT ? 'bg-white shadow-md text-[#E2000F]' : 'text-slate-500'}`}
                    >할부</button>
                    <button 
                      onClick={() => setState({...state, paymentMethod: PaymentMethod.LUMP_SUM})}
                      className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${state.paymentMethod === PaymentMethod.LUMP_SUM ? 'bg-white shadow-md text-[#E2000F]' : 'text-slate-500'}`}
                    >일시불</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-tighter">할인 구분</label>
                  <div className="flex bg-slate-100 p-2 rounded-2xl">
                    <button 
                      onClick={() => setState({...state, discountType: DiscountType.SUBSIDY})}
                      className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${state.discountType === DiscountType.SUBSIDY ? 'bg-white shadow-md text-[#F37321]' : 'text-slate-500'}`}
                    >공시</button>
                    <button 
                      onClick={() => setState({...state, discountType: DiscountType.CONTRACT})}
                      className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${state.discountType === DiscountType.CONTRACT ? 'bg-white shadow-md text-[#F37321]' : 'text-slate-500'}`}
                    >선약</button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-slate-500 mb-2 uppercase tracking-tighter">임직원 할인 (원)</label>
                <input 
                  type="number"
                  className="w-full px-6 py-4 rounded-2xl border-4 border-slate-100 bg-slate-50 font-black text-xl text-slate-900 outline-none focus:border-[#E2000F] transition-all"
                  value={state.employeeDiscount}
                  onChange={(e) => setState({...state, employeeDiscount: Number(e.target.value)})}
                  placeholder="0"
                />
              </div>
            </section>

            <section className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-slate-100 space-y-6">
              <div className="flex items-center gap-3 border-b-2 border-slate-50 pb-4">
                <i className="fas fa-layer-group text-[#F37321] text-xl"></i>
                <h3 className="text-lg font-black text-slate-900 uppercase">요금제 설계</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-1 tracking-tighter">유지 요금제 (M+{state.maintenanceMonths})</label>
                  <select 
                    className="w-full px-5 py-4 rounded-2xl border-4 border-slate-50 bg-slate-50 font-black text-lg text-slate-900 outline-none"
                    value={state.initialPlanId}
                    onChange={(e) => setState({...state, initialPlanId: e.target.value})}
                  >
                    {sortedPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-1 tracking-tighter">변경 후 요금제</label>
                  <select 
                    className="w-full px-5 py-4 rounded-2xl border-4 border-slate-50 bg-slate-50 font-black text-lg text-slate-900 outline-none"
                    value={state.afterPlanId}
                    onChange={(e) => setState({...state, afterPlanId: e.target.value})}
                  >
                    {sortedPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl flex items-center justify-between border-2 border-slate-100 cursor-pointer" onClick={() => setState({...state, useFamilyDiscount: !state.useFamilyDiscount})}>
                <div>
                  <h4 className="text-base font-black text-slate-800 transition">SKT 온가족할인 적용</h4>
                  <p className="text-[10px] text-slate-400 font-bold">기본료 30% 추가 할인</p>
                </div>
                <div className={`w-16 h-8 rounded-full relative transition-all duration-300 shadow-inner ${state.useFamilyDiscount ? 'bg-[#E2000F]' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform duration-300 ${state.useFamilyDiscount ? 'translate-x-9' : 'translate-x-1'}`}></div>
                </div>
              </div>
            </section>
          </div>

          <div className="lg:col-span-7 space-y-8">
            <section className="bg-gradient-to-br from-[#E2000F] via-[#F37321] to-[#E2000F] rounded-[3rem] p-10 shadow-2xl border-4 border-white/20 relative overflow-hidden text-center text-white">
              <div className="absolute top-0 right-0 p-16 opacity-10 rotate-12">
                <i className="fas fa-coins text-[8rem]"></i>
              </div>
              <div className="absolute bottom-0 left-0 p-16 opacity-10 -rotate-12">
                <i className="fas fa-file-invoice-dollar text-[8rem]"></i>
              </div>

              <div className="relative z-10 space-y-8">
                <div>
                  <span className="bg-white/20 backdrop-blur-md text-white text-sm font-black px-6 py-2.5 rounded-full uppercase tracking-widest border border-white/30 shadow-lg inline-block">
                    최종 할부원금 (기기 순수 가격)
                  </span>
                  <div className="text-4xl lg:text-5xl font-black mt-6 tracking-tighter drop-shadow-2xl">
                    {formatKrw(results.principal)}
                  </div>
                  <p className="text-xs text-white/70 mt-4 font-bold bg-black/10 px-6 py-2 rounded-full inline-block">
                    출고가 {formatKrw(selectedDevice.price)} 
                    {results.subsidy > 0 && ` - 지원금 ${formatKrw(results.subsidy)}`}
                    {state.employeeDiscount > 0 && ` - 임직원할인 ${formatKrw(state.employeeDiscount)}`}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center pt-8 border-t-2 border-white/20">
                  <span className="text-white/80 text-sm font-black uppercase tracking-widest mb-1">24개월 총 소요 비용 (기기+통신료)</span>
                  <div className="text-3xl lg:text-4xl font-black drop-shadow-sm">{formatKrw(results.total2Year)}</div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-2">
                  <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-inner">
                    <span className="text-white/70 text-xs font-black block mb-2 uppercase tracking-tighter">월 단말기 납부액</span>
                    <span className="text-xl lg:text-2xl font-black">{formatKrw(results.monthlyInstallment)}</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-inner">
                    <span className="text-white/70 text-xs font-black block mb-2 uppercase tracking-tighter">2년간 총 이자(5.9%)</span>
                    <span className="text-xl lg:text-2xl font-black">{formatKrw(results.totalInterest)}</span>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-2 border-slate-100 flex flex-col h-full relative">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 text-xl shadow-inner"><i className="fas fa-hourglass-start"></i></div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900">변경 전 {state.maintenanceMonths}개월</h4>
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">Initial Fee</p>
                  </div>
                </div>
                
                <div className="space-y-4 flex-1">
                  <div className="flex justify-between text-sm font-black">
                    <span className="text-slate-500 tracking-tighter">기본료 ({initialPlan.name})</span>
                    <span className="text-slate-900">{formatKrw(initialPlan.price)}</span>
                  </div>
                  {results.initial.contractDiscount > 0 && (
                    <div className="flex justify-between text-sm font-black text-[#E2000F]">
                      <span className="tracking-tighter">선택약정(25%)</span>
                      <span>-{formatKrw(results.initial.contractDiscount)}</span>
                    </div>
                  )}
                  {results.initial.familyDiscount > 0 && (
                    <div className="flex justify-between text-sm font-black text-[#F37321]">
                      <span className="tracking-tighter">온가족할인(30%)</span>
                      <span>-{formatKrw(results.initial.familyDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-50">
                    <span className="text-slate-500 tracking-tighter">단말기 할부금</span>
                    <span className="text-slate-900">{formatKrw(results.monthlyInstallment)}</span>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t-4 border-slate-100 flex justify-between items-end gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">월 예상 납부액</span>
                  <span className="text-xl lg:text-2xl font-black text-slate-900 leading-none whitespace-nowrap">{formatKrw(results.initial.total)}</span>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-[#E2000F]/20 flex flex-col h-full relative">
                <div className="absolute top-0 right-0 bg-[#E2000F] text-white text-[10px] font-black px-5 py-2 rounded-bl-2xl shadow-md">OPTIMAL DESIGN</div>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-[#E2000F] text-xl shadow-inner"><i className="fas fa-check-double"></i></div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900">변경 후 {24 - state.maintenanceMonths}개월</h4>
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">Post-Period Fee</p>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="flex justify-between text-sm font-black">
                    <span className="text-slate-500 tracking-tighter">기본료 ({afterPlan.name})</span>
                    <span className="text-slate-900">{formatKrw(afterPlan.price)}</span>
                  </div>
                  {results.after.contractDiscount > 0 && (
                    <div className="flex justify-between text-sm font-black text-[#E2000F]">
                      <span className="tracking-tighter">선택약정(25%)</span>
                      <span>-{formatKrw(results.after.contractDiscount)}</span>
                    </div>
                  )}
                  {results.after.familyDiscount > 0 && (
                    <div className="flex justify-between text-sm font-black text-[#F37321]">
                      <span className="tracking-tighter">온가족할인(30%)</span>
                      <span>-{formatKrw(results.after.familyDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black pt-2 border-t border-slate-50">
                    <span className="text-slate-500 tracking-tighter">단말기 할부금</span>
                    <span className="text-slate-900">{formatKrw(results.monthlyInstallment)}</span>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t-4 border-[#E2000F]/10 flex justify-between items-end gap-2">
                  <span className="text-[10px] font-black text-[#E2000F] uppercase tracking-widest leading-none mb-1">월 예상 납부액</span>
                  <span className="text-xl lg:text-2xl font-black text-[#E2000F] leading-none whitespace-nowrap">{formatKrw(results.after.total)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-lg border-2 border-slate-100 space-y-4">
              <h5 className="text-base font-black text-slate-900 flex items-center gap-2 uppercase tracking-tighter">
                <i className="fas fa-info-circle text-[#E2000F]"></i> 상세 산출 근거 및 안내
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100">
                  <p className="text-sm font-black text-slate-800 mb-3 tracking-tighter">비용 합계 상세</p>
                  <div className="space-y-2 text-xs font-bold text-slate-500">
                    <div className="flex justify-between"><span className="tracking-tighter">할부원금</span><span>{formatKrw(results.principal)}</span></div>
                    <div className="flex justify-between"><span className="tracking-tighter">유지기간 총액 ({state.maintenanceMonths}개월)</span><span>{formatKrw(results.initial.total * state.maintenanceMonths)}</span></div>
                    <div className="flex justify-between"><span className="tracking-tighter">이후기간 총액 ({24-state.maintenanceMonths}개월)</span><span>{formatKrw(results.after.total * (24-state.maintenanceMonths))}</span></div>
                    <div className="pt-2 border-t-2 border-slate-200 flex justify-between text-slate-900 font-black"><span>24개월 총액</span><span>{formatKrw(results.total2Year)}</span></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <ul className="text-xs font-black text-slate-500 space-y-2 list-none">
                    <li className="flex gap-2"><i className="fas fa-caret-right text-[#E2000F] mt-1"></i> 할부 이자: 연 5.9% 원리금균등 기준 (월 복리)</li>
                    <li className="flex gap-2"><i className="fas fa-caret-right text-[#E2000F] mt-1"></i> 온가족할인: 가입 연수 합산 30년 이상 기준</li>
                    <li className="flex gap-2"><i className="fas fa-caret-right text-[#E2000F] mt-1"></i> 공시지원금: 초기 선택 요금제에 따라 상이함</li>
                    <li className="flex gap-2"><i className="fas fa-caret-right text-[#E2000F] mt-1"></i> 유효기간: 개통 당일 정책에 따라 변동 가능</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      <footer className="max-w-6xl mx-auto px-6 mt-12 mb-12 text-center relative">
        <div className="w-20 h-2 bg-gradient-to-r from-[#E2000F] to-[#F37321] mx-auto rounded-full mb-6 shadow-sm opacity-50"></div>
        <p className="text-slate-400 text-xs font-black uppercase tracking-[0.4em]">SK TELECOM SALES CONSULTING • PROFESSIONAL v3.6</p>
        
        <button 
          onClick={() => isAdmin ? setIsAdmin(false) : setShowLogin(true)}
          className="absolute right-6 bottom-0 text-slate-300 hover:text-slate-500 transition-colors"
          title="관리자 설정"
        >
          <i className="fas fa-cog text-lg"></i>
        </button>
      </footer>
    </div>
  );
};

export default App;
