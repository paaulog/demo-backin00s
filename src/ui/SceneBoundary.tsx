import { Component, type ReactNode } from 'react';
import { useApp } from '../store/store';

/** Qualquer erro na cena 3D cai no fallback 2D em vez de derrubar a interface inteira. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[cena 3D]', error);
    useApp.getState().setWebglFailed(true);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
