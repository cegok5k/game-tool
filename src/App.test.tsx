import { render, screen } from '@testing-library/react'
import { App } from './App'

test('App renders the Shell', () => {
  render(<App />)
  expect(screen.getByLabelText('Menu Bar')).toBeInTheDocument()
  expect(screen.getByLabelText('Canvas')).toBeInTheDocument()
})
