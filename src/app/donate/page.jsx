'use client'

import OtzariaSoftwareHeader from '@/components/OtzariaSoftwareHeader'
import OtzariaSoftwareFooter from '@/components/OtzariaSoftwareFooter'

export default function DonatePage() {
  return (
    <div className="min-h-screen bg-background">
      <OtzariaSoftwareHeader />

      <main className="py-12 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold text-primary mb-6" style={{ fontFamily: 'FrankRuehl, serif' }}>
            תרומה לאוצריא
          </h1>
          
          <div className="glass-strong p-8 rounded-2xl border border-gray-200 bg-white">
            <span className="material-symbols-outlined text-7xl text-primary mb-4 block">
              volunteer_activism
            </span>
            <p className="text-xl text-gray-700 mb-8">
              הפרויקט מתוחזק בהתנדבות. תרומתכם עוזרת לנו לשלם על שרתים ולהמשיך לפתח את התוכנה.
            </p>
            
            <a
              href="https://www.matara.pro/nedarimplus/online/?S=ejco"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-xl text-lg font-bold hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              <span className="material-symbols-outlined">payments</span>
              לתרומה מאובטחת (נדרים פלוס)
            </a>
          </div>
        </div>
      </main>

      <OtzariaSoftwareFooter />
    </div>
  )
}