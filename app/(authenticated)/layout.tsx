import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'

function NavigationFallback() {
  return <div aria-hidden="true" className="fixed inset-x-0 bottom-0 h-16 border-t border-gray-800 bg-gray-900" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
}

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      {children}
      <Suspense fallback={<NavigationFallback />}>
        <BottomNav />
      </Suspense>
    </div>
  )
}
