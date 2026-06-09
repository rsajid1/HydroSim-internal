'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.detail || "Login failed")
            }

            // Store tokens in localStorage
            localStorage.setItem("access_token", data.access_token)
            localStorage.setItem("id_token", data.id_token)
            localStorage.setItem("refresh_token", data.refresh_token)

            // Redirect to dashboard
            router.push("/dashboard")
        } catch (err: any) {
            setError(err.message || "An error occurred during login")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {/* Left panel */}
            <div className="flex flex-col justify-between w-1/2 bg-green-50 px-12 py-8">
                <div>
                    {/* Logo and name */}
                    <div className="flex items-center gap-3">
                        <img src="/11zon_cropped.png" alt="Hydrosim Logo" className="w-8 h-10" />
                        <span className="text-lg font-semibold text-green-700">Hydrosim Inc</span>
                    </div>
                </div>

            </div>
            {/* Right panel */}
            <div className="flex flex-col w-1/2 px-12 py-8 justify-center relative">
                {/* Login link in the top right */}
                <div className="absolute top-8 right-12 text-sm">
                    <Link href="/auth/signup" className="ml-4 text-blue-600 hover:underline">
                        Sign Up
                    </Link>
                </div>
                <div className="mx-auto w-full max-w-md">
                    <h1 className="text-2xl font-bold text-center mb-2">Login to your account</h1>
                    <p className="text-center text-gray-600 text-sm mb-6">
                        Enter your email to Login to your account
                    </p>
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-6">
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
                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Password</Label>
                                    <Link
                                        href="/auth/forgot-password"
                                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                                    >
                                        Forgot your password?
                                    </Link>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>
                        <Button
                            type="submit"
                            className="bg-lime-600 text-white w-full mt-4 mb-3 hover:bg-lime-700"
                            disabled={loading}
                        >
                            {loading ? "Logging in..." : "Login with Email"}
                        </Button>

                    </form>
                    <p className="text-center text-xs mt-6 text-gray-500">
                        By clicking continue, you agree to our <a href="#" className="underline">Terms of Service</a> and <a href="#" className="underline">Privacy Policy</a>.
                    </p>
                </div>
            </div>
        </div >
    )
}
