import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Button } from "@/components/ui/button"

describe("Button", () => {
  it("renders its children inside a <button> by default", () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole("button", { name: "Click me" })
    expect(button).toBeInTheDocument()
    expect(button.tagName).toBe("BUTTON")
  })

  it("applies variant classes", () => {
    render(<Button variant="outline">Outlined</Button>)
    expect(screen.getByRole("button", { name: "Outlined" })).toHaveClass("border")
  })
})
