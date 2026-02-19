'use client'

import { useState } from 'react'
import Modal from '@/components/Modal'
import FormInput from '@/components/FormInput'

export default function HeaderErrorCheckerModal({ isOpen, onClose, bookId, onSuccess }) {
  const [reStart, setReStart] = useState('')
  const [reEnd, setReEnd] = useState('')
  const [gershayim, setGershayim] = useState(false)
  const [isShas, setIsShas] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState(null)

  const handleSubmit = async () => {
    setErrors(null)
    setLoading(true)
    
    try {
      const response = await fetch('/api/dicta/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'header-error-checker',
          book_id: bookId,
          re_start: reStart,
          re_end: reEnd,
          gershayim,
          is_shas: isShas
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setErrors({ error: data.detail || 'שגיאה לא ידועה' })
        return
      }
      
      setErrors(data)
    } catch (error) {
      setErrors({ error: 'שגיאה בתקשורת עם השרת' })
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setErrors(null)
    onClose()
  }

  const hasErrors = errors && (
    (errors.unmatched_regex?.length > 0) ||
    (errors.unmatched_tags?.length > 0) ||
    (errors.opening_without_closing?.length > 0) ||
    (errors.closing_without_opening?.length > 0) ||
    (errors.heading_errors?.length > 0) ||
    (errors.missing_levels?.length > 0)
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="בדיקת שגיאות בכותרות"
      size="xl"
    >
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
          <p>כלי זה בודק שגיאות נפוצות בכותרות ובתגי HTML.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label="תווים מותרים בהתחלה"
            value={reStart}
            onChange={(e) => setReStart(e.target.value)}
            placeholder='למשל: ".(["'
          />
          
          <FormInput
            label="תווים מותרים בסוף"
            value={reEnd}
            onChange={(e) => setReEnd(e.target.value)}
            placeholder='למשל: ".])"'
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={gershayim}
              onChange={(e) => setGershayim(e.target.checked)}
              className="w-4 h-4"
            />
            <span>התעלם מכותרות עם גרשיים</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isShas}
              onChange={(e) => setIsShas(e.target.checked)}
              className="w-4 h-4"
            />
            <span>מצב ש"ס (דילוג דפים)</span>
          </label>
        </div>

        {errors?.error && (
          <div className="p-3 rounded bg-red-100 text-red-700">
            {errors.error}
          </div>
        )}

        {errors && !errors.error && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {!hasErrors ? (
              <div className="p-3 rounded bg-green-100 text-green-700">
                ✓ לא נמצאו שגיאות!
              </div>
            ) : (
              <>
                {errors.unmatched_regex?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-red-700 mb-2">כותרות לא תואמות regex ({errors.unmatched_regex.length}):</h4>
                    <ul className="text-sm space-y-1 bg-red-50 p-3 rounded max-h-40 overflow-y-auto">
                      {errors.unmatched_regex.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                )}

                {errors.unmatched_tags?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-orange-700 mb-2">כותרות לא עוקבות ({errors.unmatched_tags.length}):</h4>
                    <ul className="text-sm space-y-1 bg-orange-50 p-3 rounded max-h-40 overflow-y-auto">
                      {errors.unmatched_tags.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                )}

                {errors.opening_without_closing?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-purple-700 mb-2">תגים פתוחים ללא סגירה ({errors.opening_without_closing.length}):</h4>
                    <ul className="text-sm space-y-1 bg-purple-50 p-3 rounded max-h-40 overflow-y-auto">
                      {errors.opening_without_closing.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                )}

                {errors.closing_without_opening?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-blue-700 mb-2">תגים סוגרים ללא פתיחה ({errors.closing_without_opening.length}):</h4>
                    <ul className="text-sm space-y-1 bg-blue-50 p-3 rounded max-h-40 overflow-y-auto">
                      {errors.closing_without_opening.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                )}

                {errors.heading_errors?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-pink-700 mb-2">כותרות עם טקסט נוסף ({errors.heading_errors.length}):</h4>
                    <ul className="text-sm space-y-1 bg-pink-50 p-3 rounded max-h-40 overflow-y-auto">
                      {errors.heading_errors.map((item, i) => <li key={i}>• {item}</li>)}
                    </ul>
                  </div>
                )}

                {errors.missing_levels?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-gray-700 mb-2">רמות כותרת חסרות:</h4>
                    <p className="text-sm bg-gray-50 p-3 rounded">H{errors.missing_levels.join(', H')}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'בודק...' : 'בדוק'}
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
