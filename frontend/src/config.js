export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5107';
export const HUB_URL = `${API_URL}/battleHub`;

export const VALID_AUTO_PLACEMENT = [
  [0,0], [0,1], [0,2], [0,3],
  [2,0], [2,1], [2,2],
  [4,0], [4,1], [4,2],
  [6,0], [6,1],
  [8,0], [8,1],
  [0,6], [0,7],
  [3,6],
  [5,6],
  [7,6],
  [9,6]
];