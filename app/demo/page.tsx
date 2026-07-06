'use client'
import { useState } from 'react'
import ProgressBar from '@/components/ProgressBar'
import { CATEGORIES, getCategoryIcon, getCategoryLabel } from '@/lib/categories'
import { Home, User, Users, Settings, Plus, Trash2, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'

const MOCK_USER = { name: 'Lucas', username: 'lucas', salary: 80000, savings_goal: 15000 }
const MOCK_EXPENSES_IND = [
  { id: '1', amount: 3200, category: 'supermercado', description: 'Disco', date: '2026-07-06' },
  { id: '2', amount: 850, category: 'transporte', description: null, date: '2026-07-06' },
  { id: '3', amount: 4500, category: 'comida', description: 'Salida viernes', date: '2026-07-05' },
  { id: '4', amount: 1200, category: 'entretenimiento', description: 'Netflix', date: '2026-07-04' },
  { id: '5', amount: 6800, category: 'hogar', description: 'Ferretería', date: '2026-07-03' },
]
const MOCK_COUPLE = { monthly_budget: 40000 }
const MOCK_DEPOSITS = [
  { id: 'd1', user: 'Lucas', amount: 20000 },
  { id: 'd2', user: 'Sofi', amount: 20000 },
]
const MOCK_EXPENSES_PAR = [
  { id: 'p1', amount: 8500, category: 'supermercado', description: 'Supermercado semanal', date: '2026-07-06' },
  { id: 'p2', amount: 3200, category: 'comida', description: 'Cena afuera', date: '2026-07-05' },
  { id: 'p3', amount: 1800, category: 'entretenimiento', description: 'Cine', date: '2026-07-04' },
]

function formatUYU(n: number) {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

type Screen = 'login' | 'home' | 'individual' | 'pareja' | 'agregar' | 'config'

const NAV = [
  { id: 'individual', icon: User, label: 'Yo' },
  { id: 'pareja', icon: Users, label: 'Pareja' },
  { id: 'config', icon: Settings, label: 'Config' },
] as const

export default function DemoPage() {
  const [screen, setScreen] = useState<Screen>('login')
  const [selectedCat, setSelectedCat] = useState('')
  const [depositOpen, setDepositOpen] = useState(false)
  const [tipo, setTipo] = useState<'individual' | 'pareja'>('individual')

  const totalInd = MOCK_EXPENSES_IND.reduce((s, e) => s + e.amount, 0)
  const limiteInd = MOCK_USER.salary - MOCK_USER.savings_goal
  const dispInd = limiteInd - totalInd

  const totalDeposit = MOCK_DEPOSITS.reduce((s, d) => s + d.amount, 0)
  const totalPar = MOCK_EXPENSES_PAR.reduce((s, e) => s + e.amount, 0)
  const dispPar = totalDeposit - totalPar

  const nav = (s: Screen) => setScreen(s)

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-sm mb-6">
        <p className="text-center text-xs text-gray-600 mb-4 uppercase tracking-widest">— Vista previa del diseño —</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {(['login', 'home', 'individual', 'pareja', 'agregar', 'config'] as Screen[]).map((s) => (
            <button key={s} onClick={() => nav(s)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${screen === s ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* PHONE FRAME */}
      <div className="w-full max-w-sm bg-gray-950 rounded-3xl border border-gray-800 overflow-hidden shadow-2xl" style={{ minHeight: 680 }}>

        {/* LOGIN */}
        {screen === 'login' && (
          <div className="flex flex-col items-center justify-center px-6 py-16 min-h-[680px]">
            <div className="text-center mb-10">
              <div className="text-5xl mb-4">💸</div>
              <h1 className="text-3xl font-bold text-white">Gastos</h1>
              <p className="text-gray-500 mt-2 text-sm">Tracker de gastos</p>
            </div>
            <div className="w-full flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-400 font-medium">Usuario</label>
                <input readOnly defaultValue="lucas" className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-base focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-400 font-medium">Contraseña</label>
                <input readOnly type="password" defaultValue="secret" className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-base focus:outline-none" />
              </div>
              <button onClick={() => nav('home')} className="mt-2 bg-emerald-600 text-white font-semibold rounded-xl py-3.5 text-base">
                Ingresar
              </button>
            </div>
          </div>
        )}

        {/* HOME */}
        {screen === 'home' && (
          <div className="flex flex-col min-h-[680px]">
            <div className="flex-1 px-4 pt-6 pb-4 flex flex-col gap-5 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">julio 2026</p>
                  <h1 className="text-xl font-bold text-white">Hola, Lucas 👋</h1>
                </div>
                <button className="text-gray-600 text-sm">Salir</button>
              </div>

              <div className="bg-gray-900 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm font-medium">Mis gastos</span>
                  <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">Individual</span>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Disponible</p>
                  <p className="text-3xl font-bold text-emerald-400">{formatUYU(dispInd)}</p>
                </div>
                <ProgressBar value={totalInd} max={limiteInd} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-xs text-gray-600">Sueldo</p><p className="text-sm font-semibold text-white">{formatUYU(MOCK_USER.salary)}</p></div>
                  <div><p className="text-xs text-gray-600">Meta ahorro</p><p className="text-sm font-semibold text-emerald-400">{formatUYU(MOCK_USER.savings_goal)}</p></div>
                  <div><p className="text-xs text-gray-600">Gastado</p><p className="text-sm font-semibold text-white">{formatUYU(totalInd)}</p></div>
                </div>
              </div>

              <div className="bg-gray-900 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm font-medium">Pareja</span>
                  <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">Compartido</span>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Disponible</p>
                  <p className="text-3xl font-bold text-emerald-400">{formatUYU(dispPar)}</p>
                </div>
                <ProgressBar value={totalPar} max={totalDeposit} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-xs text-gray-600">Presupuesto</p><p className="text-sm font-semibold text-white">{formatUYU(MOCK_COUPLE.monthly_budget)}</p></div>
                  <div><p className="text-xs text-gray-600">Depositado</p><p className="text-sm font-semibold text-emerald-400">{formatUYU(totalDeposit)}</p></div>
                  <div><p className="text-xs text-gray-600">Gastado</p><p className="text-sm font-semibold text-white">{formatUYU(totalPar)}</p></div>
                </div>
              </div>
            </div>
            <BottomNavDemo active="home" onNav={nav} />
          </div>
        )}

        {/* INDIVIDUAL */}
        {screen === 'individual' && (
          <div className="flex flex-col min-h-[680px]">
            <div className="flex-1 px-4 pt-6 pb-4 flex flex-col gap-5 overflow-y-auto">
              <h1 className="text-xl font-bold text-white">Mis gastos</h1>
              <div className="bg-gray-900 rounded-2xl p-5 flex flex-col gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Disponible este mes</p>
                  <p className="text-3xl font-bold text-emerald-400">{formatUYU(dispInd)}</p>
                </div>
                <ProgressBar value={totalInd} max={limiteInd} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-xs text-gray-600">Límite</p><p className="text-sm font-semibold text-white">{formatUYU(limiteInd)}</p></div>
                  <div><p className="text-xs text-gray-600">Gastado</p><p className="text-sm font-semibold text-white">{formatUYU(totalInd)}</p></div>
                  <div><p className="text-xs text-gray-600">Meta ahorro</p><p className="text-sm font-semibold text-emerald-400">{formatUYU(MOCK_USER.savings_goal)}</p></div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hoy</p>
                {MOCK_EXPENSES_IND.slice(0, 2).map((e) => (
                  <ExpenseRow key={e.id} {...e} />
                ))}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">Ayer</p>
                {MOCK_EXPENSES_IND.slice(2, 3).map((e) => (
                  <ExpenseRow key={e.id} {...e} />
                ))}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">4 jul</p>
                {MOCK_EXPENSES_IND.slice(3).map((e) => (
                  <ExpenseRow key={e.id} {...e} />
                ))}
              </div>
            </div>
            <button onClick={() => { setTipo('individual'); nav('agregar') }} className="fixed-fab">
              <div className="absolute bottom-20 right-4 bg-emerald-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg">
                <Plus size={26} />
              </div>
            </button>
            <BottomNavDemo active="individual" onNav={nav} />
          </div>
        )}

        {/* PAREJA */}
        {screen === 'pareja' && (
          <div className="flex flex-col min-h-[680px]">
            <div className="flex-1 px-4 pt-6 pb-4 flex flex-col gap-5 overflow-y-auto">
              <h1 className="text-xl font-bold text-white">Pareja</h1>
              <div className="bg-gray-900 rounded-2xl p-5 flex flex-col gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Disponible este mes</p>
                  <p className="text-3xl font-bold text-emerald-400">{formatUYU(dispPar)}</p>
                </div>
                <ProgressBar value={totalPar} max={totalDeposit} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-xs text-gray-600">Presupuesto</p><p className="text-sm font-semibold text-white">{formatUYU(MOCK_COUPLE.monthly_budget)}</p></div>
                  <div><p className="text-xs text-gray-600">Depositado</p><p className="text-sm font-semibold text-emerald-400">{formatUYU(totalDeposit)}</p></div>
                  <div><p className="text-xs text-gray-600">Gastado</p><p className="text-sm font-semibold text-white">{formatUYU(totalPar)}</p></div>
                </div>
              </div>
              <div className="bg-gray-900 rounded-2xl p-4 flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Depósitos del mes</p>
                {MOCK_DEPOSITS.map((d) => (
                  <div key={d.id} className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-300">{d.user}</span>
                    <span className="text-sm font-semibold text-emerald-400">+{formatUYU(d.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-gray-900 rounded-2xl overflow-hidden">
                <button onClick={() => setDepositOpen(!depositOpen)} className="w-full flex items-center justify-between p-4 text-sm text-gray-400">
                  <span className="font-medium">+ Registrar depósito</span>
                  {depositOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {depositOpen && (
                  <div className="px-4 pb-4 flex flex-col gap-3">
                    <input readOnly placeholder="Monto en UYU" className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-base w-full focus:outline-none" />
                    <button className="bg-emerald-700 text-white font-semibold rounded-xl py-3 text-sm">Guardar depósito</button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hoy</p>
                {MOCK_EXPENSES_PAR.slice(0, 1).map((e) => <ExpenseRow key={e.id} {...e} />)}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">Ayer</p>
                {MOCK_EXPENSES_PAR.slice(1).map((e) => <ExpenseRow key={e.id} {...e} />)}
              </div>
            </div>
            <button onClick={() => { setTipo('pareja'); nav('agregar') }} className="fixed-fab">
              <div className="absolute bottom-20 right-4 bg-emerald-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg">
                <Plus size={26} />
              </div>
            </button>
            <BottomNavDemo active="pareja" onNav={nav} />
          </div>
        )}

        {/* AGREGAR */}
        {screen === 'agregar' && (
          <div className="flex flex-col min-h-[680px]">
            <div className="flex-1 px-4 pt-6 pb-6 flex flex-col gap-5 overflow-y-auto">
              <div className="flex items-center gap-3">
                <button onClick={() => nav(tipo === 'pareja' ? 'pareja' : 'individual')} className="text-gray-400">
                  <ArrowLeft size={22} />
                </button>
                <h1 className="text-xl font-bold text-white">Agregar gasto</h1>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2 font-medium">¿Para quién?</p>
                <div className="flex gap-2">
                  {(['individual', 'pareja'] as const).map((t) => (
                    <button key={t} onClick={() => setTipo(t)}
                      className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-colors ${tipo === t ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400'}`}>
                      {t === 'individual' ? '👤 Yo' : '💑 Pareja'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2 font-medium">Monto</p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">$</span>
                  <input readOnly placeholder="0" className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-8 pr-4 py-3.5 text-white text-xl font-semibold placeholder-gray-700 focus:outline-none" />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2 font-medium">Categoría</p>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(({ id, label, icon }) => (
                    <button key={id} onClick={() => setSelectedCat(id)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-colors ${selectedCat === id ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400'}`}>
                      <span className="text-2xl">{icon}</span>{label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2 font-medium">Descripción <span className="text-gray-600">(opcional)</span></p>
                <input readOnly placeholder="Ej: almuerzo con amigos" className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none text-base" />
              </div>
              <button className="bg-emerald-600 text-white font-semibold rounded-xl py-4 text-base mt-2">
                Guardar gasto
              </button>
            </div>
            <BottomNavDemo active="agregar" onNav={nav} />
          </div>
        )}

        {/* CONFIG */}
        {screen === 'config' && (
          <div className="flex flex-col min-h-[680px]">
            <div className="flex-1 px-4 pt-6 pb-4 flex flex-col gap-4 overflow-y-auto">
              <h1 className="text-xl font-bold text-white">Configuración</h1>
              <div className="bg-gray-900 rounded-2xl p-5">
                <h2 className="text-base font-semibold text-white mb-4">Mis finanzas</h2>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-sm text-gray-400 font-medium block mb-1.5">Sueldo mensual</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input readOnly defaultValue={MOCK_USER.salary} className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none text-base" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 font-medium block mb-1.5">Meta de ahorro mensual</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input readOnly defaultValue={MOCK_USER.savings_goal} className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none text-base" />
                    </div>
                    <p className="text-xs text-gray-600 mt-1.5">Límite gasto = sueldo − meta ahorro</p>
                  </div>
                  <button className="bg-emerald-700 text-white font-semibold rounded-xl py-3 text-sm">Guardar</button>
                </div>
              </div>
              <div className="bg-gray-900 rounded-2xl p-5">
                <h2 className="text-base font-semibold text-white mb-4">Pareja</h2>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-sm text-gray-400 font-medium block mb-1.5">Presupuesto mensual conjunto</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input readOnly defaultValue={MOCK_COUPLE.monthly_budget} className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none text-base" />
                    </div>
                  </div>
                  <button className="bg-emerald-700 text-white font-semibold rounded-xl py-3 text-sm">Guardar</button>
                </div>
              </div>
            </div>
            <BottomNavDemo active="config" onNav={nav} />
          </div>
        )}

      </div>

      <p className="text-xs text-gray-700 mt-6 text-center">Datos de ejemplo · No conectado a Supabase</p>
    </div>
  )
}

function ExpenseRow({ amount, category, description }: { id: string; amount: number; category: string; description: string | null; date: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900">
      <span className="text-2xl">{getCategoryIcon(category)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{description || getCategoryLabel(category)}</p>
        <p className="text-xs text-gray-500">{getCategoryLabel(category)}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white">{formatUYU(amount)}</span>
        <button className="text-gray-700 hover:text-red-500 p-1"><Trash2 size={16} /></button>
      </div>
    </div>
  )
}

function BottomNavDemo({ active, onNav }: { active: string; onNav: (s: Screen) => void }) {
  return (
    <nav className="border-t border-gray-800 bg-gray-900">
      <div className="flex justify-around items-center h-16 px-2">
        <button onClick={() => onNav('individual')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${active === 'individual' ? 'text-emerald-400' : 'text-gray-500'}`}>
          <User size={22} />
          <span className="text-xs font-medium">Yo</span>
        </button>

        <button onClick={() => onNav('pareja')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${active === 'pareja' ? 'text-emerald-400' : 'text-gray-500'}`}>
          <Users size={22} />
          <span className="text-xs font-medium">Pareja</span>
        </button>

        <button onClick={() => onNav('agregar')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${active === 'agregar' ? 'text-emerald-400' : 'text-gray-500'}`}>
          <Plus size={22} />
          <span className="text-xs font-medium">Agregar</span>
        </button>

        <button onClick={() => onNav('config')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${active === 'config' ? 'text-emerald-400' : 'text-gray-500'}`}>
          <Settings size={22} />
          <span className="text-xs font-medium">Config</span>
        </button>
      </div>
    </nav>
  )
}
