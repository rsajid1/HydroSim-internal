import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Input } from "@/components/ui/input"

describe("Input", () => {
  it("renders with the given type and placeholder", () => {
    render(<Input type="email" placeholder="Email address" />)
    const input = screen.getByPlaceholderText("Email address")
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute("type", "email")
  })

  it("merges a custom className with the component defaults", () => {
    render(<Input placeholder="Search" className="custom-class" />)
    const input = screen.getByPlaceholderText("Search")
    expect(input).toHaveClass("custom-class")
    // a default class from the component is still applied
    expect(input).toHaveClass("w-full")
  })
})
