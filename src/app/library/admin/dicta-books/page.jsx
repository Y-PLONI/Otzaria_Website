'use client'

import { useState, useEffect } from 'react'

export default function AdminDictaBooksPage() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newBookTitle, setNewBookTitle] = useState('')
  const [newBookContent, setNewBookContent] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const loadBooks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dicta/books')
      if (response.ok) {
        const data = await response.json()
        setBooks(data)
      }
    } catch (error) {
      console.error('Error loading dicta books:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBooks()
  }, [])

  const handleCreateBook = async () => {
    if (!newBookTitle.trim()) return alert('נא להזין שם לספר')
    
    try {
      const response = await fetch('/api/dicta/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newBookTitle,
          content: newBookContent
        })
      })
      
      if (response.ok) {
        setNewBookTitle('')
        setNewBookContent('')
        setShowCreateForm(false)
        loadBooks()
        alert('הספר נוצר בהצלחה!')
      } else {
        const data = await response.json()
        alert(data.error || 'שגיאה ביצירת הספר')
      }
    } catch (e) {
      alert('שגיאה ביצירת הספר')
    }
  }

  const handleDeleteBook = async (bookId, bookTitle) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הספר "${bookTitle}"?`)) return
    
    try {
      const response = await fetch(`/api/dicta/books/${bookId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setBooks(prev => prev.filter(b => b._id !== bookId))
        alert('הספר נמחק בהצלחה!')
      } else {
        alert('שגיאה במחיקת הספר')
      }
    } catch (e) {
      alert('שגיאה במחיקת הספר')
    }
  }

  const handleReleaseBook = async (bookId) => {
    try {
      const response = await fetch(`/api/dicta/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release' })
      })
      
      if (response.ok) {
        loadBooks()
        alert('הספר שוחרר בהצלחה!')
      } else {
        alert('שגיאה בשחרור הספר')
      }
    } catch (e) {
      alert('שגיאה בשחרור הספר')
    }
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'available': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">פנוי</span>
      case 'in-progress': return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">בעריכה</span>
      case 'completed': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">הושלם</span>
      default: return status
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
    </div>
  )

  return (
    <div className="glass-strong p-6 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">edit_document</span>
          ניהול ספרי דיקטה
        </h2>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg hover:bg-primary/90 transition flex items-center gap-2"
        >
          <span className="material-symbols-outlined">add</span>
          הוסף ספר חדש
        </button>
      </div>

      {/* טופס יצירת ספר */}
      {showCreateForm && (
        <div className="mb-6 p-4 bg-surface-variant rounded-lg">
          <h3 className="font-bold mb-4">יצירת ספר חדש</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">שם הספר</label>
              <input
                type="text"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="הזן שם לספר"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">תוכן התחלתי (אופציונלי)</label>
              <textarea
                value={newBookContent}
                onChange={(e) => setNewBookContent(e.target.value)}
                className="w-full p-2 border rounded h-32"
                placeholder="הדבק כאן טקסט התחלתי..."
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleCreateBook}
                className="bg-primary text-on-primary px-4 py-2 rounded hover:bg-primary/90"
              >
                צור ספר
              </button>
              <button 
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* רשימת ספרים */}
      {books.length === 0 ? (
        <div className="text-center py-12 text-on-surface/60">
          <span className="material-symbols-outlined text-6xl mb-4 block">library_books</span>
          <p>אין ספרי דיקטה עדיין</p>
          <p className="text-sm">לחץ "הוסף ספר חדש" כדי להתחיל</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-variant">
                <th className="text-right p-3">שם הספר</th>
                <th className="text-right p-3">סטטוס</th>
                <th className="text-right p-3">נערך ע"י</th>
                <th className="text-right p-3">עדכון אחרון</th>
                <th className="text-center p-3">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {books.map(book => (
                <tr key={book._id} className="border-b border-surface-variant/50 hover:bg-surface-variant/30">
                  <td className="p-3 font-medium">{book.title}</td>
                  <td className="p-3">{getStatusBadge(book.status)}</td>
                  <td className="p-3">{book.claimedBy?.name || '-'}</td>
                  <td className="p-3 text-sm text-on-surface/60">
                    {new Date(book.updatedAt).toLocaleDateString('he-IL')}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-center">
                      {book.status === 'in-progress' && (
                        <button
                          onClick={() => handleReleaseBook(book._id)}
                          className="p-2 text-orange-600 hover:bg-orange-100 rounded"
                          title="שחרר ספר"
                        >
                          <span className="material-symbols-outlined">lock_open</span>
                        </button>
                      )}
                      <a
                        href={`/dicta-editor?bookId=${book._id}`}
                        target="_blank"
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                        title="פתח בעורך"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </a>
                      <button
                        onClick={() => handleDeleteBook(book._id, book.title)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded"
                        title="מחק ספר"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
