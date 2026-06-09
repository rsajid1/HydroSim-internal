'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send reset email')
      }

      setMessage('Reset code sent to your email. Check your inbox!')
      
      // Auto-redirect to reset page after 3s
      setTimeout(() => {
        router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`)
      }, 3000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Left panel */}
      <div className="flex flex-col justify-between w-1/2 bg-green-50 px-12 py-8">
        <div className="flex items-center gap-3">
          <img src="/11zon_cropped.png" alt="Hydrosim Logo" className="w-8 h-10" />
          <span className="text-lg font-semibold text-green-700">Hydrosim Inc</span>
        </div>
      </div>
      
      {/* Right panel */}
      <div className="flex flex-col w-1/2 px-12 py-8 justify-center">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-2">Reset Password</h1>
          <p className="text-center text-gray-600 text-sm mb-6">
            Enter your email address and we&apos;ll send you a 6-digit code to reset your password.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            <Button 
              type="submit" 
              className="bg-lime-600 text-white w-full mt-6 hover:bg-lime-700" 
              disabled={loading || !email}
            >
              {loading ? 'Sending...' : 'Send Reset Code'}
            </Button>
          </form>

          <p className="text-center text-sm mt-6">
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              ← Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
