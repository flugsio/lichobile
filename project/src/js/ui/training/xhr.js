import { request } from '../../http';

export function attempt(id, startedAt, win) {
  return request(`/training/${id}/attempt`, {
    method: 'POST',
    data: {
      win: win ? 1 : 0,
      time: new Date().getTime() - (startedAt || new Date()).getTime()
    }
  });
}

export function vote(id, v) {
  return request(`/training/${id}/vote`, {
    method: 'POST',
    data: {
      vote: v
    }
  });
}

export function setDifficulty(d) {
  return request('/training/difficulty', {
    method: 'POST',
    data: {
      difficulty: d
    }
  });
}

export function loadPuzzle(id) {
  return request(`/training/${id}/load`, { background: true });
}

export function newPuzzle() {
  return request('/training/new', { background: true });
}

export function history() {
  return request('/training/history');
}
