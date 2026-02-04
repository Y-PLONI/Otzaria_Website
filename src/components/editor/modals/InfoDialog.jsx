'use client'
import { useState, useEffect } from 'react'

export default function InfoDialog({ isOpen, onClose, bookInstructions, globalInstructions }) {
  const [doNotShowAgain, setDoNotShowAgain] = useState(false)
  
  useEffect(() => {
    if (isOpen) setDoNotShowAgain(false);
  }, [isOpen]);

  if (!isOpen) return null

  const handleClose = () => {
    onClose(doNotShowAgain)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleIn">
        
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">menu_book</span>
            <span>הנחיות עריכה</span>
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* תוכן גלילה */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {bookInstructions && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                 {bookInstructions.title || 'הנחיות לספר זה'}
              </h3>

              <div className="space-y-6">
                {bookInstructions.sections?.length > 0 ? (
                  bookInstructions.sections.map((section, idx) => (
                    <div key={`book-${idx}`} className="bg-blue-50/50 rounded-lg p-4 border border-blue-100/50">
                      <h4 className="font-bold text-gray-900 mb-2">{section.title}</h4>
                      <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
                        {section.items.map((item, itemIdx) => (
                          <li key={itemIdx} className="leading-relaxed marker:text-blue-500">{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">אין הנחיות מיוחדות לספר זה.</p>
                )}
              </div>
            </div>
          )}

          {bookInstructions && globalInstructions && (
            <hr className="my-6 border-gray-200 border-dashed" />
          )}

          {globalInstructions && globalInstructions.sections?.length > 0 && (
            <div className="opacity-90">
              <h3 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-500">settings</span>
                {globalInstructions.title || 'הנחיות כלליות למערכת'}
              </h3>
              
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-4">
                {globalInstructions.sections.map((section, idx) => (
                  <div key={`global-${idx}`}>
                    {/* מציג כותרת משנה רק אם היא שונה מהכותרת הראשית */}
                    {section.title && section.title !== globalInstructions.title && (
                      <h4 className="font-semibold text-gray-700 mb-2 text-sm">{section.title}</h4>
                    )}
                    <ul className="list-disc list-inside space-y-1 text-gray-600 text-sm">
                      {section.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="leading-relaxed">{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
          <label className="flex items-center gap-2 cursor-pointer select-none group">
            <div className="relative flex items-center">
              <input 
                type="checkbox" 
                checked={doNotShowAgain}
                onChange={(e) => setDoNotShowAgain(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all"></div>
              <span className="material-symbols-outlined absolute text-white text-[16px] opacity-0 peer-checked:opacity-100 pointer-events-none left-[2px]">check</span>
            </div>
            <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">אל תציג שוב לספר זה</span>
          </label>

          <button 
            onClick={handleClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm font-medium"
          >
            אישור
          </button>
        </div>
      </div>
    </div>
  )
}