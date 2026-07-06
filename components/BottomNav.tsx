'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Users, Plus, Settings } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()
  const tipo = pathname === '/pareja' ? 'pareja' : 'individual'

  const linkClass = (href: string) =>
    `flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
      pathname === href ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
    }`

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        <Link href="/individual" className={linkClass('/individual')}>
          <User size={22} />
          <span className="text-xs font-medium">Yo</span>
        </Link>
        <Link href="/pareja" className={linkClass('/pareja')}>
          <Users size={22} />
          <span className="text-xs font-medium">Pareja</span>
        </Link>
        <Link href={`/agregar?tipo=${tipo}`} className={linkClass('/agregar')}>
          <Plus size={22} />
          <span className="text-xs font-medium">Agregar</span>
        </Link>
        <Link href="/config" className={linkClass('/config')}>
          <Settings size={22} />
          <span className="text-xs font-medium">Config</span>
        </Link>
      </div>
    </nav>
  )
}
