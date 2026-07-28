import '@testing-library/jest-dom/vitest'

// jsdom clears nothing between tests, so localStorage leaks state across
// them. Clearing here keeps store tests independent of execution order.
beforeEach(() => {
  localStorage.clear()
})
