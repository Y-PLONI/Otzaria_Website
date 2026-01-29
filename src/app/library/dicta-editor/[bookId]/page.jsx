'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Button from '@/components/Button'
import CreateHeadersModal from '@/components/dicta-tools/CreateHeadersModal'
import SingleLetterHeadersModal from '@/components/dicta-tools/SingleLetterHeadersModal'
import ChangeHeadingModal from '@/components/dicta-tools/ChangeHeadingModal'
import PunctuateModal from '@/components/dicta-tools/PunctuateModal'
import PageBHeaderModal from '@/components/dicta-tools/PageBHeaderModal'
import ReplacePageBModal from '@/components/dicta-tools/ReplacePageBModal'
import HeaderErrorCheckerModal from '@/components/dicta-tools/HeaderErrorCheckerModal'
import TextCleanerModal from '@/components/dicta-tools/TextCleanerModal'

export default function DictaEditorPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const bookId = params?.bookId
  
  const [book, setBook] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fontSize, setFontSize] = useState(18)
  const [toc, setToc] = useState([])
  const [activeTool, setActiveTool] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const contentRef = useRef(null)

  // טעינת הספר מה-API
  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/signin')
      return
    }
    
    const loadBook = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/dicta/books/${bookId}`)
        if (!res.ok) throw new Error('שגיאה בטעינת הספר')
        const data = await res.json()
        setBook(data)
        setContent(data.content || '')
      } catch (error) {
        console.error('Error loading book:', error)
        alert('שגיאה בטעינת הספר')
      } finally {
        setLoading(false)
      }
    }
    
    if (bookId) loadBook()
  }, [bookId, status, router])

  // יצירת תוכן עניינים מתגי H1-H6
  useEffect(() => {
    if (!content) return
    
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6')
    
    const tocItems = Array.from(headings).map((heading, index) => ({
      id: `heading-${index}`,
      level: parseInt(heading.tagName[1]),
      text: heading.textContent,
      html: heading.outerHTML
    }))
    
    setToc(tocItems)
  }, [content])

  // שמירת הספר
  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch(`/api/dicta/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
      
      if (!res.ok) throw new Error('שגיאה בשמירה')
      alert('הספר נשמר בהצלחה!')
    } catch (error) {
      console.error('Error saving book:', error)
      alert('שגיאה בשמירת הספר')
    } finally {
      setSaving(false)
    }
  }

  // רענון התוכן לאחר שינוי בכלי
  const refreshContent = async () => {
    try {
      const res = await fetch(`/api/dicta/books/${bookId}`)
      if (!res.ok) throw new Error('שגיאה ברענון')
      const data = await res.json()
      setContent(data.content || '')
    } catch (error) {
      console.error('Error refreshing:', error)
      alert('שגיאה ברענון התוכן')
    }
  }

  // גלילה לסעיף בתוכן
  const scrollToHeading = (index) => {
    if (!contentRef.current) return
    const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6')
    if (headings[index]) {
      headings[index].scrollIntoView({ behavior: 'smooth', block: 'center' })
      headings[index].style.backgroundColor = '#fff3cd'
      setTimeout(() => {
        headings[index].style.backgroundColor = ''
      }, 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">טוען...</div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">הספר לא נמצא</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            icon="arrow_forward"
            variant="ghost"
            onClick={() => router.push('/library/admin/dicta-books')}
            label="חזרה"
          />
          <h1 className="text-2xl font-bold text-gray-800">{book.title}</h1>
          {book.status === 'in-progress' && (
            <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm">
              בעריכה
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            icon={editMode ? 'visibility' : 'edit'}
            variant="ghost"
            size="sm"
            onClick={() => setEditMode(!editMode)}
            label={editMode ? 'תצוגה' : 'עריכה'}
          />
          <Button
            icon="remove"
            variant="ghost"
            size="sm"
            onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
          />
          <span className="text-sm font-medium">{fontSize}</span>
          <Button
            icon="add"
            variant="ghost"
            size="sm"
            onClick={() => setFontSize(prev => Math.min(32, prev + 2))}
          />
          <Button
            icon="save"
            variant="primary"
            onClick={handleSave}
            loading={saving}
            label="שמירה"
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <aside className="w-20 bg-white border-l flex flex-col items-center py-4 gap-2 overflow-y-auto shadow-sm">
          <button
            onClick={() => setActiveTool('createHeaders')}
            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            title="יצירת כותרות"
          >
            <span className="material-symbols-outlined text-gray-700">title</span>
          </button>
          
          <button
            onClick={() => setActiveTool('singleLetterHeaders')}
            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            title="כותרות אותיות"
          >
            <span className="material-symbols-outlined text-gray-700">format_size</span>
          </button>
          
          <button
            onClick={() => setActiveTool('changeHeading')}
            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            title="שינוי רמת כותרת"
          >
            <span className="material-symbols-outlined text-gray-700">format_indent_increase</span>
          </button>
          
          <button
            onClick={() => setActiveTool('punctuate')}
            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            title="הדגשה וניקוד"
          >
            <span className="material-symbols-outlined text-gray-700">format_bold</span>
          </button>
          
          <button
            onClick={() => setActiveTool('pageBHeader')}
            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            title="כותרות עמוד ב"
          >
            <span className="material-symbols-outlined text-gray-700">find_in_page</span>
          </button>
          
          <button
            onClick={() => setActiveTool('replacePageB')}
            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            title="החלפת עמוד ב"
          >
            <span className="material-symbols-outlined text-gray-700">swap_horiz</span>
          </button>
          
          <button
            onClick={() => setActiveTool('headerCheck')}
            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            title="בדיקת שגיאות בכותרות"
          >
            <span className="material-symbols-outlined text-gray-700">bug_report</span>
          </button>
          
          <button
            onClick={() => setActiveTool('cleanText')}
            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            title="ניקוי טקסט"
          >
            <span className="material-symbols-outlined text-gray-700">cleaning_services</span>
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6 bg-white">
          {editMode ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full p-4 border rounded-lg font-mono resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              style={{ fontSize: `${fontSize}px`, direction: 'rtl' }}
            />
          ) : (
            <div
              ref={contentRef}
              className="max-w-4xl mx-auto prose prose-lg"
              style={{ fontSize: `${fontSize}px` }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </main>

        {/* Navigation Sidebar */}
        <aside className="w-64 bg-white border-r p-4 overflow-y-auto shadow-sm">
          <h3 className="font-bold text-lg mb-4 text-gray-800">תוכן עניינים</h3>
          {toc.length === 0 ? (
            <p className="text-sm text-gray-500">אין כותרות בספר</p>
          ) : (
            <ul className="space-y-2">
              {toc.map((item, index) => (
                <li
                  key={item.id}
                  className="cursor-pointer hover:bg-gray-100 p-2 rounded transition-colors"
                  style={{ paddingRight: `${(item.level - 1) * 12}px` }}
                  onClick={() => scrollToHeading(index)}
                >
                  <span className="text-sm text-gray-700">{item.text}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {/* Tool Modals */}
      <CreateHeadersModal
        isOpen={activeTool === 'createHeaders'}
        onClose={() => setActiveTool(null)}
        bookId={bookId}
        onSuccess={refreshContent}
      />
      
      <SingleLetterHeadersModal
        isOpen={activeTool === 'singleLetterHeaders'}
        onClose={() => setActiveTool(null)}
        bookId={bookId}
        onSuccess={refreshContent}
      />
      
      <ChangeHeadingModal
        isOpen={activeTool === 'changeHeading'}
        onClose={() => setActiveTool(null)}
        bookId={bookId}
        onSuccess={refreshContent}
      />
      
      <PunctuateModal
        isOpen={activeTool === 'punctuate'}
        onClose={() => setActiveTool(null)}
        bookId={bookId}
        onSuccess={refreshContent}
      />
      
      <PageBHeaderModal
        isOpen={activeTool === 'pageBHeader'}
        onClose={() => setActiveTool(null)}
        bookId={bookId}
        onSuccess={refreshContent}
      />
      
      <ReplacePageBModal
        isOpen={activeTool === 'replacePageB'}
        onClose={() => setActiveTool(null)}
        bookId={bookId}
        onSuccess={refreshContent}
      />
      
      <HeaderErrorCheckerModal
        isOpen={activeTool === 'headerCheck'}
        onClose={() => setActiveTool(null)}
        bookId={bookId}
        onSuccess={refreshContent}
      />
      
      <TextCleanerModal
        isOpen={activeTool === 'cleanText'}
        onClose={() => setActiveTool(null)}
        bookId={bookId}
        onSuccess={refreshContent}
      />
    </div>
  )
}
