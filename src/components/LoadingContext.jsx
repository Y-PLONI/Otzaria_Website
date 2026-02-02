'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const LoadingContext = createContext(null)

export function LoadingProvider({ children }) {
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    message: ''
  })

  // פונקציה להפעלת הטעינה
  const startLoading = useCallback((message = 'מעבד נתונים...') => {
    setLoadingState({ isLoading: true, message })
  }, [])

  // פונקציה לעצירת הטעינה
  const stopLoading = useCallback(() => {
    setLoadingState(prev => ({ ...prev, isLoading: false }))
  }, [])

  return (
    <LoadingContext.Provider value={{ startLoading, stopLoading, isLoading: loadingState.isLoading }}>
      {children}

      <AnimatePresence>
        {loadingState.isLoading && (
          <motion.div 
            className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div 
              className="glass-strong px-12 py-10 rounded-3xl flex flex-col items-center shadow-2xl border border-surface-variant/50"
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              {/* ספינר כפול ומעוצב */}
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-t-primary border-r-transparent border-b-primary border-l-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-4 border-t-secondary border-r-transparent border-b-secondary border-l-transparent rounded-full animate-spin reverse-spin opacity-70" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
              </div>

              {/* הודעת הטעינה */}
              <h3 className="text-xl font-frank font-bold text-on-surface tracking-wide animate-pulse">
                {loadingState.message}
              </h3>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}