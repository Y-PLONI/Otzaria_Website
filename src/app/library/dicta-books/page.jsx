'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Header from '@/components/Header'
import Link from 'next/link'

export default function DictaBooksPublicPage() {
  const { data: session } = useSession()
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const isAdmin = session?.user?.role === 'admin'

  useEffect(() => {
    fetchBooks()
  }, [])

  const fetchBooks = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/dicta/books')
      if (res.ok) {
        const data = await res.json()
        setBooks(data)
      }
    } catch (error) {
      console.error('Error fetching books:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredBooks = books.filter(book => 
    book.title?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <Header />
      
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <h1 className="text-4xl font-bold font-frank text-slate-900 mb-2">עריכת ספרי דיקטה</h1>
              <p className="text-slate-600 text-lg">בחר ספר שהועלה מהסריקות של דיקטה והשתתף בסידור הטקסט לצורך הכנסה לאוצריא.</p>
            </div>
            
            {isAdmin && (
              <Link 
                href="/library/admin/dicta-books" 
                className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-all font-semibold shadow-sm"
              >
                <span className="material-symbols-outlined text-primary">security</span>
                ממשק ניהול וסנכרון
              </Link>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative mb-8">
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5">
              search
            </span>
            <input 
              type="text"
              placeholder="חיפוש ספר לפי שם..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-lg"
            />
          </div>

          {/* Books Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-48 bg-white animate-pulse rounded-2xl border border-slate-100"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBooks.length > 0 ? (
                filteredBooks.map((book) => (
                  <div key={book._id} className="group bg-white rounded-2xl border border-slate-200 p-6 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                        book.status === 'available' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                        {book.status === 'available' ? 'זמין לעריכה' : 'בטיפול'}
                      </div>
                      <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">
                        menu_book
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 mb-2 font-frank leading-tight line-clamp-2">
                      {book.title}
                    </h3>

                    <div className="mt-auto pt-6">
                      <div className="flex flex-col gap-2 mb-6">
                        {book.claimedBy ? (
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span className="material-symbols-outlined text-base">person</span>
                            <span>נערך על ידי {book.claimedBy.name || 'משתמש'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-slate-400 italic">
                            <span className="material-symbols-outlined text-base">schedule</span>
                            <span>טרם התחילו בעריכה</span>
                          </div>
                        )}
                      </div>

                      <Link 
                        href={`/library/dicta-editor/${book._id}`}
                        className="block w-full text-center bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-primary transition-all shadow-md"
                      >
                        פתח עורך טקסט
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                  <p className="text-slate-400 text-lg">לא נמצאו ספרים התואמים את החיפוש שלך.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}