'use client'
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"

//UPDATE TO ROUTE COGNITO 

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage("") // clear message each time

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage(data.message || "Signup successful!")
      } else {
        setMessage(data.detail || "Something went wrong.")
      }
    } catch (err) {
      setMessage("Network error. Please try again later.")
    }
  }

  return (
    <div className="relative min-h-screen bg-green-50 flex items-center justify-center">
      <div className="absolute top-6 left-8 flex items-center gap-3">
        <img src="/11zon_cropped.png" alt="Hydrosim Logo" className="w-8 h-10" />
        <span className="text-lg font-semibold text-green-700">Hydrosim Inc</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm w-full max-w-md p-8">
        <div className="relative">
          <div className="absolute top-0 right-0 text-sm">
            <Link href="/auth/login" className="ml-4 text-blue-600 hover:underline">
              Login
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Create an account</h1>
          <p className="text-center text-gray-600 text-sm mb-6">
            Enter your email below to create your account
          </p>

          <form onSubmit={handleSubmit}>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              required
              className="mb-3"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              id="password"
              type="password"
              placeholder="Enter password"
              required
              className="mb-3"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" className="bg-lime-600 text-white w-full mb-3 hover:bg-lime-700">
              Sign Up
            </Button>
          </form>

          {message && (
            <p className="text-center text-sm text-gray-700 mt-4">{message}</p>
          )}

          <p className="text-center text-xs mt-6 text-gray-500">
            By clicking Sign Up, you agree to our{" "}
            <a href="#" className="underline">Terms of Service</a> and{" "}
            <a href="#" className="underline">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  )
}