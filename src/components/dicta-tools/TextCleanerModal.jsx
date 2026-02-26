'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'

export default function TextCleanerModal({ isOpen, onClose, bookId, onSuccess }) {
  const [options, setOptions] = useState({
    remove_empty_lines: true,
    remove_double_spaces: true,
    remove_spaces_before: true,
    remove_spaces_after: true,
    remove_spaces_around_newlines: true,
    replace_double_quotes: true,
    normalize_quotes: true,
    clean_duplicate_tags: false
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const handleToggle = (key) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSubmit = async () => {
    setResult('')
    setLoading(true)
    
    try {
      const response = await fetch('/api/dicta/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'text-cleaner',
          book_id: bookId,
          options
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setResult(`שגיאה: ${data.detail || 'שגיאה לא ידועה'}`)
        return
      }
      
      if (data.changed) {
        setResult('הטקסט נוקה בהצלחה!')
        setTimeout(() => {
          onSuccess()
          onClose()
          setResult('')
        }, 1500)
      } else {
        setResult('לא נמצאו שינויים לביצוע')
      }
    } catch (error) {
      setResult('שגיאה בתקשורת עם השרת')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setResult('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="ניקוי טקסט"
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
          <p>כלי זה מנקה שגיאות נפוצות בטקסט כמו רווחים מיותרים, שורות ריקות וכו'.</p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="checkbox"
              checked={options.remove_empty_lines}
              onChange={() => handleToggle('remove_empty_lines')}
              className="w-4 h-4"
            />
            <span>הסרת שורות ריקות</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="checkbox"
              checked={options.remove_double_spaces}
              onChange={() => handleToggle('remove_double_spaces')}
              className="w-4 h-4"
            />
            <span>הסרת רווחים כפולים</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="checkbox"
              checked={options.remove_spaces_before}
              onChange={() => handleToggle('remove_spaces_before')}
              className="w-4 h-4"
            />
            <span>הסרת רווחים לפני פיסוק</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="checkbox"
              checked={options.remove_spaces_after}
              onChange={() => handleToggle('remove_spaces_after')}
              className="w-4 h-4"
            />
            <span>הסרת רווחים אחרי סוגריים פותחים</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="checkbox"
              checked={options.remove_spaces_around_newlines}
              onChange={() => handleToggle('remove_spaces_around_newlines')}
              className="w-4 h-4"
            />
            <span>הסרת רווחים סביב מעברי שורה</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="checkbox"
              checked={options.replace_double_quotes}
              onChange={() => handleToggle('replace_double_quotes')}
              className="w-4 h-4"
            />
            <span>החלפת גרשיים כפולים למרכאות</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="checkbox"
              checked={options.normalize_quotes}
              onChange={() => handleToggle('normalize_quotes')}
              className="w-4 h-4"
            />
            <span>אחדות מרכאות וגרשיים</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="checkbox"
              checked={options.clean_duplicate_tags}
              onChange={() => handleToggle('clean_duplicate_tags')}
              className="w-4 h-4"
            />
            <div className="flex flex-col">
              <span>נקה תגיות כפולות</span>
              <span className="text-xs text-gray-500 mr-6">(למשל &lt;b&gt;חידושים&lt;/b&gt; &lt;b&gt;על&lt;/b&gt;, לא מומלץ להפעיל לפני גמר העריכה)</span>
            </div>
          </label>
        </div>

        {result && (
          <div className={`p-3 rounded ${result.includes('שגיאה') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {result}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'מעבד...' : 'הפעל'}
          </button>
          <button
            onClick={handleClose}
            className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </Modal>
  )
}
