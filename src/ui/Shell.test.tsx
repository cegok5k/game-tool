import { render, screen } from '@testing-library/react'
import { Shell } from './Shell'

test('Shell renders all four zones', () => {
  render(<Shell />)
  expect(screen.getByLabelText('Menu Bar')).toBeInTheDocument()
  expect(screen.getByLabelText('Scene Tree')).toBeInTheDocument()
  expect(screen.getByLabelText('Canvas')).toBeInTheDocument()
  expect(screen.getByLabelText('Inspector')).toBeInTheDocument()
  expect(screen.getByLabelText('Bottom Tabs')).toBeInTheDocument()
})
