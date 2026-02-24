'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Button from '@/components/Button'
import { useDialog } from '@/components/DialogContext'
import CreateHeadersModal from '@/components/dicta-tools/CreateHeadersModal'
import SingleLetterHeadersModal from '@/components/dicta-tools/SingleLetterHeadersModal'
import ChangeHeadingModal from '@/components/dicta-tools/ChangeHeadingModal'
import PunctuateModal from '@/components/dicta-tools/PunctuateModal'
import PageBHeaderModal from '@/components/dicta-tools/PageBHeaderModal'
import ReplacePageBModal from '@/components/dicta-tools/ReplacePageBModal'
import HeaderErrorCheckerModal from '@/components/dicta-tools/HeaderErrorCheckerModal'
import TextCleanerModal from '@/components/dicta-tools/TextCleanerModal'
import AddPageNumberModal from '@/components/dicta-tools/AddPageNumberModal'
import ShortcutsDialog from '@/components/editor/modals/ShortcutsDialog'

const DEFAULT_SHORTCUTS = {
  'save': 'Ctrl+KeyS',
  'toggleEdit': 'Ctrl+KeyE',
  'bold': 'Ctrl+KeyB',
  'italic': 'Ctrl+KeyI',
  'underline': 'Ctrl+KeyU',
  'h1': 'Ctrl+Digit1',
  'h2': 'Ctrl+Digit2',
  'h3': 'Ctrl+Digit3',
  'fontIncrease': 'Ctrl+Equal',
  'fontDecrease': 'Ctrl+Minus',
  'alignRight': 'Ctrl+KeyR',
  'alignCenter': 'Ctrl+Shift+KeyC',
  'alignLeft': 'Ctrl+KeyL',
  'shortcuts': 'Alt+KeyK',
}

export default function DictaEditorPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { showAlert, showConfirm } = useDialog()
  const bookId = params?.bookId
  
  const currentUserId = session?.user?.id
  const isAdmin = session?.user?.role === 'admin'
  
  const [book, setBook] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [fontSize, setFontSize] = useState(18)
  const [textAlign, setTextAlign] = useState('right')
  const [toc, setToc] = useState([])
  const [activeTool, setActiveTool] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)
  const [userShortcuts, setUserShortcuts] = useState(DEFAULT_SHORTCUTS)
  const contentRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/library/auth/login')
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
        showAlert('שגיאה', 'שגיאה בטעינת הספר')
      } finally {
        setLoading(false)
      }
    }
    
    if (bookId) loadBook()
  }, [bookId, status, router, showAlert])

  useEffect(() => {
    const saved = localStorage.getItem('dicta_editor_shortcuts')
    if (saved) {
      try {
        setUserShortcuts(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse shortcuts:', e)
      }
    }
  }, [])

  const insertTag = useCallback((tag) => {
    if (!textareaRef.current) return
    
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    
    let newText
    if (selectedText) {
      newText = content.substring(0, start) + 
                `<${tag}>${selectedText}</${tag}>` + 
                content.substring(end)
    } else {
      newText = content.substring(0, start) + 
                `<${tag}></${tag}>` + 
                content.substring(end)
    }
    
    setContent(newText)
    
    setTimeout(() => {
      const newPos = start + tag.length + 2 + selectedText.length
      textarea.focus()
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }, [content])

  useEffect(() => {
    if (!content) return
    
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6')
    
    const tocItems = Array.from(headings).map((heading, index) => ({
      id: `heading-${index}`,
      level: Math.min(Math.max(parseInt(heading.tagName[1]), 1), 6),
      text: heading.textContent,
      html: heading.outerHTML
    }))
    
    setToc(tocItems)
  }, [content])

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch(`/api/dicta/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
      
      if (!res.ok) throw new Error('שגיאה בשמירה')
      showAlert('הצלחה', 'הספר נשמר בהצלחה!')
    } catch (error) {
      console.error('Error saving book:', error)
      showAlert('שגיאה', 'שגיאה בשמירת הספר')
    } finally {
      setSaving(false)
    }
  }

  const saveUserShortcuts = useCallback((newShortcuts) => {
    setUserShortcuts(newShortcuts)
    localStorage.setItem('dicta_editor_shortcuts', JSON.stringify(newShortcuts))
    showAlert('הצלחה', 'קיצורי המקלדת עודכנו בהצלחה')
  }, [showAlert])

  const actionsMap = useMemo(() => ({
    'save': { label: 'שמירה', action: handleSave },
    'toggleEdit': { label: 'מעבר בין עריכה לתצוגה', action: () => setEditMode(prev => !prev) },
    'fontIncrease': { label: 'הגדל גופן', action: () => setFontSize(prev => Math.min(32, prev + 2)) },
    'fontDecrease': { label: 'הקטן גופן', action: () => setFontSize(prev => Math.max(12, prev - 2)) },
    'alignRight': { label: 'יישור לימין', action: () => setTextAlign('right') },
    'alignCenter': { label: 'יישור למרכז', action: () => setTextAlign('center') },
    'alignLeft': { label: 'יישור לשמאל', action: () => setTextAlign('left') },
    'alignJustify': { label: 'יישור מלא', action: () => setTextAlign('justify') },
    'bold': { label: 'מודגש (B)', action: () => insertTag('b') },
    'italic': { label: 'נטוי (I)', action: () => insertTag('i') },
    'underline': { label: 'קו תחתון (U)', action: () => insertTag('u') },
    'h1': { label: 'כותרת H1', action: () => insertTag('h1') },
    'h2': { label: 'כותרת H2', action: () => insertTag('h2') },
    'h3': { label: 'כותרת H3', action: () => insertTag('h3') },
    'h4': { label: 'כותרת H4', action: () => insertTag('h4') },
    'h5': { label: 'כותרת H5', action: () => insertTag('h5') },
    'h6': { label: 'כותרת H6', action: () => insertTag('h6') },
    'bigger': { label: 'הגדל גופן טקסט', action: () => insertTag('big') },
    'smaller': { label: 'הקטן גופן טקסט', action: () => insertTag('small') },
    'createHeaders': { label: 'יצירת כותרות', action: () => setActiveTool('createHeaders') },
    'singleLetterHeaders': { label: 'כותרות אותיות', action: () => setActiveTool('singleLetterHeaders') },
    'changeHeading': { label: 'שינוי רמת כותרת', action: () => setActiveTool('changeHeading') },
    'punctuate': { label: 'הדגשה וניקוד', action: () => setActiveTool('punctuate') },
    'pageBHeader': { label: 'כותרות עמוד ב', action: () => setActiveTool('pageBHeader') },
    'replacePageB': { label: 'החלפת עמוד ב', action: () => setActiveTool('replacePageB') },
    'addPageNumber': { label: 'מיזוג דף ועמוד', action: () => setActiveTool('addPageNumber') },
    'headerCheck': { label: 'בדיקת שגיאות בכותרות', action: () => setActiveTool('headerCheck') },
    'cleanText': { label: 'ניקוי טקסט', action: () => setActiveTool('cleanText') },
    'shortcuts': { label: 'ערוך קיצורי מקלדת', action: () => setShowShortcutsDialog(true) },
  }), [handleSave, insertTag])

  const availableActions = useMemo(() => {
    return Object.entries(actionsMap).map(([id, def]) => ({
      id,
      label: def.label
    }))
  }, [actionsMap])

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (showShortcutsDialog) return

      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

      const modifiers = []
      if (e.ctrlKey) modifiers.push('Ctrl')
      if (e.altKey) modifiers.push('Alt')
      if (e.shiftKey) modifiers.push('Shift')
      if (e.metaKey) modifiers.push('Meta')
      
      const code = e.code

      const combination = [...modifiers, code].join('+')
      
      const foundActionId = Object.keys(userShortcuts).find(actionId => {
        const savedCombo = userShortcuts[actionId]
        return savedCombo === combination
      })

      if (foundActionId && actionsMap[foundActionId]) {
        e.preventDefault()
        e.stopPropagation()
        actionsMap[foundActionId].action()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
  }, [userShortcuts, actionsMap, showShortcutsDialog])

  const refreshContent = async () => {
    try {
      const res = await fetch(`/api/dicta/books/${bookId}`)
      if (!res.ok) throw new Error('שגיאה ברענון')
      const data = await res.json()
      setBook(data)
      setContent(data.content || '')
    } catch (error) {
      console.error('Error refreshing:', error)
      showAlert('שגיאה', 'שגיאה ברענון התוכן')
    }
  }

  const handleClaim = () => {
    showConfirm(
      'תפיסת ספר',
      'האם אתה בטוח שברצונך לתפוס את הספר לעריכה?',
      async () => {
        try {
          setClaiming(true)
          const res = await fetch(`/api/dicta/books/${bookId}/claim`, {
            method: 'POST',
          })
          if (res.ok) {
            await refreshContent()
            showAlert('הצלחה', 'הספר נתפס בהצלחה וכעת תוכל להתחיל לערוך אותו!')
          } else {
            showAlert('שגיאה', 'אירעה בעיה בתפיסת הספר. ייתכן שהוא נתפס על ידי משתמש אחר.')
          }
        } catch (error) {
          console.error('Error claiming book:', error)
          showAlert('שגיאה', 'אירעה שגיאה בתקשורת מול השרת.')
        } finally {
          setClaiming(false)
        }
      }
    )
  }

  const handleComplete = () => {
    showConfirm(
      'סיום עריכה',
      'האם אתה בטוח שסיימת לערוך את הספר? לאחר האישור הספר יסומן כ"הושלם".',
      async () => {
        try {
          setCompleting(true)
          const res = await fetch(`/api/dicta/books/${bookId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'complete' })
          })
          if (res.ok) {
            await refreshContent()
            showAlert('הצלחה', 'הספר סומן כהושלם בהצלחה!')
          } else {
            showAlert('שגיאה', 'אירעה בעיה בסיום עריכת הספר.')
          }
        } catch (error) {
          console.error('Error completing book:', error)
          showAlert('שגיאה', 'אירעה שגיאה בתקשורת מול השרת.')
        } finally {
          setCompleting(false)
        }
      }
    )
  }

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

  const claimedById = book?.claimedBy?._id || book?.claimedBy
  const isOwner = currentUserId && claimedById === currentUserId
  const isCompleted = book?.status === 'completed'
  const canEdit = (!isCompleted && isOwner) || isAdmin
  const isAvailable = !claimedById && !isCompleted

  return (
    <div className="flex flex-col h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            icon="arrow_forward"
            variant="ghost"
            onClick={() => router.push('/library/dicta-books')}
            label="חזרה"
          />
          <h1 className="text-2xl font-bold text-gray-800">{book.title}</h1>
          {book.status === 'in-progress' && (
            <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm">
              בעריכה
            </span>
          )}
          {book.status === 'completed' && (
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
              הושלם
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {canEdit && (
            <>
              <Button
                icon="keyboard"
                variant="ghost"
                size="sm"
                onClick={() => setShowShortcutsDialog(true)}
                label="קיצורי מקשים"
              />
              <Button
                icon={editMode ? 'visibility' : 'edit'}
                variant="ghost"
                size="sm"
                onClick={() => setEditMode(!editMode)}
                label={editMode ? 'תצוגה' : 'עריכה'}
              />
            </>
          )}

          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1 border border-gray-200 ml-2">
            <Button
              icon="format_align_right"
              variant={textAlign === 'right' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTextAlign('right')}
            />
            <Button
              icon="format_align_center"
              variant={textAlign === 'center' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTextAlign('center')}
            />
            <Button
              icon="format_align_left"
              variant={textAlign === 'left' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTextAlign('left')}
            />
            <Button
              icon="format_align_justify"
              variant={textAlign === 'justify' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTextAlign('justify')}
            />
          </div>

          <Button
            icon="remove"
            variant="ghost"
            size="sm"
            onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
          />
          <span className="text-sm font-medium w-6 text-center">{fontSize}</span>
          <Button
            icon="add"
            variant="ghost"
            size="sm"
            onClick={() => setFontSize(prev => Math.min(32, prev + 2))}
          />
          
          {isAvailable ? (
            <Button
              icon="back_hand"
              variant="primary"
              onClick={handleClaim}
              loading={claiming}
              label="תפוס לעריכה"
            />
          ) : canEdit && !isCompleted ? (
            <div className="flex gap-2">
              <Button
                icon="task_alt"
                variant="ghost"
                onClick={handleComplete}
                loading={completing}
                label="סיום"
              />
              <Button
                icon="save"
                variant="primary"
                onClick={handleSave}
                loading={saving}
                label="שמירה"
              />
            </div>
          ) : canEdit && isCompleted ? (
            <Button
              icon="save"
              variant="primary"
              onClick={handleSave}
              loading={saving}
              label="שמירה"
            />
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {canEdit && (
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
              onClick={() => setActiveTool('addPageNumber')}
              className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
              title="מיזוג דף ועמוד"
            >
              <span className="material-symbols-outlined text-gray-700">auto_stories</span>
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
        )}

        <main className="flex-1 overflow-auto bg-white">
          {editMode && canEdit ? (
            <div className="flex flex-col h-full">
              <div className="bg-gray-50 border-b px-4 py-2 flex items-center gap-2 flex-wrap">
                <Button
                  icon="format_bold"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTag('b')}
                  label="מודגש"
                />
                <Button
                  icon="format_italic"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTag('i')}
                  label="נטוי"
                />
                <Button
                  icon="format_underlined"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTag('u')}
                  label="קו תחתון"
                />
                
                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTag('h1')}
                  label="H1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTag('h2')}
                  label="H2"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTag('h3')}
                  label="H3"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTag('h4')}
                  label="H4"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTag('h5')}
                  label="H5"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTag('h6')}
                  label="H6"
                />
                
                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                
                <Button
                  icon="text_increase"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTag('big')}
                  label="גדול"
                />
                <Button
                  icon="text_decrease"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertTag('small')}
                  label="קטן"
                />
              </div>
              
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 p-6 border-0 font-mono resize-none focus:ring-0 outline-none"
                style={{ fontSize: `${fontSize}px`, direction: 'rtl', textAlign: textAlign }}
              />
            </div>
          ) : (
            <div className="p-6">
              <div
                ref={contentRef}
                className="max-w-4xl mx-auto prose prose-lg"
                style={{ fontSize: `${fontSize}px`, textAlign: textAlign }}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          )}
        </main>

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

      <AddPageNumberModal
        isOpen={activeTool === 'addPageNumber'}
        onClose={() => setActiveTool(null)}
        bookId={bookId}
        onSuccess={refreshContent}
      />

      <ShortcutsDialog
        isOpen={showShortcutsDialog}
        onClose={() => setShowShortcutsDialog(false)}
        shortcuts={userShortcuts}
        availableActions={availableActions}
        saveShortcuts={saveUserShortcuts}
        resetToDefaults={() => {
          setUserShortcuts(DEFAULT_SHORTCUTS)
          localStorage.setItem('dicta_editor_shortcuts', JSON.stringify(DEFAULT_SHORTCUTS))
          showAlert('הצלחה', 'קיצורי המקלדת אופסו')
        }}
      />
    </div>
  )
}