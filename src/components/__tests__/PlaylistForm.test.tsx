import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlaylistForm from '../PlaylistForm';

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, playlist: { _id: '123' } }),
  })
) as jest.Mock;

// Mock router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

describe('PlaylistForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  /**
   * Test rendering the form in create mode
   */
  it('renders the form in create mode', () => {
    render(<PlaylistForm mode="create" />);
    
    expect(screen.getByLabelText(/NAME/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/DESCRIPTION/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PUBLIC/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('CREATE PLAYLIST');
  });
  
  /**
   * Test rendering the form in edit mode
   */
  it('renders the form in edit mode with initial data', () => {
    const initialData = {
      id: '123',
      name: 'Test Playlist',
      description: 'Test Description',
      isPublic: true,
    };
    
    render(<PlaylistForm mode="edit" initialData={initialData} />);
    
    expect(screen.getByLabelText(/NAME/i)).toHaveValue('Test Playlist');
    expect(screen.getByLabelText(/DESCRIPTION/i)).toHaveValue('Test Description');
    expect(screen.getByLabelText(/PUBLIC/i)).toBeChecked();
    expect(screen.getByRole('button')).toHaveTextContent('UPDATE PLAYLIST');
  });
  
  /**
   * Test submitting the form in create mode
   */
  it('submits the form in create mode', async () => {
    render(<PlaylistForm mode="create" />);
    
    fireEvent.change(screen.getByLabelText(/NAME/i), {
      target: { value: 'New Playlist' },
    });
    
    fireEvent.change(screen.getByLabelText(/DESCRIPTION/i), {
      target: { value: 'New Description' },
    });
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Playlist',
          description: 'New Description',
          isPublic: true,
        }),
      });
    });
    
    expect(screen.getByText('Playlist created successfully!')).toBeInTheDocument();
  });
  
  /**
   * Test submitting the form in edit mode
   */
  it('submits the form in edit mode', async () => {
    const initialData = {
      id: '123',
      name: 'Test Playlist',
      description: 'Test Description',
      isPublic: true,
    };
    
    render(<PlaylistForm mode="edit" initialData={initialData} />);
    
    fireEvent.change(screen.getByLabelText(/NAME/i), {
      target: { value: 'Updated Playlist' },
    });
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/playlists/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: '123',
          name: 'Updated Playlist',
          description: 'Test Description',
          isPublic: true,
        }),
      });
    });
    
    expect(screen.getByText('Playlist updated successfully!')).toBeInTheDocument();
  });
  
  /**
   * Test handling form submission errors
   */
  it('handles form submission errors', async () => {
    // Override the fetch mock to return an error
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ message: 'Something went wrong' }),
      })
    );
    
    render(<PlaylistForm mode="create" />);
    
    fireEvent.change(screen.getByLabelText(/NAME/i), {
      target: { value: 'New Playlist' },
    });
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });
}); 