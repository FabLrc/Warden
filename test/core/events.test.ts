import { describe, expect, it } from "vitest"
import { EventBus, event } from "../../src/core/events.js"

describe("EventBus", () => {
  it("delivers the complete event envelope in publication order", () => {
    const received: string[] = []
    const events = new EventBus()
    events.subscribe((value) => received.push(value.type))
    const value = event("s1", "session.started", {})
    events.publish(value)
    expect(value).toMatchObject({ sessionId: "s1", type: "session.started" })
    expect(value.id).toEqual(expect.any(String))
    expect(value.timestamp).toEqual(expect.any(Number))
    expect(received).toEqual(["session.started"])
  })
})
