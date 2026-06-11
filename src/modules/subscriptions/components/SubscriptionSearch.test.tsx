import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SubscriptionSearch from './SubscriptionSearch';

describe('SubscriptionSearch', () => {
  it('renders the input with the current value', () => {
    render(<SubscriptionSearch value="hello" onChange={jest.fn()} />);
    const input = screen.getByPlaceholderText(/Поиск по имени пользователя/) as HTMLInputElement;
    expect(input.value).toBe('hello');
  });

  it('calls onChange when user types', () => {
    const onChange = jest.fn();
    render(<SubscriptionSearch value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText(/Поиск по имени пользователя/);
    fireEvent.change(input, { target: { value: '@bob' } });
    expect(onChange).toHaveBeenCalledWith('@bob');
  });

  it('clears value when the clear button is clicked', () => {
    const onChange = jest.fn();
    render(<SubscriptionSearch value="bob" onChange={onChange} />);
    const clearBtn = screen.getByLabelText('Очистить поиск');
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('does not render the clear button when value is empty', () => {
    render(<SubscriptionSearch value="" onChange={jest.fn()} />);
    expect(screen.queryByLabelText('Очистить поиск')).not.toBeInTheDocument();
  });
});
