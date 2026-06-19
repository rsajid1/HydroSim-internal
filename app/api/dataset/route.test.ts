import { describe, it, expect } from "vitest"
import { normalizeCrop, parseDataset, filterRowsForCrop } from "@/lib/dataset"

// A tiny CSV with the columns the route reads, deliberately out of `day` order and
// mixing crops so the filter + sort behaviour is observable.
const CSV = [
  "simulation_id,crop_type,growth_stage,system_type,day,ph,ec,air_temperature_c,humidity_percent,co2_ppm,water_level_percent,stress_score,predicted_yield_score,risk_level,status",
  "sim_1,lettuce,vegetative,nft,20,6.0,1.2,20,60,800,85,5,94,low,stable",
  "sim_2,lettuce,seedling,dwc,5,6.1,1.1,21,58,790,86,8,90,low,stable",
  "sim_3,tomato,flowering,nft,50,6.0,2.5,25,70,900,85,10,88,low,stable",
].join("\n")

describe("normalizeCrop", () => {
  it("maps the UI id 'tomatoes' to the dataset 'tomato'", () => {
    expect(normalizeCrop("tomatoes")).toBe("tomato")
  })

  it("is case-insensitive and trims whitespace", () => {
    expect(normalizeCrop("  Lettuce ")).toBe("lettuce")
  })
})

describe("filterRowsForCrop", () => {
  const rows = parseDataset(CSV)

  it("returns only lettuce rows, sorted by day ascending", () => {
    const result = filterRowsForCrop(rows, "lettuce")
    expect(result.map(r => r.simulation_id)).toEqual(["sim_2", "sim_1"])
  })

  it("resolves the 'tomatoes' alias to tomato rows", () => {
    const result = filterRowsForCrop(rows, "tomatoes")
    expect(result.map(r => r.crop_type)).toEqual(["tomato"])
  })

  it("returns an empty array for a crop with no rows", () => {
    expect(filterRowsForCrop(rows, "herbs")).toEqual([])
  })
})
