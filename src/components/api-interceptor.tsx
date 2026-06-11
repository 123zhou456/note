'use client'

import { useEffect } from 'react'
import { installApiInterceptor } from '@/lib/api-handler'

export function ApiInterceptor() {
  useEffect(() => {
    installApiInterceptor()
  }, [])

  return null
}
