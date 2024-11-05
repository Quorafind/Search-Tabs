import { createRoot } from 'react-dom/client';

jest.mock('react-dom/client', () => ({
  createRoot: jest.fn(() => ({
    render: jest.fn(),
  })),
}));

// Mock the Popup component
jest.mock('../Popup', () => ({
  __esModule: true,
  default: () => null,
}));

describe('Popup index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    document.body.innerHTML = '<div id="popup-root"></div>';
    require('../index');
    expect(createRoot).toHaveBeenCalled();
    expect(createRoot).toHaveBeenCalledWith(document.getElementById('popup-root'));
  });

  it('does not render when container is missing', () => {
    document.body.innerHTML = '';
    require('../index');
    expect(createRoot).not.toHaveBeenCalled();
  });
});